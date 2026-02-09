import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { Motorcycle, Photo, MileageHistory, ServiceRecord, ServiceRecordReceipt, VehicleDocument, CollectionRole } from '@/types/database';
import { VehicleDetailContent } from '@/components/vehicles/VehicleDetailContent';
import { notFound } from 'next/navigation';

async function getUserRoleForCollection(supabase: Awaited<ReturnType<typeof createClient>>, collectionId: string, userId: string): Promise<CollectionRole | null> {
  // Check if user is owner
  const { data: collection } = await supabase
    .from('collections')
    .select('owner_id')
    .eq('id', collectionId)
    .single();

  if (collection?.owner_id === userId) return 'owner';

  // Check membership role
  const { data: membership } = await supabase
    .from('collection_members')
    .select('role')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .single();

  return (membership?.role as CollectionRole) || null;
}

interface VehicleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  // Fetch vehicle first (needed for collection_id)
  const { data, error } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return notFound();
  }

  const vehicle = data as Motorcycle;

  // Run all remaining queries in parallel
  const [
    { data: photosData },
    { data: mileageData },
    { data: serviceData },
    { data: documentsData },
    role,
  ] = await Promise.all([
    supabase
      .from('photos')
      .select('*')
      .eq('motorcycle_id', id)
      .order('display_order', { ascending: true }),
    supabase
      .from('mileage_history')
      .select('*')
      .eq('motorcycle_id', id)
      .order('recorded_date', { ascending: false }),
    supabase
      .from('service_records')
      .select('*')
      .eq('motorcycle_id', id)
      .order('service_date', { ascending: false }),
    supabase
      .from('vehicle_documents')
      .select('*')
      .eq('motorcycle_id', id)
      .order('created_at', { ascending: false }),
    vehicle.collection_id
      ? getUserRoleForCollection(supabase, vehicle.collection_id, user.id)
      : Promise.resolve('owner' as CollectionRole),
  ]);

  const photos = (photosData || []) as Photo[];
  const mileageHistory = (mileageData || []) as MileageHistory[];
  const documents = (documentsData || []) as VehicleDocument[];
  const canEdit = role === 'owner' || role === 'editor';

  // Fetch receipts for service records
  const serviceIds = (serviceData || []).map(s => s.id);
  const { data: receiptsData } = serviceIds.length > 0
    ? await supabase
        .from('service_record_receipts')
        .select('*')
        .in('service_record_id', serviceIds)
    : { data: [] };

  const serviceRecords = (serviceData || []).map(record => ({
    ...record,
    receipts: (receiptsData || []).filter(r => r.service_record_id === record.id)
  })) as (ServiceRecord & { receipts: ServiceRecordReceipt[] })[];

  // Generate all signed URLs server-side in parallel batches
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

  return (
    <AppShell>
      <VehicleDetailContent
        vehicle={vehicle}
        photos={photos}
        mileageHistory={mileageHistory}
        serviceRecords={serviceRecords}
        documents={documents}
        imageUrls={imageUrls}
        documentUrls={documentUrls}
        receiptUrls={receiptUrls}
        canEdit={canEdit}
      />
    </AppShell>
  );
}
