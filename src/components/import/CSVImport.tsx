'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';
import { parseFlexibleDate, formatDateForDB } from '@/lib/dateUtils';
import { parseStatusFromNotes } from '@/lib/statusParser';
import { DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface CSVImportProps {
  collections: UserCollection[];
}

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  name?: string;
  year?: string;
  vin?: string;
  plate_number?: string;
  mileage?: string;
  notes?: string;
  tab_expiration?: string;
  make?: string;
  model?: string;
  nickname?: string;
  vehicle_type?: string;
  purchase_price?: string;
  purchase_date?: string;
  status?: string;
  maintenance_notes?: string;
}

interface PreviewRow {
  original: CSVRow;
  mapped: {
    name: string;
    year: number | null;
    vin: string | null;
    plate_number: string | null;
    mileage: string | null;
    notes: string | null;
    tab_expiration: string | null;
    make: string | null;
    model: string | null;
    nickname: string | null;
    vehicle_type: string;
    purchase_price: number | null;
    purchase_date: string | null;
    status: string;
    sale_info: object | null;
    maintenance_notes: string | null;
  };
  valid: boolean;
  error?: string;
}

const fieldLabels: Record<keyof ColumnMapping, string> = {
  name: 'Name (required)',
  make: 'Make',
  model: 'Model',
  year: 'Year',
  nickname: 'Nickname',
  vehicle_type: 'Vehicle Type',
  vin: 'VIN',
  plate_number: 'Plate Number',
  mileage: 'Mileage',
  tab_expiration: 'Tab Expiration',
  status: 'Status',
  notes: 'Notes',
  purchase_price: 'Purchase Price',
  purchase_date: 'Purchase Date',
  maintenance_notes: 'Maintenance Notes',
};

