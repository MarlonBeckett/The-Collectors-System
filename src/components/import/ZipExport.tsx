'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle } from '@/types/database';
import {
  generateCSV,
  downloadCSV,
  ExportOptions,
  generateDocumentsCSV,
  generateServiceRecordsCSV,
} from '@/lib/exportUtils';
import { VehicleDocument, ServiceRecord } from '@/types/database';
import {
  exportCollectionZip,
  exportVehicleZip,
  ExportProgress,
  ExportResult,
} from '@/lib/zipExport';
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  TableCellsIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface ZipExportProps {
  collections: UserCollection[];
}

type ExportMode = 'collection' | 'vehicle' | 'csv';

export function ZipExport({ collections }: ZipExportProps) {
  const [allVehicles, setAllVehicles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('collection');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [csvOptions, setCsvOptions] = useState<ExportOptions>({
    includeInactive: true,
    encodeStatusInNotes: true,
  });

  const defaultCollection = collections.find((c) => c.is_owner) || collections[0];
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    defaultCollection?.id || ''
  );

  const abortRef = useRef<AbortController | null>(null);

  // Abort any running export on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const supabase = createClient();

  useEffect(() => {
    async function fetchVehicles() {
      const { data, error } = await supabase
        .from('motorcycles')
        .select('*')
        .order('name');

      if (!error && data) {
        setAllVehicles(data as Motorcycle[]);
      }
      setLoading(false);
    }
    fetchVehicles();
  }, [supabase]);

  const vehicles = selectedCollectionId
    ? allVehicles.filter((v) => v.collection_id === selectedCollectionId)
    : allVehicles;

  const activeCount = vehicles.filter(
    (v) => v.status === 'active' || v.status === 'maintenance'
  ).length;
  const inactiveCount = vehicles.length - activeCount;

  // Warn before closing during export
  useEffect(() => {
    if (!exporting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [exporting]);

  const handleProgress = useCallback((p: ExportProgress) => {
    setProgress(p);
  }, []);

  const handleCollectionExport = async () => {
    const collection = collections.find((c) => c.id === selectedCollectionId);
    if (!collection) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setExporting(true);
    setResult(null);
    setProgress({ phase: 'Starting', current: 0, total: 1, message: 'Starting export...' });

    try {
      const res = await exportCollectionZip(
        selectedCollectionId,
        collection.name,
        supabase,
        csvOptions,
        handleProgress,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setResult(res);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Export error:', err);
        setResult({ success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export failed unexpectedly'] });
      }
    } finally {
      if (!controller.signal.aborted) {
        setExporting(false);
        setProgress(null);
      }
    }
  };

  const handleVehicleExport = async () => {
    if (!selectedVehicleId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setExporting(true);
    setResult(null);
    setProgress({ phase: 'Starting', current: 0, total: 1, message: 'Starting export...' });

    try {
      const res = await exportVehicleZip(selectedVehicleId, supabase, handleProgress, controller.signal);
      if (!controller.signal.aborted) {
        setResult(res);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Export error:', err);
        setResult({ success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export failed unexpectedly'] });
      }
    } finally {
      if (!controller.signal.aborted) {
        setExporting(false);
        setProgress(null);
      }
    }
  };

  const handleCsvExport = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setExporting(true);
    setResult(null);
    try {
      const collection = collections.find((c) => c.id === selectedCollectionId);
      const collectionName = collection?.name.toLowerCase().replace(/\s+/g, '-') || 'vehicles';
      const date = new Date().toISOString().split('T')[0];

      const vehiclesCsv = generateCSV(vehicles, csvOptions);

      // Fetch documents and service records for all vehicles
      const vehicleIds = vehicles.map((v) => v.id);
      const vehicleNameMap = new Map(vehicles.map((v) => [v.id, v.name]));

      const [docsRes, recordsRes] = await Promise.all([
        vehicleIds.length > 0
          ? supabase.from('vehicle_documents').select('*').in('motorcycle_id', vehicleIds)
          : Promise.resolve({ data: [], error: null }),
        vehicleIds.length > 0
          ? supabase.from('service_records').select('*').in('motorcycle_id', vehicleIds).order('service_date', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const documents = ((docsRes.data || []) as VehicleDocument[]).map((d) => ({
        ...d,
        vehicle_name: vehicleNameMap.get(d.motorcycle_id) || '',
      }));

      const serviceRecords = ((recordsRes.data || []) as ServiceRecord[]).map((r) => ({
        ...r,
        vehicle_name: vehicleNameMap.get(r.motorcycle_id) || '',
      }));

      // If there are documents or service records, bundle as ZIP
      if (documents.length > 0 || serviceRecords.length > 0) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        let fileCount = 1;

        zip.file('vehicles.csv', vehiclesCsv);

        if (documents.length > 0) {
          zip.file('documents.csv', generateDocumentsCSV(documents));
          fileCount++;
        }

        if (serviceRecords.length > 0) {
          zip.file('service-records.csv', generateServiceRecordsCSV(serviceRecords));
          fileCount++;
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${collectionName}-export-${date}.zip`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (!controller.signal.aborted) {
          setResult({ success: true, totalFiles: fileCount, skippedFiles: 0, skippedDetails: [] });
        }
      } else {
        // No related data, just download plain CSV
        downloadCSV(vehiclesCsv, `${collectionName}-export-${date}.csv`);
        if (!controller.signal.aborted) {
          setResult({ success: true, totalFiles: 1, skippedFiles: 0, skippedDetails: [] });
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('CSV export error:', err);
        setResult({ success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['CSV export failed'] });
      }
    } finally {
      if (!controller.signal.aborted) {
        setExporting(false);
      }
    }
  };

  const handleExport = () => {
    if (exportMode === 'collection') handleCollectionExport();
    else if (exportMode === 'vehicle') handleVehicleExport();
    else handleCsvExport();
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading vehicles...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collection Selector */}
      {collections.length > 0 && (
        <div className="bg-card border border-border p-4">
          <label className="block text-sm font-medium mb-2">Collection</label>
          <select
            value={selectedCollectionId}
            onChange={(e) => {
              setSelectedCollectionId(e.target.value);
              setSelectedVehicleId('');
              setResult(null);
            }}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name} {collection.is_owner ? '(Owner)' : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>{vehicles.length} total</span>
            <span>{activeCount} active</span>
            {inactiveCount > 0 && <span>{inactiveCount} inactive</span>}
          </div>
        </div>
      )}

      {/* Export Mode Cards */}
      <div className="space-y-3">
        <h3 className="font-semibold">Export Type</h3>

        <button
          onClick={() => { setExportMode('collection'); setResult(null); }}
          disabled={exporting}
          className={`w-full text-left p-4 border transition-colors ${
            exportMode === 'collection'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:bg-muted/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <ArchiveBoxIcon className={`w-5 h-5 mt-0.5 shrink-0 ${exportMode === 'collection' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <div className="font-medium">Full Collection Backup</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                ZIP with all vehicles, photos, documents, service records, and history
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setExportMode('vehicle'); setResult(null); }}
          disabled={exporting}
          className={`w-full text-left p-4 border transition-colors ${
            exportMode === 'vehicle'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:bg-muted/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <ArrowDownTrayIcon className={`w-5 h-5 mt-0.5 shrink-0 ${exportMode === 'vehicle' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <div className="font-medium">Single Vehicle Backup</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                ZIP with all files for one vehicle
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setExportMode('csv'); setResult(null); }}
          disabled={exporting}
          className={`w-full text-left p-4 border transition-colors ${
            exportMode === 'csv'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:bg-muted/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <TableCellsIcon className={`w-5 h-5 mt-0.5 shrink-0 ${exportMode === 'csv' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div>
              <div className="font-medium">CSV Spreadsheet</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Vehicles, documents, and service records — no photos or files
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Vehicle picker for single vehicle mode */}
      {exportMode === 'vehicle' && (
        <div className="bg-card border border-border p-4">
          <label className="block text-sm font-medium mb-2">Select Vehicle</label>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles in this collection.</p>
          ) : (
            <select
              value={selectedVehicleId}
              onChange={(e) => { setSelectedVehicleId(e.target.value); setResult(null); }}
              className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Choose a vehicle...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.year ? `(${v.year})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* CSV options (shown for collection ZIP and CSV modes) */}
      {(exportMode === 'collection' || exportMode === 'csv') && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">
            {exportMode === 'csv' ? 'Export Options' : 'CSV Options'}
          </h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={csvOptions.includeInactive}
              onChange={(e) =>
                setCsvOptions((prev) => ({ ...prev, includeInactive: e.target.checked }))
              }
              className="mt-1 w-4 h-4 text-primary border-input rounded focus:ring-primary"
            />
            <div>
              <div className="text-sm font-medium">Include inactive vehicles</div>
              <div className="text-xs text-muted-foreground">Export sold and traded vehicles</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={csvOptions.encodeStatusInNotes}
              onChange={(e) =>
                setCsvOptions((prev) => ({ ...prev, encodeStatusInNotes: e.target.checked }))
              }
              className="mt-1 w-4 h-4 text-primary border-input rounded focus:ring-primary"
            />
            <div>
              <div className="text-sm font-medium">Encode status in notes</div>
              <div className="text-xs text-muted-foreground">
                Prefix notes with SOLD/TRADED for re-import compatibility
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Progress bar */}
      {exporting && progress && (
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{progress.phase}</span>
            {progress.total > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {progress.current}/{progress.total}
              </span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="w-full bg-muted h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{
                  width: `${Math.round((progress.current / progress.total) * 100)}%`,
                }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground truncate">{progress.message}</p>
        </div>
      )}

      {/* Result summary */}
      {result && !exporting && (
        <div
          className={`border p-4 ${
            result.success
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-destructive/5 border-destructive/20'
          }`}
        >
          {result.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium">Export complete</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {result.totalFiles} file{result.totalFiles !== 1 ? 's' : ''} exported
                {result.skippedFiles > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {' '}&middot; {result.skippedFiles} skipped
                  </span>
                )}
              </p>
              {result.skippedDetails.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    View skipped files
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {result.skippedDetails.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-destructive" />
              <span className="font-medium text-destructive">
                {result.skippedDetails[0] || 'Export failed'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={
          exporting ||
          vehicles.length === 0 ||
          (exportMode === 'vehicle' && !selectedVehicleId)
        }
        className="w-full py-3 px-4 font-semibold flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {exporting ? (
          'Exporting...'
        ) : exportMode === 'csv' ? (
          <>
            <TableCellsIcon className="w-5 h-5" />
            Export CSV
          </>
        ) : (
          <>
            <ArchiveBoxIcon className="w-5 h-5" />
            Export ZIP
          </>
        )}
      </button>

      {vehicles.length === 0 && !loading && (
        <p className="text-center text-sm text-muted-foreground">
          No vehicles to export in this collection.
        </p>
      )}
    </div>
  );
}
