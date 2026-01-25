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
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card border border-border p-4">
        <p className="text-3xl font-bold text-foreground">{activeVehicles.length}</p>
        <p className="text-sm text-muted-foreground">Active Vehicles</p>
      </div>

      <div className={`border p-4 ${needsTabsRenewed > 0 ? 'bg-destructive/10 border-destructive' : 'bg-card border-border'}`}>
        <p className={`text-3xl font-bold ${needsTabsRenewed > 0 ? 'text-destructive' : 'text-foreground'}`}>
          {needsTabsRenewed}
        </p>
        <p className="text-sm text-muted-foreground">Needs Tabs Renewed</p>
      </div>

      <div className={`border p-4 ${maintenanceCount > 0 ? 'bg-amber-500/10 border-amber-500' : 'bg-card border-border'}`}>
        <p className={`text-3xl font-bold ${maintenanceCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
          {maintenanceCount}
        </p>
        <p className="text-sm text-muted-foreground">Needs Maintenance</p>
      </div>

      <div className="bg-card border border-border p-4">
        <p className="text-3xl font-bold text-foreground">{vehicles.length}</p>
        <p className="text-sm text-muted-foreground">Total</p>
      </div>
    </div>
  );
}