export function CSVImport({ collections }: CSVImportProps) {
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');

  // Default to first owned collection, or first collection if none owned
  const defaultCollection = collections.find(c => c.is_owner) || collections[0];
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(defaultCollection?.id || '');

  const supabase = createClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(line => line.trim());
      let csvText = text;

      if (lines.length >= 2) {
        const firstLineCommas = (lines[0].match(/,/g) || []).length;
        const secondLineCommas = (lines[1].match(/,/g) || []).length;

        if (firstLineCommas === 0 || (secondLineCommas > 0 && firstLineCommas < secondLineCommas / 2)) {
          csvText = lines.slice(1).join('\n');
        }
      }

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          let data = results.data as CSVRow[];
          const fields = results.meta.fields || [];

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

          const autoMapping: ColumnMapping = {};

          const fieldPatterns: { field: keyof ColumnMapping; patterns: string[] }[] = [
            { field: 'name', patterns: ['name', 'motorcycle', 'bike', 'vehicle', 'title'] },
            { field: 'make', patterns: ['make', 'manufacturer', 'brand'] },
            { field: 'model', patterns: ['model'] },
            { field: 'year', patterns: ['year', 'yr', 'model year'] },
            { field: 'nickname', patterns: ['nickname', 'alias'] },
            { field: 'vehicle_type', patterns: ['vehicle_type', 'type', 'category'] },
            { field: 'vin', patterns: ['vin', 'vehicle identification'] },
            { field: 'plate_number', patterns: ['plate', 'license', 'tag', 'registration'] },
            { field: 'mileage', patterns: ['mile', 'mileage', 'odometer', 'odo'] },
            { field: 'tab_expiration', patterns: ['expir', 'tab', 'renewal', 'due'] },
            { field: 'status', patterns: ['status'] },
            { field: 'notes', patterns: ['note', 'comment', 'description', 'memo'] },
            { field: 'purchase_price', patterns: ['purchase_price', 'price', 'cost', 'paid'] },
            { field: 'purchase_date', patterns: ['purchase_date', 'bought', 'acquired'] },
            { field: 'maintenance_notes', patterns: ['maintenance', 'service', 'repair'] },
          ];

          fields.forEach((field) => {
            const normalized = field.toLowerCase().trim();

            for (const { field: targetField, patterns } of fieldPatterns) {
              if (autoMapping[targetField]) continue;

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

  const generatePreview = () => {
    const previewRows: PreviewRow[] = csvData.map((row) => {
      const name = mapping.name ? row[mapping.name]?.trim() : '';

      if (!name) {
        return {
          original: row,
          mapped: {
            name: '',
            year: null,
            vin: null,
            plate_number: null,
            mileage: null,
            notes: null,
            tab_expiration: null,
            make: null,
            model: null,
            nickname: null,
            vehicle_type: 'motorcycle',
            purchase_price: null,
            purchase_date: null,
            status: 'active',
            sale_info: null,
            maintenance_notes: null,
          },
          valid: false,
          error: 'Name is required',
        };
      }

      const notes = mapping.notes ? row[mapping.notes]?.trim() : null;
      const { status: parsedStatus, saleInfo, cleanedNotes } = parseStatusFromNotes(notes);

      // Use explicit status mapping if available, otherwise use parsed from notes
      let status: string = parsedStatus;
      if (mapping.status) {
        const statusValue = row[mapping.status]?.trim()?.toLowerCase();
        if (['active', 'sold', 'traded', 'stored', 'maintenance'].includes(statusValue)) {
          status = statusValue;
        }
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

      const purchasePriceStr = mapping.purchase_price ? row[mapping.purchase_price]?.trim() : null;
      let purchasePrice: number | null = null;
      if (purchasePriceStr) {
        const cleaned = purchasePriceStr.replace(/[$,]/g, '');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) {
          purchasePrice = parsed;
        }
      }

      const vehicleTypeStr = mapping.vehicle_type ? row[mapping.vehicle_type]?.trim()?.toLowerCase() : null;
      let vehicleType = 'motorcycle';
      if (vehicleTypeStr && ['motorcycle', 'car', 'boat', 'trailer', 'other'].includes(vehicleTypeStr)) {
        vehicleType = vehicleTypeStr;
      }

      return {
        original: row,
        mapped: {
          name,
          year,
          vin: mapping.vin ? row[mapping.vin]?.trim() || null : null,
          plate_number: mapping.plate_number ? row[mapping.plate_number]?.trim() || null : null,
          mileage: mapping.mileage ? row[mapping.mileage]?.trim() || null : null,
          notes: cleanedNotes || (notes !== cleanedNotes ? null : notes),
          tab_expiration: formatDateForDB(tabExpDate),
          make: mapping.make ? row[mapping.make]?.trim() || null : null,
          model: mapping.model ? row[mapping.model]?.trim() || null : null,
          nickname: mapping.nickname ? row[mapping.nickname]?.trim() || null : null,
          vehicle_type: vehicleType,
          purchase_price: purchasePrice,
          purchase_date: formatDateForDB(purchaseDate),
          status,
          sale_info: saleInfo,
          maintenance_notes: mapping.maintenance_notes ? row[mapping.maintenance_notes]?.trim() || null : null,
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
          year: row.mapped.year,
          vin: row.mapped.vin,
          plate_number: row.mapped.plate_number,
          mileage: row.mapped.mileage,
          notes: row.mapped.notes,
          tab_expiration: row.mapped.tab_expiration,
          make: row.mapped.make,
          model: row.mapped.model,
          nickname: row.mapped.nickname,
          vehicle_type: row.mapped.vehicle_type as 'motorcycle' | 'car' | 'boat' | 'trailer' | 'other',
          purchase_price: row.mapped.purchase_price,
          purchase_date: row.mapped.purchase_date,
          status: row.mapped.status as 'active' | 'sold' | 'traded' | 'stored' | 'maintenance',
          sale_info: row.mapped.sale_info,
          maintenance_notes: row.mapped.maintenance_notes,
          collection_id: selectedCollectionId,
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
    setStep('upload');
  };

  return (
    <div className="space-y-6">
      {/* Collection Selector */}
      {collections.length > 0 && step !== 'done' && (
        <div className="bg-card border border-border p-4">
          <label className="block text-sm font-medium mb-2">
            Import to Collection
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

      {/* Step 1: Upload */}
      {step === 'upload' && (
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
      )}

      {/* Step 2: Column Mapping */}
      {step === 'map' && (
        <div className="space-y-6">
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
                      <td className="px-2 py-2 font-medium max-w-[150px] truncate">
                        {row.mapped.name || <span className="text-destructive">Missing</span>}
                      </td>
                      <td className="px-2 py-2 text-xs max-w-[120px] truncate">
                        {[row.mapped.make, row.mapped.model].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-2 py-2">{row.mapped.year || '-'}</td>
                      <td className="px-2 py-2 font-mono text-xs max-w-[100px] truncate">{row.mapped.vin || '-'}</td>
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
