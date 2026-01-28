import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { daysUntilExpiration } from '@/lib/dateUtils';
import { ChatChoiceMetadata, ChatActionMetadata, ChatAction, VehicleFact } from '@/types/database';

interface Motorcycle {
  id: string;
  name: string;
  nickname: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  vehicle_type: string | null;
  mileage: string | null;
  plate_number: string | null;
  tab_expiration: string | null;
  status: string | null;
  notes: string | null;
  maintenance_notes: string | null;
}

// Parse product syntax from AI response: [PRODUCT: name | url | price | category]
export function parseProductsFromResponse(text: string): {
  cleanText: string;
  products: Array<{ name: string; url: string; price: string; category: string }>;
} {
  const productRegex = /\[PRODUCT:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^\]]+?)\s*\]/g;
  let cleanText = text;
  const products: Array<{ name: string; url: string; price: string; category: string }> = [];

  let match;
  while ((match = productRegex.exec(text)) !== null) {
    products.push({
      name: match[1].trim(),
      url: match[2].trim(),
      price: match[3].trim(),
      category: match[4].trim(),
    });
    cleanText = cleanText.replace(match[0], '').trim();
  }

  return { cleanText, products };
}

// Parse choice syntax from AI response: [CHOICE: question | opt1 | opt2 | opt3]
function parseChoiceFromResponse(text: string): { cleanText: string; choiceMetadata: ChatChoiceMetadata | null } {
  const choiceRegex = /\[CHOICE(?:_CUSTOM)?:\s*([^|]+?)\s*\|\s*(.+?)\]/g;
  let cleanText = text;
  let choiceMetadata: ChatChoiceMetadata | null = null;

  const match = choiceRegex.exec(text);
  if (match) {
    const question = match[1].trim();
    const optionsStr = match[2];
    const options = optionsStr.split('|').map(o => o.trim()).filter(o => o.length > 0);
    const allowCustom = match[0].includes('CHOICE_CUSTOM');

    if (options.length >= 2) {
      choiceMetadata = {
        type: 'choice',
        question,
        options,
        allowCustom,
      };
      cleanText = text.replace(match[0], '').trim();
    }
  }

  return { cleanText, choiceMetadata };
}

// Parse action syntax from AI response: [ACTION:type:vehicleId:param1=value1,param2=value2]
function parseActionsFromResponse(text: string, vehicles: Motorcycle[]): { cleanText: string; actionMetadata: ChatActionMetadata | null } {
  const actionRegex = /\[ACTION:(\w+):([^:\]]*):?([^\]]*)\]/g;
  let cleanText = text;
  const actions: ChatAction[] = [];

  let match;
  while ((match = actionRegex.exec(text)) !== null) {
    const actionType = match[1] as ChatAction['actionType'];
    const vehicleRef = match[2].trim();
    const paramsStr = match[3] || '';

    // Find vehicle by name or ID
    const vehicle = vehicles.find(v =>
      v.id === vehicleRef ||
      v.name.toLowerCase() === vehicleRef.toLowerCase() ||
      v.nickname?.toLowerCase() === vehicleRef.toLowerCase()
    );

    // Parse params
    const params: Record<string, string | number> = {};
    if (paramsStr) {
      paramsStr.split(',').forEach(p => {
        const [key, value] = p.split('=').map(s => s.trim());
        if (key && value) {
          params[key] = isNaN(Number(value)) ? value : Number(value);
        }
      });
    }

    let label = '';
    switch (actionType) {
      case 'update_mileage':
        label = `Update mileage to ${params.mileage || '?'}`;
        break;
      case 'log_purchase':
        label = `Log purchase: ${params.productName || 'item'}`;
        break;
      case 'log_maintenance':
        label = `Log ${params.type || 'maintenance'}`;
        break;
      case 'set_status':
        label = `Set status to ${params.status || '?'}`;
        break;
      default:
        label = actionType;
    }

    actions.push({
      actionType,
      label,
      vehicleId: vehicle?.id,
      params,
    });

    cleanText = cleanText.replace(match[0], '').trim();
  }

  return {
    cleanText,
    actionMetadata: actions.length > 0 ? { type: 'action', actions } : null,
  };
}

