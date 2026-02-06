import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { formatSaleInfo } from '@/lib/statusParser';
import { Motorcycle, Photo, SaleInfo, VehicleType, MileageHistory, ServiceRecord, ServiceRecordReceipt, VehicleDocument, CollectionRole } from '@/types/database';
import { VehicleStatus } from '@/components/vehicles/VehicleStatus';
import { MileageSection } from '@/components/vehicles/MileageSection';
import { ServiceRecordsSection } from '@/components/vehicles/ServiceRecordsSection';
import { DocumentsSection } from '@/components/vehicles/DocumentsSection';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

async function getUserRoleForCollection(supabase: Awaited<ReturnType<typeof createClient>>, collectionId: string): Promise<CollectionRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check if user is owner
  const { data: collection } = await supabase
    .from('collections')
    .select('owner_id')
    .eq('id', collectionId)
    .single();

  if (collection?.owner_id === user.id) return 'owner';

  // Check membership role
  const { data: membership } = await supabase
    .from('collection_members')
    .select('role')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .single();

  return (membership?.role as CollectionRole) || null;
}

const vehicleTypeLabels: Record<VehicleType, string> = {
  motorcycle: 'Motorcycle',
  car: 'Car',
  boat: 'Boat',
  trailer: 'Trailer',
  other: 'Other',
};

export const dynamic = 'force-dynamic';

interface VehicleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return notFound();
  }

  const vehicle = data as Motorcycle;

  const { data: photosData } = await supabase
    .from('photos')
    .select('*')
    .eq('motorcycle_id', id)
    .order('display_order', { ascending: true });

  const photos = (photosData || []) as Photo[];

  const { data: mileageData } = await supabase
    .from('mileage_history')
    .select('*')
    .eq('motorcycle_id', id)
    .order('recorded_date', { ascending: false });

  const mileageHistory = (mileageData || []) as MileageHistory[];

  const { data: serviceData } = await supabase
    .from('service_records')
    .select('*')
    .eq('motorcycle_id', id)
    .order('service_date', { ascending: false });

  // Fetch receipts for all service records
  const serviceIds = (serviceData || []).map(s => s.id);
  const { data: receiptsData } = serviceIds.length > 0
    ? await supabase
        .from('service_record_receipts')
        .select('*')
        .in('service_record_id', serviceIds)
    : { data: [] };

  // Attach receipts to their service records
  const serviceRecords = (serviceData || []).map(record => ({
    ...record,
    receipts: (receiptsData || []).filter(r => r.service_record_id === record.id)
  })) as (ServiceRecord & { receipts: ServiceRecordReceipt[] })[];

  // Fetch documents
  const { data: documentsData } = await supabase
    .from('vehicle_documents')
    .select('*')
    .eq('motorcycle_id', id)
    .order('created_at', { ascending: false });

  const documents = (documentsData || []) as VehicleDocument[];

  // Get user's role for this vehicle's collection
  let canEdit = true; // default to true for backwards compatibility
  if (vehicle.collection_id) {
    const role = await getUserRoleForCollection(supabase, vehicle.collection_id);
    canEdit = role === 'owner' || role === 'editor';
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back</span>
          </Link>
          {canEdit && (
            <Link
              href={`/vehicles/${id}/edit`}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground hover:opacity-90"
            >
              <PencilIcon className="w-4 h-4" />
              <span>Edit</span>
            </Link>
          )}
        </div>

        {/* Photo Gallery */}
        <PhotoGallery photos={photos} motorcycleName={vehicle.name} />

        {/* Vehicle Details */}
        <div className="px-4 py-6 space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{vehicle.name}</h1>
              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                {vehicleTypeLabels[vehicle.vehicle_type || 'motorcycle']}
              </span>
            </div>
            {vehicle.nickname && (
              <p className="text-lg text-muted-foreground italic">&ldquo;{vehicle.nickname}&rdquo;</p>
            )}
            <div className="flex items-center gap-2 text-lg text-muted-foreground mt-1">
              {vehicle.make && <span>{vehicle.make}</span>}
              {vehicle.model && (
                <>
                  {vehicle.make && <span>·</span>}
                  <span>{vehicle.model}</span>
                </>
              )}
              {vehicle.year && (
                <>
                  {(vehicle.make || vehicle.model) && <span>·</span>}
                  <span>{vehicle.year}</span>
                </>
              )}
            </div>

            {/* Sale Info */}
            {vehicle.sale_info && (
              <p className="mt-2 text-muted-foreground">
                {formatSaleInfo(vehicle.sale_info as SaleInfo)}
              </p>
            )}
          </div>

          {/* Vehicle Status Section - prominent, editable */}
          <VehicleStatus vehicle={vehicle} canEdit={canEdit} />

          {/* Key Information */}
          <div className="grid gap-4">
            {/* Plate Number & VIN - side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Plate Number */}
              <div className="bg-card border border-border p-4">
                <h2 className="text-sm font-medium text-muted-foreground mb-1">Plate Number</h2>
                <p className="text-2xl font-mono font-bold tracking-wider">
                  {vehicle.plate_number || '—'}
                </p>
              </div>

              {/* VIN */}
              <div className="bg-card border border-border p-4 min-w-0">
                <h2 className="text-sm font-medium text-muted-foreground mb-1">VIN</h2>
                <p className="text-lg font-mono tracking-wide break-all overflow-hidden">
                  {vehicle.vin || '—'}
                </p>
              </div>
            </div>

            {/* Mileage - with update button */}
            <MileageSection motorcycleId={vehicle.id} mileageHistory={mileageHistory} canEdit={canEdit} />

            {/* Service History */}
            <ServiceRecordsSection motorcycleId={vehicle.id} serviceRecords={serviceRecords} canEdit={canEdit} />

            {/* Documents */}
            <DocumentsSection motorcycleId={vehicle.id} documents={documents} canEdit={canEdit} />

            {/* Notes */}
            {vehicle.notes && (
              <div className="bg-card border border-border p-4">
                <h2 className="text-sm font-medium text-muted-foreground mb-1">Notes</h2>
                <p className="text-foreground whitespace-pre-wrap">{vehicle.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
