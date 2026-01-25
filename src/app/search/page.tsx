'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle } from '@/types/database';
import { AppShell } from '@/components/layout/AppShell';
import { VehicleCard } from '@/components/dashboard/VehicleCard';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SearchPage() {
  const [vehicles, setVehicles] = useState<Motorcycle[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadVehicles = async () => {
      const { data } = await supabase
        .from('motorcycles')
        .select('*')
        .order('name');
      if (data) setVehicles(data);
      setLoading(false);
    };
    loadVehicles();
  }, [supabase]);

  const filteredVehicles = useMemo(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    return vehicles.filter(
      (vehicle) =>
        vehicle.name.toLowerCase().includes(q) ||
        vehicle.plate_number?.toLowerCase().includes(q) ||
        vehicle.vin?.toLowerCase().includes(q) ||
        vehicle.year?.toString().includes(q) ||
        vehicle.mileage?.toLowerCase().includes(q) ||
        vehicle.notes?.toLowerCase().includes(q)
    );
  }, [vehicles, query]);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Search</h1>
          <p className="text-muted-foreground">Find vehicles by name, plate, VIN, or year</p>
        </div>

        {/* Search Input */}
        <div className="sticky top-14 z-40 bg-background py-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicles..."
              autoFocus
              className="w-full pl-12 pr-4 py-4 text-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Results */}
        <div className="mt-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mx-auto" />
            </div>
          ) : query.trim() === '' ? (
            <div className="text-center py-12 text-muted-foreground">
              Start typing to search...
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No vehicles found matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                {filteredVehicles.length} result{filteredVehicles.length !== 1 ? 's' : ''}
              </p>
              {filteredVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
