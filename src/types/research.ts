export interface ProductRecommendation {
  name: string;
  brand: string;
  price?: { amount: number; currency: string; source: string };
  url: string;
  reasoning: string;
  pros: string[];
  cons: string[];
  reviewSummary?: string;
}

export interface ResearchResult {
  recommendations: ProductRecommendation[];
  sources: { url: string; title: string }[];
  hasMoreResults: boolean;
}

export type QueryIntent = 'quick_question' | 'product_research' | 'general_chat';

export interface VehicleContext {
  id: string;
  name: string;
  vehicleType: string;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
}

export interface ResearchProgress {
  step: string;
  detail?: string;
}

// Research mode phases for two-phase flow
export type ResearchPhase = 'initial' | 'discovery' | 'product_finding' | 'complete';

// Discovery phase results - information about product categories
export interface DiscoveryResult {
  oemSpec?: string;
  productTypes: {
    name: string;
    description: string;
    priceRange?: string;
    prosAndCons?: { pros: string[]; cons: string[] };
  }[];
  keyConsiderations: string[];
  popularBrands: string[];
  suggestedQuestions: string[];
}

// Research session state tracked in chat metadata
export interface ResearchState {
  phase: ResearchPhase;
  productCategory?: string; // e.g., "battery", "tire", "oil"
  vehicleId?: string;
  discoveryResult?: DiscoveryResult;
  userPreferences?: string; // e.g., "lithium", "budget", etc.
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface TavilyResponse {
  results: TavilySearchResult[];
  query: string;
}
