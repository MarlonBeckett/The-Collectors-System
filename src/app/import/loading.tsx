import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ImportLoading() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back arrow + title area */}
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-9 h-9" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-56 mt-2" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          <Skeleton className="flex-1 h-12" />
          <Skeleton className="flex-1 h-12" />
        </div>

        {/* Content area */}
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </AppShell>
  );
}
