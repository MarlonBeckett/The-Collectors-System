import { tavily } from '@tavily/core';
import { TavilySearchResult, TavilyResponse, VehicleContext } from '@/types/research';
import { getPreferredDomains } from './vehicleRetailers';

let tavilyClient: ReturnType<typeof tavily> | null = null;

function getTavilyClient() {
  if (!tavilyClient) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY not configured');
    }
    tavilyClient = tavily({ apiKey });
  }
  return tavilyClient;
}

export async function searchProducts(
  query: string,
  vehicleContext?: VehicleContext
): Promise<TavilyResponse> {
  const client = getTavilyClient();

  // Get preferred domains for vehicle type
  const includeDomains = vehicleContext
    ? getPreferredDomains(vehicleContext.vehicleType)
    : undefined;

  const response = await client.search(query, {
    searchDepth: 'advanced',
    maxResults: 10,
    includeAnswer: false,
    includeDomains: includeDomains?.slice(0, 5), // Tavily limits domain filters
  });

  return {
    query,
    results: response.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.publishedDate,
    })),
  };
}

export async function searchMultipleQueries(
  queries: string[],
  vehicleContext?: VehicleContext
): Promise<TavilyResponse[]> {
  // Run searches in parallel
  const searchPromises = queries.map((query) => searchProducts(query, vehicleContext));
  const results = await Promise.allSettled(searchPromises);

  return results
    .filter((r): r is PromiseFulfilledResult<TavilyResponse> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export function aggregateResults(searches: TavilyResponse[]): TavilySearchResult[] {
  const seenUrls = new Set<string>();
  const aggregated: TavilySearchResult[] = [];

  for (const search of searches) {
    for (const result of search.results) {
      // Normalize URL for deduplication
      const normalizedUrl = normalizeUrl(result.url);
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        aggregated.push(result);
      }
    }
  }

  // Sort by score descending
  aggregated.sort((a, b) => b.score - a.score);

  return aggregated;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'ref',
      'aff',
      'affiliate',
      'source',
      'tag',
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    // Normalize hostname
    parsed.hostname = parsed.hostname.replace(/^www\./, '');
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function validateLinks(urls: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Validate links in parallel with timeout
  const validationPromises = urls.map(async (url) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TheCollectorsSystem/1.0; +https://thecollectorssystem.com)',
        },
      });

      clearTimeout(timeoutId);
      results.set(url, response.ok);
    } catch {
      // On error, assume link might be valid (some sites block HEAD requests)
      results.set(url, true);
    }
  });

  await Promise.allSettled(validationPromises);
  return results;
}

export function cleanProductUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Amazon: prefer ASIN-based URLs
    if (parsed.hostname.includes('amazon.')) {
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      if (asinMatch) {
        return `https://www.amazon.com/dp/${asinMatch[1]}`;
      }
    }

    // Remove tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'ref',
      'aff',
      'affiliate',
      'source',
      'tag',
      'pd_rd_w',
      'pf_rd_p',
      'pf_rd_r',
      'pd_rd_r',
      'pd_rd_wg',
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));

    return parsed.toString();
  } catch {
    return url;
  }
}

export function isAmazonUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes('amazon.');
  } catch {
    return false;
  }
}

export function prioritizeNonAmazonResults(results: TavilySearchResult[]): TavilySearchResult[] {
  const amazon: TavilySearchResult[] = [];
  const others: TavilySearchResult[] = [];

  for (const result of results) {
    if (isAmazonUrl(result.url)) {
      amazon.push(result);
    } else {
      others.push(result);
    }
  }

  // Return non-Amazon first, then Amazon as fallback
  return [...others, ...amazon];
}
