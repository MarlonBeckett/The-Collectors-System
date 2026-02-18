import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { Motorcycle, Photo, MileageHistory, ServiceRecord, ServiceRecordReceipt, VehicleDocument } from '@/types/database';
import { ShareShell } from '@/components/share/ShareShell';
import { VehicleDetailContent } from '@/components/vehicles/VehicleDetailContent';
import type { Metadata } from 'next';

interface ShareVehiclePageProps {
  params: Promise<{ token: string; id: string }>;
}

export async function generateMetadata({ params }: ShareVehiclePageProps): Promise<Metadata> {
  const { token, id } = await params;
  const supabase = createAdminClient();

  const { data: shareLink } = await supabase
    .from('collection_share_links')
    .select('collection_id, is_active')
    .eq('token', token)
    .single();

  if (!shareLink || !shareLink.is_active) {
    return { title: 'Shared Vehicle' };
  }

  const { data: vehicle } = await supabase
    .from('motorcycles')
    .select('year, make, model')
    .eq('id', id)
    .eq('collection_id', shareLink.collection_id)
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
  const { token, id } = await params;
  const supabase = createAdminClient();

  // Look up share link
  const { data: shareLink } = await supabase
    .from('collection_share_links')
    .select('id, collection_id, is_active')
    .eq('token', token)
    .single();

  if (!shareLink || !shareLink.is_active) {
    return notFound();
  }

  // Fetch vehicle and verify it belongs to this collection
  const { data: vehicleData } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('id', id)
    .eq('collection_id', shareLink.collection_id)
    .single();

  if (!vehicleData) {
    return notFound();
  }

  // Strip sensitive fields
  const vehicle: Motorcycle = {
    ...vehicleData as Motorcycle,
    vin: null,
    plate_number: null,
    purchase_price: null,
    purchase_date: null,
    tab_expiration: null,
  };

  // Fetch collection name
  const { data: collection } = await supabase
    .from('collections')
    .select('name')
    .eq('id', shareLink.collection_id)
    .single();

  // Fetch all related data in parallel
  const [
    { data: photosData },
    { data: mileageData },
    { data: serviceData },
    { data: documentsData },
  ] = await Promise.all([
    supabase.from('photos').select('*').eq('motorcycle_id', id).order('display_order', { ascending: true }),
    supabase.from('mileage_history').select('*').eq('motorcycle_id', id).order('recorded_date', { ascending: false }),
    supabase.from('service_records').select('*').eq('motorcycle_id', id).order('service_date', { ascending: false }),
    supabase.from('vehicle_documents').select('*').eq('motorcycle_id', id).order('created_at', { ascending: false }),
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
    .from('collection_share_links')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', shareLink.id);

  return (
    <ShareShell collectionName={collection?.name || 'Shared Collection'}>
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
        backHref={`/share/${token}`}
      />
    </ShareShell>
  );
}
