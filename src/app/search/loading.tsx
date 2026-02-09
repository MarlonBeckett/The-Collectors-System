import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SearchLoading() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="mb-6">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>

        {/* Search input */}
        <Skeleton className="h-14 w-full" />

        {/* Results area */}
        <div className="mt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border bg-card p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28 mt-2" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
