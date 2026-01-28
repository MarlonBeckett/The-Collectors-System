'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';
import { parseFlexibleDate, formatDateForDB } from '@/lib/dateUtils';
import { parseStatusFromNotes } from '@/lib/statusParser';
import { DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  name?: string;
  make?: string;
  model?: string;
  nickname?: string;
  year?: string;
  vin?: string;
  plate_number?: string;
  mileage?: string;
  notes?: string;
  tab_expiration?: string;
  vehicle_type?: string;
  status?: string;
  purchase_price?: string;
  purchase_date?: string;
  maintenance_notes?: string;
  estimated_value?: string;
}

interface PreviewRow {
  original: CSVRow;
  mapped: {
    name: string;
    make: string | null;
    model: string | null;
    nickname: string | null;
    year: number | null;
    vin: string | null;
    plate_number: string | null;
    mileage: string | null;
    notes: string | null;
    tab_expiration: string | null;
    vehicle_type: string;
    status: string;
    sale_info: object | null;
    purchase_price: number | null;
    purchase_date: string | null;
    maintenance_notes: string | null;
    estimated_value: number | null;
  };
  valid: boolean;
  error?: string;
}

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
  owner_display_name: string | null;
  owner_email: string | null;
}

// Order determines display in the mapping UI - more specific fields first
const fieldLabels: Record<keyof ColumnMapping, string> = {
  name: 'Name (required)',
  make: 'Make',
  model: 'Model',
  nickname: 'Nickname',
  year: 'Year',
  vin: 'VIN',
  plate_number: 'Plate Number',
  mileage: 'Mileage',
  tab_expiration: 'Tab Expiration',
  vehicle_type: 'Vehicle Type',
  status: 'Status',
  purchase_price: 'Purchase Price',
  purchase_date: 'Purchase Date',
  estimated_value: 'Estimated Value',
  maintenance_notes: 'Maintenance Notes',
  notes: 'Notes (General)',
};

