import { AppShell } from '@/components/layout/AppShell';

export default function SettingsLoading() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="h-8 w-32 bg-[#333] animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#333] animate-pulse h-24 rounded" />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
