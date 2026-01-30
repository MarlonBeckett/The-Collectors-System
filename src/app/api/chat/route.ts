import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { daysUntilExpiration } from '@/lib/dateUtils';
import { ChatChoiceMetadata, ChatActionMetadata, ChatSourcesMetadata, ChatAction, VehicleFact, ChatProduct, ProductTier } from '@/types/database';

// Check if query needs product research (batteries, oil, parts, accessories)
function needsProductResearch(message: string): boolean {
  const productKeywords = [
    'battery', 'batteries', 'oil', 'filter', 'tire', 'tires', 'brake', 'brakes',
    'chain', 'sprocket', 'spark plug', 'coolant', 'fluid', 'pad', 'pads',
    'recommendation', 'recommend', 'best', 'which', 'what', 'buy', 'purchase',
    'replace', 'replacement', 'need', 'looking for', 'suggestions', 'options'
  ];
  const messageLower = message.toLowerCase();
  return productKeywords.some(keyword => messageLower.includes(keyword));
}

// Extract store name from URL
function extractStoreFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const storeMap: Record<string, string> = {
      'revzilla.com': 'RevZilla',
      'cyclegear.com': 'Cycle Gear',
      'denniskirk.com': 'Dennis Kirk',
      'jpcycles.com': 'J&P Cycles',
      'rockymountainatvmc.com': 'Rocky Mountain ATV/MC',
      'motosport.com': 'MotoSport',
      'partzilla.com': 'Partzilla',
      'chaparral-racing.com': 'Chaparral',
      'bikebandit.com': 'BikeBandit',
      'motomummy.com': 'MotoMummy',
      'mightymaxbattery.com': 'Mighty Max',
      'batteriesplus.com': 'Batteries Plus',
      'batteryclerk.com': 'Battery Clerk',
      'yuasabatteries.com': 'Yuasa',
      'shorai.com': 'Shorai',
      'motobatt.com': 'MotoBatt',
      'throttlexbatteries.com': 'ThrottleX',
      'antigravitybatteries.com': 'Antigravity',
    };
    return storeMap[hostname] || hostname.replace('.com', '').replace('.net', '');
  } catch {
    return 'Store';
  }
}

// Check if URL is a product/shopping site (motorcycle-specific retailers preferred)
function isProductUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    // Prioritize motorcycle-specific retailers - avoid general retailers with unreliable links
    const productDomains = [
      'revzilla.com', 'cyclegear.com', 'denniskirk.com', 'jpcycles.com',
      'rockymountainatvmc.com', 'motosport.com', 'partzilla.com',
      'chaparral-racing.com', 'bikebandit.com', 'motomummy.com',
      'mightymaxbattery.com', 'batteriesplus.com', 'batteryclerk.com',
      'yuasabatteries.com', 'shorai.com', 'antigravitybatteries.com',
      'motobatt.com', 'throttlexbatteries.com',
    ];
    return productDomains.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

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

// Parse PRODUCT_INFO syntax: [PRODUCT_INFO: Product Name | tier | brief description | price | optional_url]
interface ParsedProductInfo {
  name: string;
  tier: ProductTier;
  description: string;
  price: string;
  url?: string;
}

