import { Skeleton } from './Skeleton';

export function VehicleDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Main photo */}
      <Skeleton className="w-full h-64 sm:h-80" />

      {/* Thumbnail strip */}
      <div className="flex gap-1 px-4 py-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="w-16 h-16" />
        ))}
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Title + type badge */}
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-5 w-44 mt-2" />
        </div>

        {/* Status section */}
        <Skeleton className="h-20" />

        {/* Plate & VIN side-by-side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>

        {/* Mileage section */}
        <Skeleton className="h-32" />

        {/* Service records section */}
        <Skeleton className="h-32" />

        {/* Documents section */}
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
