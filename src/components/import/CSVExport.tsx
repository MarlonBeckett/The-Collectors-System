'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle } from '@/types/database';
import {
  generateCSV,
  downloadCSV,
  getExportFilename,
  ExportOptions,
} from '@/lib/exportUtils';
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useSelectedCollection } from '@/hooks/useSelectedCollection';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface CSVExportProps {
  collections: UserCollection[];
}

export function CSVExport({ collections }: CSVExportProps) {
  const [allVehicles, setAllVehicles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    includeInactive: true,
    encodeStatusInNotes: true,
  });

  const [selectedCollectionId, setSelectedCollectionId] = useSelectedCollection(collections);

  const supabase = createClient();

  useEffect(() => {
    async function fetchVehicles() {
      const { data, error } = await supabase
        .from('motorcycles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vehicles:', error);
      } else {
        setAllVehicles(data as Motorcycle[]);
      }
      setLoading(false);
    }

    fetchVehicles();
  }, [supabase]);

  // Filter vehicles by selected collection
  const vehicles = selectedCollectionId
    ? allVehicles.filter(v => v.collection_id === selectedCollectionId)
    : allVehicles;

  const activeCount = vehicles.filter(
    (v) => v.status === 'active' || v.status === 'maintenance'
  ).length;
  const inactiveCount = vehicles.length - activeCount;

  const exportCount = options.includeInactive ? vehicles.length : activeCount;

  const handleExport = () => {
    setExporting(true);

    try {
      const csv = generateCSV(vehicles, options);
      const selectedCollection = collections.find(c => c.id === selectedCollectionId);
      const collectionName = selectedCollection?.name.toLowerCase().replace(/\s+/g, '-') || 'vehicles';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${collectionName}-export-${date}.csv`;
      downloadCSV(csv, filename);
      setExported(true);

      // Reset after 3 seconds
      setTimeout(() => setExported(false), 3000);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading vehicles...
      </div>
    );
  }

  if (allVehicles.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No vehicles to export.</p>
        <a
          href="/vehicles/new"
          className="text-primary hover:underline"
        >
          Add your first vehicle
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collection Selector */}
      {collections.length > 0 && (
        <div className="bg-card border border-border p-4">
          <label className="block text-sm font-medium mb-2">
            Export from Collection
          </label>
          <select
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name} {collection.is_owner ? '(Owner)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats */}
      <div className="bg-card border border-border p-4">
        <h3 className="font-semibold mb-2">Collection Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">{vehicles.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-secondary">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
            <div className="text-xs text-muted-foreground">Inactive</div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-4">
        <h3 className="font-semibold">Export Options</h3>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={options.includeInactive}
            onChange={(e) =>
              setOptions((prev) => ({
                ...prev,
                includeInactive: e.target.checked,
              }))
            }
            className="mt-1 w-4 h-4 text-primary border-input rounded focus:ring-primary"
          />
          <div>
            <div className="font-medium">Include inactive vehicles</div>
            <div className="text-sm text-muted-foreground">
              Export sold and traded vehicles
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={options.encodeStatusInNotes}
            onChange={(e) =>
              setOptions((prev) => ({
                ...prev,
                encodeStatusInNotes: e.target.checked,
              }))
            }
            className="mt-1 w-4 h-4 text-primary border-input rounded focus:ring-primary"
          />
          <div>
            <div className="font-medium">Encode status in notes</div>
            <div className="text-sm text-muted-foreground">
              Prefix notes with SOLD/TRADED for re-import compatibility
            </div>
          </div>
        </label>
      </div>

      {/* Export Preview */}
      <div className="bg-muted/50 border border-border p-4">
        <h3 className="font-semibold mb-2">Export Preview</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {exportCount} vehicle{exportCount !== 1 ? 's' : ''} will be exported
        </p>
        <div className="text-xs text-muted-foreground">
          <strong>Fields:</strong> name, make, model, year, vehicle_type, vin,
          plate_number, mileage, tab_expiration, status, notes, purchase_price,
          purchase_date, nickname, maintenance_notes
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={exporting || exportCount === 0}
        className={`w-full py-3 px-4 font-semibold flex items-center justify-center gap-2 transition-all ${
          exported
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {exported ? (
          <>
            <CheckCircleIcon className="w-5 h-5" />
            Exported Successfully
          </>
        ) : exporting ? (
          'Exporting...'
        ) : (
          <>
            <ArrowDownTrayIcon className="w-5 h-5" />
            Export {exportCount} Vehicle{exportCount !== 1 ? 's' : ''} to CSV
          </>
        )}
      </button>
    </div>
  );
}
