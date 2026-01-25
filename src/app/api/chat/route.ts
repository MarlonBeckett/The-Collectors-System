import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { daysUntilExpiration } from '@/lib/dateUtils';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'Chat service not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, sessionId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      // Create a new session
      const { data: newSession } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title: message.substring(0, 50) })
        .select()
        .single();
      currentSessionId = newSession?.id;
    }

    // Get user's vehicles with detailed info for context
    const { data: vehicles } = await supabase
      .from('motorcycles')
      .select('*')
      .order('name');

    // Get recent chat history for this session
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Build detailed collection summary
    let collectionSummary = '';
    if (vehicles?.length) {
      const activeVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'maintenance');
      const soldVehicles = vehicles.filter(v => v.status === 'sold' || v.status === 'traded');

      // Find vehicles needing attention
      const needsMaintenance = vehicles.filter(v => v.status === 'maintenance');
      const expiringTabs = activeVehicles.filter(v => {
        const days = daysUntilExpiration(v.tab_expiration);
        return days !== null && days <= 30;
      });
      const expiredTabs = activeVehicles.filter(v => {
        const days = daysUntilExpiration(v.tab_expiration);
        return days !== null && days < 0;
      });

      collectionSummary = `
## USER'S VEHICLE COLLECTION

### Overview
- Total vehicles: ${vehicles.length}
- Active vehicles: ${activeVehicles.length}
- Sold/traded: ${soldVehicles.length}

### Vehicles Needing Attention
${expiredTabs.length > 0 ? `- EXPIRED TABS (${expiredTabs.length}): ${expiredTabs.map(v => v.name).join(', ')}` : '- No expired tabs'}
${expiringTabs.length > 0 ? `- Tabs expiring soon (${expiringTabs.length}): ${expiringTabs.map(v => v.name).join(', ')}` : ''}
${needsMaintenance.length > 0 ? `- Needs maintenance (${needsMaintenance.length}): ${needsMaintenance.map(v => `${v.name}${v.maintenance_notes ? ` (${v.maintenance_notes})` : ''}`).join(', ')}` : '- No maintenance needed'}

### Vehicle Details
${vehicles.map(v => {
  const tabDays = daysUntilExpiration(v.tab_expiration);
  const tabStatus = tabDays === null ? 'No expiration set' :
    tabDays < 0 ? `EXPIRED ${Math.abs(tabDays)} days ago` :
    tabDays <= 30 ? `Expires in ${tabDays} days` : `Valid (${tabDays} days)`;

  return `
**${v.name}** (${v.status})
- Type: ${v.vehicle_type || 'motorcycle'}
- Year/Make/Model: ${[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Not specified'}
${v.nickname ? `- Nickname: "${v.nickname}"` : ''}
${v.mileage ? `- Mileage: ${v.mileage}` : ''}
${v.plate_number ? `- Plate: ${v.plate_number}` : ''}
- Tab status: ${tabStatus}
${v.notes ? `- Notes: ${v.notes}` : ''}
${v.maintenance_notes ? `- Maintenance notes: ${v.maintenance_notes}` : ''}`;
}).join('\n')}
`;
    } else {
      collectionSummary = 'The user has no vehicles in their collection yet.';
    }

    // Build chat history context
    const historyContext = recentMessages?.reverse().map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n') || '';

    const systemPrompt = `You are a helpful assistant for a vehicle collection management app called "The Collectors System".
You help users manage their motorcycles, cars, boats, trailers, and other vehicles.
You have access to their complete collection data below and can provide personalized insights, recommendations, and answers.

Key capabilities:
- Provide specific information about any vehicle in their collection
- Alert about upcoming tab expirations or overdue maintenance
- Suggest maintenance schedules based on mileage and vehicle type
- Provide general vehicle care advice
- Research parts, accessories, and maintenance info using Google Search when asked about specific products or recommendations for their vehicles (use the year/make/model from their collection data)

Be friendly, concise, and helpful. Reference specific vehicles by name when relevant.
Use the detailed data below to give personalized, accurate responses.

IMPORTANT: Do NOT use any markdown formatting in your responses. No bold, italics, headers, bullet points, or code blocks. Write in plain text only using regular sentences and paragraphs.

${collectionSummary}

${historyContext ? `\n### Recent Conversation\n${historyContext}\n` : ''}`;

    // Save user message
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      session_id: currentSessionId,
      role: 'user',
      content: message,
    });

    // Call Gemini API with Google Search grounding for research questions
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt + '\n\nUser: ' + message,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let assistantMessage = response.text || 'I apologize, but I was unable to generate a response. Please try again.';

    // Extract source URLs from grounding metadata if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks?.length) {
      const sources = groundingMetadata.groundingChunks
        .filter((chunk: { web?: { uri?: string; title?: string } }) => chunk.web?.uri)
        .map((chunk: { web?: { uri?: string; title?: string } }) => ({
          url: chunk.web!.uri,
          title: chunk.web!.title || new URL(chunk.web!.uri!).hostname.replace('www.', ''),
        }));

      // Deduplicate by title/domain
      const uniqueSources = sources.filter(
        (source: { url: string; title: string }, index: number, self: { url: string; title: string }[]) =>
          index === self.findIndex((s) => s.title === source.title)
      );

      if (uniqueSources.length > 0) {
        assistantMessage += '\n\nSources:\n' + uniqueSources
          .slice(0, 5) // Limit to 5 sources
          .map((s: { url: string; title: string }) => `[${s.title}](${s.url})`)
          .join('\n');
      }
    }

    // Save assistant message
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      session_id: currentSessionId,
      role: 'assistant',
      content: assistantMessage,
    });

    // Update session title if it's a new session (use first message as title)
    if (!sessionId && currentSessionId) {
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentSessionId);
    }

    return NextResponse.json({ message: assistantMessage, sessionId: currentSessionId });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process message', details: errorMessage },
      { status: 500 }
    );
  }
}
