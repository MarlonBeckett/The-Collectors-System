import { VehicleContext } from '@/types/research';

/**
 * Find which vehicle the user is referring to in their message
 * Searches by name, nickname, model, make, or combinations
 */
export function findVehicleContext(
  vehicleMentioned: string | undefined,
  vehicles: Array<{
    id: string;
    name: string;
    vehicle_type: string;
    year: number | null;
    make: string | null;
    model: string | null;
    nickname: string | null;
  }>
): VehicleContext | undefined {
  if (!vehicleMentioned || !vehicles.length) return undefined;

  const searchTerm = vehicleMentioned.toLowerCase();

  // Try exact name match first
  let match = vehicles.find(
    (v) => v.name.toLowerCase() === searchTerm || v.nickname?.toLowerCase() === searchTerm
  );

  // Try exact model match (most specific)
  if (!match) {
    match = vehicles.find(
      (v) => v.model && searchTerm.includes(v.model.toLowerCase())
    );
  }

  // Try nickname partial match
  if (!match) {
    match = vehicles.find(
      (v) => v.nickname?.toLowerCase() && searchTerm.includes(v.nickname.toLowerCase())
    );
  }

  // Try name contains search term or vice versa
  if (!match) {
    match = vehicles.find(
      (v) =>
        v.name.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(v.name.toLowerCase())
    );
  }

  // Try make + model combination in search term (e.g., "KTM 300XC")
  if (!match) {
    match = vehicles.find((v) => {
      if (v.make && v.model) {
        const makeModel = `${v.make} ${v.model}`.toLowerCase();
        return searchTerm.includes(makeModel) || searchTerm.includes(`${v.make.toLowerCase()} ${v.model.toLowerCase()}`);
      }
      return false;
    });
  }

  // Last resort: make-only match, but only if there's exactly one vehicle of that make
  if (!match) {
    const makeMatches = vehicles.filter(
      (v) => v.make && searchTerm.includes(v.make.toLowerCase())
    );
    if (makeMatches.length === 1) {
      match = makeMatches[0];
    }
  }

  if (match) {
    return {
      id: match.id,
      name: match.name,
      vehicleType: match.vehicle_type,
      year: match.year,
      make: match.make,
      model: match.model,
      nickname: match.nickname,
    };
  }

  return undefined;
}
