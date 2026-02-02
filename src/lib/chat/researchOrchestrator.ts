import { GoogleGenAI } from '@google/genai';
import {
  ProductRecommendation,
  ResearchResult,
  VehicleContext,
  TavilySearchResult,
} from '@/types/research';
import {
  searchMultipleQueries,
  aggregateResults,
  validateLinks,
  cleanProductUrl,
  prioritizeNonAmazonResults,
} from './tavilyService';
import { getRetailerName } from './vehicleRetailers';

export function expandQueries(
  userQuery: string,
  vehicleContext?: VehicleContext
): string[] {
  const queries: string[] = [];
  const baseQuery = userQuery.toLowerCase();

  // Build vehicle context string - be very specific for fitment
  let vehicleStr = '';
  let vehicleShort = '';
  if (vehicleContext) {
    const parts = [vehicleContext.year, vehicleContext.make, vehicleContext.model].filter(
      Boolean
    );
    vehicleStr = parts.join(' ');
    vehicleShort = vehicleContext.model || '';
    if (!vehicleStr && vehicleContext.name) {
      vehicleStr = vehicleContext.name;
      vehicleShort = vehicleContext.name;
    }
  }

  // Query 1: Direct fitment search - include "fits" keyword for product pages
  if (vehicleStr) {
    queries.push(`${baseQuery} fits ${vehicleStr}`);
  } else {
    queries.push(`best ${baseQuery}`);
  }

  // Query 2: Year-specific OEM/replacement search
  if (vehicleStr) {
    queries.push(`${vehicleStr} ${baseQuery} OEM replacement compatible`);
  }

  // Query 3: Forum/community - these often have verified fitment info
  if (vehicleShort) {
    queries.push(`${vehicleShort} ${baseQuery} forum what fits`);
  }

  // Query 4: Exact part number search (forums often mention specific part numbers)
  if (vehicleStr) {
    queries.push(`${vehicleStr} ${baseQuery} part number size spec`);
  }

  // Query 5: Retailer-specific fitment search
  if (vehicleStr) {
    queries.push(`site:revzilla.com OR site:denniskirk.com ${vehicleStr} ${baseQuery}`);
  }

  // Limit to 5 queries max to stay within reasonable API usage
  return queries.slice(0, 5);
}

export async function performResearch(
  userQuery: string,
  vehicleContext?: VehicleContext,
  geminiApiKey?: string,
  excludeProducts?: string[]
): Promise<ResearchResult> {
  // Step 1: Expand queries based on context
  const expandedQueries = expandQueries(userQuery, vehicleContext);

  // Step 2: Perform parallel Tavily searches
  const searchResults = await searchMultipleQueries(expandedQueries, vehicleContext);

  // Step 3: Aggregate and deduplicate results
  let aggregatedResults = aggregateResults(searchResults);

  // Step 4: Prioritize non-Amazon results
  aggregatedResults = prioritizeNonAmazonResults(aggregatedResults);

  // Step 5: Clean URLs
  aggregatedResults = aggregatedResults.map((r) => ({
    ...r,
    url: cleanProductUrl(r.url),
  }));

  // Step 6: Validate top links (limit to save time)
  const topUrls = aggregatedResults.slice(0, 15).map((r) => r.url);
  const validationResults = await validateLinks(topUrls);

  // Filter out invalid links
  aggregatedResults = aggregatedResults.filter((r) => {
    const isValid = validationResults.get(r.url);
    return isValid !== false; // Keep if valid or not checked
  });

  // Step 7: Synthesize recommendations using Gemini
  if (geminiApiKey && aggregatedResults.length > 0) {
    return await synthesizeRecommendations(
      userQuery,
      aggregatedResults,
      vehicleContext,
      geminiApiKey,
      excludeProducts
    );
  }

  // Fallback: Create basic recommendations from search results
  return createBasicRecommendations(aggregatedResults);
}

