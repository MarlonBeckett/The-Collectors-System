import { revzillaTool } from './motorcycle/revzilla';
import { RetailerTool, RetailerProduct, SearchParams } from './types';

// Registry of all available tools
const ALL_TOOLS: RetailerTool[] = [
  revzillaTool,
  // Add new tools here - that's it!
  // Phase 2: cyclegearTool, denniskirkTool, jpcyclesTool
  // Phase 3: rockautoTool, autozoneTool
];

// Get tools for a vehicle type
export function getToolsForVehicleType(vehicleType: string): RetailerTool[] {
  return ALL_TOOLS.filter(
    (tool) =>
      tool.vehicleTypes.includes(vehicleType) || tool.vehicleTypes.includes('all')
  );
}

// Execute a tool by name
export async function executeTool(
  toolName: string,
  params: SearchParams
): Promise<RetailerProduct[]> {
  const tool = ALL_TOOLS.find((t) => t.name === toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  return tool.search(params);
}

// Execute ALL tools for a vehicle type (parallel)
export async function executeAllToolsForVehicle(
  vehicleType: string,
  params: SearchParams
): Promise<RetailerProduct[]> {
  const tools = getToolsForVehicleType(vehicleType);

  if (tools.length === 0) {
    console.log(`No tools found for vehicle type: ${vehicleType}`);
    return [];
  }

  console.log(
    `Executing ${tools.length} tools for ${vehicleType}:`,
    tools.map((t) => t.name)
  );

  const results = await Promise.all(
    tools.map((t) =>
      t.search(params).catch((err) => {
        console.error(`Tool ${t.name} failed:`, err);
        return [];
      })
    )
  );

  const allProducts = results.flat();
  console.log(`Total products from all tools: ${allProducts.length}`);

  return allProducts;
}

// Keywords that indicate a product search query
const PRODUCT_KEYWORDS = [
  'battery',
  'batteries',
  'tire',
  'tires',
  'oil',
  'helmet',
  'gear',
  'part',
  'parts',
  'accessory',
  'accessories',
  'buy',
  'recommend',
  'recommendation',
  'best',
  'which',
  'what should',
  'need',
  'needs',
  'chain',
  'sprocket',
  'brake',
  'brakes',
  'pad',
  'pads',
  'filter',
  'exhaust',
  'seat',
  'handlebars',
  'grips',
  'mirrors',
  'lights',
  'jacket',
  'gloves',
  'boots',
  'pants',
];

// Detect if message is a product query
export function isProductQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PRODUCT_KEYWORDS.some((kw) => lower.includes(kw));
}

// Extract the product query from the message - focus on the actual product being searched
export function extractProductQuery(message: string): string {
  const lower = message.toLowerCase();

  // First, try to find specific product keywords in the message
  for (const keyword of PRODUCT_KEYWORDS) {
    if (lower.includes(keyword)) {
      // For specific parts, just return the keyword
      if (['battery', 'batteries', 'tire', 'tires', 'oil', 'helmet', 'chain',
           'sprocket', 'brake', 'brakes', 'filter', 'exhaust', 'seat',
           'handlebars', 'grips', 'mirrors', 'jacket', 'gloves', 'boots', 'pants'].includes(keyword)) {
        return keyword;
      }
    }
  }

  // Remove common question prefixes and filler words
  let query = message
    .replace(/^(what|which|can you|do you|please|help me|i need|i want|get me|find me|looking for|it needs)\s+/gi, '')
    .replace(/^(a|an|the|some|new)\s+/gi, '')
    .replace(/\?+$/, '')
    .replace(/help me fix.*?:/gi, '')
    .replace(/for (my|the|a)\s+\w+.*$/gi, '')
    .trim();

  // If still too long, try to extract just the product part
  const productMatch = query.match(/\b(battery|batteries|tire|tires|oil|helmet|chain|sprocket|brake|brakes|filter|exhaust|seat|handlebars|grips|mirrors|jacket|gloves|boots|pants|pad|pads|lights)\b/i);
  if (productMatch) {
    return productMatch[1];
  }

  // Clean up "should I get" type phrases
  query = query.replace(/should\s+i\s+(get|buy|use)/gi, '').trim();

  // Limit to first few words if still too long
  const words = query.split(/\s+/);
  if (words.length > 4) {
    query = words.slice(0, 4).join(' ');
  }

  return query || message;
}

// Re-export types
export type { RetailerProduct, SearchParams, RetailerTool, VehicleContext } from './types';
