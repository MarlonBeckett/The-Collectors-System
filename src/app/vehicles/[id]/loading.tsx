import { AppShell } from '@/components/layout/AppShell';
import { VehicleDetailSkeleton } from '@/components/ui/VehicleDetailSkeleton';

export default function VehicleLoading() {
  return (
    <AppShell>
      <VehicleDetailSkeleton />
    </AppShell>
  );
}
