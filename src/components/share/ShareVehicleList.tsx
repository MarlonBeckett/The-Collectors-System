'use client';

import { useState, useMemo } from 'react';
import { Motorcycle } from '@/types/database';
import { ShareVehicleCard } from './ShareVehicleCard';
import { getVehicleDisplayName } from '@/lib/vehicleUtils';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface ShareVehicleListProps {
  vehicles: Motorcycle[];
  token: string;
  showcaseUrls: Record<string, string>;
}

type SortOption = 'newest' | 'oldest' | 'name';

export function ShareVehicleList({ vehicles, token, showcaseUrls }: ShareVehicleListProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');

  const filtered = useMemo(() => {
    let result = vehicles;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v => {
        const name = getVehicleDisplayName(v).toLowerCase();
        const nickname = (v.nickname || '').toLowerCase();
        return name.includes(q) || nickname.includes(q);
      });
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return getVehicleDisplayName(a).localeCompare(getVehicleDisplayName(b));
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [vehicles, search, sort]);

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vehicles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-3 py-2 bg-card border border-border text-foreground"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? 'No vehicles match your search.' : 'No vehicles in this collection.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(vehicle => (
            <ShareVehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              token={token}
              showcaseUrl={showcaseUrls[vehicle.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