// Extract facts from conversation for smart memory
function extractFactsFromConversation(
  userMessage: string,
  assistantMessage: string,
  vehicles: Motorcycle[]
): Array<{ vehicleId: string; factType: string; factKey: string; factValue: string }> {
  const facts: Array<{ vehicleId: string; factType: string; factKey: string; factValue: string }> = [];

  // Look for purchase confirmations
  const purchasePatterns = [
    /(?:bought|purchased|got|ordered|using|went with|chose)\s+(?:the\s+)?(.+?)\s+(?:for|on)\s+(?:the\s+)?(.+)/i,
    /(?:i'?m?\s+)?(?:using|running)\s+(.+?)\s+(?:in|on)\s+(?:the\s+)?(.+)/i,
  ];

  for (const pattern of purchasePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const product = match[1].trim();
      const vehicleRef = match[2].trim();

      const vehicle = vehicles.find(v =>
        v.name.toLowerCase().includes(vehicleRef.toLowerCase()) ||
        v.nickname?.toLowerCase().includes(vehicleRef.toLowerCase())
      );

      if (vehicle) {
        // Determine product type
        let factKey = 'purchase';
        if (/oil|synthetic|motor\s*oil/i.test(product)) factKey = 'preferred_oil';
        else if (/battery/i.test(product)) factKey = 'battery_brand';
        else if (/filter/i.test(product)) factKey = 'filter_brand';
        else if (/tire/i.test(product)) factKey = 'tire_brand';

        facts.push({
          vehicleId: vehicle.id,
          factType: 'preference',
          factKey,
          factValue: product,
        });
      }
    }
  }

  return facts;
}

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

    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title: message.substring(0, 50) })
        .select()
        .single();
      currentSessionId = newSession?.id;
    }

    // Get user's vehicles with detailed info for context
    // Filter by collection if specified
    let vehiclesQuery = supabase.from('motorcycles').select('*');
    if (collectionId) {
      vehiclesQuery = vehiclesQuery.eq('collection_id', collectionId);
    }
    const { data: vehicles } = await vehiclesQuery.order('name') as { data: Motorcycle[] | null };

    // Get vehicle facts for smart memory
    const { data: vehicleFacts } = await supabase
      .from('vehicle_facts')
      .select('*')
      .eq('user_id', user.id) as { data: VehicleFact[] | null };

    // Get recent purchases for context
    const { data: recentPurchases } = await supabase
      .from('vehicle_purchases')
      .select('*, motorcycles(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

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

  // Get facts for this vehicle
  const facts = vehicleFacts?.filter(f => f.vehicle_id === v.id) || [];
  const factsStr = facts.length > 0
    ? `- Known preferences: ${facts.map(f => `${f.fact_key}=${f.fact_value}`).join(', ')}`
    : '';

  return `
**${v.name}** (${v.status}) [ID: ${v.id}]
- Type: ${v.vehicle_type || 'motorcycle'}
- Year/Make/Model: ${[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Not specified'}
${v.nickname ? `- Nickname: "${v.nickname}"` : ''}
${v.mileage ? `- Mileage: ${v.mileage}` : ''}
${v.plate_number ? `- Plate: ${v.plate_number}` : ''}
- Tab status: ${tabStatus}
${v.notes ? `- Notes: ${v.notes}` : ''}
${v.maintenance_notes ? `- Maintenance notes: ${v.maintenance_notes}` : ''}
${factsStr}`;
}).join('\n')}
`;
    } else {
      collectionSummary = 'The user has no vehicles in their collection yet.';
    }

    // Build purchase history context
    let purchaseContext = '';
    if (recentPurchases?.length) {
      purchaseContext = `
### Recent Purchases
${recentPurchases.map(p => {
  const vehicleName = (p.motorcycles as { name: string } | null)?.name || 'Unknown vehicle';
  return `- ${p.product_name}${p.brand ? ` (${p.brand})` : ''} for ${vehicleName} on ${new Date(p.purchase_date).toLocaleDateString()}`;
}).join('\n')}
`;
    }

    // Build chat history context
    const historyContext = recentMessages?.reverse().map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n') || '';

    const systemPrompt = `You are an expert vehicle enthusiast and mechanic assistant for "The Collectors System" - a vehicle collection management app.

## Your Expertise
- Deep knowledge of motorcycle maintenance schedules and best practices
- Oil types, filters, and fluids for specific makes/models
- Common issues and fixes for popular vehicles
- Parts compatibility and quality brands
- Seasonal preparation and storage
- Battery types and specifications

