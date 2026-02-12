'use client';

import Link from 'next/link';
import { Motorcycle } from '@/types/database';
import { getVehicleDisplayName } from '@/lib/vehicleUtils';
import { ExpirationIndicator } from './ExpirationIndicator';
import { formatDate } from '@/lib/dateUtils';

interface BikeCardProps {
  bike: Motorcycle;
}

export function BikeCard({ bike }: BikeCardProps) {
  const isInactive = bike.status !== 'active';

  return (
    <Link
      href={`/bikes/${bike.id}`}
      className={`block bg-card border border-border p-4 hover:border-primary transition-colors ${
        isInactive ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-card-foreground truncate">
            {getVehicleDisplayName(bike)}
          </h3>
        </div>

        {bike.status === 'active' && (
          <ExpirationIndicator expirationDate={bike.tab_expiration} />
        )}

        {isInactive && (
          <span className={`px-2 py-1 text-xs font-medium uppercase ${
            bike.status === 'sold' ? 'bg-muted text-muted-foreground' :
            bike.status === 'traded' ? 'bg-accent/10 text-accent' :
            'bg-muted text-muted-foreground'
          }`}>
            {bike.status}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {bike.plate_number && (
          <div>
            <span className="text-muted-foreground">Plate: </span>
            <span className="font-mono font-medium">{bike.plate_number}</span>
          </div>
        )}
        {bike.tab_expiration && bike.status === 'active' && (
          <div>
            <span className="text-muted-foreground">Expires: </span>
            <span>{formatDate(bike.tab_expiration)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
