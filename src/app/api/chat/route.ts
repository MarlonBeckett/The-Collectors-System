import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { daysUntilExpiration } from '@/lib/dateUtils';
import { findVehicleContext } from '@/lib/chat/intentClassifier';
import {
  performDiscoveryPhase,
  performProductFindingPhase,
  formatDiscoveryResponse,
} from '@/lib/chat/researchOrchestrator';
import { ResearchResult, ResearchState, DiscoveryResult } from '@/types/research';

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

    const { message, sessionId, collectionId, researchMode } = await request.json();

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

    // Research mode handling
    let researchResult: ResearchResult | null = null;
    let discoveryResult: DiscoveryResult | null = null;
    let foundVehicleContext: {
      id: string;
      name: string;
      vehicleType: string;
      year: number | null;
      make: string | null;
      model: string | null;
      nickname: string | null;
    } | null = null;
    let researchState: ResearchState | null = null;

    // Build vehicle list for context matching
    const vehicleList = vehicles?.map(v => ({
      id: v.id,
      name: v.name,
      vehicle_type: v.vehicle_type,
      year: v.year,
      make: v.make,
      model: v.model,
      nickname: v.nickname,
    })) || [];

    if (researchMode && apiKey) {
      // Find vehicle context from current message or chat history
      let vehicleContext = findVehicleContext(message, vehicleList);
      if (!vehicleContext && recentMessages?.length) {
        for (const msg of recentMessages) {
          vehicleContext = findVehicleContext(msg.content, vehicleList);
          if (vehicleContext) break;
        }
      }
      if (vehicleContext) {
        foundVehicleContext = vehicleContext;
      }

      // Check if we're in the middle of a research flow by looking at recent messages
      const lastAssistantMessage = recentMessages?.find(m => m.role === 'assistant');
      const lastResearchState = lastAssistantMessage?.metadata?.researchState as ResearchState | undefined;

      // Determine current phase based on context
      if (lastResearchState?.phase === 'discovery') {
        // User responded to discovery - this should be product finding phase
        console.log('Research: Product finding phase triggered');
        researchState = {
          phase: 'product_finding',
          productCategory: lastResearchState.productCategory,
          vehicleId: foundVehicleContext?.id,
          discoveryResult: lastResearchState.discoveryResult,
          userPreferences: message, // User's refinement (e.g., "lithium options")
        };

        try {
          researchResult = await performProductFindingPhase(
            lastResearchState.productCategory || message,
            message,
            foundVehicleContext || undefined,
            lastResearchState.discoveryResult || undefined,
            apiKey
          );
          console.log('Product finding result:', researchResult?.recommendations?.length, 'recommendations');
        } catch (error) {
          console.error('Product finding failed:', error);
        }
      } else {
        // First research message - run discovery phase
        console.log('Research: Discovery phase triggered for:', message);
        researchState = {
          phase: 'discovery',
          productCategory: message,
          vehicleId: foundVehicleContext?.id,
        };

        try {
          discoveryResult = await performDiscoveryPhase(
            message,
            foundVehicleContext || undefined,
            apiKey
          );
          researchState.discoveryResult = discoveryResult;
          console.log('Discovery result:', discoveryResult);
        } catch (error) {
          console.error('Discovery phase failed:', error);
        }
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

    // Handle discovery phase response
    if (discoveryResult && researchState?.phase === 'discovery') {
      assistantMessage = formatDiscoveryResponse(discoveryResult, foundVehicleContext || undefined);

      responseMetadata = {
        type: 'discovery',
        discoveryResult,
        vehicleContext: foundVehicleContext,
        researchState,
      };
    }
    // Handle product finding phase response
    else if (researchResult && researchResult.recommendations.length > 0) {
      // Build response text for product recommendations
      const vehicleStr = foundVehicleContext
        ? [foundVehicleContext.year, foundVehicleContext.make, foundVehicleContext.model].filter(Boolean).join(' ')
        : null;

      let response = vehicleStr
        ? `Here are my top recommendations for your ${vehicleStr}:\n\n`
        : 'Here are my top recommendations:\n\n';

      researchResult.recommendations.forEach((rec, index) => {
        response += `${index + 1}. ${rec.name || 'Unknown Product'}`;
        if (rec.price && typeof rec.price.amount === 'number') {
          response += ` ($${rec.price.amount.toFixed(2)})`;
        }
        response += '\n';
        if (rec.reasoning) {
          response += `   ${rec.reasoning}\n`;
        }
        const pros = Array.isArray(rec.pros) ? rec.pros : [];
        const cons = Array.isArray(rec.cons) ? rec.cons : [];
        if (pros.length > 0) {
          response += `   Pros: ${pros.slice(0, 3).join(', ')}\n`;
        }
        if (cons.length > 0) {
          response += `   Cons: ${cons.slice(0, 2).join(', ')}\n`;
        }
        response += '\n';
      });

      assistantMessage = response;

      responseMetadata = {
        type: 'product_research',
        researchResult,
        vehicleContext: foundVehicleContext,
        researchState,
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

    // Generate AI title for new sessions (fire and forget)
    if (!sessionId && currentSessionId) {
      const sessionIdForTitle = currentSessionId;
      (async () => {
        try {
          const titleResult = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Generate a concise 3-6 word title for this chat. No quotes or punctuation. Just the title.

User: ${message.substring(0, 200)}
Assistant: ${assistantMessage.substring(0, 200)}`,
          });
          const title = titleResult.text?.trim().substring(0, 100) || message.substring(0, 50);
          await supabase
            .from('chat_sessions')
            .update({ title, updated_at: new Date().toISOString() })
            .eq('id', sessionIdForTitle);
        } catch (e) {
          console.error('Title generation failed:', e);
        }
      })();
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