async function synthesizeRecommendations(
  userQuery: string,
  searchResults: TavilySearchResult[],
  vehicleContext: VehicleContext | undefined,
  apiKey: string,
  excludeProducts?: string[]
): Promise<ResearchResult> {
  const ai = new GoogleGenAI({ apiKey });

  const vehicleInfo = vehicleContext
    ? `User's vehicle: ${[vehicleContext.year, vehicleContext.make, vehicleContext.model]
        .filter(Boolean)
        .join(' ')} (${vehicleContext.vehicleType})`
    : 'No specific vehicle context';

  const searchContext = searchResults
    .slice(0, 15)
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content.substring(0, 500)}...`
    )
    .join('\n\n');

  const excludeSection = excludeProducts && excludeProducts.length > 0
    ? `\n\nPREVIOUSLY SHOWN PRODUCTS (prioritize showing DIFFERENT products, but you can include these if they're the best options):\n${excludeProducts.map(p => `- ${p}`).join('\n')}\n\nTry to find new/different products first, but it's OK to include a previously shown product if it's clearly the best fit.`
    : '';

  const prompt = `You are a product research assistant helping a vehicle owner find parts and accessories.

${vehicleInfo}

User's question: "${userQuery}"${excludeSection}

CRITICAL FITMENT RULES:
- ONLY recommend products that EXPLICITLY state compatibility with the user's exact vehicle (year, make, model)
- If a search result shows a product page, the product MUST list the user's vehicle in its fitment/compatibility section
- Do NOT recommend products just because they appear in search results - verify fitment is mentioned
- Forum recommendations are valuable because users confirm what actually fits
- If you cannot verify fitment for at least 3 products, return fewer recommendations rather than guessing
- Include the specific part number (like YB7C-A for batteries) when mentioned

Based on the following search results, provide up to 10 product recommendations (ONLY if fitment is verified). Include pros AND cons for each product.

Search Results:
${searchContext}

Respond in JSON format with this structure:
{
  "recommendations": [
    {
      "name": "Product name with part number if available",
      "brand": "Brand name",
      "price": { "amount": 89.99, "currency": "USD", "source": "retailer name" },
      "url": "exact URL from search results",
      "reasoning": "Why this fits their specific vehicle - cite the fitment evidence",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"],
      "reviewSummary": "Brief summary of what reviewers say"
    }
  ]
}

Rules:
1. Only use URLs that appear in the search results
2. ONLY recommend if the search result explicitly mentions compatibility with the user's vehicle
3. If fitment is uncertain, add "Verify fitment before purchase" to cons
4. Prioritize products from specialty retailers (RevZilla, Dennis Kirk, RockAuto) over Amazon
5. If a forum post confirms "I use X on my [vehicle]", that counts as verified fitment`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    // Collect unique sources
    const sources = new Map<string, string>();
    for (const result of searchResults.slice(0, 10)) {
      const domain = getRetailerName(result.url);
      if (!sources.has(domain)) {
        sources.set(domain, result.url);
      }
    }

    return {
      recommendations: parsed.recommendations || [],
      sources: Array.from(sources.entries()).map(([title, url]) => ({ title, url })),
      hasMoreResults: false,
    };
  } catch (error) {
    console.error('Error synthesizing recommendations:', error);
    return createBasicRecommendations(searchResults);
  }
}

function createBasicRecommendations(
  searchResults: TavilySearchResult[]
): ResearchResult {
  const recommendations: ProductRecommendation[] = searchResults.slice(0, 10).map((result) => ({
    name: result.title,
    brand: extractBrand(result.title),
    url: result.url,
    reasoning: result.content.substring(0, 200),
    pros: ['Found in search results'],
    cons: ['Verify fitment before purchase'],
  }));

  const sources = new Map<string, string>();
  for (const result of searchResults.slice(0, 10)) {
    const domain = getRetailerName(result.url);
    if (!sources.has(domain)) {
      sources.set(domain, result.url);
    }
  }

  return {
    recommendations,
    sources: Array.from(sources.entries()).map(([title, url]) => ({ title, url })),
    hasMoreResults: false,
  };
}

function extractBrand(title: string): string {
  // Common brand patterns - extract first capitalized word
  const words = title.split(/[\s\-–]/);
  for (const word of words) {
    if (word.length > 2 && /^[A-Z]/.test(word)) {
      return word;
    }
  }
  return 'Unknown';
}

export function formatResearchResponse(
  result: ResearchResult,
  vehicleContext?: VehicleContext
): string {
  let response = '';

  if (vehicleContext) {
    const vehicleStr = [vehicleContext.year, vehicleContext.make, vehicleContext.model]
      .filter(Boolean)
      .join(' ');
    response += `Based on your ${vehicleStr}, here are my recommendations:\n\n`;
  } else {
    response += 'Here are my recommendations:\n\n';
  }

  result.recommendations.forEach((rec, index) => {
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
    if (rec.url) {
      response += `   [View on ${getRetailerName(rec.url)}](${rec.url})\n`;
    }
    response += '\n';
  });

  if (result.sources.length > 0) {
    response += '\nSources: ' + result.sources.map((s) => s.title).join(', ');
  }

  return response;
}
