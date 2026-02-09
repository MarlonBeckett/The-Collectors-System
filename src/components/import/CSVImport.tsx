'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/client';
import { parseFlexibleDate, formatDateForDB } from '@/lib/dateUtils';
import { parseStatusFromNotes } from '@/lib/statusParser';
import { DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { DocumentType, ServiceCategory } from '@/types/database';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface SubscriptionInfo {
  isPro: boolean;
  vehicleCount: number;
  vehicleLimit: number;
}

interface CSVImportProps {
  collections: UserCollection[];
  subscriptionInfo: SubscriptionInfo;
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
    estimated_value: number | null;
    sale_info_type: string | null;
    sale_info_date: string | null;
    sale_info_amount: number | null;
    sale_info_notes: string | null;
  };
  valid: boolean;
  error?: string;
}

interface DocumentRow {
  vehicle_name: string;
  title: string;
  document_type: string;
  expiration_date: string;
  notes: string;
  file_name: string;
  file_type: string;
}

interface ServiceRecordRow {
  vehicle_name: string;
  service_date: string;
  title: string;
  description: string;
  cost: string;
  odometer: string;
  shop_name: string;
  category: string;
  receipt_files: string;
}

interface MileageRow {
  vehicle_name: string;
  mileage: string;
  recorded_date: string;
  notes: string;
}

interface ZipFileEntry {
  name: string;
  entry: JSZip.JSZipObject;
}

interface VehicleZipFiles {
  photos: ZipFileEntry[];
  documents: ZipFileEntry[];
  receipts: ZipFileEntry[];
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

function parseCSVText(text: string): CSVRow[] {
  const lines = text.split('\n').filter(line => line.trim());
  let csvText = text;

  if (lines.length >= 2) {
    const firstLineCommas = (lines[0].match(/,/g) || []).length;
    const secondLineCommas = (lines[1].match(/,/g) || []).length;

    if (firstLineCommas === 0 || (secondLineCommas > 0 && firstLineCommas < secondLineCommas / 2)) {
      csvText = lines.slice(1).join('\n');
    }
  }

  let result: CSVRow[] = [];
  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      result = (results.data as CSVRow[]).filter((row) => {
        const nonEmptyFields = Object.values(row).filter(v => {
          if (v === null || v === undefined) return false;
          return String(v).trim() !== '';
        });
        return nonEmptyFields.length >= 2;
      });
    },
  });
  return result;
}

/**
 * Detect if a CSV uses the comprehensive format (has record_type column).
 * If so, split rows into vehicles, services, documents, mileage.
 */
function parseComprehensiveCSV(rows: CSVRow[]): {
  isComprehensive: boolean;
  vehicleRows: CSVRow[];
  serviceRows: ServiceRecordRow[];
  documentRows: DocumentRow[];
  mileageRows: MileageRow[];
} {
  if (rows.length === 0) {
    return { isComprehensive: false, vehicleRows: [], serviceRows: [], documentRows: [], mileageRows: [] };
  }

  // Check if first row has record_type field
  const firstRow = rows[0];
  if (!('record_type' in firstRow)) {
    return { isComprehensive: false, vehicleRows: rows, serviceRows: [], documentRows: [], mileageRows: [] };
  }

  const vehicleRows: CSVRow[] = [];
  const serviceRows: ServiceRecordRow[] = [];
  const documentRows: DocumentRow[] = [];
  const mileageRows: MileageRow[] = [];

  for (const row of rows) {
    const recordType = row.record_type?.trim()?.toLowerCase();
    const vehicleName = row.vehicle_name?.trim() || '';

    if (!vehicleName) continue;

    switch (recordType) {
      case 'vehicle':
        vehicleRows.push(row);
        break;
      case 'service':
        serviceRows.push({
          vehicle_name: vehicleName,
          service_date: row.service_date?.trim() || '',
          title: row.service_title?.trim() || '',
          description: row.service_description?.trim() || '',
          cost: row.service_cost?.trim() || '',
          odometer: row.service_odometer?.trim() || '',
          shop_name: row.service_shop?.trim() || '',
          category: row.service_category?.trim() || '',
          receipt_files: row.service_receipt_files?.trim() || '',
        });
        break;
      case 'document':
        documentRows.push({
          vehicle_name: vehicleName,
          title: row.document_title?.trim() || '',
          document_type: row.document_type?.trim() || '',
          expiration_date: row.document_expiration?.trim() || '',
          notes: row.notes?.trim() || '',
          file_name: row.document_file_name?.trim() || '',
          file_type: row.document_file_type?.trim() || '',
        });
        break;
      case 'mileage':
        mileageRows.push({
          vehicle_name: vehicleName,
          mileage: row.mileage?.trim() || '',
          recorded_date: row.recorded_date?.trim() || '',
          notes: row.notes?.trim() || '',
        });
        break;
    }
  }

  return { isComprehensive: true, vehicleRows, serviceRows, documentRows, mileageRows };
}

