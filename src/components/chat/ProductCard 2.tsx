'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface Product {
  name: string;
  url: string;
  price: string;
  category: string;
  store: string;
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 p-3 bg-muted/50 border border-border hover:bg-muted hover:border-primary/30 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {product.name}
          </span>
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <span className="text-xs text-muted-foreground">{product.store}</span>
      </div>
      <span className="text-sm font-semibold text-primary flex-shrink-0">
        {product.price}
      </span>
    </a>
  );
}

interface ProductListProps {
  products: Product[];
}

export function ProductList({ products }: ProductListProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Products Mentioned
      </h4>
      <div className="flex flex-col gap-2">
        {products.map((product, index) => (
          <ProductCard key={index} product={product} />
        ))}
      </div>
    </div>
  );
}
