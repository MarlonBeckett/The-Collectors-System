'use client';

import { Motorcycle } from '@/types/database';
import { daysUntilExpiration } from '@/lib/dateUtils';

interface QuickStatsProps {
  vehicles: Motorcycle[];
}

export function QuickStats({ vehicles }: QuickStatsProps) {
  const activeVehicles = vehicles.filter(v => v.status === 'active');
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
  const expiredCount = activeVehicles.filter(v => {
    const days = daysUntilExpiration(v.tab_expiration);
    return days !== null && days < 0;
  }).length;
  const soonCount = activeVehicles.filter(v => {
    const days = daysUntilExpiration(v.tab_expiration);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const needsTabsRenewed = expiredCount + soonCount;

  return (
    <div className="flex gap-2">
      <div className="flex-1 bg-card border border-border p-2 text-center">
        <p className="text-xl font-bold text-foreground">{activeVehicles.length}</p>
        <p className="text-xs text-muted-foreground">Active</p>
      </div>

      <div className={`flex-1 border p-2 text-center ${needsTabsRenewed > 0 ? 'bg-destructive/10 border-destructive' : 'bg-card border-border'}`}>
        <p className={`text-xl font-bold ${needsTabsRenewed > 0 ? 'text-destructive' : 'text-foreground'}`}>
          {needsTabsRenewed}
        </p>
        <p className="text-xs text-muted-foreground">Tabs</p>
      </div>

      <div className={`flex-1 border p-2 text-center ${maintenanceCount > 0 ? 'bg-destructive/10 border-destructive' : 'bg-card border-border'}`}>
        <p className={`text-xl font-bold ${maintenanceCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
          {maintenanceCount}
        </p>
        <p className="text-xs text-muted-foreground">Maint.</p>
      </div>

      <div className="flex-1 bg-card border border-border p-2 text-center">
        <p className="text-xl font-bold text-foreground">{vehicles.length}</p>
        <p className="text-xs text-muted-foreground">Total</p>
      </div>
    </div>
  );
}
