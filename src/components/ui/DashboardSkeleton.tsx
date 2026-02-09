import { Skeleton } from './Skeleton';

export function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Collection switcher */}
      <div className="mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <div className="space-y-4">
        {/* Carousel (16:9) */}
        <Skeleton className="w-full aspect-video" />

        {/* Quick stats — 4 cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>

        {/* Search bar + sort/filter buttons */}
        <div className="flex gap-2">
          <Skeleton className="flex-1 h-12" />
          <Skeleton className="w-12 h-12" />
          <Skeleton className="w-12 h-12" />
        </div>

        {/* Vehicle cards */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-border bg-card p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28 mt-2" />
                <Skeleton className="h-3 w-20 mt-2" />
              </div>
              <Skeleton className="w-16 h-6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
