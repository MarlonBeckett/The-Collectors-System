import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { daysUntilExpiration } from '@/lib/dateUtils';
import { classifyIntentFast, findVehicleContext } from '@/lib/chat/intentClassifier';
import { performResearch, formatResearchResponse } from '@/lib/chat/researchOrchestrator';
import { ResearchResult } from '@/types/research';

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

    const { message, sessionId, collectionId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!collectionId) {
      return NextResponse.json({ error: 'Collection is required' }, { status: 400 });
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

    // Get user's vehicles with detailed info for context (filtered by collection)
    const { data: vehicles } = await supabase
      .from('motorcycles')
      .select('*')
      .eq('collection_id', collectionId)
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

    // Classify intent to determine if this needs deep product research
    const intent = classifyIntentFast(message);

    // Check for TAVILY_API_KEY for product research
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    const canDoResearch = intent === 'product_research' && tavilyApiKey;

    // If product research, find vehicle context and perform research
    let researchResult: ResearchResult | null = null;
    let foundVehicleContext: {
      id: string;
      name: string;
      vehicleType: string;
      year: number | null;
      make: string | null;
      model: string | null;
      nickname: string | null;
    } | null = null;

    if (canDoResearch && vehicles?.length) {
      // Try to find which vehicle the user is asking about
      // First check the current message, then check recent chat history
      const vehicleList = vehicles.map(v => ({
        id: v.id,
        name: v.name,
        vehicle_type: v.vehicle_type,
        year: v.year,
        make: v.make,
        model: v.model,
        nickname: v.nickname,
      }));

      let vehicleContext = findVehicleContext(message, vehicleList);

      // If not found in current message, check recent messages for context
      if (!vehicleContext && recentMessages?.length) {
        for (const msg of recentMessages) {
          vehicleContext = findVehicleContext(msg.content, vehicleList);
          if (vehicleContext) break;
        }
      }

      try {
        // Build search query - include previous product context for follow-up queries
        let searchQuery = message;
        let previousProducts: string[] = [];
        const isFollowUp = /other|more|else|different|alternative/i.test(message.toLowerCase());

        if (isFollowUp && recentMessages?.length) {
          // Find the original product query from chat history
          for (const msg of recentMessages) {
            if (msg.role === 'user' && /battery|tire|oil|part|accessory/i.test(msg.content)) {
              // Modify the query to find alternatives
              searchQuery = msg.content + ' alternative options budget premium';
              break;
            }
          }

          // Extract product names from previous assistant responses to deprioritize them
          for (const msg of recentMessages) {
            if (msg.role === 'assistant') {
              // Match product names like "1. Product Name" or numbered products
              const productMatches = msg.content.match(/^\d+\.\s+(.+?)(?:\n|$)/gm);
              if (productMatches) {
                for (const match of productMatches) {
                  const name = match.replace(/^\d+\.\s+/, '').trim();
                  if (name.length > 5) {
                    previousProducts.push(name);
                  }
                }
              }
            }
          }
        }

        console.log('Starting product research for:', searchQuery);
        console.log('Vehicle context:', vehicleContext);
        console.log('Previously shown products:', previousProducts);
        researchResult = await performResearch(searchQuery, vehicleContext, apiKey, previousProducts);
        console.log('Research result:', researchResult?.recommendations?.length, 'recommendations');
        if (vehicleContext) {
          foundVehicleContext = vehicleContext;
        }
      } catch (error) {
        console.error('Research failed, falling back to standard chat:', error);
        // Continue with standard Gemini flow on research failure
      }
    }

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

    let assistantMessage: string;
    let responseMetadata: Record<string, unknown> | null = null;

    // If we have research results, format them and use Gemini to create a natural response
    if (researchResult && researchResult.recommendations.length > 0) {
      // Format the research response with full vehicle context
      assistantMessage = formatResearchResponse(researchResult, foundVehicleContext || undefined);

      // Store research metadata for UI rendering
      responseMetadata = {
        type: 'product_research',
        researchResult,
        vehicleContext: foundVehicleContext,
      };
    } else {
      // Standard Gemini flow for quick questions and general chat
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt + '\n\nUser: ' + message,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      assistantMessage = response.text || 'I apologize, but I was unable to generate a response. Please try again.';

      // Extract source URLs from grounding metadata if available
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks?.length) {
        const sources: { url: string; title: string }[] = [];

        for (const chunk of groundingMetadata.groundingChunks) {
          const webChunk = chunk as { web?: { uri?: string; title?: string } };
          if (webChunk.web?.uri) {
            const url = webChunk.web.uri;
            let title = webChunk.web.title;
            if (!title) {
              try {
                title = new URL(url).hostname.replace('www.', '');
              } catch {
                title = 'Link';
              }
            }
            sources.push({ url, title });
          }
        }

        // Deduplicate by title/domain
        const uniqueSources = sources.filter(
          (source, index, self) => index === self.findIndex((s) => s.title === source.title)
        );

        if (uniqueSources.length > 0) {
          assistantMessage += '\n\nSources:\n' + uniqueSources
            .slice(0, 5) // Limit to 5 sources
            .map((s) => `[${s.title}](${s.url})`)
            .join('\n');
        }
      }
    }

    // Save assistant message with metadata
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      session_id: currentSessionId,
      role: 'assistant',
      content: assistantMessage,
      metadata: responseMetadata,
    });

    // Update session title if it's a new session (use first message as title)
    if (!sessionId && currentSessionId) {
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentSessionId);
    }

    // Return response with optional metadata for rich rendering
    const responseBody: {
      message: string;
      sessionId: string | undefined;
      metadata?: Record<string, unknown>;
    } = {
      message: assistantMessage,
      sessionId: currentSessionId,
    };

    if (responseMetadata) {
      responseBody.metadata = responseMetadata;
      console.log('Returning response with metadata, recommendations count:',
        (responseMetadata.researchResult as ResearchResult)?.recommendations?.length);
    } else {
      console.log('Returning response WITHOUT metadata');
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process message', details: errorMessage },
      { status: 500 }
    );
  }
}
