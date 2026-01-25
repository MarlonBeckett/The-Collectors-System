'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MileageHistory } from '@/types/database';
import { formatDate } from '@/lib/dateUtils';
import { PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface MileageSectionProps {
  motorcycleId: string;
  mileageHistory: MileageHistory[];
}

export function MileageSection({ motorcycleId, mileageHistory }: MileageSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isAdding, setIsAdding] = useState(false);
  const [mileage, setMileage] = useState('');
  const [mileageDate, setMileageDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const mileageNum = parseInt(mileage.replace(/,/g, ''));
    if (!mileageNum || isNaN(mileageNum)) return;

    setLoading(true);
    try {
      // Add to mileage history
      const { error: historyError } = await supabase.from('mileage_history').insert({
        motorcycle_id: motorcycleId,
        mileage: mileageNum,
        recorded_date: mileageDate,
      });

      if (historyError) throw historyError;

      // Update the main mileage field on the vehicle
      const { error: updateError } = await supabase
        .from('motorcycles')
        .update({ mileage: mileageNum.toLocaleString() })
        .eq('id', motorcycleId);

      if (updateError) throw updateError;

      setMileage('');
      setMileageDate(new Date().toISOString().split('T')[0]);
      setIsAdding(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to update mileage:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setMileage('');
    setMileageDate(new Date().toISOString().split('T')[0]);
    setIsAdding(false);
  };

  const latestMileage = mileageHistory[0];

  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-muted-foreground">Mileage</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-3 h-3" />
            Update
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g., 12,500"
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              autoFocus
            />
            <input
              type="date"
              value={mileageDate}
              onChange={(e) => setMileageDate(e.target.value)}
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 py-2 border border-border hover:bg-muted transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !mileage}
              className="flex-1 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : latestMileage ? (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-semibold">{latestMileage.mileage.toLocaleString()} mi</p>
            <span className="text-sm text-muted-foreground">
              as of {formatDate(latestMileage.recorded_date)}
            </span>
          </div>

          {/* Mileage History */}
          {mileageHistory.length > 1 && (
            <details className="mt-3">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                View history ({mileageHistory.length} entries)
              </summary>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {mileageHistory.map((entry, index) => {
                  const prevEntry = mileageHistory[index + 1];
                  const milesDiff = prevEntry ? entry.mileage - prevEntry.mileage : null;
                  return (
                    <div key={entry.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                      <span className="font-mono">{entry.mileage.toLocaleString()} mi</span>
                      <div className="flex items-center gap-2">
                        {milesDiff !== null && milesDiff > 0 && (
                          <span className="text-xs text-muted-foreground">+{milesDiff.toLocaleString()}</span>
                        )}
                        <span className="text-muted-foreground">{formatDate(entry.recorded_date)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">No mileage recorded</p>
      )}
    </div>
  );
}
