'use client';

import { ProductRecommendation } from '@/types/research';

interface StarIconProps {
  filled: boolean;
}

function StarIcon({ filled }: StarIconProps) {
  return (
    <svg
      className={`w-3 h-3 ${filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

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

              {/* Rating and review count */}
              {product.rating !== undefined && product.rating > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon key={star} filled={star <= Math.round(product.rating!)} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    {product.rating.toFixed(1)}
                  </span>
                  {product.reviewCount !== undefined && product.reviewCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({product.reviewCount.toLocaleString()} reviews)
                    </span>
                  )}
                </div>
              )}

              {/* Badges row */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Fitment verified badge */}
                {product.fitmentVerified && (
                  <span className="inline-flex items-center text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Verified Fit
                  </span>
                )}

                {/* Retailer badge */}
                {product.retailer && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    via {product.retailer}
                  </span>
                )}

                {/* In stock / Out of stock */}
                {product.inStock === false && (
                  <span className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                    Out of Stock
                  </span>
                )}
              </div>
            </div>
            {product.price !== undefined && product.price > 0 && (
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-primary">
                  ${product.price.toFixed(2)}
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
  sources?: { url: string; title: string }[];
}

export function ProductList({ recommendations, sources }: ProductListProps) {
  // Separate products with reasoning (top picks) from those without (more options)
  const topPicks = recommendations.filter((p) => p.reasoning);
  const moreOptions = recommendations.filter((p) => !p.reasoning);

  return (
    <div className="mt-2">
      {/* Top picks - always shown expanded */}
      {topPicks.map((product, index) => (
        <ProductCard key={index} product={product} rank={index + 1} />
      ))}

      {/* More options - collapsible if there are many */}
      {moreOptions.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Show {moreOptions.length} more option{moreOptions.length > 1 ? 's' : ''}
          </summary>
          <div className="mt-2">
            {moreOptions.map((product, index) => (
              <ProductCard
                key={topPicks.length + index}
                product={product}
                rank={topPicks.length + index + 1}
              />
            ))}
          </div>
        </details>
      )}

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
