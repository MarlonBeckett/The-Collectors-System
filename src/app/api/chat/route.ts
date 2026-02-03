import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { daysUntilExpiration } from '@/lib/dateUtils';
import {
  executeAllToolsForVehicle,
  isProductQuery,
  extractProductQuery,
  RetailerProduct,
  VehicleContext,
} from '@/lib/chat/tools';
import { ProductRecommendation } from '@/types/research';

// Find which vehicle the user is asking about
function findVehicleContext(
  message: string,
  vehicles: Array<{
    id: string;
    name: string;
    vehicle_type: string;
    year: number | null;
    make: string | null;
    model: string | null;
    nickname: string | null;
  }>
): VehicleContext | null {
  if (!vehicles.length) return null;

  const searchTerm = message.toLowerCase();

  // Try exact name match first
  let match = vehicles.find(
    (v) =>
      v.name.toLowerCase() === searchTerm || v.nickname?.toLowerCase() === searchTerm
  );

  // Try exact model match (most specific)
  if (!match) {
    match = vehicles.find(
      (v) => v.model && searchTerm.includes(v.model.toLowerCase())
    );
  }

  // Try nickname partial match
  if (!match) {
    match = vehicles.find(
      (v) =>
        v.nickname?.toLowerCase() && searchTerm.includes(v.nickname.toLowerCase())
    );
  }

  // Try name contains search term or vice versa
  if (!match) {
    match = vehicles.find(
      (v) =>
        v.name.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(v.name.toLowerCase())
    );
  }

  // Try make + model combination in search term
  if (!match) {
    match = vehicles.find((v) => {
      if (v.make && v.model) {
        const makeModel = `${v.make} ${v.model}`.toLowerCase();
        return (
          searchTerm.includes(makeModel) ||
          searchTerm.includes(`${v.make.toLowerCase()} ${v.model.toLowerCase()}`)
        );
      }
      return false;
    });
  }

  // Last resort: make-only match, but only if there's exactly one vehicle of that make
  if (!match) {
    const makeMatches = vehicles.filter(
      (v) => v.make && searchTerm.includes(v.make.toLowerCase())
    );
    if (makeMatches.length === 1) {
      match = makeMatches[0];
    }
  }

  // If still no match and there's only one vehicle, use it
  if (!match && vehicles.length === 1) {
    match = vehicles[0];
  }

  if (match) {
    return {
      id: match.id,
      name: match.name,
      vehicleType: match.vehicle_type || 'motorcycle',
      year: match.year,
      make: match.make,
      model: match.model,
      nickname: match.nickname,
    };
  }

  return null;
}

