'use client';

import { useState, useMemo } from 'react';
import { Motorcycle } from '@/types/database';
import { BikeCard } from './BikeCard';
import { SearchBar } from './SearchBar';
import { QuickStats } from './QuickStats';
import { daysUntilExpiration } from '@/lib/dateUtils';
import { getVehicleDisplayName } from '@/lib/vehicleUtils';

interface BikeListProps {
  bikes: Motorcycle[];
}

export function BikeList({ bikes }: BikeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const sortedBikes = useMemo(() => {
    // Sort: active bikes first, then by expiration (expired first, then soonest, nulls last)
    return [...bikes].sort((a, b) => {
      // Active bikes come before inactive
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;

      // For active bikes, sort by expiration
      if (a.status === 'active' && b.status === 'active') {
        const daysA = daysUntilExpiration(a.tab_expiration);
        const daysB = daysUntilExpiration(b.tab_expiration);

        // Nulls last
        if (daysA === null && daysB === null) return 0;
        if (daysA === null) return 1;
        if (daysB === null) return -1;

        // Expired first, then soonest
        return daysA - daysB;
      }

      // For inactive bikes, sort by display name
      return getVehicleDisplayName(a).localeCompare(getVehicleDisplayName(b));
    });
  }, [bikes]);

  const filteredBikes = useMemo(() => {
    let result = sortedBikes;

    // Filter by active status
    if (!showInactive) {
      result = result.filter(b => b.status === 'active');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(bike =>
        bike.make.toLowerCase().includes(query) ||
        bike.model.toLowerCase().includes(query) ||
        bike.sub_model?.toLowerCase().includes(query) ||
        bike.nickname?.toLowerCase().includes(query) ||
        bike.plate_number?.toLowerCase().includes(query) ||
        bike.vin?.toLowerCase().includes(query) ||
        bike.year.toString().includes(query)
      );
    }

    return result;
  }, [sortedBikes, searchQuery, showInactive]);

  const inactiveCount = bikes.filter(b => b.status !== 'active').length;

  return (
    <div className="space-y-4">
      <QuickStats vehicles={bikes} />

      <div className="sticky top-14 z-40 bg-background py-2">
        <SearchBar onSearch={setSearchQuery} />

        {inactiveCount > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`text-sm px-3 py-1 border ${
                showInactive
                  ? 'bg-muted border-border text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {showInactive ? 'Hide' : 'Show'} {inactiveCount} sold
            </button>
          </div>
        )}
      </div>

      {filteredBikes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? 'No bikes found matching your search' : 'No bikes yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBikes.map(bike => (
            <BikeCard key={bike.id} bike={bike} />
          ))}
        </div>
      )}
    </div>
  );
}
