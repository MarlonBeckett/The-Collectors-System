import JSZip from 'jszip';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  Motorcycle,
  Photo,
  VehicleDocument,
  ServiceRecord,
  ServiceRecordReceipt,
  MileageHistory,
  ValueHistory,
} from '@/types/database';
import { generateComprehensiveCSV, ExportOptions } from '@/lib/exportUtils';

export interface ExportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

export interface ExportResult {
  success: boolean;
  totalFiles: number;
  skippedFiles: number;
  skippedDetails: string[];
}

export interface VehicleExportData {
  vehicle: Motorcycle;
  vehicleFolderName: string;
  photos: Photo[];
  documents: VehicleDocument[];
  serviceRecords: (ServiceRecord & { receipts: ServiceRecordReceipt[] })[];
  mileageHistory: MileageHistory[];
  valueHistory: ValueHistory[];
  /** Map of receipt file names used in ZIP, keyed by service record id */
  receiptFileNamesByServiceId: Map<string, string[]>;
  /** Map of document file names used in ZIP, keyed by document id */
  docFileNameById: Map<string, string>;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, ' ').trim();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function fetchFileFromStorage(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
  signal?: AbortSignal
): Promise<Blob | null> {
  try {
    if (signal?.aborted) return null;

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return null;
    }

    if (signal?.aborted) return null;

    const response = await fetch(signedUrlData.signedUrl, { signal });
    if (!response.ok) return null;

    return await response.blob();
  } catch {
    return null;
  }
}