function parseProductInfoFromResponse(text: string): { cleanText: string; productInfos: ParsedProductInfo[] } {
  // Match both 4-part and 5-part (with URL) formats
  const productInfoRegex = /\[PRODUCT_INFO:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/g;
  let cleanText = text;
  const productInfos: ParsedProductInfo[] = [];

  let match;
  while ((match = productInfoRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const tierRaw = match[2].trim().toLowerCase();
    const description = match[3].trim();
    const price = match[4].trim();
    const url = match[5]?.trim();

    // Validate tier
    const validTiers = ['budget', 'mid-range', 'premium', 'oem'];
    const tier = validTiers.includes(tierRaw) ? tierRaw as ProductTier : 'mid-range';

    productInfos.push({ name, tier, description, price, url });
    cleanText = cleanText.replace(match[0], '').trim();
  }

  // Clean up any double newlines left behind
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanText, productInfos };
}

// Match AI-provided product info with grounding URLs using fuzzy matching
function matchProductsWithInfo(
  groundingProducts: Array<{ name: string; url: string; store: string }>,
  productInfos: ParsedProductInfo[]
): ChatProduct[] {
  const matchedProducts: ChatProduct[] = [];
  const usedUrls = new Set<string>();

  // Helper to extract significant words from a product name (brand names, model numbers)
  const getSignificantWords = (name: string): string[] => {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'battery', 'oil', 'filter'].includes(word));
  };

  // Try to match each AI-provided product with a grounding URL
  for (const info of productInfos) {
    // If AI provided a URL directly, use it
    if (info.url && info.url.startsWith('http')) {
      usedUrls.add(info.url);
      matchedProducts.push({
        name: info.name,
        url: info.url,
        price: info.price,
        store: extractStoreFromUrl(info.url),
        tier: info.tier,
        description: info.description,
      });
      continue;
    }

    // Otherwise, try fuzzy matching with grounding products
    const infoWords = getSignificantWords(info.name);
    let bestMatch: { name: string; url: string; store: string } | null = null;
    let bestScore = 0;

    for (const gp of groundingProducts) {
      if (usedUrls.has(gp.url)) continue;

      const gpWords = getSignificantWords(gp.name);
      // Also check the URL for product identifiers
      const urlWords = getSignificantWords(gp.url.split('/').pop() || '');
      const allGpWords = [...gpWords, ...urlWords];

      // Count matching significant words
      const matchingWords = infoWords.filter(w =>
        allGpWords.some(gw => gw.includes(w) || w.includes(gw))
      );
      const score = matchingWords.length / Math.max(infoWords.length, 1);

      if (score > bestScore && score >= 0.25) {
        bestScore = score;
        bestMatch = gp;
      }
    }

    if (bestMatch) {
      usedUrls.add(bestMatch.url);
      matchedProducts.push({
        name: info.name,
        url: bestMatch.url,
        price: info.price,
        store: bestMatch.store,
        tier: info.tier,
        description: info.description,
      });
    } else {
      // No URL match - include with empty url (will become Google Shopping search)
      matchedProducts.push({
        name: info.name,
        url: '',
        price: info.price,
        store: '',
        tier: info.tier,
        description: info.description,
      });
    }
  }

  // Add any remaining grounding products that weren't matched (without tier info)
  for (const gp of groundingProducts) {
    if (!usedUrls.has(gp.url)) {
      matchedProducts.push({
        name: gp.name,
        url: gp.url,
        store: gp.store,
      });
    }
  }

  return matchedProducts;
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

## Proactive Insights
When appropriate:
- If a vehicle hasn't had an oil change logged in 3000+ miles, mention it
- Suggest seasonal maintenance (winterization, spring prep)
- Warn about common issues for specific year/make/models
- Recommend preventive maintenance based on mileage milestones

## RESPONSE TEMPLATES - USE THESE FOR CONSISTENT OUTPUT

When responding to questions, follow the appropriate template below. These ensure consistent, complete responses.

### TEMPLATE: PRODUCT_RESEARCH (Use for: battery, oil, parts, accessories questions)

CRITICAL: Before searching, identify the EXACT vehicle from the user's message or conversation context. Search ONLY for products compatible with that specific year/make/model. Never mix up vehicles or brands.

BE CONCISE. Keep your prose to 2-3 short paragraphs max. Let the product cards do the heavy lifting.

Structure your response as:

1. VEHICLE SPEC (1 sentence): State the exact vehicle and part spec
   Example: "Your 2015 Honda CBR650F takes a HF204 oil filter."
   Example: "Your 2009 Yamaha TW200 takes a YTX5L-BS battery."

2. OPTIONS SUMMARY (1-2 paragraphs): Briefly cover key differences between tiers
   - Don't repeat details that will be in the product cards
   - Focus on the "why" of each tier, not exhaustive specs

