'use client';

import { ProductRecommendation } from '@/types/research';

interface ProductCardProps {
  product: ProductRecommendation;
  rank?: number;
}

export function ProductCard({ product, rank }: ProductCardProps) {
  // Ensure pros and cons are arrays
  const pros = Array.isArray(product.pros) ? product.pros : [];
  const cons = Array.isArray(product.cons) ? product.cons : [];

  return (
    <div className="border border-border bg-card p-4 mb-3">
      <div className="flex items-start gap-3">
        {rank && (
          <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
            {rank}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-card-foreground text-sm">
                {product.name || 'Unknown Product'}
              </h4>
              <p className="text-xs text-muted-foreground">{product.brand || ''}</p>
            </div>
            {product.price && typeof product.price.amount === 'number' && (
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-primary">
                  ${product.price.amount.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {product.price.source || ''}
                </p>
              </div>
            )}
          </div>

          {product.reasoning && (
            <p className="text-sm text-muted-foreground mt-2">{product.reasoning}</p>
          )}

          {(pros.length > 0 || cons.length > 0) && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              {pros.length > 0 && (
                <div>
                  <p className="font-medium text-green-600 dark:text-green-400 mb-1">
                    Pros
                  </p>
                  <ul className="space-y-0.5">
                    {pros.slice(0, 3).map((pro, i) => (
                      <li key={i} className="text-muted-foreground">
                        + {pro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cons.length > 0 && (
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400 mb-1">
                    Cons
                  </p>
                  <ul className="space-y-0.5">
                    {cons.slice(0, 3).map((con, i) => (
                      <li key={i} className="text-muted-foreground">
                        - {con}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {product.reviewSummary && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              "{product.reviewSummary}"
            </p>
          )}

          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:text-primary/80 font-medium"
            >
              View Product
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductListProps {
  recommendations: ProductRecommendation[];
  additionalProducts?: ProductRecommendation[];
  sources?: { url: string; title: string }[];
}

export function ProductList({
  recommendations,
  sources,
}: ProductListProps) {
  return (
    <div className="mt-2">
      {recommendations.map((product, index) => (
        <ProductCard key={index} product={product} rank={index + 1} />
      ))}

      {sources && sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Sources:{' '}
            {sources.map((source, index) => (
              <span key={index}>
                {index > 0 && ', '}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  {source.title}
                </a>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
