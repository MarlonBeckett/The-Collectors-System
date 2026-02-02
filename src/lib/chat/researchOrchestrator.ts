import { GoogleGenAI } from '@google/genai';
import {
  ProductRecommendation,
  ResearchResult,
  VehicleContext,
  DiscoveryResult,
} from '@/types/research';

/**
 * Discovery Phase: Research product category information for a specific vehicle
 * Returns OEM specs, product types, considerations, and popular options
 */
export async function performDiscoveryPhase(
  userQuery: string,
  vehicleContext?: VehicleContext,
  apiKey?: string
): Promise<DiscoveryResult> {
  if (!apiKey) {
    throw new Error('API key required for discovery phase');
  }

  const ai = new GoogleGenAI({ apiKey });

  const vehicleInfo = vehicleContext
    ? `${[vehicleContext.year, vehicleContext.make, vehicleContext.model].filter(Boolean).join(' ')} (${vehicleContext.vehicleType})`
    : 'unspecified vehicle';

  // Step 1: Search for information with Google grounding
  const searchPrompt = `Research ${userQuery} for a ${vehicleInfo}.

Find:
1. What is the OEM/stock specification? Include part numbers.
2. What types/categories are available (e.g., for batteries: Lithium-Ion, AGM, Lead-Acid)?
3. What are key considerations when choosing?
4. What are popular brands recommended by owners?

Use Google Search to find current, accurate information.`;

  try {
    const searchResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const searchText = searchResponse.text || '';
    console.log('Discovery search response length:', searchText.length);

    // Step 2: Structure the search results into JSON
    const structurePrompt = `Based on the following research about ${userQuery} for a ${vehicleInfo}, extract and structure the information.

Research findings:
${searchText}

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "oemSpec": "OEM specification and part number if found, or null",
  "productTypes": [
    {
      "name": "Type name",
      "description": "Brief description",
      "priceRange": "$XX - $XX or null",
      "prosAndCons": {
        "pros": ["Pro 1", "Pro 2"],
        "cons": ["Con 1", "Con 2"]
      }
    }
  ],
  "keyConsiderations": ["Consideration 1", "Consideration 2"],
  "popularBrands": ["Brand 1", "Brand 2"],
  "suggestedQuestions": ["Question to help narrow down choice"]
}`;

    const structureResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: structurePrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonText = structureResponse.text || '';
    console.log('Discovery structured response:', jsonText.substring(0, 300));

    const parsed = JSON.parse(jsonText);

    return {
      oemSpec: parsed.oemSpec || undefined,
      productTypes: parsed.productTypes || [],
      keyConsiderations: parsed.keyConsiderations || [],
      popularBrands: parsed.popularBrands || [],
      suggestedQuestions: parsed.suggestedQuestions || [],
    };
  } catch (error) {
    console.error('Discovery phase error:', error);
    return {
      productTypes: [],
      keyConsiderations: ['Unable to complete research. Please try again.'],
      popularBrands: [],
      suggestedQuestions: ['What specific type are you looking for?'],
    };
  }
}

/**
 * Product Finding Phase: Search for actual products with purchase links
 * Uses the discovery context to find specific products that match user preferences
 */
