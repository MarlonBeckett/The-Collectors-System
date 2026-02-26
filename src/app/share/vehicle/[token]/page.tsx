import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { Motorcycle, Photo, MileageHistory, ServiceRecord, ServiceRecordReceipt, VehicleDocument } from '@/types/database';
import { ShareShell } from '@/components/share/ShareShell';
import { VehicleDetailContent } from '@/components/vehicles/VehicleDetailContent';
import type { Metadata } from 'next';

interface ShareVehiclePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: ShareVehiclePageProps): Promise<Metadata> {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: shareLink } = await supabase
    .from('vehicle_share_links')
    .select('motorcycle_id, is_active')
    .eq('token', token)
    .single();

  if (!shareLink || !shareLink.is_active) {
    return { title: 'Shared Vehicle' };
  }

  const { data: vehicle } = await supabase
    .from('motorcycles')
    .select('year, make, model')
    .eq('id', shareLink.motorcycle_id)
    .single();

  if (!vehicle) {
    return { title: 'Shared Vehicle' };
  }

  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Shared Vehicle';
  return {
    title,
    openGraph: { title },
  };
}

export default async function ShareVehiclePage({ params }: ShareVehiclePageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Look up vehicle share link
  const { data: shareLink } = await supabase
    .from('vehicle_share_links')
    .select('id, motorcycle_id, is_active, include_vin, include_plate, include_purchase_info, include_tab_expiration, include_notes, include_service_records, include_documents, include_mileage')
    .eq('token', token)
    .single();

  if (!shareLink || !shareLink.is_active) {
    return notFound();
  }

  const vehicleId = shareLink.motorcycle_id;

  // Fetch vehicle
  const { data: vehicleData } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('id', vehicleId)
    .single();

  if (!vehicleData) {
    return notFound();
  }

  // Strip fields based on share link toggle settings
  const vehicle: Motorcycle = {
    ...vehicleData as Motorcycle,
    vin: shareLink.include_vin ? vehicleData.vin : null,
    plate_number: shareLink.include_plate ? vehicleData.plate_number : null,
    purchase_price: shareLink.include_purchase_info ? vehicleData.purchase_price : null,
    purchase_date: shareLink.include_purchase_info ? vehicleData.purchase_date : null,
    tab_expiration: shareLink.include_tab_expiration ? vehicleData.tab_expiration : null,
    notes: shareLink.include_notes ? vehicleData.notes : null,
  };

  // Fetch related data in parallel (skip sections toggled off)
  const [
    { data: photosData },
    { data: mileageData },
    { data: serviceData },
    { data: documentsData },
  ] = await Promise.all([
    supabase.from('photos').select('*').eq('motorcycle_id', vehicleId).order('display_order', { ascending: true }),
    shareLink.include_mileage
      ? supabase.from('mileage_history').select('*').eq('motorcycle_id', vehicleId).order('recorded_date', { ascending: false })
      : Promise.resolve({ data: [] }),
    shareLink.include_service_records
      ? supabase.from('service_records').select('*').eq('motorcycle_id', vehicleId).order('service_date', { ascending: false })
      : Promise.resolve({ data: [] }),
    shareLink.include_documents
      ? supabase.from('vehicle_documents').select('*').eq('motorcycle_id', vehicleId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const photos = (photosData || []) as Photo[];
  const mileageHistory = (mileageData || []) as MileageHistory[];
  const documents = (documentsData || []) as VehicleDocument[];

  // Fetch receipts for service records
  const serviceIds = (serviceData || []).map(s => s.id);
  const { data: receiptsData } = serviceIds.length > 0
    ? await supabase.from('service_record_receipts').select('*').in('service_record_id', serviceIds)
    : { data: [] };

  const serviceRecords = (serviceData || []).map(record => ({
    ...record,
    receipts: (receiptsData || []).filter(r => r.service_record_id === record.id),
  })) as (ServiceRecord & { receipts: ServiceRecordReceipt[] })[];

  // Generate signed URLs
  const allReceipts = serviceRecords.flatMap(r => r.receipts || []);

  const [photoUrlsResult, documentUrlsResult, receiptUrlsResult] = await Promise.all([
    photos.length > 0
      ? supabase.storage.from('motorcycle-photos').createSignedUrls(photos.map(p => p.storage_path), 3600)
      : Promise.resolve({ data: null }),
    documents.length > 0
      ? supabase.storage.from('vehicle-documents').createSignedUrls(documents.map(d => d.storage_path), 3600)
      : Promise.resolve({ data: null }),
    allReceipts.length > 0
      ? supabase.storage.from('service-receipts').createSignedUrls(allReceipts.map(r => r.storage_path), 3600)
      : Promise.resolve({ data: null }),
  ]);

  const imageUrls: Record<string, string> = {};
  if (photoUrlsResult.data) {
    photoUrlsResult.data.forEach((item, i) => {
      if (item.signedUrl) imageUrls[photos[i].id] = item.signedUrl;
    });
  }

  const documentUrls: Record<string, string> = {};
  if (documentUrlsResult.data) {
    documentUrlsResult.data.forEach((item, i) => {
      if (item.signedUrl) documentUrls[documents[i].id] = item.signedUrl;
    });
  }

  const receiptUrls: Record<string, string> = {};
  if (receiptUrlsResult.data) {
    receiptUrlsResult.data.forEach((item, i) => {
      if (item.signedUrl) receiptUrls[allReceipts[i].id] = item.signedUrl;
    });
  }

  // Update last_accessed_at
  await supabase
    .from('vehicle_share_links')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', shareLink.id);

  const vehicleName = [vehicleData.year, vehicleData.make, vehicleData.model].filter(Boolean).join(' ') || 'Shared Vehicle';

  return (
    <ShareShell collectionName={vehicleName}>
      <VehicleDetailContent
        vehicle={vehicle}
        photos={photos}
        mileageHistory={mileageHistory}
        serviceRecords={serviceRecords}
        documents={documents}
        imageUrls={imageUrls}
        documentUrls={documentUrls}
        receiptUrls={receiptUrls}
        canEdit={false}
      />
    </ShareShell>
  );
}
