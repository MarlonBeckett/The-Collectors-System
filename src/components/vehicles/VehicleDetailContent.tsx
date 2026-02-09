'use client';

import { useState, useEffect, useCallback } from 'react';
import { Motorcycle, Photo, SaleInfo, VehicleType, MileageHistory, ServiceRecord, ServiceRecordReceipt, VehicleDocument } from '@/types/database';
import { VehicleDetailSkeleton } from '@/components/ui/VehicleDetailSkeleton';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { formatSaleInfo } from '@/lib/statusParser';
import { VehicleStatus } from '@/components/vehicles/VehicleStatus';
import { MileageSection } from '@/components/vehicles/MileageSection';
import { ServiceRecordsSection } from '@/components/vehicles/ServiceRecordsSection';
import { DocumentsSection } from '@/components/vehicles/DocumentsSection';
import Link from 'next/link';
import { PencilIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const vehicleTypeLabels: Record<VehicleType, string> = {
  motorcycle: 'Motorcycle',
  car: 'Car',
  boat: 'Boat',
  trailer: 'Trailer',
  other: 'Other',
};

interface VehicleDetailContentProps {
  vehicle: Motorcycle;
  photos: Photo[];
  mileageHistory: MileageHistory[];
  serviceRecords: (ServiceRecord & { receipts: ServiceRecordReceipt[] })[];
  documents: VehicleDocument[];
  imageUrls: Record<string, string>;
  documentUrls: Record<string, string>;
  receiptUrls: Record<string, string>;
  canEdit: boolean;
}

export function VehicleDetailContent({
  vehicle,
  photos,
  mileageHistory,
  serviceRecords,
  documents,
  imageUrls,
  documentUrls,
  receiptUrls,
  canEdit,
}: VehicleDetailContentProps) {
  const hasPhotos = photos.length > 0;
  const [revealed, setRevealed] = useState(!hasPhotos);

  // Timeout fallback — 4s max wait, then show regardless
  useEffect(() => {
    if (revealed) return;
    const timer = setTimeout(() => setRevealed(true), 3000);
    return () => clearTimeout(timer);
  }, [revealed]);

  const handleFirstImageLoad = useCallback(() => {
    setRevealed(true);
  }, []);

  // Both layers render simultaneously. Content is in normal document flow
  // so next/image gets proper layout and priority. The skeleton sits on top
  // as an absolute overlay until the first gallery photo fires onLoad.
  return (
    <div className="relative">
      {/* Skeleton overlay — covers content until first image loads */}
      {!revealed && (
        <div className="absolute inset-0 z-10 bg-background">
          <VehicleDetailSkeleton />
        </div>
      )}

      {/* Real content — always in flow so images load with correct priority */}
      <div className={revealed ? 'animate-fade-in' : ''}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back</span>
            </Link>
            {canEdit && (
              <Link
                href={`/vehicles/${vehicle.id}/edit`}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground hover:opacity-90"
              >
                <PencilIcon className="w-4 h-4" />
                <span>Edit</span>
              </Link>
            )}
          </div>

          {/* Photo Gallery */}
          <PhotoGallery
            photos={photos}
            motorcycleName={vehicle.name}
            imageUrls={imageUrls}
            onFirstImageLoad={handleFirstImageLoad}
          />

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

            {/* Vehicle Status Section */}
            <VehicleStatus vehicle={vehicle} canEdit={canEdit} />

            {/* Key Information */}
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card border border-border p-4">
                  <h2 className="text-sm font-medium text-muted-foreground mb-1">Plate Number</h2>
                  <p className="text-2xl font-mono font-bold tracking-wider">
                    {vehicle.plate_number || '—'}
                  </p>
                </div>
                <div className="bg-card border border-border p-4 min-w-0">
                  <h2 className="text-sm font-medium text-muted-foreground mb-1">VIN</h2>
                  <p className="text-lg font-mono tracking-wide break-all overflow-hidden">
                    {vehicle.vin || '—'}
                  </p>
                </div>
              </div>

              <MileageSection motorcycleId={vehicle.id} mileageHistory={mileageHistory} canEdit={canEdit} />
              <ServiceRecordsSection motorcycleId={vehicle.id} serviceRecords={serviceRecords} canEdit={canEdit} initialReceiptUrls={receiptUrls} />
              <DocumentsSection motorcycleId={vehicle.id} documents={documents} canEdit={canEdit} initialUrls={documentUrls} />

              {vehicle.notes && (
                <div className="bg-card border border-border p-4">
                  <h2 className="text-sm font-medium text-muted-foreground mb-1">Notes</h2>
                  <p className="text-foreground whitespace-pre-wrap">{vehicle.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