function getUniqueFileName(
  usedNames: Set<string>,
  desiredName: string
): string {
  if (!usedNames.has(desiredName)) {
    usedNames.add(desiredName);
    return desiredName;
  }

  const lastDot = desiredName.lastIndexOf('.');
  const base = lastDot > 0 ? desiredName.substring(0, lastDot) : desiredName;
  const ext = lastDot > 0 ? desiredName.substring(lastDot) : '';

  let counter = 2;
  let candidate = `${base}-${counter}${ext}`;
  while (usedNames.has(candidate)) {
    counter++;
    candidate = `${base}-${counter}${ext}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function buildVehicleInfoJson(
  vehicle: Motorcycle,
  photos: Photo[],
  documents: VehicleDocument[],
  serviceRecords: (ServiceRecord & { receipts: ServiceRecordReceipt[] })[],
  mileageHistory: MileageHistory[],
  valueHistory: ValueHistory[]
): string {
  return JSON.stringify(
    {
      vehicle: {
        id: vehicle.id,
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        vehicle_type: vehicle.vehicle_type,
        vin: vehicle.vin,
        plate_number: vehicle.plate_number,
        mileage: vehicle.mileage,
        nickname: vehicle.nickname,
        status: vehicle.status,
        notes: vehicle.notes,
        maintenance_notes: vehicle.maintenance_notes,
        tab_expiration: vehicle.tab_expiration,
        purchase_price: vehicle.purchase_price,
        purchase_date: vehicle.purchase_date,
        estimated_value: vehicle.estimated_value,
        sale_info: vehicle.sale_info,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at,
      },
      photos: photos.map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        display_order: p.display_order,
        caption: p.caption,
        is_showcase: p.is_showcase,
        created_at: p.created_at,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        document_type: d.document_type,
        expiration_date: d.expiration_date,
        notes: d.notes,
        file_name: d.file_name,
        file_type: d.file_type,
        storage_path: d.storage_path,
        created_at: d.created_at,
      })),
      service_records: serviceRecords.map((sr) => ({
        id: sr.id,
        service_date: sr.service_date,
        title: sr.title,
        description: sr.description,
        cost: sr.cost,
        odometer: sr.odometer,
        shop_name: sr.shop_name,
        category: sr.category,
        created_at: sr.created_at,
        receipts: sr.receipts.map((r) => ({
          id: r.id,
          file_name: r.file_name,
          file_type: r.file_type,
          storage_path: r.storage_path,
          created_at: r.created_at,
        })),
      })),
      mileage_history: mileageHistory.map((m) => ({
        id: m.id,
        mileage: m.mileage,
        recorded_date: m.recorded_date,
        notes: m.notes,
        created_at: m.created_at,
      })),
      value_history: valueHistory.map((v) => ({
        id: v.id,
        estimated_value: v.estimated_value,
        recorded_date: v.recorded_date,
        source: v.source,
        notes: v.notes,
        created_at: v.created_at,
      })),
    },
    null,
    2
  );
}

/**
 * Add a vehicle's data and files to the ZIP using flat top-level folder structure.
 * Returns the fetched data so callers can build the comprehensive CSV without re-querying.
 */
async function addVehicleToZip(
  zip: JSZip,
  vehicle: Motorcycle,
  rootFolder: string,
  vehicleFolderName: string,
  supabase: SupabaseClient,
  onProgress: (progress: ExportProgress) => void,
  fileCounter: { downloaded: number; skipped: number; skippedDetails: string[] },
  signal?: AbortSignal
): Promise<VehicleExportData | null> {
  // Fetch all related data for this vehicle
  const [photosRes, documentsRes, serviceRecordsRes, _receiptsRes, mileageRes, valueRes] =
    await Promise.all([
      supabase
        .from('photos')
        .select('*')
        .eq('motorcycle_id', vehicle.id)
        .order('display_order'),
      supabase
        .from('vehicle_documents')
        .select('*')
        .eq('motorcycle_id', vehicle.id)
        .order('created_at'),
      supabase
        .from('service_records')
        .select('*')
        .eq('motorcycle_id', vehicle.id)
        .order('service_date', { ascending: false }),
      supabase
        .from('service_record_receipts')
        .select('*')
        .eq('service_record_id', '')
        .limit(0), // Placeholder - we fetch per-record below
      supabase
        .from('mileage_history')
        .select('*')
        .eq('motorcycle_id', vehicle.id)
        .order('recorded_date', { ascending: false }),
      supabase
        .from('value_history')
        .select('*')
        .eq('motorcycle_id', vehicle.id)
        .order('recorded_date', { ascending: false }),
    ]);

  const photos = (photosRes.data || []) as Photo[];
  const documents = (documentsRes.data || []) as VehicleDocument[];
  const serviceRecords = (serviceRecordsRes.data || []) as ServiceRecord[];
  const mileageHistory = (mileageRes.data || []) as MileageHistory[];
  const valueHistory = (valueRes.data || []) as ValueHistory[];

  // Fetch receipts for each service record
  const serviceRecordIds = serviceRecords.map((sr) => sr.id);
  let allReceipts: ServiceRecordReceipt[] = [];
  if (serviceRecordIds.length > 0) {
    const { data: receiptsData } = await supabase
      .from('service_record_receipts')
      .select('*')
      .in('service_record_id', serviceRecordIds);
    allReceipts = (receiptsData || []) as ServiceRecordReceipt[];
  }

  // Group receipts by service record
  const serviceRecordsWithReceipts = serviceRecords.map((sr) => ({
    ...sr,
    receipts: allReceipts.filter((r) => r.service_record_id === sr.id),
  }));

  // Add vehicle-info.json under vehicle-data/
  const infoJson = buildVehicleInfoJson(
    vehicle,
    photos,
    documents,
    serviceRecordsWithReceipts,
    mileageHistory,
    valueHistory
  );
  zip.file(`${rootFolder}/vehicle-data/${vehicleFolderName}.json`, infoJson);

  // Track file names used in ZIP for CSV mapping
  const receiptFileNamesByServiceId = new Map<string, string[]>();
  const docFileNameById = new Map<string, string>();

  // Download and add photos to images/{vehicleFolderName}/
  const photoNames = new Set<string>();
  for (const photo of photos) {
    if (signal?.aborted) return null;
    onProgress({
      phase: 'Downloading files',
      current: fileCounter.downloaded + fileCounter.skipped,
      total: 0,
      message: `${vehicle.name}: downloading photo...`,
    });

    const blob = await fetchFileFromStorage(supabase, 'motorcycle-photos', photo.storage_path, signal);
    if (signal?.aborted) return null;
    if (blob) {
      const ext = photo.storage_path.split('.').pop() || 'jpg';
      const baseName = photo.caption
        ? `${sanitizeFileName(photo.caption)}.${ext}`
        : photo.storage_path.split('/').pop() || `photo.${ext}`;
      const fileName = getUniqueFileName(photoNames, baseName);
      zip.file(`${rootFolder}/images/${vehicleFolderName}/${fileName}`, blob);
      fileCounter.downloaded++;
    } else {
      fileCounter.skipped++;
      fileCounter.skippedDetails.push(`${vehicle.name}: photo ${photo.storage_path}`);
    }
  }

  // Download and add documents to documents/{vehicleFolderName}/
  const docNames = new Set<string>();
  for (const doc of documents) {
    if (signal?.aborted) return null;
    onProgress({
      phase: 'Downloading files',
      current: fileCounter.downloaded + fileCounter.skipped,
      total: 0,
      message: `${vehicle.name}: downloading document "${doc.title}"...`,
    });

    const blob = await fetchFileFromStorage(supabase, 'vehicle-documents', doc.storage_path, signal);
    if (signal?.aborted) return null;
    if (blob) {
      const fileName = getUniqueFileName(docNames, doc.file_name || doc.storage_path.split('/').pop() || 'document');
      zip.file(`${rootFolder}/documents/${vehicleFolderName}/${fileName}`, blob);
      docFileNameById.set(doc.id, fileName);
      fileCounter.downloaded++;
    } else {
      fileCounter.skipped++;
      fileCounter.skippedDetails.push(`${vehicle.name}: document "${doc.title}"`);
    }
  }

  // Download and add service record receipts to receipts/{vehicleFolderName}/
  const receiptNames = new Set<string>();
  for (const sr of serviceRecordsWithReceipts) {
    const filesForThisService: string[] = [];
    for (const receipt of sr.receipts) {
      if (signal?.aborted) return null;
      onProgress({
        phase: 'Downloading files',
        current: fileCounter.downloaded + fileCounter.skipped,
        total: 0,
        message: `${vehicle.name}: downloading receipt for "${sr.title}"...`,
      });

      const blob = await fetchFileFromStorage(supabase, 'service-receipts', receipt.storage_path, signal);
      if (signal?.aborted) return null;
      if (blob) {
        const receiptFileName = receipt.file_name || receipt.storage_path.split('/').pop() || 'receipt';
        const fileName = getUniqueFileName(receiptNames, receiptFileName);
        zip.file(`${rootFolder}/receipts/${vehicleFolderName}/${fileName}`, blob);
        filesForThisService.push(fileName);
        fileCounter.downloaded++;
      } else {
        fileCounter.skipped++;
        fileCounter.skippedDetails.push(`${vehicle.name}: receipt for "${sr.title}"`);
      }
    }
    if (filesForThisService.length > 0) {
      receiptFileNamesByServiceId.set(sr.id, filesForThisService);
    }
  }

  return {
    vehicle,
    vehicleFolderName,
    photos,
    documents,
    serviceRecords: serviceRecordsWithReceipts,
    mileageHistory,
    valueHistory,
    receiptFileNamesByServiceId,
    docFileNameById,
  };
}

export async function exportVehicleZip(
  vehicleId: string,
  supabase: SupabaseClient,
  onProgress: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<ExportResult> {
  onProgress({ phase: 'Preparing', current: 0, total: 1, message: 'Fetching vehicle data...' });

  const { data: vehicle, error } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('id', vehicleId)
    .single();

  if (error || !vehicle || signal?.aborted) {
    return { success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: [] };
  }

  const v = vehicle as Motorcycle;
  const zip = new JSZip();
  const date = new Date().toISOString().split('T')[0];
  const vehicleFolderName = sanitizeFileName(v.name);
  const rootFolder = sanitizeFileName(`${v.name}-${date}`);

  const fileCounter = { downloaded: 0, skipped: 0, skippedDetails: [] as string[] };

  const exportData = await addVehicleToZip(zip, v, rootFolder, vehicleFolderName, supabase, onProgress, fileCounter, signal);

  if (signal?.aborted || !exportData) {
    return { success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export cancelled'] };
  }

  // Build comprehensive CSV for single vehicle
  const serviceRecordsForCSV = exportData.serviceRecords.map((sr) => ({
    ...sr,
    vehicle_name: v.name,
    receipt_files: (exportData.receiptFileNamesByServiceId.get(sr.id) || []).join(','),
  }));
  const docsForCSV = exportData.documents.map((d) => ({
    ...d,
    vehicle_name: v.name,
  }));
  const mileageForCSV = exportData.mileageHistory.map((m) => ({
    ...m,
    vehicle_name: v.name,
  }));

  const csvContent = generateComprehensiveCSV(
    [v],
    docsForCSV,
    serviceRecordsForCSV,
    mileageForCSV,
    { includeInactive: true, encodeStatusInNotes: false }
  );
  zip.file(`${rootFolder}/csv/collection-export.csv`, csvContent);

  onProgress({
    phase: 'Generating ZIP',
    current: 0,
    total: 1,
    message: 'Creating ZIP file...',
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    streamFiles: true,
  });

  if (signal?.aborted) {
    return { success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export cancelled'] };
  }

  downloadBlob(blob, `${rootFolder}.zip`);

  return {
    success: true,
    totalFiles: fileCounter.downloaded,
    skippedFiles: fileCounter.skipped,
    skippedDetails: fileCounter.skippedDetails,
  };
}

export async function exportCollectionZip(
  collectionId: string,
  collectionName: string,
  supabase: SupabaseClient,
  csvOptions: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<ExportResult> {
  onProgress({ phase: 'Preparing', current: 0, total: 1, message: 'Fetching collection data...' });

  const { data: vehicles, error } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('collection_id', collectionId)
    .order('name');

  if (error || !vehicles || vehicles.length === 0 || signal?.aborted) {
    return {
      success: false,
      totalFiles: 0,
      skippedFiles: 0,
      skippedDetails: signal?.aborted ? ['Export cancelled'] : vehicles?.length === 0 ? ['No vehicles in collection'] : [],
    };
  }

  const typedVehicles = vehicles as Motorcycle[];
  const zip = new JSZip();
  const date = new Date().toISOString().split('T')[0];
  const rootFolder = sanitizeFileName(`${collectionName}-${date}`);

  const fileCounter = { downloaded: 0, skipped: 0, skippedDetails: [] as string[] };
  const vehicleFolderNames = new Set<string>();

  // Accumulate data from each vehicle for comprehensive CSV
  const allExportData: VehicleExportData[] = [];

  for (let i = 0; i < typedVehicles.length; i++) {
    if (signal?.aborted) {
      return { success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export cancelled'] };
    }

    const vehicle = typedVehicles[i];
    onProgress({
      phase: 'Processing vehicles',
      current: i + 1,
      total: typedVehicles.length,
      message: `Processing ${vehicle.name} (${i + 1}/${typedVehicles.length})...`,
    });

    const vehicleFolder = getUniqueFileName(vehicleFolderNames, sanitizeFileName(vehicle.name));
    const exportData = await addVehicleToZip(
      zip,
      vehicle,
      rootFolder,
      vehicleFolder,
      supabase,
      onProgress,
      fileCounter,
      signal
    );

    if (signal?.aborted || !exportData) {
      return { success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export cancelled'] };
    }

    allExportData.push(exportData);
  }

  // Build comprehensive CSV from accumulated data
  onProgress({ phase: 'Generating CSV', current: 0, total: 1, message: 'Generating collection-export.csv...' });

  const allDocs: (VehicleDocument & { vehicle_name: string })[] = [];
  const allServiceRecords: (ServiceRecord & { vehicle_name: string; receipt_files: string; receipts: ServiceRecordReceipt[] })[] = [];
  const allMileage: (MileageHistory & { vehicle_name: string })[] = [];

  for (const data of allExportData) {
    const vName = data.vehicle.name;

    for (const doc of data.documents) {
      allDocs.push({ ...doc, vehicle_name: vName });
    }

    for (const sr of data.serviceRecords) {
      allServiceRecords.push({
        ...sr,
        vehicle_name: vName,
        receipt_files: (data.receiptFileNamesByServiceId.get(sr.id) || []).join(','),
      });
    }

    for (const m of data.mileageHistory) {
      allMileage.push({ ...m, vehicle_name: vName });
    }
  }

  const csvContent = generateComprehensiveCSV(
    typedVehicles,
    allDocs,
    allServiceRecords,
    allMileage,
    csvOptions
  );
  zip.file(`${rootFolder}/csv/collection-export.csv`, csvContent);

  if (signal?.aborted) {
    return { success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export cancelled'] };
  }

  onProgress({
    phase: 'Generating ZIP',
    current: 0,
    total: 1,
    message: 'Creating ZIP file...',
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    streamFiles: true,
  });

  if (signal?.aborted) {
    return { success: false, totalFiles: 0, skippedFiles: 0, skippedDetails: ['Export cancelled'] };
  }

  downloadBlob(blob, `${rootFolder}.zip`);

  return {
    success: true,
    totalFiles: fileCounter.downloaded,
    skippedFiles: fileCounter.skipped,
    skippedDetails: fileCounter.skippedDetails,
  };
}
