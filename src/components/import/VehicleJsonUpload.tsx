'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DocumentArrowUpIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { parseFlexibleDate, formatDateForDB } from '@/lib/dateUtils';
import { DocumentType, ServiceCategory } from '@/types/database';
import { useSelectedCollection } from '@/hooks/useSelectedCollection';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface VehicleJsonUploadProps {
  collections: UserCollection[];
}

interface VehicleJsonData {
  vehicle: {
    name?: string; // backward compat — old format used name
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

const VALID_DOC_TYPES: DocumentType[] = ['title', 'registration', 'insurance', 'receipt', 'manual', 'other'];
const VALID_SERVICE_CATEGORIES: ServiceCategory[] = ['maintenance', 'repair', 'upgrade', 'inspection'];

export function VehicleJsonUpload({ collections }: VehicleJsonUploadProps) {
  const [jsonData, setJsonData] = useState<VehicleJsonData | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [selectedCollectionId, setSelectedCollectionId] = useSelectedCollection(collections);

  const supabase = createClient();
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError(null);
    setDone(false);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as VehicleJsonData;

      if (!data.vehicle?.make || !data.vehicle?.model || !data.vehicle?.year) {
        // Backward compat: old format had name but no make/model/year
        if (data.vehicle?.name && (!data.vehicle.make || !data.vehicle.model)) {
          setError('This JSON uses the old format with "name" instead of make/model/year. Please re-export the vehicle to get the new format, or manually add make, model, and year fields.');
          return;
        }
        setError('JSON must contain a "vehicle" object with "make", "model", and "year" fields.');
        return;
      }

      setJsonData(data);
    } catch {
      setError('Could not parse JSON file. Please check the format.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!jsonData) return;
    setImporting(true);
    setError(null);

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
        setError(`Failed to create vehicle: ${vehicleError?.message || 'Unknown error'}`);
        setImporting(false);
        return;
      }

      const vehicleId = vehicleData.id;

      // Import documents
      if (jsonData.documents && jsonData.documents.length > 0) {
        for (const doc of jsonData.documents) {
          const docType = VALID_DOC_TYPES.includes(doc.document_type as DocumentType)
            ? doc.document_type as DocumentType
            : 'other';
          const expDate = doc.expiration_date ? formatDateForDB(parseFlexibleDate(doc.expiration_date)) : null;

          await supabase.from('vehicle_documents').insert({
            motorcycle_id: vehicleId,
            title: doc.title,
            document_type: docType,
            expiration_date: expDate,
            notes: doc.notes || null,
            file_name: doc.file_name || 'imported-document',
            file_type: doc.file_type || null,
            storage_path: '',
          });
        }
      }

      // Import service records
      if (jsonData.service_records && jsonData.service_records.length > 0) {
        for (const sr of jsonData.service_records) {
          const category = VALID_SERVICE_CATEGORIES.includes(sr.category as ServiceCategory)
            ? sr.category as ServiceCategory
            : 'maintenance';
          const serviceDate = sr.service_date
            ? formatDateForDB(parseFlexibleDate(sr.service_date)) || new Date().toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          await supabase.from('service_records').insert({
            motorcycle_id: vehicleId,
            service_date: serviceDate,
            title: sr.title,
            description: sr.description || null,
            cost: sr.cost || null,
            odometer: sr.odometer || null,
            shop_name: sr.shop_name || null,
            category,
          });
        }
      }

      // Import mileage history
      if (jsonData.mileage_history && jsonData.mileage_history.length > 0) {
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
      // Redirect to the new vehicle
      router.push(`/vehicles/${vehicleId}`);
    } catch (err) {
      console.error('JSON import error:', err);
      setError('Import failed unexpectedly. Please try again.');
    } finally {
      setImporting(false);
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
    const serviceCt = jsonData.service_records?.length || 0;
    const docCt = jsonData.documents?.length || 0;
    const mileageCt = jsonData.mileage_history?.length || 0;
    const valueCt = jsonData.value_history?.length || 0;

    return (
      <div className="space-y-4">
        <div className="bg-card border border-border p-4">
          <h3 className="font-semibold mb-2">{[v.year, v.make, v.model, v.sub_model].filter(Boolean).join(' ')}</h3>
          <div className="text-sm text-muted-foreground space-y-0.5">
            {v.vehicle_type && v.vehicle_type !== 'motorcycle' && (
              <p className="capitalize">{v.vehicle_type}</p>
            )}
            {serviceCt > 0 && <p>{serviceCt} service record{serviceCt !== 1 ? 's' : ''}</p>}
            {docCt > 0 && <p>{docCt} document{docCt !== 1 ? 's' : ''}</p>}
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

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Vehicle'}
          </button>
          <button
            onClick={() => { setJsonData(null); setError(null); }}
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
        <DocumentArrowUpIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">
          {isDragActive ? 'Drop JSON here...' : 'Drop a vehicle JSON file'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          From a single vehicle backup export
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}
