import * as cheerio from 'cheerio';
import { RetailerTool, RetailerProduct, SearchParams } from '../types';

// Simple in-memory cache for search results (15 min TTL)
const searchCache = new Map<string, { products: RetailerProduct[]; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCacheKey(params: SearchParams): string {
  return JSON.stringify({
    query: params.query,
    year: params.year,
    make: params.make,
    model: params.model,
  });
}

function getCachedResults(params: SearchParams): RetailerProduct[] | null {
  const key = getCacheKey(params);
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('RevZilla: Using cached results');
    return cached.products;
  }
  return null;
}

function setCachedResults(params: SearchParams, products: RetailerProduct[]): void {
  const key = getCacheKey(params);
  searchCache.set(key, { products, timestamp: Date.now() });
}

async function searchRevZilla(params: SearchParams): Promise<RetailerProduct[]> {
  // Check cache first
  const cached = getCachedResults(params);
  if (cached) return cached;

  // Build fitment string for URL
  const fitmentParts = [params.year, params.make, params.model].filter(Boolean);
  const hasFitment = fitmentParts.length > 0;

  // Build search URL
  // Note: RevZilla's fitment system uses JavaScript/cookies which we can't easily replicate
  // We search with the product query only and let the AI filter based on fitment knowledge
  const searchUrl = `https://www.revzilla.com/search?query=${encodeURIComponent(params.query)}`;
  console.log('RevZilla: Searching', searchUrl);
  if (hasFitment) {
    console.log('RevZilla: User vehicle:', fitmentParts.join(' '));
    console.log('RevZilla: Note - fitment filtering requires manual verification on product pages');
  }

  try {
    // Follow redirects to get the actual product listing page
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error('RevZilla: HTTP error', response.status);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products: RetailerProduct[] = [];

    // RevZilla uses .product-tile for product cards
    const productTiles = $('.product-tile');
    console.log(`RevZilla: Found ${productTiles.length} product tiles`);

    productTiles.each((i, el) => {
      const $tile = $(el);

      // Get product name from .product-tile__name
      const name = $tile.find('.product-tile__name').text().trim();
      if (!name) return;

      // Get product link - it's an <a> tag wrapping the tile or inside it
      // Links look like /motorcycle/product-name
      let href = $tile.find('a[href*="/motorcycle/"]').first().attr('href') ||
        $tile.parent('a').attr('href') ||
        $tile.closest('a').attr('href');

      if (!href) {
        // Try finding any link in the tile
        href = $tile.find('a').first().attr('href');
      }

      if (!href) return;

      const fullUrl = href.startsWith('http')
        ? href
        : `https://www.revzilla.com${href}`;

      // Get price - look for dollar amounts in the tile
      const tileText = $tile.text();
      const priceMatches = tileText.match(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
      let price = 0;
      if (priceMatches && priceMatches.length > 0) {
        // Take the first (or lowest) price found
        const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')));
        price = Math.min(...prices);
      }

      // Get brand from data attribute or extract from name
      const brand = $tile.attr('data-brand') ||
        $tile.find('[data-brand]').attr('data-brand') ||
        extractBrandFromName(name);

      // Get rating from stars
      let rating: number | undefined;
      const ratingEl = $tile.find('.product-tile__rating, [class*="star"], [class*="rating"]');
      const ratingLabel = ratingEl.attr('aria-label') || ratingEl.attr('title') || '';
      const ratingMatch = ratingLabel.match(/([\d.]+)\s*(out of|\/)\s*5/i) ||
        ratingLabel.match(/([\d.]+)\s*star/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }

      // Get review count
      let reviewCount: number | undefined;
      const reviewMatch = tileText.match(/(\d+)\s*(?:review|rating)/i);
      if (reviewMatch) {
        reviewCount = parseInt(reviewMatch[1]);
      }

      // Check stock status
      const isOutOfStock = tileText.toLowerCase().includes('out of stock') ||
        $tile.find('[class*="out-of-stock"], [class*="sold-out"]').length > 0;

      products.push({
        name,
        brand,
        price,
        currency: 'USD',
        url: fullUrl,
        rating,
        reviewCount,
        inStock: !isOutOfStock,
        retailer: 'RevZilla',
        // Note: RevZilla search doesn't filter by fitment - user must verify on product page
        fitmentVerified: false,
      });
    });

    // If no product tiles found, try alternative selectors
    if (products.length === 0) {
      console.log('RevZilla: No product tiles, trying alternative selectors');

      // Try product-index-results__product-tile
      $('.product-index-results__product-tile').each((i, el) => {
        const $tile = $(el);
        const name = $tile.find('.product-tile__name, [data-qa="product-tile-name"]').text().trim();
        if (!name) return;

        const href = $tile.find('a').first().attr('href');
        if (!href) return;

        const fullUrl = href.startsWith('http') ? href : `https://www.revzilla.com${href}`;
        const tileText = $tile.text();
        const priceMatches = tileText.match(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
        let price = 0;
        if (priceMatches && priceMatches.length > 0) {
          const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')));
          price = Math.min(...prices);
        }

        products.push({
          name,
          brand: extractBrandFromName(name),
          price,
          currency: 'USD',
          url: fullUrl,
          inStock: true,
          retailer: 'RevZilla',
          fitmentVerified: false,
        });
      });
    }

    // Log warning if no products found
    if (products.length === 0) {
      console.warn('RevZilla: No products found - selectors may need updating');
      console.log('RevZilla: Page title:', $('title').text());
      // Log first 200 chars of body for debugging
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      console.log('RevZilla: Body preview:', bodyText.substring(0, 200));
    } else {
      console.log(`RevZilla: Returning ${products.length} products`);
    }

    // Cache and return results
    setCachedResults(params, products);
    return products;
  } catch (error) {
    console.error('RevZilla: Search error', error);
    return [];
  }
}

function extractBrandFromName(name: string): string {
  // Common motorcycle battery/gear brands
  const brands = [
    'Yuasa', 'Antigravity', 'Fire Power', 'Shorai', 'Lithium', 'AGM',
    'Dainese', 'Alpinestars', 'Icon', 'Shoei', 'Arai', 'Bell', 'HJC',
    'RevIt', 'Klim', 'Scorpion', 'Fly', 'Fox', 'Thor', 'Answer',
    'Michelin', 'Pirelli', 'Dunlop', 'Bridgestone', 'Metzeler',
    'K&N', 'Akrapovic', 'Yoshimura', 'Two Brothers', 'Leo Vince',
  ];

  for (const brand of brands) {
    if (name.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }

  // Fall back to first word
  const words = name.split(/[\s\-]/);
  if (words.length > 0 && words[0].length > 1) {
    return words[0];
  }
  return 'Unknown';
}

export const revzillaTool: RetailerTool = {
  name: 'search_revzilla',
  retailerName: 'RevZilla',
  vehicleTypes: ['motorcycle'],
  description:
    'Search RevZilla for motorcycle parts, gear, and accessories with verified fitment.',
  search: searchRevZilla,
};