/**
 * Build a map of vehicle name -> zip file entries for photos, documents, receipts.
 * Handles both new structure (images/, documents/, receipts/ at root) and
 * old structure (motorcycles/{name}/images/...).
 */
function buildZipFileMap(zip: JSZip): {
  isNewStructure: boolean;
  fileMap: Map<string, VehicleZipFiles>;
} {
  const fileMap = new Map<string, VehicleZipFiles>();

  // Detect structure: check if we have top-level images/, documents/, or receipts/ folders
  const paths = Object.keys(zip.files);
  const segments = paths.map(p => p.split('/'));

  // Find the root folder (first path segment that contains subfolders)
  // Could be like "CollectionName-2025-01-01/images/..." or just "images/..."
  let rootPrefix = '';
  const hasMotorcycles = segments.some(s => s.includes('motorcycles'));
  const hasImages = segments.some(s => s.includes('images'));
  const hasDocuments = segments.some(s => s.includes('documents'));
  const hasReceipts = segments.some(s => s.includes('receipts'));

  const isNewStructure = !hasMotorcycles && (hasImages || hasDocuments || hasReceipts);

  if (isNewStructure) {
    // New flat structure: {root}/images/{vehicleName}/file, {root}/documents/{vehicleName}/file
    // Find the root prefix by looking for images/ or documents/ or receipts/
    for (const path of paths) {
      const parts = path.split('/');
      const imgIdx = parts.indexOf('images');
      const docIdx = parts.indexOf('documents');
      const recIdx = parts.indexOf('receipts');
      const idx = Math.min(
        imgIdx >= 0 ? imgIdx : Infinity,
        docIdx >= 0 ? docIdx : Infinity,
        recIdx >= 0 ? recIdx : Infinity
      );
      if (idx < Infinity) {
        rootPrefix = parts.slice(0, idx).join('/');
        if (rootPrefix) rootPrefix += '/';
        break;
      }
    }

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
      const parts = relativePath.split('/');
      if (parts.length < 3) continue; // Need at least type/vehicleName/file

      const type = parts[0]; // images, documents, or receipts
      const vehicleName = parts[1];
      const fileName = parts.slice(2).join('/');

      if (!fileMap.has(vehicleName)) {
        fileMap.set(vehicleName, { photos: [], documents: [], receipts: [] });
      }
      const vehicleFiles = fileMap.get(vehicleName)!;

      if (type === 'images') {
        vehicleFiles.photos.push({ name: fileName, entry });
      } else if (type === 'documents') {
        vehicleFiles.documents.push({ name: fileName, entry });
      } else if (type === 'receipts') {
        vehicleFiles.receipts.push({ name: fileName, entry });
      }
    }
  } else if (hasMotorcycles) {
    // Old structure: {root}/motorcycles/{vehicleName}/images/photos/file
    for (const path of paths) {
      const parts = path.split('/');
      const mcIdx = parts.indexOf('motorcycles');
      if (mcIdx < 0) continue;
      rootPrefix = parts.slice(0, mcIdx).join('/');
      if (rootPrefix) rootPrefix += '/';
      break;
    }

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
      const parts = relativePath.split('/');
      if (parts[0] !== 'motorcycles' || parts.length < 4) continue;

      const vehicleName = parts[1];
      const subPath = parts.slice(2).join('/');

      if (!fileMap.has(vehicleName)) {
        fileMap.set(vehicleName, { photos: [], documents: [], receipts: [] });
      }
      const vehicleFiles = fileMap.get(vehicleName)!;

      if (subPath.startsWith('images/photos/')) {
        vehicleFiles.photos.push({ name: parts[parts.length - 1], entry });
      } else if (subPath.startsWith('images/documents/')) {
        vehicleFiles.documents.push({ name: parts[parts.length - 1], entry });
      } else if (subPath.startsWith('images/receipts/')) {
        vehicleFiles.receipts.push({ name: parts[parts.length - 1], entry });
      }
    }
  }

  return { isNewStructure, fileMap };
}

