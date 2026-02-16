'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/client';
import { ArchiveBoxIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { parseFlexibleDate, formatDateForDB } from '@/lib/dateUtils';
import { DocumentType, ServiceCategory } from '@/types/database';
import { blobWithMime } from '@/lib/mimeTypes';
import { useSelectedCollection } from '@/hooks/useSelectedCollection';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface CollectionCapacity {
  canAdd: boolean;
  reason: string | null;
}

interface VehicleZipImportProps {
  collections: UserCollection[];
  collectionCapacity?: Record<string, CollectionCapacity>;
}

interface VehicleJsonData {
  vehicle: {
    name?: string; // backward compat — old format
    make: string;
    model: string;
    sub_model?: string | null;
    year: number;
    vehicle_type?: string;
    vin?: string | null;
    plate_number?: string | null;
    mileage?: string | null;
    nickname?: string | null;
    status?: string;
    notes?: string | null;
    maintenance_notes?: string | null;
    tab_expiration?: string | null;
    purchase_price?: number | null;
    purchase_date?: string | null;
    estimated_value?: number | null;
    sale_info?: {
      type?: string;
      date?: string;
      amount?: number;
      notes?: string;
    } | null;
  };
  photos?: {
    storage_path?: string;
    display_order?: number;
    caption?: string | null;
    is_showcase?: boolean;
  }[];
  documents?: {
    title: string;
    document_type?: string;
    expiration_date?: string | null;
    notes?: string | null;
    file_name?: string;
    file_type?: string | null;
  }[];
  service_records?: {
    service_date: string;
    title: string;
    description?: string | null;
    cost?: number | null;
    odometer?: number | null;
    shop_name?: string | null;
    category?: string;
    receipts?: {
      file_name: string;
      file_type?: string | null;
    }[];
  }[];
  mileage_history?: {
    mileage: number;
    recorded_date: string;
    notes?: string | null;
  }[];
  value_history?: {
    estimated_value: number;
    recorded_date: string;
    source?: string | null;
    notes?: string | null;
  }[];
}

interface ZipFileEntry {
  name: string;
  entry: JSZip.JSZipObject;
}

interface ZipFiles {
  photos: ZipFileEntry[];
  documents: ZipFileEntry[];
  receipts: ZipFileEntry[];
}

const VALID_DOC_TYPES: DocumentType[] = ['title', 'registration', 'insurance', 'receipt', 'manual', 'other'];
const VALID_SERVICE_CATEGORIES: ServiceCategory[] = ['maintenance', 'repair', 'upgrade', 'inspection'];

export function VehicleZipImport({ collections, collectionCapacity }: VehicleZipImportProps) {
  const [jsonData, setJsonData] = useState<VehicleJsonData | null>(null);
  const [zipFiles, setZipFiles] = useState<ZipFiles>({ photos: [], documents: [], receipts: [] });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const zipRef = useRef<JSZip | null>(null);

  const [selectedCollectionId, setSelectedCollectionId] = useSelectedCollection(collections);

  const supabase = createClient();
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError(null);
    setDone(false);
    setJsonData(null);
    setZipFiles({ photos: [], documents: [], receipts: [] });
    zipRef.current = null;

    try {
      const zip = await JSZip.loadAsync(file);
      zipRef.current = zip;

      // Find the vehicle-data JSON file
      let vehicleJson: VehicleJsonData | null = null;
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        if (path.includes('vehicle-data/') && path.endsWith('.json')) {
          const text = await entry.async('string');
          vehicleJson = JSON.parse(text) as VehicleJsonData;
          break;
        }
      }

      if (!vehicleJson?.vehicle?.make || !vehicleJson?.vehicle?.model || !vehicleJson?.vehicle?.year) {
        setError('Could not find valid vehicle data in this ZIP. Make sure it\'s a TCS vehicle export with make, model, and year.');
        return;
      }

      // Build file maps from ZIP
      const photos: ZipFileEntry[] = [];
      const documents: ZipFileEntry[] = [];
      const receipts: ZipFileEntry[] = [];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const parts = path.split('/');

        // Find type folder index (images, documents, receipts)
        const imgIdx = parts.indexOf('images');
        const docIdx = parts.indexOf('documents');
        const recIdx = parts.indexOf('receipts');

        if (imgIdx >= 0 && parts.length > imgIdx + 2) {
          const fileName = parts.slice(imgIdx + 2).join('/');
          photos.push({ name: fileName, entry });
        } else if (docIdx >= 0 && parts.length > docIdx + 2) {
          const fileName = parts.slice(docIdx + 2).join('/');
          documents.push({ name: fileName, entry });
        } else if (recIdx >= 0 && parts.length > recIdx + 2) {
          const fileName = parts.slice(recIdx + 2).join('/');
          receipts.push({ name: fileName, entry });
        }
      }

      setJsonData(vehicleJson);
      setZipFiles({ photos, documents, receipts });
    } catch {
      setError('Could not read this ZIP file. Make sure it\'s a valid TCS vehicle export.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!jsonData) return;
    setImporting(true);
    setError(null);
    setImportProgress('Creating vehicle...');

    try {
      const v = jsonData.vehicle;
      const vehicleType = v.vehicle_type && ['motorcycle', 'car', 'boat', 'trailer', 'other'].includes(v.vehicle_type)
        ? v.vehicle_type : 'motorcycle';
      const status = v.status && ['active', 'sold', 'traded', 'maintenance'].includes(v.status)
        ? v.status : 'active';

      const tabExpDate = v.tab_expiration ? parseFlexibleDate(v.tab_expiration) : null;
      const purchaseDate = v.purchase_date ? parseFlexibleDate(v.purchase_date) : null;

      const { data: vehicleData, error: vehicleError } = await supabase.from('motorcycles').insert({
        make: v.make,
        model: v.model,
        sub_model: v.sub_model || null,
        year: v.year,
        vehicle_type: vehicleType as 'motorcycle' | 'car' | 'boat' | 'trailer' | 'other',
        vin: v.vin || null,
        plate_number: v.plate_number || null,
        mileage: v.mileage || null,
        nickname: v.nickname || null,
        status: status as 'active' | 'sold' | 'traded' | 'maintenance',
        notes: v.notes || null,
        maintenance_notes: v.maintenance_notes || null,
        tab_expiration: formatDateForDB(tabExpDate),
        purchase_price: v.purchase_price || null,
        purchase_date: formatDateForDB(purchaseDate),
        estimated_value: v.estimated_value || null,
        sale_info: v.sale_info || null,
        collection_id: selectedCollectionId,
      }).select('id').single();

      if (vehicleError || !vehicleData) {
        if (vehicleError?.message?.includes('Vehicle limit reached')) {
          setError('This collection has reached its vehicle limit. The collection owner needs to upgrade to Pro for unlimited vehicles.');
        } else {
          setError(`Failed to create vehicle: ${vehicleError?.message || 'Unknown error'}`);
        }
        setImporting(false);
        return;
      }

      const vehicleId = vehicleData.id;

      // Upload photos
      if (zipFiles.photos.length > 0) {
        setImportProgress(`Uploading ${zipFiles.photos.length} photos...`);

        // Determine showcase index from JSON data
        const showcaseIdx = jsonData.photos?.findIndex(p => p.is_showcase) ?? -1;

        for (let i = 0; i < zipFiles.photos.length; i++) {
          const photo = zipFiles.photos[i];
          try {
            const rawBlob = await photo.entry.async('blob');
            const blob = blobWithMime(rawBlob, photo.name);
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
                is_showcase: showcaseIdx >= 0 && i === showcaseIdx,
              });
            }
          } catch {
            // Skip failed photo
          }
        }
      }

      // Import documents
      if (jsonData.documents && jsonData.documents.length > 0) {
        setImportProgress(`Importing ${jsonData.documents.length} documents...`);
        for (const doc of jsonData.documents) {
          const docType = VALID_DOC_TYPES.includes(doc.document_type as DocumentType)
            ? doc.document_type as DocumentType
            : 'other';
          const expDate = doc.expiration_date ? formatDateForDB(parseFlexibleDate(doc.expiration_date)) : null;

          let storagePath = '';

          // Try to find matching file in ZIP
          if (doc.file_name) {
            const fileEntry = zipFiles.documents.find(f => f.name === doc.file_name);
            if (fileEntry) {
              try {
                const rawBlob = await fileEntry.entry.async('blob');
                const blob = blobWithMime(rawBlob, doc.file_name);
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const ext = doc.file_name.split('.').pop() || 'bin';
                storagePath = `${vehicleId}/${timestamp}-${random}.${ext}`;

                const { error: uploadError } = await supabase.storage
                  .from('vehicle-documents')
                  .upload(storagePath, blob);

                if (uploadError) storagePath = '';
              } catch {
                storagePath = '';
              }
            }
          }

          await supabase.from('vehicle_documents').insert({
            motorcycle_id: vehicleId,
            title: doc.title,
            document_type: docType,
            expiration_date: expDate,
            notes: doc.notes || null,
            file_name: doc.file_name || 'imported-document',
            file_type: doc.file_type || null,
            storage_path: storagePath,
          });
        }
      }

      // Import service records + receipts
      if (jsonData.service_records && jsonData.service_records.length > 0) {
        setImportProgress(`Importing ${jsonData.service_records.length} service records...`);
        for (const sr of jsonData.service_records) {
          const category = VALID_SERVICE_CATEGORIES.includes(sr.category as ServiceCategory)
            ? sr.category as ServiceCategory
            : 'maintenance';
          const serviceDate = sr.service_date
            ? formatDateForDB(parseFlexibleDate(sr.service_date)) || new Date().toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          const { data: srData } = await supabase.from('service_records').insert({
            motorcycle_id: vehicleId,
            service_date: serviceDate,
            title: sr.title,
            description: sr.description || null,
            cost: sr.cost || null,
            odometer: sr.odometer || null,
            shop_name: sr.shop_name || null,
            category,
          }).select('id').single();

          // Upload receipts for this service record
          if (srData && sr.receipts && sr.receipts.length > 0) {
            for (const receipt of sr.receipts) {
              const fileEntry = zipFiles.receipts.find(f => f.name === receipt.file_name);
              if (!fileEntry) continue;

              try {
                const rawBlob = await fileEntry.entry.async('blob');
                const blob = blobWithMime(rawBlob, receipt.file_name);
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const ext = receipt.file_name.split('.').pop() || 'bin';
                const storagePath = `${srData.id}/${timestamp}-${random}.${ext}`;

                const { error: uploadError } = await supabase.storage
                  .from('service-receipts')
                  .upload(storagePath, blob);

                if (!uploadError) {
                  await supabase.from('service_record_receipts').insert({
                    service_record_id: srData.id,
                    file_name: receipt.file_name,
                    file_type: receipt.file_type || null,
                    storage_path: storagePath,
                  });
                }
              } catch {
                // Skip failed receipt
              }
            }
          }
        }
      }

      // Import mileage history
      if (jsonData.mileage_history && jsonData.mileage_history.length > 0) {
        setImportProgress('Importing mileage history...');
        for (const m of jsonData.mileage_history) {
          const recordedDate = m.recorded_date
            ? formatDateForDB(parseFlexibleDate(m.recorded_date)) || new Date().toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          await supabase.from('mileage_history').insert({
            motorcycle_id: vehicleId,
            mileage: m.mileage,
            recorded_date: recordedDate,
            notes: m.notes || null,
          });
        }
      }

      // Import value history
      if (jsonData.value_history && jsonData.value_history.length > 0) {
        setImportProgress('Importing value history...');
        for (const vh of jsonData.value_history) {
          const recordedDate = vh.recorded_date
            ? formatDateForDB(parseFlexibleDate(vh.recorded_date)) || new Date().toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          await supabase.from('value_history').insert({
            motorcycle_id: vehicleId,
            estimated_value: vh.estimated_value,
            recorded_date: recordedDate,
            source: vh.source || null,
            notes: vh.notes || null,
          });
        }
      }

      setDone(true);
      router.push(`/vehicles/${vehicleId}`);
    } catch (err) {
      console.error('ZIP import error:', err);
      setError('Import failed unexpectedly. Please try again.');
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  if (done) {
    return (
      <div className="border border-secondary bg-secondary/10 p-4 text-center">
        <CheckCircleIcon className="w-8 h-8 mx-auto text-secondary mb-2" />
        <p className="font-medium">Vehicle imported! Redirecting...</p>
      </div>
    );
  }

  if (jsonData) {
    const v = jsonData.vehicle;
    const photoCt = zipFiles.photos.length;
    const serviceCt = jsonData.service_records?.length || 0;
    const docCt = jsonData.documents?.length || 0;
    const mileageCt = jsonData.mileage_history?.length || 0;
    const valueCt = jsonData.value_history?.length || 0;
    const receiptCt = zipFiles.receipts.length;
    const docFileCt = zipFiles.documents.length;

    return (
      <div className="space-y-4">
        <div className="bg-card border border-border p-4">
          <h3 className="font-semibold mb-2">{[v.year, v.make, v.model, v.sub_model].filter(Boolean).join(' ')}</h3>
          <div className="text-sm text-muted-foreground space-y-0.5">
            {v.vehicle_type && v.vehicle_type !== 'motorcycle' && (
              <p className="capitalize">{v.vehicle_type}</p>
            )}
            {photoCt > 0 && <p>{photoCt} photo{photoCt !== 1 ? 's' : ''}</p>}
            {serviceCt > 0 && <p>{serviceCt} service record{serviceCt !== 1 ? 's' : ''}</p>}
            {docCt > 0 && <p>{docCt} document{docCt !== 1 ? 's' : ''}{docFileCt > 0 ? ` (${docFileCt} file${docFileCt !== 1 ? 's' : ''})` : ''}</p>}
            {receiptCt > 0 && <p>{receiptCt} receipt file{receiptCt !== 1 ? 's' : ''}</p>}
            {mileageCt > 0 && <p>{mileageCt} mileage entr{mileageCt !== 1 ? 'ies' : 'y'}</p>}
            {valueCt > 0 && <p>{valueCt} value history entr{valueCt !== 1 ? 'ies' : 'y'}</p>}
          </div>
        </div>

        {collections.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1">Collection</label>
            <select
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.is_owner ? '(Owner)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {collectionCapacity && !collectionCapacity[selectedCollectionId]?.canAdd && (
          <p className="text-sm text-destructive">
            {collectionCapacity[selectedCollectionId]?.reason}
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {importing && importProgress && (
          <p className="text-sm text-muted-foreground">{importProgress}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing || (!!collectionCapacity && !collectionCapacity[selectedCollectionId]?.canAdd)}
            className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Vehicle'}
          </button>
          <button
            onClick={() => { setJsonData(null); setError(null); setZipFiles({ photos: [], documents: [], receipts: [] }); zipRef.current = null; }}
            disabled={importing}
            className="py-3 px-6 border border-border hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary'
        }`}
      >
        <input {...getInputProps()} />
        <ArchiveBoxIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">
          {isDragActive ? 'Drop ZIP here...' : 'Drop a TCS vehicle ZIP file here'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          From a single vehicle export
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}