export async function performProductFindingPhase(
  productCategory: string,
  userPreferences: string,
  vehicleContext?: VehicleContext,
  discoveryContext?: DiscoveryResult,
  apiKey?: string
): Promise<ResearchResult> {
  if (!apiKey) {
    throw new Error('API key required for product finding phase');
  }

  const ai = new GoogleGenAI({ apiKey });

  const vehicleInfo = vehicleContext
    ? `${[vehicleContext.year, vehicleContext.make, vehicleContext.model].filter(Boolean).join(' ')} (${vehicleContext.vehicleType})`
    : 'unspecified vehicle';

  const oemContext = discoveryContext?.oemSpec
    ? `OEM Spec: ${discoveryContext.oemSpec}`
    : '';

  // Extract key terms for better searching
  const searchTerms = userPreferences.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  // Determine retailer based on vehicle type
  const isMotorcycle = vehicleContext?.vehicleType === 'motorcycle';
  const retailer = isMotorcycle ? 'RevZilla' : 'Amazon';
  const retailerSite = isMotorcycle ? 'site:revzilla.com' : '';

  // Step 1: Search for actual products on the specific retailer
  const searchPrompt = `Search ${retailerSite} for ${searchTerms} ${productCategory} that fits ${vehicleInfo}.

Find ALL ${searchTerms} ${productCategory} products on ${retailer} that are compatible with ${vehicleInfo}.

Search for: "${vehicleContext?.year || ''} ${vehicleContext?.make || ''} ${vehicleContext?.model || ''} ${searchTerms} ${productCategory} ${retailerSite}"

For each product found:
- Exact product name and part number
- Current price
- Direct product page URL on ${retailer}
- Confirm it shows as fitting ${vehicleInfo} in the fitment selector

${oemContext}

Find as many compatible products as possible from ${retailer}.`;

  try {
    const searchResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const searchText = searchResponse.text || '';
    console.log('Product search response length:', searchText.length);

    // Extract grounding sources for URLs
    const groundingMetadata = searchResponse.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    const sourceUrls: { url: string; title: string }[] = [];

    for (const chunk of groundingChunks) {
      const webChunk = chunk as { web?: { uri?: string; title?: string } };
      if (webChunk.web?.uri) {
        const url = webChunk.web.uri;
        let title = webChunk.web.title || '';
        if (!title) {
          try {
            title = new URL(url).hostname.replace('www.', '');
          } catch {
            title = 'Link';
          }
        }
        // Filter URLs based on vehicle type
        const isSearchPage = url.includes('/search') || url.includes('?q=');
        const isRevZilla = url.includes('revzilla.com');

        // For motorcycles, only allow RevZilla
        if (isMotorcycle) {
          if (isRevZilla && !isSearchPage) {
            sourceUrls.push({ url, title });
          }
        } else {
          // For other vehicles, exclude eBay and Walmart
          const isEbay = url.includes('ebay.com');
          const isWalmart = url.includes('walmart.com');
          if (!isSearchPage && !isEbay && !isWalmart) {
            sourceUrls.push({ url, title });
          }
        }
      }
    }

    // Step 2: Structure the products into JSON
    const structurePrompt = `Extract ALL products from the search results for ${userPreferences} ${productCategory} for ${vehicleInfo}.

Search results:
${searchText}

Available URLs from search:
${sourceUrls.map(s => `- ${s.title}: ${s.url}`).join('\n')}

RULES:
1. Extract EVERY product mentioned from ${isMotorcycle ? 'RevZilla' : 'the search results'}
2. Include ALL brands found (Shorai, Antigravity, BikeMaster, Duraboost, Tusk, Yuasa, MotoBatt, etc.)
3. Only include products with RevZilla URLs (revzilla.com)
4. For fitment: if ${retailer} shows it fits the vehicle, it's confirmed

Output ONLY valid JSON (no markdown):
{
  "recommendations": [
    {
      "name": "Product name with part number",
      "brand": "Brand name",
      "price": { "amount": 99.99, "currency": "USD", "source": "${retailer}" },
      "url": "RevZilla product URL",
      "reasoning": "Confirmed to fit ${vehicleInfo} via ${retailer} fitment guide",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1"],
      "reviewSummary": "Customer feedback if mentioned"
    }
  ],
  "sources": [{ "title": "${retailer}", "url": "https://www.revzilla.com" }]
}

Include ALL products found that fit the vehicle.`;

    const structureResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: structurePrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonText = structureResponse.text || '';
    console.log('Product structured response:', jsonText.substring(0, 300));

    const parsed = JSON.parse(jsonText);

    const recommendations: ProductRecommendation[] = (parsed.recommendations || []).map(
      (rec: ProductRecommendation) => ({
        name: rec.name || 'Unknown Product',
        brand: rec.brand || 'Unknown',
        price: rec.price,
        url: rec.url || '',
        reasoning: rec.reasoning || '',
        pros: Array.isArray(rec.pros) ? rec.pros : [],
        cons: Array.isArray(rec.cons) ? rec.cons : [],
        reviewSummary: rec.reviewSummary,
      })
    );

    // Use grounding sources if no sources in response
    const sources = parsed.sources?.length > 0
      ? parsed.sources
      : sourceUrls.slice(0, 5);

    return {
      recommendations,
      sources,
      hasMoreResults: recommendations.length >= 8,
    };
  } catch (error) {
    console.error('Product finding phase error:', error);
    return {
      recommendations: [],
      sources: [],
      hasMoreResults: false,
    };
  }
}

/**
 * Format discovery results into a conversational response
 */
export function formatDiscoveryResponse(
  result: DiscoveryResult,
  vehicleContext?: VehicleContext
): string {
  const vehicleStr = vehicleContext
    ? [vehicleContext.year, vehicleContext.make, vehicleContext.model].filter(Boolean).join(' ')
    : 'your vehicle';

  let response = `Here's what I found about options for your ${vehicleStr}:\n\n`;

  if (result.oemSpec) {
    response += `OEM Specification: ${result.oemSpec}\n\n`;
  }

  if (result.productTypes.length > 0) {
    response += 'Your main options:\n\n';
    result.productTypes.forEach((type, index) => {
      response += `${index + 1}. ${type.name}`;
      if (type.priceRange) {
        response += ` (${type.priceRange})`;
      }
      response += `\n   ${type.description}\n`;
      if (type.prosAndCons) {
        if (type.prosAndCons.pros?.length) {
          response += `   Pros: ${type.prosAndCons.pros.join(', ')}\n`;
        }
        if (type.prosAndCons.cons?.length) {
          response += `   Cons: ${type.prosAndCons.cons.join(', ')}\n`;
        }
      }
      response += '\n';
    });
  }

  if (result.keyConsiderations.length > 0) {
    response += 'Things to consider:\n';
    result.keyConsiderations.forEach(consideration => {
      response += `- ${consideration}\n`;
    });
    response += '\n';
  }

  if (result.popularBrands.length > 0) {
    response += `Popular brands: ${result.popularBrands.join(', ')}\n\n`;
  }

  response += 'Which type interests you? Or should I show you all options?';

  return response;
}