// Convert retailer products to product recommendations with AI analysis
async function analyzeProducts(
  products: RetailerProduct[],
  userQuery: string,
  vehicleContext: VehicleContext | null,
  ai: GoogleGenAI
): Promise<ProductRecommendation[]> {
  if (products.length === 0) return [];

  // If we have few products, skip AI analysis and return directly
  if (products.length <= 3) {
    return products.map((p) => ({
      name: p.name,
      brand: p.brand,
      price: p.price,
      currency: p.currency,
      url: p.url,
      imageUrl: p.imageUrl,
      rating: p.rating,
      reviewCount: p.reviewCount,
      inStock: p.inStock,
      retailer: p.retailer,
      fitmentVerified: p.fitmentVerified,
    }));
  }

  const vehicleInfo = vehicleContext
    ? `User's vehicle: ${[vehicleContext.year, vehicleContext.make, vehicleContext.model]
        .filter(Boolean)
        .join(' ')} (${vehicleContext.vehicleType})`
    : 'No specific vehicle context';

  const productList = products
    .slice(0, 30) // Limit to 30 products for analysis
    .map(
      (p, i) =>
        `[${i + 1}] ${p.name} - ${p.brand} - $${p.price} - Rating: ${p.rating || 'N/A'} (${p.reviewCount || 0} reviews) - ${p.retailer}`
    )
    .join('\n');

  const prompt = `You are a motorcycle parts expert analyzing product search results.

${vehicleInfo}
User's query: "${userQuery}"

Products found from retailer search:
${productList}

YOUR TASK: Use your knowledge to identify which products ACTUALLY FIT this specific vehicle.

For batteries: You must know the OEM battery size for this vehicle. Common sizes include YTX5L-BS, YTX7L-BS, YTZ7S, YTZ10S, etc.
For tires: Know the stock tire sizes for this vehicle.
For other parts: Know if the part is model-specific or universal.

IMPORTANT: If you don't know the exact specification for this vehicle, say so honestly. Don't guess.

From the product list, identify ONLY the products that:
1. Match the correct specification for this vehicle (e.g., correct battery size)
2. Are compatible equivalents (e.g., lithium batteries that replace specific AGM sizes)

Respond in JSON format:
{
  "vehicleSpec": "The correct specification for this vehicle (e.g., 'YTX5L-BS battery' or 'unknown')",
  "rankings": [
    {
      "index": 1,
      "reasoning": "Why this SPECIFIC product fits - cite the specification match",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1"]
    }
  ]
}

Rules:
- If you don't know the correct spec, set vehicleSpec to "unknown" and return empty rankings
- ONLY include products that match the correct specification
- If a product name contains a battery code like "YTX5L" and that matches the vehicle spec, include it
- Be specific about WHY a product fits - don't just say "likely fits"
- Maximum 10 recommendations`;

  try {
    // AI analysis without Google Search (can't combine with JSON response)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);
    const rankings = parsed.rankings || [];
    const vehicleSpec = parsed.vehicleSpec || 'unknown';

    console.log(`AI determined vehicle spec: ${vehicleSpec}`);
    console.log(`AI found ${rankings.length} matching products`);

    // If AI couldn't determine spec or found no matches, return empty
    if (vehicleSpec === 'unknown' || rankings.length === 0) {
      console.log('AI could not determine fitment - returning only verified matches');
    }

    // Convert products to recommendations with analysis
    const recommendations: ProductRecommendation[] = [];

    // Only add products that AI confirmed as fitting
    for (const r of rankings) {
      const product = products[r.index - 1];
      if (!product) continue;

      recommendations.push({
        name: product.name,
        brand: product.brand,
        price: product.price,
        currency: product.currency,
        url: product.url,
        imageUrl: product.imageUrl,
        rating: product.rating,
        reviewCount: product.reviewCount,
        inStock: product.inStock,
        retailer: product.retailer,
        fitmentVerified: true, // AI confirmed this fits
        reasoning: r.reasoning,
        pros: r.pros || [],
        cons: r.cons || [],
      });
    }

    return recommendations;
  } catch (error) {
    console.error('Error analyzing products:', error);
    // Return empty on error - we don't want to show unverified products
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Chat service not configured' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      const activeVehicles = vehicles.filter(
        (v) => v.status === 'active' || v.status === 'maintenance'
      );
      const soldVehicles = vehicles.filter(
        (v) => v.status === 'sold' || v.status === 'traded'
      );

      // Find vehicles needing attention
      const needsMaintenance = vehicles.filter((v) => v.status === 'maintenance');
      const expiringTabs = activeVehicles.filter((v) => {
        const days = daysUntilExpiration(v.tab_expiration);
        return days !== null && days <= 30;
      });
      const expiredTabs = activeVehicles.filter((v) => {
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
${expiredTabs.length > 0 ? `- EXPIRED TABS (${expiredTabs.length}): ${expiredTabs.map((v) => v.name).join(', ')}` : '- No expired tabs'}
${expiringTabs.length > 0 ? `- Tabs expiring soon (${expiringTabs.length}): ${expiringTabs.map((v) => v.name).join(', ')}` : ''}
${needsMaintenance.length > 0 ? `- Needs maintenance (${needsMaintenance.length}): ${needsMaintenance.map((v) => `${v.name}${v.maintenance_notes ? ` (${v.maintenance_notes})` : ''}`).join(', ')}` : '- No maintenance needed'}

### Vehicle Details
${vehicles
  .map((v) => {
    const tabDays = daysUntilExpiration(v.tab_expiration);
    const tabStatus =
      tabDays === null
        ? 'No expiration set'
        : tabDays < 0
          ? `EXPIRED ${Math.abs(tabDays)} days ago`
          : tabDays <= 30
            ? `Expires in ${tabDays} days`
            : `Valid (${tabDays} days)`;

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
  })
  .join('\n')}
`;
    } else {
      collectionSummary = 'The user has no vehicles in their collection yet.';
    }

    // Build chat history context
    const historyContext =
      recentMessages
        ?.reverse()
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n') || '';

    // Save user message
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      session_id: currentSessionId,
      role: 'user',
      content: message,
    });

    let assistantMessage: string;
    let responseMetadata: Record<string, unknown> | null = null;

    // Check if this is a product search query
    if (isProductQuery(message) && vehicles?.length) {
      // Find vehicle context from message or chat history
      const vehicleList = vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        vehicle_type: v.vehicle_type || 'motorcycle',
        year: v.year,
        make: v.make,
        model: v.model,
        nickname: v.nickname,
      }));

      let vehicleContext = findVehicleContext(message, vehicleList);

      // If not found in current message, check recent messages
      if (!vehicleContext && recentMessages?.length) {
        for (const msg of recentMessages) {
          vehicleContext = findVehicleContext(msg.content, vehicleList);
          if (vehicleContext) break;
        }
      }

      const productQuery = extractProductQuery(message);
      const vehicleType = vehicleContext?.vehicleType || 'motorcycle';
      const vehicleStr = vehicleContext
        ? [vehicleContext.year, vehicleContext.make, vehicleContext.model]
            .filter(Boolean)
            .join(' ')
        : '';

      console.log('Product search detected:', {
        query: productQuery,
        vehicleType,
        vehicleContext: vehicleStr || 'none',
      });

      // Step 1: Ask AI to find the EXACT compatible part specifications for this vehicle
      let searchQueries: string[] = [productQuery];
      if (vehicleContext) {
        console.log('Looking up compatible part specs for', vehicleStr);
        try {
          const specResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents:
              `What is the OEM ${productQuery} specification for a ${vehicleStr}?\n\n` +
              `For batteries: What is the EXACT OEM battery code? (e.g., YB7C-A, YTX5L-BS)\n` +
              `Also list any direct replacement/equivalent codes that can be found in product names.\n\n` +
              `IMPORTANT: Only list codes that would appear IN THE PRODUCT NAME on retail sites.\n` +
              `Do NOT list OEM Yamaha/Honda part numbers - only universal battery codes.\n\n` +
              `Respond with ONLY a comma-separated list of 2-5 codes, nothing else.\n` +
              `Example: "YB7C-A, CB7C-A" or "YTX5L-BS, YTZ5S"`,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });
          const specText = specResponse.text?.trim() || '';
          // Parse comma-separated specs - only keep codes that look like battery/tire specs
          const specs = specText
            .split(/[,\n]/)
            .map(s => s.trim())
            .filter(s => {
              if (!s || s.length > 20 || s.length < 3) return false;
              // Battery code patterns:
              // - Standard: YB7C-A, YTX5L-BS, YTZ7S, CB7C-A
              // - Lithium: DBL5L, BMP7L-FP, DLFP-7L-BS
              // Allow: starts with letters, has digits, may have dashes and suffix letters
              const isBatteryCode = /^[A-Z]{1,4}[\dA-Z-]{2,12}$/i.test(s);
              // Tire pattern: numbers/letters with slashes (e.g., 130/80-17)
              const isTireSize = /^\d{2,3}\/\d{2,3}[-]?\d{2}$/.test(s);
              return isBatteryCode || isTireSize;
            });
          if (specs.length > 0 && specs.length <= 10) {
            searchQueries = specs;
            console.log(`AI found ${specs.length} compatible specs:`, specs);
          } else {
            console.log(`AI response: "${specText}" - extracted ${specs.length} specs, using original query`);
          }
        } catch (err) {
          console.error('Error looking up part specs:', err);
        }
      }

      // Step 2: Search RevZilla for ALL compatible specs and combine results
      console.log('Searching for specs:', searchQueries);
      const allProducts: RetailerProduct[] = [];
      const seenUrls = new Set<string>();

      for (const query of searchQueries.slice(0, 5)) { // Limit to 5 queries
        const products = await executeAllToolsForVehicle(vehicleType, {
          query,
          year: vehicleContext?.year || undefined,
          make: vehicleContext?.make || undefined,
          model: vehicleContext?.model || undefined,
        });

        // Add products we haven't seen yet
        for (const p of products) {
          if (!seenUrls.has(p.url)) {
            seenUrls.add(p.url);
            allProducts.push(p);
          }
        }
      }

      // We searched for specific part specs - filter products to only those matching specs
      const searchedForSpecs = searchQueries.length > 1 || searchQueries[0] !== productQuery;

      // Filter products to only those that match one of the searched specs
      let filteredProducts = allProducts;
      if (searchedForSpecs) {
        // Create regex patterns for each spec to match in product names
        const specPatterns = searchQueries.map(spec => {
          // Normalize the spec: YB7C-A, YB7CA, YB7C A should all match
          const normalized = spec.replace(/[-\s]/g, '[-\\s]?');
          return new RegExp(normalized, 'i');
        });

        filteredProducts = allProducts.filter(p => {
          const name = p.name.toLowerCase();
          // Product must match at least one of the spec patterns
          return specPatterns.some(pattern => pattern.test(p.name));
        });

        console.log(`Filtered ${allProducts.length} products to ${filteredProducts.length} matching specs`);
      }

      if (filteredProducts.length > 0) {
        // Analyze products with AI for ranking
        const recommendations = await analyzeProducts(
          filteredProducts,
          searchQueries.join(', '),
          vehicleContext,
          ai
        );

        // Use AI recommendations if available, otherwise use filtered products
        // Since we already filtered by spec, all products are valid fits
        const productsToShow = recommendations.length > 0 ? recommendations : filteredProducts.map((p) => ({
          name: p.name,
          brand: p.brand,
          price: p.price,
          currency: p.currency,
          url: p.url,
          rating: p.rating,
          reviewCount: p.reviewCount,
          inStock: p.inStock,
          retailer: p.retailer,
          fitmentVerified: true, // Products already filtered to matching specs
        }));

        const searchedFor = searchedForSpecs ? searchQueries.join(', ') : productQuery;
        assistantMessage = vehicleStr
          ? `Here are ${searchedFor} options for your ${vehicleStr}:`
          : `Here are the products I found for "${searchedFor}":`;

        // Store metadata for UI rendering
        responseMetadata = {
          type: 'product_search',
          researchResult: {
            recommendations: productsToShow,
            sources: [
              ...new Set(productsToShow.map((p) => p.retailer).filter(Boolean)),
            ].map((retailer) => ({
              title: retailer as string,
              url: productsToShow.find((p) => p.retailer === retailer)?.url || '',
            })),
            hasMoreResults: false,
          },
          vehicleContext,
        };

        console.log(
          `Product search complete: ${productsToShow.length} products for "${searchedFor}"`
        );
      } else if (allProducts.length > 0) {
        // We found products but none matched the specs - inform user
        const searchedFor = searchedForSpecs ? searchQueries.join(', ') : productQuery;
        assistantMessage = vehicleStr
          ? `I searched for ${searchedFor} for your ${vehicleStr}, but none of the ${allProducts.length} products found matched the exact specifications. ` +
            `The compatible specs I found for your vehicle are: ${searchQueries.slice(0, 5).join(', ')}. ` +
            `You may want to check RevZilla directly with your vehicle's make/model filter applied.`
          : `I searched for ${searchedFor} but couldn't find exact matches. Try searching RevZilla directly.`;

        console.log(
          `No matching products: ${allProducts.length} found but 0 matched specs ${searchQueries.join(', ')}`
        );
      } else {
        // No products found at all, fall back to standard chat
        console.log('No products found, falling back to standard chat');
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents:
            `You are a helpful assistant for a vehicle collection management app. ` +
            `The user asked about "${productQuery}" but no products were found in the search. ` +
            `Provide helpful suggestions for where they might find what they're looking for, ` +
            `or suggest alternative search terms. Be concise and helpful.\n\n` +
            `User's vehicle: ${vehicleContext ? `${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}` : 'Not specified'}`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        assistantMessage =
          response.text ||
          "I couldn't find any products matching your search. Try being more specific or checking retailer websites directly.";
      }
    } else {
      // Standard Gemini flow for general questions
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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt + '\n\nUser: ' + message,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      assistantMessage =
        response.text ||
        'I apologize, but I was unable to generate a response. Please try again.';

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
          (source, index, self) =>
            index === self.findIndex((s) => s.title === source.title)
        );

        if (uniqueSources.length > 0) {
          assistantMessage +=
            '\n\nSources:\n' +
            uniqueSources
              .slice(0, 5)
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

    // Update session timestamp
    if (!sessionId && currentSessionId) {
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentSessionId);
    }

    // Return response
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
      console.log(
        'Returning response with metadata, recommendations count:',
        (responseMetadata.researchResult as { recommendations: unknown[] })
          ?.recommendations?.length
      );
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
