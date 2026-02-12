'use client';

import Link from 'next/link';
import { Motorcycle, VehicleType } from '@/types/database';
import { getVehicleDisplayName } from '@/lib/vehicleUtils';
import { ExpirationIndicator } from './ExpirationIndicator';
import { formatDate } from '@/lib/dateUtils';

interface VehicleCardProps {
  vehicle: Motorcycle;
}

const vehicleTypeLabels: Record<VehicleType, string> = {
  motorcycle: 'Motorcycle',
  car: 'Car',
  boat: 'Boat',
  trailer: 'Trailer',
  other: 'Other',
};

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const isInactive = vehicle.status !== 'active' && vehicle.status !== 'maintenance';
  const vehicleType = vehicle.vehicle_type || 'motorcycle';

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className={`block bg-card border border-border p-4 hover:border-primary transition-colors ${
        isInactive ? 'opacity-60' : ''
      } ${vehicle.status === 'maintenance' ? 'border-l-4 border-l-destructive' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-card-foreground truncate">
              {getVehicleDisplayName(vehicle)}
            </h3>
            <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground">
              {vehicleTypeLabels[vehicleType]}
            </span>
          </div>
          {vehicle.nickname && (
            <p className="text-sm text-muted-foreground italic">&ldquo;{vehicle.nickname}&rdquo;</p>
          )}
        </div>

        {vehicle.status === 'active' && (
          <ExpirationIndicator expirationDate={vehicle.tab_expiration} />
        )}

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

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {vehicle.plate_number && (
          <div>
            <span className="text-muted-foreground">Plate: </span>
            <span className="font-mono font-medium">{vehicle.plate_number}</span>
          </div>
        )}
        {vehicle.tab_expiration && vehicle.status === 'active' && (
          <div>
            <span className="text-muted-foreground">Expires: </span>
            <span>{formatDate(vehicle.tab_expiration)}</span>
          </div>
        )}
      </div>

      {vehicle.status === 'maintenance' && vehicle.maintenance_notes && (
        <div className="mt-2 text-sm text-destructive">
          {vehicle.maintenance_notes}
        </div>
      )}
    </Link>
  );
}
