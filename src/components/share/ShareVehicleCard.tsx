'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Motorcycle, VehicleType } from '@/types/database';
import { getVehicleDisplayName } from '@/lib/vehicleUtils';

interface ShareVehicleCardProps {
  vehicle: Motorcycle;
  token: string;
  showcaseUrl?: string;
}

const vehicleTypeLabels: Record<VehicleType, string> = {
  motorcycle: 'Motorcycle',
  car: 'Car',
  boat: 'Boat',
  trailer: 'Trailer',
  other: 'Other',
};

export function ShareVehicleCard({ vehicle, token, showcaseUrl }: ShareVehicleCardProps) {
  const isInactive = vehicle.status !== 'active' && vehicle.status !== 'maintenance';
  const vehicleType = vehicle.vehicle_type || 'motorcycle';

  return (
    <Link
      href={`/share/${token}/vehicle/${vehicle.id}`}
      className={`block bg-card border border-border hover:border-primary transition-colors overflow-hidden ${
        isInactive ? 'opacity-60' : ''
      } ${vehicle.status === 'maintenance' ? 'border-l-4 border-l-destructive' : ''}`}
    >
      {/* Showcase Photo */}
      <div className="relative w-full aspect-[16/10] bg-muted">
        {showcaseUrl ? (
          <Image
            src={showcaseUrl}
            alt={getVehicleDisplayName(vehicle)}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No showcase image available
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-card-foreground truncate">
                {getVehicleDisplayName(vehicle)}
              </h3>
              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground shrink-0">
                {vehicleTypeLabels[vehicleType]}
              </span>
            </div>
            {vehicle.nickname && (
              <p className="text-sm text-muted-foreground italic">&ldquo;{vehicle.nickname}&rdquo;</p>
            )}
          </div>

          {vehicle.status === 'maintenance' && (
            <span className="px-2 py-1 text-xs font-medium uppercase bg-destructive/10 text-destructive">
              Maintenance
            </span>
          )}

          {isInactive && (
            <span className={`px-2 py-1 text-xs font-medium uppercase ${
              vehicle.status === 'sold' ? 'bg-muted text-muted-foreground' :
              vehicle.status === 'traded' ? 'bg-accent/10 text-accent' :
              'bg-muted text-muted-foreground'
            }`}>
              {vehicle.status}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
