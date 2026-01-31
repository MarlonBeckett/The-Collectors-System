'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle, MotorcycleStatus } from '@/types/database';
import { daysUntilExpiration, formatDate } from '@/lib/dateUtils';
import { ExpirationIndicator } from '@/components/dashboard/ExpirationIndicator';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface VehicleStatusProps {
  vehicle: Motorcycle;
  canEdit?: boolean;
}

export function VehicleStatus({ vehicle, canEdit = true }: VehicleStatusProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<MotorcycleStatus>(vehicle.status);
  const [maintenanceNotes, setMaintenanceNotes] = useState(vehicle.maintenance_notes || '');
  const [loading, setLoading] = useState(false);

  const days = daysUntilExpiration(vehicle.tab_expiration);
  const needsTabsRenewed = days !== null && days <= 30;
  const tabsExpired = days !== null && days < 0;

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('motorcycles')
        .update({
          status,
          maintenance_notes: status === 'maintenance' ? maintenanceNotes || null : null,
        })
        .eq('id', vehicle.id);

      if (error) throw error;
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStatus(vehicle.status);
    setMaintenanceNotes(vehicle.maintenance_notes || '');
    setIsEditing(false);
  };

  // Determine overall vehicle condition
  const getConditionSummary = () => {
    const issues: { type: 'error' | 'warning'; message: string }[] = [];

    if (vehicle.status === 'maintenance') {
      issues.push({ type: 'warning', message: 'Needs maintenance' });
    }

    if (tabsExpired) {
      issues.push({ type: 'error', message: 'Tabs expired' });
    } else if (needsTabsRenewed) {
      issues.push({ type: 'warning', message: 'Tabs expiring soon' });
    }

    return issues;
  };

  const conditions = getConditionSummary();
  const isGoodToGo = conditions.length === 0 && vehicle.status === 'active';

  if (isEditing) {
    return (
      <div className="bg-card border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Update Status</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="p-2 hover:bg-muted transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="p-2 bg-primary text-primary-foreground hover:opacity-90"
            >
              <CheckIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as MotorcycleStatus)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="active">Active</option>
          <option value="maintenance">Needs Maintenance</option>
          <option value="stored">Stored</option>
          <option value="sold">Sold</option>
          <option value="traded">Traded</option>
        </select>

        {status === 'maintenance' && (
          <textarea
            value={maintenanceNotes}
            onChange={(e) => setMaintenanceNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="What needs attention? (e.g., dead battery, carburetor needs cleaning)"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Overall Status Card */}
      <div className={`border p-4 ${
        conditions.some(c => c.type === 'error') ? 'bg-destructive/10 border-destructive' :
        conditions.some(c => c.type === 'warning') ? 'bg-amber-500/10 border-amber-500' :
        isGoodToGo ? 'bg-green-500/10 border-green-500' : 'bg-card border-border'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-muted-foreground">Vehicle Status</h2>
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-muted/50 transition-colors rounded"
              title="Edit status"
            >
              <PencilIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {isGoodToGo ? (
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            Ready to Drive
          </p>
        ) : conditions.length > 0 ? (
          <div className="space-y-2">
            {conditions.map((condition, i) => (
              <div key={i} className={`flex items-center gap-2 ${
                condition.type === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  condition.type === 'error' ? 'bg-destructive' : 'bg-amber-500'
                }`} />
                <span className="font-medium">{condition.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-lg font-medium text-muted-foreground capitalize">{vehicle.status}</p>
        )}

        {/* Maintenance notes inline */}
        {vehicle.status === 'maintenance' && vehicle.maintenance_notes && (
          <p className="mt-2 text-sm text-foreground">{vehicle.maintenance_notes}</p>
        )}
      </div>

      {/* Tab Expiration - always show for active/maintenance vehicles */}
      {(vehicle.status === 'active' || vehicle.status === 'maintenance') && (
        <div className={`border p-4 ${
          tabsExpired ? 'bg-destructive/10 border-destructive' :
          needsTabsRenewed ? 'bg-amber-500/10 border-amber-500' : 'bg-card border-border'
        }`}>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Tab Expiration</h2>
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold">
              {vehicle.tab_expiration ? formatDate(vehicle.tab_expiration) : 'Not set'}
            </span>
            <ExpirationIndicator expirationDate={vehicle.tab_expiration} />
          </div>
        </div>
      )}
    </div>
  );
}