3. RECOMMENDATION (1 sentence): Your pick and why
   Example: "For daily riding, I'd go with the Yuasa - proven and well-priced."

4. PRODUCT_INFO TAGS: Add one tag per product at the END:
   [PRODUCT_INFO: Product Name | tier | one-line benefit | $XX-XX]

   Tiers: budget, mid-range, premium, oem

IMPORTANT: Search for reviews and forum discussions too - include them as sources. Users value real-world experience from forums like tw200forum.com, advrider.com, etc.

### TEMPLATE: MAINTENANCE (Use for: oil change, tire change, how-to questions)

BE CONCISE. 2-3 paragraphs max.

1. WHAT YOU NEED (1 sentence): Parts, tools, supplies
2. KEY STEPS (1 paragraph): The essential process, conversationally
3. PRO TIP (1 sentence): Most important thing to remember
4. PRODUCT_INFO TAGS for recommended products

### TEMPLATE: TROUBLESHOOTING (Use for: won't start, running rough, strange noise)

BE CONCISE. 2-3 paragraphs max.

1. LIKELY CAUSES (ranked): Most probable first
2. QUICK DIAGNOSTIC: How to narrow it down fast
3. PRODUCT_INFO TAGS if parts needed

### TEMPLATE: COMPARISON (Use for: "X vs Y", "which is better")

BE CONCISE. 2 paragraphs max.

1. KEY DIFFERENCES: What matters between them
2. VERDICT: Clear recommendation with reasoning
3. PRODUCT_INFO TAGS for both options

## PRODUCT_INFO SYNTAX - CRITICAL

For EVERY product you mention, add this tag at the END of your response:
[PRODUCT_INFO: Full Product Name | tier | one-line benefit/description | $XX-XX | URL]

- Tiers: budget, mid-range, premium, oem
- URL: Include the FULL URL from your search results if you have one. This is important!

Examples:
[PRODUCT_INFO: Yuasa YTX5L-BS | oem | Factory original, proven reliable | $50-60 | https://www.revzilla.com/product/yuasa-ytx5l-bs]
[PRODUCT_INFO: Mighty Max YTX5L-BS | budget | Same specs, good value | $35-45]

If you don't have a real URL from search, omit the URL field (don't make one up).

The system uses these tags to create clickable product cards that link directly to retailers.

## Product Search Strategy

CRITICAL: When the user asks about a specific vehicle, you MUST search for products for THAT EXACT vehicle. Pay close attention to the year, make, and model mentioned in the conversation.

When researching products, search MULTIPLE retailers to find the best prices and availability:
1. Search: "[exact year] [exact make] [exact model] [part] site:revzilla.com" - Check RevZilla
2. Search: "[exact year] [exact make] [exact model] [part] site:cyclegear.com" - Check Cycle Gear
3. Search: "[exact year] [exact make] [exact model] [part] site:jpcycles.com" - Check J&P Cycles
4. Search: "[exact year] [exact make] [exact model] [part] site:rockymountainatvmc.com" - Check Rocky Mountain
5. Search: "[exact year] [exact make] [exact model] [part] review forum" - Find reviews and community recommendations

VEHICLE MATCHING RULES:
- If user mentions "CBR 650F" or "CBR650F", search for "Honda CBR650F" products - NOT BMW, KTM, or any other brand
- If user mentions "TW200", search for "Yamaha TW200" products only
- NEVER mix brands - a Honda filter is for Honda bikes, a BMW filter is for BMW bikes
- Double-check that search results match the EXACT vehicle being discussed
- If results seem wrong (e.g., "Honda filter for BMW"), discard them and search again with more specific terms

CRITICAL RULES FOR PRODUCT LINKS:
- ONLY use URLs from your Google Search results - NEVER make up URLs
- VERIFY the product matches the user's vehicle before recommending it
- AVOID Amazon and Walmart - their links often break. Prefer motorcycle-specific retailers.
- Search MULTIPLE retailers and include the URL with the best price in each PRODUCT_INFO tag
- If you can't find a working URL from a reputable motorcycle retailer, omit the URL (the system will provide a Google Shopping link)
- Include forum discussions and review articles in your sources

