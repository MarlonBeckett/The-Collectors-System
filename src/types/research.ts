export interface ProductRecommendation {
  name: string;
  brand: string;
  price?: number;
  currency?: string;
  url: string;
  imageUrl?: string;
  rating?: number; // 0-5 scale
  reviewCount?: number;
  inStock?: boolean;
  retailer?: string; // "RevZilla", "CycleGear", etc.
  fitmentVerified?: boolean;
  reasoning?: string; // AI-generated explanation
  pros?: string[]; // AI-generated from analysis
  cons?: string[]; // AI-generated from analysis
  reviewSummary?: string; // AI-generated from reviews
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
