import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLoading() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="h-8 w-48 bg-[#333] animate-pulse rounded" />
          <div className="h-4 w-64 bg-[#333] animate-pulse rounded mt-2" />
        </div>
        <div className="flex gap-2 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 bg-[#333] animate-pulse h-16 rounded" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#333] animate-pulse h-24 rounded" />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