### Choice Questions
When you want to ask the user a question with specific options:
[CHOICE: Your question here? | Option 1 | Option 2 | Option 3]

### Quick Actions
When you can help the user take an action (ONLY after they confirm a purchase):
[ACTION:action_type:vehicle_name:param1=value1,param2=value2]

Supported actions:
- [ACTION:update_mileage:TW200:mileage=12500] - Update mileage
- [ACTION:log_purchase:TW200:productName=Castrol 10W-40,category=oil,brand=Castrol] - Log purchase
- [ACTION:log_maintenance:TW200:type=Oil Change,notes=Used Castrol 10W-40] - Log maintenance
- [ACTION:set_status:TW200:status=maintenance] - Change status

CRITICAL: Only use [ACTION:log_purchase:...] AFTER user explicitly says they bought something.

## Communication Rules

1. NO MARKDOWN FORMATTING in your prose:
   - No bold (**text**) or italics
   - No bullet points or numbered lists
   - No headers
   Write in plain, natural paragraphs with line breaks between them.

2. Keep responses concise - 2-4 short paragraphs max for the prose section.

3. DO NOT add a "Sources:" section - the system handles that automatically.

4. ALWAYS add [PRODUCT_INFO] tags at the end for any products you mention.

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

    // Identify which vehicle the user is asking about BEFORE making API calls
    let targetVehicle: Motorcycle | undefined;
    if (vehicles?.length) {
      const messageLower = message.toLowerCase();
      for (const v of vehicles) {
        const nameMatch = v.name.toLowerCase();
        const makeMatch = v.make?.toLowerCase() || '';
        const modelMatch = v.model?.toLowerCase() || '';
        const nicknameMatch = v.nickname?.toLowerCase() || '';

        // Check various ways user might refer to the vehicle
        if (
          messageLower.includes(nameMatch) ||
          (makeMatch && modelMatch && messageLower.includes(makeMatch) && messageLower.includes(modelMatch)) ||
          (makeMatch && messageLower.includes(makeMatch) && messageLower.includes(String(v.year))) ||
          (nicknameMatch && messageLower.includes(nicknameMatch)) ||
          // Also check for partial model matches like "cbr 650" matching "CBR 650 F"
          (modelMatch && modelMatch.split(' ').every(part => messageLower.includes(part.toLowerCase())))
        ) {
          targetVehicle = v;
          break;
        }
      }
    }

    let assistantMessage: string;
    let perplexityCitations: string[] = [];

    // Use Perplexity for product research queries, Gemini for everything else
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    const usePerplexity = perplexityApiKey && needsProductResearch(message);

    if (usePerplexity) {
      // Use Perplexity sonar-pro for product research with real-time web search
      const perplexity = new OpenAI({
        apiKey: perplexityApiKey,
        baseURL: 'https://api.perplexity.ai',
      });

      // Build an enhanced message that explicitly states the vehicle
      let enhancedMessage = message;
      if (targetVehicle) {
        const vehicleSpec = [targetVehicle.year, targetVehicle.make, targetVehicle.model].filter(Boolean).join(' ');
        enhancedMessage = `[VEHICLE CONTEXT: The user is asking about their ${vehicleSpec}. This is a ${targetVehicle.year} model - search for products specifically compatible with this EXACT year and model, NOT newer versions like 2024 or 2025 models.]\n\nUser question: ${message}`;
        console.log('Enhanced message for Perplexity:', enhancedMessage);
      }

      const perplexityResponse = await perplexity.chat.completions.create({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enhancedMessage },
        ],
      });

      assistantMessage = perplexityResponse.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';

      // Extract citations from Perplexity response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      perplexityCitations = (perplexityResponse as any).citations || [];

      console.log('Perplexity citations:', perplexityCitations);
    } else {
      // Use Gemini for non-product queries
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt + '\n\nUser: ' + message,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      assistantMessage = response.text || 'I apologize, but I was unable to generate a response. Please try again.';
    }

    // Remove any AI-generated "Sources:" section - we'll add our own formatted version
    assistantMessage = assistantMessage.replace(/\n\n(?:Sources|References|Learn more):\n[\s\S]*$/i, '');

    // Parse syntax: choices, actions, and product info
    const { cleanText: afterChoice, choiceMetadata } = parseChoiceFromResponse(assistantMessage);
    const { cleanText: afterAction, actionMetadata } = parseActionsFromResponse(afterChoice, vehicles || []);
    const { cleanText: finalText, productInfos } = parseProductInfoFromResponse(afterAction);
    assistantMessage = finalText;

    // Extract source URLs - from Perplexity citations or Gemini grounding
    const groundingProducts: Array<{ name: string; url: string; store: string }> = [];
    const infoSources: Array<{ title: string; url: string }> = [];

    // List of common vehicle brands to detect mismatched products
    const vehicleBrands = ['honda', 'yamaha', 'kawasaki', 'suzuki', 'bmw', 'ktm', 'ducati', 'harley', 'indian', 'triumph', 'aprilia', 'mv agusta', 'can-am', 'can am'];

    if (usePerplexity && perplexityCitations.length > 0) {
      // Process Perplexity citations
      for (const url of perplexityCitations) {
        if (typeof url !== 'string') continue;

        try {
          const hostname = new URL(url).hostname.replace('www.', '');

          if (isProductUrl(url)) {
            // Filter out products from wrong brands
            if (targetVehicle?.make) {
              const urlLower = url.toLowerCase();
              const targetMake = targetVehicle.make.toLowerCase();

              const mentionedBrand = vehicleBrands.find(brand =>
                urlLower.includes(brand) && brand !== targetMake && !targetMake.includes(brand)
              );

              if (mentionedBrand && !urlLower.includes(targetMake)) {
                console.log(`Filtering out mismatched product URL: ${url}`);
                continue;
              }
            }

            groundingProducts.push({
              name: 'Product',
              url,
              store: extractStoreFromUrl(url),
            });
          } else {
            infoSources.push({ title: hostname, url });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }

    // Match AI-provided product info with grounding URLs (or create products without URLs)
    const matchedProducts = matchProductsWithInfo(groundingProducts, productInfos);

    // Deduplicate products by URL (or name if no URL)
    const uniqueProducts = matchedProducts.filter(
      (p, i, self) => i === self.findIndex((x) =>
        (p.url && x.url === p.url) || (!p.url && !x.url && x.name === p.name)
      )
    ).slice(0, 8); // Allow more products for tiered display

    const uniqueSources = infoSources.filter(
      (s, i, self) => i === self.findIndex((x) => x.url === s.url)
    ).slice(0, 5);

    // Use the already-identified target vehicle for context, or try to find one
    let vehicleContext: string | undefined;
    if (targetVehicle) {
      vehicleContext = [targetVehicle.year, targetVehicle.make, targetVehicle.model].filter(Boolean).join(' ');
    } else if (vehicles?.length === 1) {
      // If only one vehicle, use it as default context
      const v = vehicles[0];
      vehicleContext = [v.year, v.make, v.model].filter(Boolean).join(' ');
    }

    // Build sources metadata if we have products or sources
    let sourcesMetadata: ChatSourcesMetadata | null = null;
    if (uniqueProducts.length > 0 || uniqueSources.length > 0) {
      sourcesMetadata = {
        type: 'sources',
        sources: uniqueSources,
        products: uniqueProducts,
        vehicleContext,
      };
    }

    // Combine metadata - prioritize choices/actions, fall back to sources
    const metadata: ChatChoiceMetadata | ChatActionMetadata | ChatSourcesMetadata | null =
      choiceMetadata || actionMetadata || sourcesMetadata;

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

    return NextResponse.json({
      message: assistantMessage,
      sessionId: currentSessionId,
      metadata,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process message', details: errorMessage },
      { status: 500 }
    );
  }
}
