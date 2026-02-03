export interface RetailerProduct {
  name: string;
  brand: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string;
  rating?: number; // 0-5 scale
  reviewCount?: number;
  inStock: boolean;
  retailer: string; // "RevZilla", "CycleGear", etc.
  fitmentVerified: boolean;
}

export interface SearchParams {
  query: string;
  year?: number;
  make?: string;
  model?: string;
}

export interface RetailerTool {
  name: string; // "search_revzilla"
  retailerName: string; // "RevZilla"
  vehicleTypes: string[]; // ["motorcycle"]
  description: string;
  search: (params: SearchParams) => Promise<RetailerProduct[]>;
}

export interface VehicleContext {
  id: string;
  name: string;
  vehicleType: string;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
}
