'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle, MotorcycleStatus } from '@/types/database';
import { parseFlexibleDate, formatDateForDB } from '@/lib/dateUtils';
import { PhotoUploader } from '@/components/photos/PhotoUploader';

interface BikeFormProps {
  bike?: Motorcycle;
  mode: 'create' | 'edit';
}

export function BikeForm({ bike, mode }: BikeFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(bike?.name || '');
  const [year, setYear] = useState(bike?.year?.toString() || '');
  const [vin, setVin] = useState(bike?.vin || '');
  const [plateNumber, setPlateNumber] = useState(bike?.plate_number || '');
  const [mileage, setMileage] = useState(bike?.mileage || '');
  const [notes, setNotes] = useState(bike?.notes || '');
  const [tabExpiration, setTabExpiration] = useState(
    bike?.tab_expiration
      ? new Date(bike.tab_expiration).toISOString().split('T')[0]
      : ''
  );
  const [status, setStatus] = useState<MotorcycleStatus>(bike?.status || 'active');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const parsedDate = parseFlexibleDate(tabExpiration);
      const bikeData = {
        name,
        year: year ? parseInt(year) : null,
        vin: vin || null,
        plate_number: plateNumber || null,
        mileage: mileage || null,
        notes: notes || null,
        tab_expiration: formatDateForDB(parsedDate),
        status,
      };

      if (mode === 'create') {
        const { data, error } = await supabase
          .from('motorcycles')
          .insert(bikeData)
          .select()
          .single();

        if (error) throw error;
        router.push(`/bikes/${data.id}`);
      } else if (bike) {
        const { error } = await supabase
          .from('motorcycles')
          .update(bikeData)
          .eq('id', bike.id);

        if (error) throw error;
        router.push(`/bikes/${bike.id}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!bike) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('motorcycles')
        .delete()
        .eq('id', bike.id);

      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Name <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g., KTM Super Duke 990"
        />
      </div>

      {/* Year */}
      <div>
        <label htmlFor="year" className="block text-sm font-medium mb-2">
          Year
        </label>
        <input
          id="year"
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          min="1900"
          max="2099"
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g., 2023"
        />
      </div>

      {/* VIN */}
      <div>
        <label htmlFor="vin" className="block text-sm font-medium mb-2">
          VIN
        </label>
        <input
          id="vin"
          type="text"
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase())}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          placeholder="Vehicle Identification Number"
        />
      </div>

      {/* Plate Number */}
      <div>
        <label htmlFor="plateNumber" className="block text-sm font-medium mb-2">
          Plate Number
        </label>
        <input
          id="plateNumber"
          type="text"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          placeholder="License plate"
        />
      </div>

      {/* Tab Expiration */}
      <div>
        <label htmlFor="tabExpiration" className="block text-sm font-medium mb-2">
          Tab Expiration
        </label>
        <input
          id="tabExpiration"
          type="date"
          value={tabExpiration}
          onChange={(e) => setTabExpiration(e.target.value)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Mileage */}
      <div>
        <label htmlFor="mileage" className="block text-sm font-medium mb-2">
          Mileage
        </label>
        <input
          id="mileage"
          type="text"
          value={mileage}
          onChange={(e) => setMileage(e.target.value)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g., 12,500 - 8/27/25"
        />
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium mb-2">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as MotorcycleStatus)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="active">Active</option>
          <option value="maintenance">Needs Maintenance</option>
          <option value="sold">Sold</option>
          <option value="traded">Traded</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-2">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Additional notes..."
        />
      </div>

      {/* Photo Upload (only in edit mode) */}
      {mode === 'edit' && bike && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Photos
          </label>
          <PhotoUploader motorcycleId={bike.id} />
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !name}
          className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Add Motorcycle' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="py-3 px-6 border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Delete Button (edit mode only) */}
      {mode === 'edit' && bike && (
        <div className="pt-6 border-t border-border">
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-destructive hover:underline text-sm"
            >
              Delete this motorcycle
            </button>
          ) : (
            <div className="bg-destructive/10 border border-destructive p-4">
              <p className="text-destructive font-medium mb-3">
                Are you sure you want to delete &ldquo;{bike.name}&rdquo;? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelete(false)}
                  className="px-4 py-2 border border-border hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