## Your Personality & Communication
- Friendly, knowledgeable, and concise
- Reference vehicles by their name or nickname when discussing them
- Provide actionable advice, not just information
- Minimize questions - use context and educated guesses
- Only ask clarifying questions when there's genuine ambiguity (e.g., incompatible options)
- Example: "You need an air filter for your 2012 Harley" → Show Harley-specific filters (don't ask "which model?")
- Example: "Battery died" for unknown vehicle → Ask which vehicle (can't guess without context)

## Proactive Insights
When appropriate:
- If a vehicle hasn't had an oil change logged in 3000+ miles, mention it
- Suggest seasonal maintenance (winterization, spring prep)
- Warn about common issues for specific year/make/models
- Recommend preventive maintenance based on mileage milestones

## Example Flows (For Reference)

### Example 1: Direct Product Request
User: "I need a new battery for my TW200"
Your response: "Your TW200 is a Honda, so you'll want a small sealed battery. Here are some solid options: [PRODUCT: Yuasa YB9-B Battery | https://amazon.com/... | $49.99 | battery] trusted by riders for durability, or [PRODUCT: Shorai LFX14A2-BS12 | https://amazon.com/... | $99.99 | battery] if you want lithium performance. The Yuasa is a safe choice; the Shorai is lighter and better for performance builds. Which interests you?"
→ Do NOT ask "what type of battery?" - provide options with context

### Example 2: Maintenance Suggestion
User: "My Rebel is running rough"
Your response: "That could be a few things. First, when's the last time you changed the oil? Is the fuel fresh? If it's been running rough lately with no recent changes, a fuel treatment like Chevron Techron (around $5-8 at auto stores) and a fresh spark plug ($3-10) often help. Want me to find specific options for your Rebel?"
→ Provide context-specific guidance WITHOUT searching until they show interest

### Example 3: Product Search with Minimized Questions
User: "Should I get Mobil 1 or Castrol for my bike?"
Your response: "Both are excellent synthetics. Mobil 1 is slightly thinner (better cold starts), Castrol EDGE is slightly thicker (better heat protection). For your TW200, either works great. Here's what's available right now: [PRODUCT: Mobil 1 Synthetic 10W-40 | https://amazon.com/... | $12.99 | motor-oil] or [PRODUCT: Castrol EDGE 10W-40 | https://amazon.com/... | $13.99 | motor-oil]. Go with whatever's cheapest or closest to you."
→ Make a recommendation without needing choices

### Example 4: Logging a Purchase
User: "I just bought that Castrol oil you mentioned"
Your response: "Great choice! I'll log it for you. You now have a record that you used Castrol EDGE 10W-40 on your TW200. Next oil change is in 3000 miles or 6 months."
[ACTION:log_purchase:TW200:productName=Castrol EDGE 10W-40,category=motor-oil,brand=Castrol,price=13.99]
→ Only offer the action AFTER they confirm purchase

## Product Research Flow (IMPORTANT - MINIMIZE QUESTIONS)

When the user mentions products, parts, accessories, or maintenance that requires purchases:

### Question Minimization Strategy
- Use vehicle context (year, make, model) to make educated guesses about what they need
- ONLY ask clarifying questions if there's genuine ambiguity (e.g., multiple incompatible options)
- Example: User says "I need a battery for my 2023 Harley" → Don't ask "what type?" → Search for Harley batteries
- Example: User says "battery" for unknown bike → Ask "What's the year/make/model?" (if not in context)
- Example: User says "oil change" → Don't ask "what brand?" → Show Mobil/Castrol/Motul options at different prices

### Product Search & Presentation Flow

1. DETECT product intent: Words like "need", "buy", "get", "install", "replace", "fix", "recommended", "should I use"
   → Automatically use GOOGLE SEARCH to find actual products (don't ask permission)

2. FIND products with:
   - Specific product names and model numbers
   - Current prices with currency
   - Direct purchase links (Amazon, RevZilla, manufacturer, bike shops, etc.)
   - Include 3-5 options at different price points (budget to premium)

3. FORMAT products in conversation as markdown links with inline pricing:
   [Product Name](https://purchase-url.com) - $XX.XX - brief description
   Example: [Mobil 1 Synthetic 10W-40](https://amazon.com/...) - $12.99 - industry standard synthetic

   Use [PRODUCT: Product Name | https://url | $XX.XX | category] for structured tracking

4. SMART FOLLOW-UP: After showing products, only ask if they:
   - Need different options (price range, brand preference, specifications)
   - Want to log a purchase (only if they indicate they bought something)
   - Have specific questions about options shown

### Critical: Never show log_purchase action prematurely
- Only offer [ACTION:log_purchase:...] AFTER user explicitly says:
  - "I bought [product]"
  - "I'll go with [product]"
  - "Log this" / "Add to my history"
  - They confirm they made a purchase decision

## Interactive Features

### Product Listings (NEW)
When listing products found via search, use this structured format to track them:
[PRODUCT: Product Name | https://purchase-url.com | $XX.XX | category]

Example within conversation:
"For your TW200, here are some recommended oils: [PRODUCT: Castrol EDGE 10W-40 | https://amazon.com/... | $12.99 | motor-oil] for synthetic protection or [PRODUCT: Shell Rotella T4 | https://amazon.com/... | $8.99 | motor-oil] for budget."

This allows the UI to track and suggest "log this purchase" actions for specific products.

### Choice Questions
When you want to ask the user a question with specific options, use this format:
[CHOICE: Your question here? | Option 1 | Option 2 | Option 3]

Use [CHOICE_CUSTOM: ...] if you want to allow custom input.

Good examples:
- After showing products: [CHOICE: Which one interests you? | The budget option | The premium option | Show me different brands]
- Narrowing down: [CHOICE: Specific to any vehicle? | TW200 | Rebel 500 | Multiple vehicles]

### Quick Actions
When you can help the user take an action, use this format:
[ACTION:action_type:vehicle_name:param1=value1,param2=value2]

Supported actions:
- [ACTION:update_mileage:TW200:mileage=12500] - Update a vehicle's mileage
- [ACTION:log_purchase:TW200:productName=Castrol 10W-40,category=oil,brand=Castrol,price=12.99,link=https://amazon.com/...] - Log a purchase
- [ACTION:log_maintenance:TW200:type=Oil Change,notes=Used Castrol 10W-40] - Log maintenance
- [ACTION:set_status:TW200:status=maintenance] - Change vehicle status

IMPORTANT: Only show log_purchase action AFTER the user explicitly says they bought something or wants to log it. Never offer it unprompted.

## Communication Rules
- Do NOT use markdown formatting (no bold, italics, headers, bullets, or code blocks) EXCEPT for links and prices
- You CAN and SHOULD use markdown links: [Product Name](https://url.com) - $XX.XX for product links
- Write in natural sentences and paragraphs, embedding product recommendations inline
- Be concise but thorough - answer questions directly
- ALWAYS include prices when recommending products (critical for shopping decisions)
- ALWAYS include purchase links when available (format: [Name](url) - $price)
- Do NOT ask "Would you like me to find products?" → Just provide them naturally in your response

${collectionSummary}
${purchaseContext}
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

    // Parse all syntax in order: products, choices, actions
    const { cleanText: afterProducts, products } = parseProductsFromResponse(assistantMessage);
    const { cleanText: afterChoice, choiceMetadata } = parseChoiceFromResponse(afterProducts);
    const { cleanText: finalText, actionMetadata } = parseActionsFromResponse(afterChoice, vehicles || []);
    assistantMessage = finalText;

    // Combine metadata - prioritize by type
    const metadata = choiceMetadata || actionMetadata || null;

    // Store products mentioned in this response for future reference
    if (products.length > 0) {
      // We could add product logging here in the future
      // For now, just track that products were mentioned
    }

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

      const uniqueSources = sources.filter(
        (source, index, self) => index === self.findIndex((s) => s.title === source.title)
      );

      if (uniqueSources.length > 0) {
        assistantMessage += '\n\nSources:\n' + uniqueSources
          .slice(0, 5)
          .map((s) => `[${s.title}](${s.url})`)
          .join('\n');
      }
    }

    // Extract and save facts from the conversation
    const extractedFacts = extractFactsFromConversation(message, assistantMessage, vehicles || []);
    for (const fact of extractedFacts) {
      await supabase.from('vehicle_facts').upsert({
        user_id: user.id,
        vehicle_id: fact.vehicleId,
        fact_type: fact.factType,
        fact_key: fact.factKey,
        fact_value: fact.factValue,
        source_session_id: currentSessionId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'vehicle_id,fact_key',
      });
    }

    // Save assistant message with metadata
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      session_id: currentSessionId,
      role: 'assistant',
      content: assistantMessage,
      metadata,
    });

    // Update session timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentSessionId);

    return NextResponse.json({ message: assistantMessage, sessionId: currentSessionId, metadata });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process message', details: errorMessage },
      { status: 500 }
    );
  }
}
