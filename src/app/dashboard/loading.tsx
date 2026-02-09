import { AppShell } from '@/components/layout/AppShell';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export default function DashboardLoading() {
  return (
    <AppShell>
      <DashboardSkeleton />
    </AppShell>
  );
}