const VALID_DOC_TYPES: DocumentType[] = ['title', 'registration', 'insurance', 'receipt', 'manual', 'other'];
const VALID_SERVICE_CATEGORIES: ServiceCategory[] = ['maintenance', 'repair', 'upgrade', 'inspection'];

export function CSVImport({ collections, subscriptionInfo }: CSVImportProps) {
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    documents: number;
    serviceRecords: number;
    mileageEntries: number;
    photos: number;
    documentFiles: number;
    receiptFiles: number;
  } | null>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [limitError, setLimitError] = useState<string | null>(null);

  // Whether we detected the comprehensive CSV format (skip column mapping)
  const [isComprehensive, setIsComprehensive] = useState(false);

  // Additional data from comprehensive CSV or old-format ZIP
  const [documentRows, setDocumentRows] = useState<DocumentRow[]>([]);
  const [serviceRecordRows, setServiceRecordRows] = useState<ServiceRecordRow[]>([]);
  const [mileageRows, setMileageRows] = useState<MileageRow[]>([]);

  // ZIP file entries for importing binary files
  const zipRef = useRef<JSZip | null>(null);
  const [zipFileMap, setZipFileMap] = useState<Map<string, VehicleZipFiles>>(new Map());

  // Default to first owned collection, or first collection if none owned
  const defaultCollection = collections.find(c => c.is_owner) || collections[0];
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(defaultCollection?.id || '');

  const supabase = createClient();

  const processVehicleCSV = useCallback((text: string) => {
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
            return String(v).trim() !== '';
          });
          return nonEmptyFields.length >= 2;
        });

        // Check if this is a comprehensive CSV
        const { isComprehensive: isComp, vehicleRows, serviceRows, documentRows: docRows, mileageRows: mileRows } = parseComprehensiveCSV(data);

        if (isComp) {
          setIsComprehensive(true);
          setServiceRecordRows(serviceRows);
          setDocumentRows(docRows);
          setMileageRows(mileRows);

          // For comprehensive CSV, vehicle rows use vehicle_name as the name field
          // Set up auto-mapping and skip to preview
          setCsvData(vehicleRows);
          setHeaders(fields);

          const autoMapping: ColumnMapping = {
            name: 'vehicle_name',
            make: 'make',
            model: 'model',
            year: 'year',
            nickname: 'nickname',
            vehicle_type: 'vehicle_type',
            vin: 'vin',
            plate_number: 'plate_number',
            mileage: 'mileage',
            tab_expiration: 'tab_expiration',
            status: 'status',
            notes: 'notes',
            purchase_price: 'purchase_price',
            purchase_date: 'purchase_date',
            maintenance_notes: 'maintenance_notes',
          };
          setMapping(autoMapping);
          setStep('preview');

          // Generate preview directly
          const previewRows = buildPreviewFromComprehensive(vehicleRows);
          setPreview(previewRows);
          return;
        }

        // Standard CSV - go through column mapping
        setIsComprehensive(false);
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
  }, []);

  /** Build preview rows directly from comprehensive CSV vehicle rows (no column mapping needed) */
  function buildPreviewFromComprehensive(vehicleRows: CSVRow[]): PreviewRow[] {
    return vehicleRows.map((row) => {
      const name = row.vehicle_name?.trim() || '';

      if (!name) {
        return {
          original: row,
          mapped: {
            name: '', year: null, vin: null, plate_number: null, mileage: null,
            notes: null, tab_expiration: null, make: null, model: null,
            nickname: null, vehicle_type: 'motorcycle', purchase_price: null,
            purchase_date: null, status: 'active', sale_info: null,
            maintenance_notes: null, estimated_value: null,
            sale_info_type: null, sale_info_date: null, sale_info_amount: null, sale_info_notes: null,
          },
          valid: false,
          error: 'Name is required',
        };
      }

      const yearStr = row.year?.trim();
      let year: number | null = null;
      if (yearStr) {
        const parsed = parseInt(yearStr);
        if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2099) year = parsed;
      }

      const ppStr = row.purchase_price?.trim();
      let purchasePrice: number | null = null;
      if (ppStr) {
        const parsed = parseFloat(ppStr.replace(/[$,]/g, ''));
        if (!isNaN(parsed)) purchasePrice = parsed;
      }

      const evStr = row.estimated_value?.trim();
      let estimatedValue: number | null = null;
      if (evStr) {
        const parsed = parseFloat(evStr.replace(/[$,]/g, ''));
        if (!isNaN(parsed)) estimatedValue = parsed;
      }

      const saAmtStr = row.sale_info_amount?.trim();
      let saleInfoAmount: number | null = null;
      if (saAmtStr) {
        const parsed = parseFloat(saAmtStr.replace(/[$,]/g, ''));
        if (!isNaN(parsed)) saleInfoAmount = parsed;
      }

      const vehicleTypeStr = row.vehicle_type?.trim()?.toLowerCase();
      const vehicleType = vehicleTypeStr && ['motorcycle', 'car', 'boat', 'trailer', 'other'].includes(vehicleTypeStr)
        ? vehicleTypeStr : 'motorcycle';

      const statusStr = row.status?.trim()?.toLowerCase();
      const status = statusStr && ['active', 'sold', 'traded', 'maintenance'].includes(statusStr)
        ? statusStr : 'active';

      const tabExpDate = row.tab_expiration ? parseFlexibleDate(row.tab_expiration) : null;
      const purchaseDate = row.purchase_date ? parseFlexibleDate(row.purchase_date) : null;

      // Build sale_info object if we have sale info columns
      let saleInfo: object | null = null;
      if (row.sale_info_type?.trim() || row.sale_info_date?.trim() || saleInfoAmount) {
        saleInfo = {
          type: row.sale_info_type?.trim() || undefined,
          date: row.sale_info_date?.trim() || undefined,
          amount: saleInfoAmount || undefined,
          notes: row.sale_info_notes?.trim() || undefined,
        };
      }

      return {
        original: row,
        mapped: {
          name,
          year,
          vin: row.vin?.trim() || null,
          plate_number: row.plate_number?.trim() || null,
          mileage: row.mileage?.trim() || null,
          notes: row.notes?.trim() || null,
          tab_expiration: formatDateForDB(tabExpDate),
          make: row.make?.trim() || null,
          model: row.model?.trim() || null,
          nickname: row.nickname?.trim() || null,
          vehicle_type: vehicleType,
          purchase_price: purchasePrice,
          purchase_date: formatDateForDB(purchaseDate),
          status,
          sale_info: saleInfo,
          maintenance_notes: row.maintenance_notes?.trim() || null,
          estimated_value: estimatedValue,
          sale_info_type: row.sale_info_type?.trim() || null,
          sale_info_date: row.sale_info_date?.trim() || null,
          sale_info_amount: saleInfoAmount,
          sale_info_notes: row.sale_info_notes?.trim() || null,
        },
        valid: true,
      };
    });
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Reset all state
    setDocumentRows([]);
    setServiceRecordRows([]);
    setMileageRows([]);
    setIsComprehensive(false);
    zipRef.current = null;
    setZipFileMap(new Map());

    // Handle ZIP files
    if (file.name.endsWith('.zip') || file.type === 'application/zip') {
      try {
        const zip = await JSZip.loadAsync(file);
        zipRef.current = zip;

        // Build file map for binary files
        const { fileMap } = buildZipFileMap(zip);
        setZipFileMap(fileMap);

        // Find the main CSV file - prefer collection-export.csv (new format), fallback to vehicles.csv (old)
        let csvText = '';

        for (const [path, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const fileName = path.split('/').pop()?.toLowerCase() || '';

          if (fileName === 'collection-export.csv') {
            csvText = await zipEntry.async('string');
            break;
          }
        }

        if (!csvText) {
          // Try old format: vehicles.csv or any CSV
          let documentsText = '';
          let serviceRecordsText = '';

          for (const [path, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            const fileName = path.split('/').pop()?.toLowerCase() || '';

            if (fileName === 'vehicles.csv' || (fileName.endsWith('.csv') && !fileName.includes('document') && !fileName.includes('service'))) {
              if (!csvText) csvText = await zipEntry.async('string');
            } else if (fileName === 'documents.csv' || fileName.includes('document')) {
              documentsText = await zipEntry.async('string');
            } else if (fileName === 'service-records.csv' || fileName.includes('service')) {
              serviceRecordsText = await zipEntry.async('string');
            }
          }

          // Parse old-format separate CSVs
          if (documentsText) {
            const rows = parseCSVText(documentsText);
            setDocumentRows(rows.map(r => ({
              vehicle_name: r.vehicle_name?.trim() || '',
              title: r.title?.trim() || '',
              document_type: r.document_type?.trim() || '',
              expiration_date: r.expiration_date?.trim() || '',
              notes: r.notes?.trim() || '',
              file_name: r.file_name?.trim() || '',
              file_type: '',
            })).filter(r => r.vehicle_name && r.title));
          }

          if (serviceRecordsText) {
            const rows = parseCSVText(serviceRecordsText);
            setServiceRecordRows(rows.map(r => ({
              vehicle_name: r.vehicle_name?.trim() || '',
              service_date: r.service_date?.trim() || '',
              title: r.title?.trim() || '',
              description: r.description?.trim() || '',
              cost: r.cost?.trim() || '',
              odometer: r.odometer?.trim() || '',
              shop_name: r.shop_name?.trim() || '',
              category: r.category?.trim() || '',
              receipt_files: '',
            })).filter(r => r.vehicle_name && r.title));
          }
        }

        if (!csvText) {
          // Fallback: use the first CSV found
          for (const [, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir && zipEntry.name.endsWith('.csv')) {
              csvText = await zipEntry.async('string');
              break;
            }
          }
        }

        if (!csvText) {
          console.error('No CSV found in ZIP');
          return;
        }

        processVehicleCSV(csvText);
      } catch (err) {
        console.error('ZIP parse error:', err);
      }
      return;
    }

    // Handle plain CSV files
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      processVehicleCSV(text);
    };
    reader.readAsText(file);
  }, [processVehicleCSV]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    maxFiles: 1,
  });

  const generatePreview = () => {
    setLimitError(null);

    const previewRows: PreviewRow[] = csvData.map((row) => {
      const name = mapping.name ? row[mapping.name]?.trim() : '';

      if (!name) {
        return {
          original: row,
          mapped: {
            name: '', year: null, vin: null, plate_number: null, mileage: null,
            notes: null, tab_expiration: null, make: null, model: null,
            nickname: null, vehicle_type: 'motorcycle', purchase_price: null,
            purchase_date: null, status: 'active', sale_info: null,
            maintenance_notes: null, estimated_value: null,
            sale_info_type: null, sale_info_date: null, sale_info_amount: null, sale_info_notes: null,
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
        if (['active', 'sold', 'traded', 'maintenance'].includes(statusValue)) {
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
          estimated_value: null,
          sale_info_type: null, sale_info_date: null, sale_info_amount: null, sale_info_notes: null,
        },
        valid: true,
      };
    });

    // Check subscription limits for free users
    const validRowCount = previewRows.filter(r => r.valid).length;
    if (!subscriptionInfo.isPro) {
      const remainingSlots = subscriptionInfo.vehicleLimit - subscriptionInfo.vehicleCount;
      if (validRowCount > remainingSlots) {
        if (remainingSlots <= 0) {
          setLimitError(
            `You've reached the free limit of ${subscriptionInfo.vehicleLimit} vehicles. Upgrade to Pro for unlimited vehicles.`
          );
        } else {
          setLimitError(
            `You can only add ${remainingSlots} more vehicle${remainingSlots === 1 ? '' : 's'} on the free plan. ` +
            `This import has ${validRowCount} vehicles.`
          );
        }
      }
    }

    setPreview(previewRows);
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    setImportProgress('Importing vehicles...');
    let success = 0;
    let failed = 0;
    let docsImported = 0;
    let recordsImported = 0;
    let mileageImported = 0;
    let photosImported = 0;
    let docFilesImported = 0;
    let receiptFilesImported = 0;

    const validRows = preview.filter((row) => row.valid);

    // Map of vehicle name -> inserted vehicle id
    const vehicleNameToId = new Map<string, string>();

    for (const row of validRows) {
      try {
        const insertData: Record<string, unknown> = {
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
          status: row.mapped.status as 'active' | 'sold' | 'traded' | 'maintenance',
          sale_info: row.mapped.sale_info,
          maintenance_notes: row.mapped.maintenance_notes,
          collection_id: selectedCollectionId,
        };

        // Add comprehensive-only fields
        if (row.mapped.estimated_value != null) {
          insertData.estimated_value = row.mapped.estimated_value;
        }

        const { data, error } = await supabase.from('motorcycles').insert(insertData).select('id, name').single();

        if (error) {
          console.error('Insert error:', error);
          failed++;
        } else {
          success++;
          if (data) {
            vehicleNameToId.set(data.name, data.id);
          }
        }
      } catch (err) {
        console.error('Insert error:', err);
        failed++;
      }
    }

    // Import documents if we have them
    if (documentRows.length > 0 && vehicleNameToId.size > 0) {
      setImportProgress('Importing documents...');
      for (const doc of documentRows) {
        const vehicleId = vehicleNameToId.get(doc.vehicle_name);
        if (!vehicleId) continue;

        const docType = VALID_DOC_TYPES.includes(doc.document_type as DocumentType)
          ? doc.document_type as DocumentType
          : 'other';

        const expDate = doc.expiration_date ? formatDateForDB(parseFlexibleDate(doc.expiration_date)) : null;

        try {
          let storagePath = '';

          // Try to find and upload the document file from ZIP
          const vehicleFiles = zipFileMap.get(doc.vehicle_name);
          if (vehicleFiles && doc.file_name) {
            const fileEntry = vehicleFiles.documents.find(f => f.name === doc.file_name);
            if (fileEntry) {
              const blob = await fileEntry.entry.async('blob');
              const timestamp = Date.now();
              const random = Math.random().toString(36).substring(2, 8);
              const ext = doc.file_name.split('.').pop() || 'bin';
              storagePath = `${vehicleId}/${timestamp}-${random}.${ext}`;

              const { error: uploadError } = await supabase.storage
                .from('vehicle-documents')
                .upload(storagePath, blob);

              if (uploadError) {
                storagePath = '';
              } else {
                docFilesImported++;
              }
            }
          }

          const { error } = await supabase.from('vehicle_documents').insert({
            motorcycle_id: vehicleId,
            title: doc.title,
            document_type: docType,
            expiration_date: expDate,
            notes: doc.notes || null,
            file_name: doc.file_name || 'imported-document',
            file_type: doc.file_type || null,
            storage_path: storagePath,
          });

          if (!error) docsImported++;
        } catch {
          // Skip failed document imports silently
        }
      }
    }

    // Import service records if we have them
    if (serviceRecordRows.length > 0 && vehicleNameToId.size > 0) {
      setImportProgress('Importing service records...');
      for (const record of serviceRecordRows) {
        const vehicleId = vehicleNameToId.get(record.vehicle_name);
        if (!vehicleId) continue;

        const category = VALID_SERVICE_CATEGORIES.includes(record.category as ServiceCategory)
          ? record.category as ServiceCategory
          : 'maintenance';

        const serviceDate = record.service_date
          ? formatDateForDB(parseFlexibleDate(record.service_date)) || new Date().toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const cost = record.cost ? parseFloat(record.cost.replace(/[$,]/g, '')) : null;
        const odometer = record.odometer ? parseInt(record.odometer.replace(/,/g, '')) : null;

        try {
          const { data: srData, error } = await supabase.from('service_records').insert({
            motorcycle_id: vehicleId,
            service_date: serviceDate,
            title: record.title,
            description: record.description || null,
            cost: cost && !isNaN(cost) ? cost : null,
            odometer: odometer && !isNaN(odometer) ? odometer : null,
            shop_name: record.shop_name || null,
            category,
          }).select('id').single();

          if (!error) {
            recordsImported++;

            // Upload receipt files if we have them
            if (srData && record.receipt_files) {
              const receiptFileNames = record.receipt_files.split(',').map(f => f.trim()).filter(Boolean);
              const vehicleFiles = zipFileMap.get(record.vehicle_name);

              if (vehicleFiles && receiptFileNames.length > 0) {
                for (const receiptFileName of receiptFileNames) {
                  const fileEntry = vehicleFiles.receipts.find(f => f.name === receiptFileName);
                  if (!fileEntry) continue;

                  try {
                    const blob = await fileEntry.entry.async('blob');
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(2, 8);
                    const ext = receiptFileName.split('.').pop() || 'bin';
                    const storagePath = `${srData.id}/${timestamp}-${random}.${ext}`;

                    const { error: uploadError } = await supabase.storage
                      .from('service-receipts')
                      .upload(storagePath, blob);

                    if (!uploadError) {
                      await supabase.from('service_record_receipts').insert({
                        service_record_id: srData.id,
                        file_name: receiptFileName,
                        file_type: null,
                        storage_path: storagePath,
                      });
                      receiptFilesImported++;
                    }
                  } catch {
                    // Skip failed receipt upload
                  }
                }
              }
            }
          }
        } catch {
          // Skip failed service record imports silently
        }
      }
    }

    // Import mileage history if we have it
    if (mileageRows.length > 0 && vehicleNameToId.size > 0) {
      setImportProgress('Importing mileage history...');
      for (const entry of mileageRows) {
        const vehicleId = vehicleNameToId.get(entry.vehicle_name);
        if (!vehicleId) continue;

        const mileage = entry.mileage ? parseInt(entry.mileage.replace(/,/g, '')) : null;
        if (!mileage || isNaN(mileage)) continue;

        const recordedDate = entry.recorded_date
          ? formatDateForDB(parseFlexibleDate(entry.recorded_date)) || new Date().toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        try {
          const { error } = await supabase.from('mileage_history').insert({
            motorcycle_id: vehicleId,
            mileage,
            recorded_date: recordedDate,
            notes: entry.notes || null,
          });

          if (!error) mileageImported++;
        } catch {
          // Skip failed mileage imports
        }
      }
    }

    // Import photos from ZIP if we have them
    if (zipFileMap.size > 0 && vehicleNameToId.size > 0) {
      setImportProgress('Uploading photos...');
      for (const [vehicleName, vehicleId] of vehicleNameToId) {
        const vehicleFiles = zipFileMap.get(vehicleName);
        if (!vehicleFiles || vehicleFiles.photos.length === 0) continue;

        for (let i = 0; i < vehicleFiles.photos.length; i++) {
          const photo = vehicleFiles.photos[i];
          try {
            const blob = await photo.entry.async('blob');
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const ext = photo.name.split('.').pop() || 'jpg';
            const storagePath = `${vehicleId}/${timestamp}-${random}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from('motorcycle-photos')
              .upload(storagePath, blob);

            if (!uploadError) {
              await supabase.from('photos').insert({
                motorcycle_id: vehicleId,
                storage_path: storagePath,
                display_order: i,
                is_showcase: i === 0,
              });
              photosImported++;
            }
          } catch {
            // Skip failed photo upload
          }
        }
      }
    }

    setImportResult({
      success,
      failed,
      documents: docsImported,
      serviceRecords: recordsImported,
      mileageEntries: mileageImported,
      photos: photosImported,
      documentFiles: docFilesImported,
      receiptFiles: receiptFilesImported,
    });
    setImporting(false);
    setImportProgress('');
    setStep('done');
  };

  const reset = () => {
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setPreview([]);
    setImportResult(null);
    setDocumentRows([]);
    setServiceRecordRows([]);
    setMileageRows([]);
    setIsComprehensive(false);
    zipRef.current = null;
    setZipFileMap(new Map());
    setLimitError(null);
    setImportProgress('');
    setStep('upload');
  };

  // Count totals for preview
  const totalPhotos = Array.from(zipFileMap.values()).reduce((sum, v) => sum + v.photos.length, 0);
  const totalDocFiles = Array.from(zipFileMap.values()).reduce((sum, v) => sum + v.documents.length, 0);
  const totalReceiptFiles = Array.from(zipFileMap.values()).reduce((sum, v) => sum + v.receipts.length, 0);

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
            {isDragActive ? 'Drop file here...' : 'Drop your CSV or ZIP file here'}
          </p>
          <p className="text-muted-foreground mt-1">
            or tap to select a file
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Supports full backup ZIPs, CSV ZIPs, and plain CSV files
          </p>
        </div>
      )}

      {/* Step 2: Column Mapping (skipped for comprehensive CSV) */}
      {step === 'map' && (
        <div className="space-y-6">
          <div className="bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">File loaded: {csvData.length} vehicle rows</h3>
            {(documentRows.length > 0 || serviceRecordRows.length > 0) && (
              <div className="text-sm text-muted-foreground mb-2 space-y-0.5">
                {documentRows.length > 0 && (
                  <p>{documentRows.length} document{documentRows.length !== 1 ? 's' : ''} found</p>
                )}
                {serviceRecordRows.length > 0 && (
                  <p>{serviceRecordRows.length} service record{serviceRecordRows.length !== 1 ? 's' : ''} found</p>
                )}
              </div>
            )}
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
              Ready to import {preview.filter((r) => r.valid).length} of {preview.length} vehicles
            </h3>
            {(documentRows.length > 0 || serviceRecordRows.length > 0 || mileageRows.length > 0 || totalPhotos > 0) && (
              <div className="text-sm text-muted-foreground space-y-0.5">
                {serviceRecordRows.length > 0 && (
                  <p>{serviceRecordRows.length} service record{serviceRecordRows.length !== 1 ? 's' : ''} will be imported</p>
                )}
                {documentRows.length > 0 && (
                  <p>{documentRows.length} document{documentRows.length !== 1 ? 's' : ''} will be imported</p>
                )}
                {mileageRows.length > 0 && (
                  <p>{mileageRows.length} mileage entr{mileageRows.length !== 1 ? 'ies' : 'y'} will be imported</p>
                )}
                {totalPhotos > 0 && (
                  <p>{totalPhotos} photo{totalPhotos !== 1 ? 's' : ''} will be uploaded</p>
                )}
                {totalDocFiles > 0 && (
                  <p>{totalDocFiles} document file{totalDocFiles !== 1 ? 's' : ''} will be uploaded</p>
                )}
                {totalReceiptFiles > 0 && (
                  <p>{totalReceiptFiles} receipt file{totalReceiptFiles !== 1 ? 's' : ''} will be uploaded</p>
                )}
              </div>
            )}
            {preview.some((r) => !r.valid) && (
              <p className="text-sm text-destructive mt-2">
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

          {limitError && (
            <div className="bg-destructive/10 border border-destructive text-destructive p-4">
              <p className="text-sm font-medium">{limitError}</p>
              <a
                href="/settings#subscription"
                className="text-sm underline mt-2 inline-block"
              >
                Upgrade to Pro
              </a>
            </div>
          )}

          {importing && importProgress && (
            <div className="bg-card border border-border p-4">
              <p className="text-sm text-muted-foreground">{importProgress}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing || preview.filter((r) => r.valid).length === 0 || !!limitError}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${preview.filter((r) => r.valid).length} Vehicles`}
            </button>
            <button
              onClick={() => isComprehensive ? reset() : setStep('map')}
              disabled={importing}
              className="py-3 px-6 border border-border hover:bg-muted"
            >
              {isComprehensive ? 'Cancel' : 'Back'}
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
            <div className="text-muted-foreground space-y-1">
              <p>
                {importResult.success} vehicle{importResult.success !== 1 ? 's' : ''} imported
                {importResult.failed > 0 && (
                  <span className="text-destructive">
                    , {importResult.failed} failed
                  </span>
                )}
              </p>
              {importResult.serviceRecords > 0 && (
                <p>{importResult.serviceRecords} service record{importResult.serviceRecords !== 1 ? 's' : ''} imported</p>
              )}
              {importResult.documents > 0 && (
                <p>{importResult.documents} document{importResult.documents !== 1 ? 's' : ''} imported</p>
              )}
              {importResult.mileageEntries > 0 && (
                <p>{importResult.mileageEntries} mileage entr{importResult.mileageEntries !== 1 ? 'ies' : 'y'} imported</p>
              )}
              {importResult.photos > 0 && (
                <p>{importResult.photos} photo{importResult.photos !== 1 ? 's' : ''} uploaded</p>
              )}
              {importResult.documentFiles > 0 && (
                <p>{importResult.documentFiles} document file{importResult.documentFiles !== 1 ? 's' : ''} uploaded</p>
              )}
              {importResult.receiptFiles > 0 && (
                <p>{importResult.receiptFiles} receipt file{importResult.receiptFiles !== 1 ? 's' : ''} uploaded</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href="/dashboard"
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