export function CSVImport() {
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [step, setStep] = useState<'select-collection' | 'upload' | 'map' | 'preview' | 'done'>('select-collection');
  const [collectionId, setCollectionId] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch user's collections
  useEffect(() => {
    async function fetchCollections() {
      const { data, error } = await supabase.rpc('get_user_collections');

      if (error) {
        console.error('Error fetching collections:', error);
      } else {
        const cols = (data || []) as UserCollection[];
        setCollections(cols);
        // Auto-select and skip to upload if only one collection
        if (cols.length === 1) {
          setCollectionId(cols[0].id);
          setStep('upload');
        }
      }
      setLoadingCollections(false);
    }
    fetchCollections();
  }, [supabase]);

  const getCollectionDisplayName = (collection: UserCollection) => {
    if (collection.is_owner) {
      return collection.name;
    }
    const ownerName = collection.owner_display_name || collection.owner_email?.split('@')[0] || 'Unknown';
    return `${collection.name} (${ownerName})`;
  };

  const selectedCollection = collections.find(c => c.id === collectionId);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // First, read the file to check for title rows
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      // Split into lines and check if first line looks like a title (single value, no commas or just one field)
      const lines = text.split('\n').filter(line => line.trim());
      let csvText = text;

      // If first line has no commas or significantly fewer commas than second line, it's likely a title
      if (lines.length >= 2) {
        const firstLineCommas = (lines[0].match(/,/g) || []).length;
        const secondLineCommas = (lines[1].match(/,/g) || []).length;

        if (firstLineCommas === 0 || (secondLineCommas > 0 && firstLineCommas < secondLineCommas / 2)) {
          // Skip the title row
          csvText = lines.slice(1).join('\n');
        }
      }

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          let data = results.data as CSVRow[];
          const fields = results.meta.fields || [];

          // Filter out rows where most fields are empty
          data = data.filter((row) => {
            const nonEmptyFields = Object.values(row).filter(v => {
              if (v === null || v === undefined) return false;
              const str = String(v).trim();
              return str !== '';
            });
            return nonEmptyFields.length >= 2;
          });

          setCsvData(data);
          setHeaders(fields);

        // Auto-detect column mappings using partial matching
        const autoMapping: ColumnMapping = {};

        // Define patterns for each field (order matters - first match wins)
        // More specific patterns should come before general ones
        const fieldPatterns: { field: keyof ColumnMapping; patterns: string[] }[] = [
          { field: 'name', patterns: ['name', 'motorcycle', 'bike', 'vehicle', 'title'] },
          { field: 'make', patterns: ['make', 'manufacturer', 'brand'] },
          { field: 'model', patterns: ['model'] },
          { field: 'nickname', patterns: ['nickname', 'alias'] },
          { field: 'year', patterns: ['year', 'yr', 'model year'] },
          { field: 'vin', patterns: ['vin', 'vehicle identification'] },
          { field: 'plate_number', patterns: ['plate', 'license', 'tag'] },
          { field: 'mileage', patterns: ['mile', 'mileage', 'odometer', 'odo'] },
          { field: 'tab_expiration', patterns: ['expir', 'tab', 'renewal', 'due'] },
          { field: 'vehicle_type', patterns: ['vehicle_type', 'vehicle type', 'type'] },
          { field: 'status', patterns: ['status'] },
          { field: 'purchase_price', patterns: ['purchase_price', 'purchase price', 'price', 'cost'] },
          { field: 'purchase_date', patterns: ['purchase_date', 'purchase date', 'bought', 'acquired'] },
          { field: 'estimated_value', patterns: ['estimated_value', 'estimated value', 'value', 'worth'] },
          // maintenance_notes before notes - check for more specific match first
          { field: 'maintenance_notes', patterns: ['maintenance_notes', 'maintenance notes', 'maintenance', 'service'] },
          { field: 'notes', patterns: ['note', 'comment', 'description', 'memo'] },
        ];

        fields.forEach((field) => {
          const normalized = field.toLowerCase().trim();

          for (const { field: targetField, patterns } of fieldPatterns) {
            // Skip if this field is already mapped
            if (autoMapping[targetField]) continue;

            // Check if any pattern matches (partial match)
            if (patterns.some(pattern => normalized.includes(pattern))) {
              autoMapping[targetField] = field;
              break;
            }
          }
        });

          setMapping(autoMapping);
          setStep('map');
        },
        error: (error: Error) => {
          console.error('CSV parse error:', error);
        },
      });
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  const parsePrice = (value: string | undefined): number | null => {
    if (!value) return null;
    // Remove currency symbols, commas, and whitespace
    const cleaned = value.replace(/[$,\s]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const parseVehicleType = (value: string | undefined): string => {
    if (!value) return 'motorcycle';
    const normalized = value.toLowerCase().trim();
    const validTypes = ['motorcycle', 'car', 'boat', 'trailer', 'other'];
    return validTypes.includes(normalized) ? normalized : 'motorcycle';
  };

  const parseStatus = (value: string | undefined): string => {
    if (!value) return 'active';
    const normalized = value.toLowerCase().trim();
    const validStatuses = ['active', 'sold', 'traded', 'stored', 'maintenance'];
    return validStatuses.includes(normalized) ? normalized : 'active';
  };

  const generatePreview = () => {
    const previewRows: PreviewRow[] = csvData.map((row) => {
      const name = mapping.name ? row[mapping.name]?.trim() : '';

      if (!name) {
        return {
          original: row,
          mapped: {
            name: '',
            make: null,
            model: null,
            nickname: null,
            year: null,
            vin: null,
            plate_number: null,
            mileage: null,
            notes: null,
            tab_expiration: null,
            vehicle_type: 'motorcycle',
            status: 'active',
            sale_info: null,
            purchase_price: null,
            purchase_date: null,
            maintenance_notes: null,
            estimated_value: null,
          },
          valid: false,
          error: 'Name is required',
        };
      }

      const notes = mapping.notes ? row[mapping.notes]?.trim() : null;

      // Check if status is explicitly mapped, otherwise try to parse from notes
      const explicitStatus = mapping.status ? row[mapping.status]?.trim() : null;
      let finalStatus: string;
      let saleInfo: object | null = null;
      let finalNotes: string | null = notes;

      if (explicitStatus) {
        finalStatus = parseStatus(explicitStatus);
      } else {
        // Try to parse status from notes
        const parsed = parseStatusFromNotes(notes);
        finalStatus = parsed.status;
        saleInfo = parsed.saleInfo;
        finalNotes = parsed.cleanedNotes || (notes !== parsed.cleanedNotes ? null : notes);
      }

      const tabExpDate = mapping.tab_expiration
        ? parseFlexibleDate(row[mapping.tab_expiration])
        : null;

      const purchaseDate = mapping.purchase_date
        ? parseFlexibleDate(row[mapping.purchase_date])
        : null;

      const yearStr = mapping.year ? row[mapping.year]?.trim() : null;
      let year: number | null = null;
      if (yearStr) {
        const parsed = parseInt(yearStr);
        if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2099) {
          year = parsed;
        }
      }

      return {
        original: row,
        mapped: {
          name,
          make: mapping.make ? row[mapping.make]?.trim() || null : null,
          model: mapping.model ? row[mapping.model]?.trim() || null : null,
          nickname: mapping.nickname ? row[mapping.nickname]?.trim() || null : null,
          year,
          vin: mapping.vin ? row[mapping.vin]?.trim() || null : null,
          plate_number: mapping.plate_number ? row[mapping.plate_number]?.trim() || null : null,
          mileage: mapping.mileage ? row[mapping.mileage]?.trim() || null : null,
          notes: finalNotes,
          tab_expiration: formatDateForDB(tabExpDate),
          vehicle_type: parseVehicleType(mapping.vehicle_type ? row[mapping.vehicle_type] : undefined),
          status: finalStatus,
          sale_info: saleInfo,
          purchase_price: parsePrice(mapping.purchase_price ? row[mapping.purchase_price] : undefined),
          purchase_date: formatDateForDB(purchaseDate),
          maintenance_notes: mapping.maintenance_notes ? row[mapping.maintenance_notes]?.trim() || null : null,
          estimated_value: parsePrice(mapping.estimated_value ? row[mapping.estimated_value] : undefined),
        },
        valid: true,
      };
    });

    setPreview(previewRows);
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;

    const validRows = preview.filter((row) => row.valid);

    for (const row of validRows) {
      try {
        const { error } = await supabase.from('motorcycles').insert({
          name: row.mapped.name,
          make: row.mapped.make,
          model: row.mapped.model,
          nickname: row.mapped.nickname,
          year: row.mapped.year,
          vin: row.mapped.vin,
          plate_number: row.mapped.plate_number,
          mileage: row.mapped.mileage,
          notes: row.mapped.notes,
          tab_expiration: row.mapped.tab_expiration,
          vehicle_type: row.mapped.vehicle_type as 'motorcycle' | 'car' | 'boat' | 'trailer' | 'other',
          status: row.mapped.status as 'active' | 'sold' | 'traded' | 'stored' | 'maintenance',
          sale_info: row.mapped.sale_info,
          purchase_price: row.mapped.purchase_price,
          purchase_date: row.mapped.purchase_date,
          maintenance_notes: row.mapped.maintenance_notes,
          estimated_value: row.mapped.estimated_value,
          collection_id: collectionId,
        });

        if (error) {
          console.error('Insert error:', error);
          failed++;
        } else {
          success++;
        }
      } catch (err) {
        console.error('Insert error:', err);
        failed++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);
    setStep('done');
  };

  const reset = () => {
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setPreview([]);
    setImportResult(null);
    // Go back to collection selection if multiple collections, otherwise to upload
    if (collections.length > 1) {
      setCollectionId(null);
      setStep('select-collection');
    } else {
      setStep('upload');
    }
  };

  if (loadingCollections) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading collections...
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No collections found.</p>
        <a
          href="/settings"
          className="text-primary hover:underline"
        >
          Create or join a collection
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 0: Select Collection */}
      {step === 'select-collection' && (
        <div className="space-y-6">
          <div className="bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">Select Collection</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Choose which collection to import vehicles into
            </p>
            <select
              value={collectionId || ''}
              onChange={(e) => setCollectionId(e.target.value || null)}
              className="w-full px-4 py-2 text-base bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a collection...</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {getCollectionDisplayName(collection)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setStep('upload')}
            disabled={!collectionId}
            className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <>
          {/* Show selected collection */}
          <div className="bg-muted/50 border border-border p-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Importing to: </span>
              <span className="font-medium">{selectedCollection ? getCollectionDisplayName(selectedCollection) : ''}</span>
            </div>
            {collections.length > 1 && (
              <button
                onClick={() => setStep('select-collection')}
                className="text-sm text-primary hover:underline"
              >
                Change
              </button>
            )}
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary'
            }`}
          >
            <input {...getInputProps()} />
            <DocumentArrowUpIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-medium text-foreground">
              {isDragActive ? 'Drop CSV file here...' : 'Drop your CSV file here'}
            </p>
            <p className="text-muted-foreground mt-1">
              or tap to select a file
            </p>
          </div>
        </>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'map' && (
        <div className="space-y-6">
          {/* Show selected collection */}
          <div className="bg-muted/50 border border-border p-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Importing to: </span>
              <span className="font-medium">{selectedCollection ? getCollectionDisplayName(selectedCollection) : ''}</span>
            </div>
          </div>

          <div className="bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">File loaded: {csvData.length} rows</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Map your CSV columns to vehicle fields
            </p>
            <p className="text-xs text-muted-foreground">
              Detected columns: {headers.join(', ')}
            </p>
          </div>

          <div className="space-y-4">
            {(Object.keys(fieldLabels) as (keyof ColumnMapping)[]).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium mb-1">
                  {fieldLabels[field]}
                </label>
                <select
                  value={mapping[field] || ''}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [field]: e.target.value || undefined,
                    }))
                  }
                  className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">-- Not mapped --</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={generatePreview}
              disabled={!mapping.name}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Preview Import
            </button>
            <button
              onClick={reset}
              className="py-3 px-6 border border-border hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Show selected collection */}
          <div className="bg-muted/50 border border-border p-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Importing to: </span>
              <span className="font-medium">{selectedCollection ? getCollectionDisplayName(selectedCollection) : ''}</span>
            </div>
          </div>

          <div className="bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">
              Ready to import {preview.filter((r) => r.valid).length} of {preview.length} rows
            </h3>
            {preview.some((r) => !r.valid) && (
              <p className="text-sm text-destructive">
                {preview.filter((r) => !r.valid).length} rows will be skipped (missing name)
              </p>
            )}
          </div>

          <div className="border border-border overflow-hidden">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium w-8"></th>
                    <th className="px-2 py-2 text-left font-medium">Name</th>
                    <th className="px-2 py-2 text-left font-medium">Make/Model</th>
                    <th className="px-2 py-2 text-left font-medium">Year</th>
                    <th className="px-2 py-2 text-left font-medium">Type</th>
                    <th className="px-2 py-2 text-left font-medium">VIN</th>
                    <th className="px-2 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr
                      key={index}
                      className={`border-t border-border ${
                        !row.valid ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <td className="px-2 py-2">
                        {row.valid ? (
                          <CheckCircleIcon className="w-4 h-4 text-secondary" />
                        ) : (
                          <XCircleIcon className="w-4 h-4 text-destructive" />
                        )}
                      </td>
                      <td className="px-2 py-2 font-medium max-w-[120px] truncate">
                        {row.mapped.name || <span className="text-destructive">Missing</span>}
                      </td>
                      <td className="px-2 py-2 text-xs max-w-[100px] truncate">
                        {[row.mapped.make, row.mapped.model].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-2 py-2">{row.mapped.year || '-'}</td>
                      <td className="px-2 py-2 capitalize text-xs">{row.mapped.vehicle_type}</td>
                      <td className="px-2 py-2 font-mono text-xs max-w-[80px] truncate">{row.mapped.vin || '-'}</td>
                      <td className="px-2 py-2 capitalize text-xs">{row.mapped.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing || preview.filter((r) => r.valid).length === 0}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${preview.filter((r) => r.valid).length} Vehicles`}
            </button>
            <button
              onClick={() => setStep('map')}
              disabled={importing}
              className="py-3 px-6 border border-border hover:bg-muted"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && importResult && (
        <div className="space-y-6">
          <div className={`border p-6 text-center ${
            importResult.failed === 0 ? 'bg-secondary/10 border-secondary' : 'bg-primary/10 border-primary'
          }`}>
            <CheckCircleIcon className="w-12 h-12 mx-auto text-secondary mb-3" />
            <h3 className="text-xl font-semibold mb-2">Import Complete</h3>
            <p className="text-muted-foreground">
              Successfully imported {importResult.success} vehicle{importResult.success !== 1 ? 's' : ''}
              {importResult.failed > 0 && (
                <span className="text-destructive">
                  . {importResult.failed} failed.
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/"
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold text-center hover:opacity-90"
            >
              View Collection
            </a>
            <button
              onClick={reset}
              className="py-3 px-6 border border-border hover:bg-muted"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
