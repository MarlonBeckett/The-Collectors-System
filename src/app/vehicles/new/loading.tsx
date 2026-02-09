import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';

export default function NewVehicleLoading() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back arrow + title */}
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-9 h-9" />
          <Skeleton className="h-8 w-40" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-full mt-6" />
        </div>
      </div>
    </AppShell>
  );
}
