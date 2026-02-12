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
  year: number;
  make: string;
  model: string;
  nickname: string | null;
}

export interface ResearchProgress {
  step: string;
  detail?: string;
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
