import { Motorcycle } from '@/types/database';

/**
 * Returns a display name like "2023 BMW R1250GS Adventure"
 * Composed from year + make + model + sub_model.
 * For "other" vehicle types where make/model/year may be empty,
 * falls back to nickname.
 */
export function getVehicleDisplayName(vehicle: Pick<Motorcycle, 'year' | 'make' | 'model' | 'sub_model'> & { nickname?: string | null }): string {
  const parts = [vehicle.year || null, vehicle.make || null, vehicle.model || null, vehicle.sub_model || null]
    .filter(Boolean)
    .join(' ');
  return parts || vehicle.nickname || 'Unnamed Vehicle';
}
