'use client';

import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ProductTier } from '@/types/database';

export interface Product {
  name: string;
  url: string;
  price?: string;
  store: string;
  tier?: ProductTier;
  description?: string;
}

// Tier badge component with color coding
function TierBadge({ tier }: { tier: ProductTier }) {
  const tierConfig: Record<ProductTier, { label: string; className: string }> = {
    budget: {
      label: 'BUDGET',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    'mid-range': {
      label: 'MID-RANGE',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    premium: {
      label: 'PREMIUM',
      className: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    oem: {
      label: 'OEM',
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
  };

  const config = tierConfig[tier];

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold tracking-wider border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

interface ProductCardProps {
  product: Product;
  vehicleContext?: string; // e.g., "2009 Yamaha TW200"
}

export function ProductCard({ product, vehicleContext }: ProductCardProps) {
  const hasDirectUrl = product.url && product.url.length > 0;

  // Generate a Google Shopping search URL for products without direct links
  // Include vehicle context for better search results
  const searchQuery = vehicleContext
    ? `${product.name} for ${vehicleContext}`
    : product.name;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=shop`;
  const linkUrl = hasDirectUrl ? product.url : searchUrl;

  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <div className="flex flex-col gap-1.5 p-3 bg-muted/50 border border-border hover:bg-muted hover:border-primary/30 transition-colors group cursor-pointer">
        {/* Top row: Tier badge + Name + Price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {product.tier && <TierBadge tier={product.tier} />}
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {product.name}
            </span>
          </div>
          {product.price && (
            <span className="text-sm font-semibold text-primary flex-shrink-0">
              {product.price}
            </span>
          )}
        </div>

        {/* Middle row: Description */}
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 pl-0">
            {product.description}
          </p>
        )}

        {/* Bottom row: Shop link or Search prompt */}
        <div className="flex items-center gap-1 text-xs">
          {hasDirectUrl ? (
            <>
              <span className="text-muted-foreground">Shop at</span>
              <span className="text-primary font-medium">{product.store}</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </>
          ) : (
            <>
              <MagnifyingGlassIcon className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Search Google Shopping</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </>
          )}
        </div>
      </div>
    </a>
  );
}

interface ProductListProps {
  products: Product[];
  vehicleContext?: string; // e.g., "2009 Yamaha TW200"
}

export function ProductList({ products, vehicleContext }: ProductListProps) {
  if (!products || products.length === 0) return null;

  // Check if products have tiers for better header
  const hasTiers = products.some(p => p.tier);
  const headerText = hasTiers ? 'Product Options' : 'Shop These Products';

  // Sort products by tier priority: oem, budget, mid-range, premium
  const tierOrder: Record<ProductTier, number> = {
    oem: 0,
    budget: 1,
    'mid-range': 2,
    premium: 3,
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (!a.tier && !b.tier) return 0;
    if (!a.tier) return 1;
    if (!b.tier) return 1;
    return tierOrder[a.tier] - tierOrder[b.tier];
  });

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {headerText}
      </h4>
      <div className="flex flex-col gap-2">
        {sortedProducts.map((product, index) => (
          <ProductCard key={index} product={product} vehicleContext={vehicleContext} />
        ))}
      </div>
    </div>
  );
}

interface SourceListProps {
  sources: Array<{ title: string; url: string }>;
}

export function SourceList({ sources }: SourceListProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <span className="text-xs text-muted-foreground">Sources: </span>
      {sources.map((source, index) => (
        <span key={index}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary underline"
          >
            {source.title}
          </a>
          {index < sources.length - 1 && <span className="text-xs text-muted-foreground">, </span>}
        </span>
      ))}
    </div>
  );
}
