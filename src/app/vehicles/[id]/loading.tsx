import { AppShell } from '@/components/layout/AppShell';

export default function VehicleLoading() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#555]">
          <div className="h-5 w-16 bg-[#333] animate-pulse rounded" />
          <div className="h-9 w-20 bg-[#333] animate-pulse rounded" />
        </div>
        <div className="bg-[#333] animate-pulse h-64 sm:h-80" />
        <div className="px-4 py-6 space-y-6">
          <div>
            <div className="h-8 w-64 bg-[#333] animate-pulse rounded" />
            <div className="h-5 w-48 bg-[#333] animate-pulse rounded mt-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#333] animate-pulse h-20 rounded" />
            <div className="bg-[#333] animate-pulse h-20 rounded" />
          </div>
          <div className="bg-[#333] animate-pulse h-32 rounded" />
          <div className="bg-[#333] animate-pulse h-32 rounded" />
        </div>
      </div>
    </AppShell>
  );
}
