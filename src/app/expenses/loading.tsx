import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ExpensesLoading() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Collection switcher */}
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
        </div>

        {/* Time filter pills */}
        <div className="flex gap-2 mb-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-16" />
          ))}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>

        {/* Category bar */}
        <Skeleton className="h-10 w-full mb-4" />

        {/* Vehicle expense rows */}
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full mb-2" />
        ))}
      </div>
    </AppShell>
  );
}
