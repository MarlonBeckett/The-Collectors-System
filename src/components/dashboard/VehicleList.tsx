'use client';

import { useState, useMemo } from 'react';
import { Motorcycle } from '@/types/database';
import { VehicleCard } from './VehicleCard';
import { SearchBar } from './SearchBar';
import { QuickStats } from './QuickStats';
import { daysUntilExpiration } from '@/lib/dateUtils';

interface VehicleListProps {
  vehicles: Motorcycle[];
}

type FilterTab = 'all' | 'tabs' | 'maintenance';

export function VehicleList({ vehicles }: VehicleListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedMake, setSelectedMake] = useState<string>('');

  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;

  const needsTabsCount = vehicles.filter(v => {
    if (v.status !== 'active') return false;
    const days = daysUntilExpiration(v.tab_expiration);
    return days !== null && days <= 30;
  }).length;

  // Get unique makes for filter dropdown
  const makes = useMemo(() => {
    const uniqueMakes = new Set(vehicles.map(v => v.make).filter((m): m is string => !!m));
    return Array.from(uniqueMakes).sort();
  }, [vehicles]);

  const sortedVehicles = useMemo(() => {
    // Sort: active vehicles first, then by expiration (expired first, then soonest, nulls last)
    return [...vehicles].sort((a, b) => {
      // Active vehicles come before inactive
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;

      // For active vehicles, sort by expiration
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

      // For inactive vehicles, sort by name
      return a.name.localeCompare(b.name);
    });
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let result = sortedVehicles;

    // Filter by active tab
    if (activeTab === 'maintenance') {
      result = result.filter(v => v.status === 'maintenance');
    } else if (activeTab === 'tabs') {
      result = result.filter(v => {
        if (v.status !== 'active') return false;
        const days = daysUntilExpiration(v.tab_expiration);
        return days !== null && days <= 30;
      });
    } else {
      // For 'all' tab, filter by active status toggle
      if (!showInactive) {
        result = result.filter(v => v.status === 'active' || v.status === 'maintenance');
      }
    }

    // Filter by make
    if (selectedMake) {
      result = result.filter(v => v.make === selectedMake);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(vehicle =>
        vehicle.name.toLowerCase().includes(query) ||
        vehicle.make?.toLowerCase().includes(query) ||
        vehicle.model?.toLowerCase().includes(query) ||
        vehicle.plate_number?.toLowerCase().includes(query) ||
        vehicle.vin?.toLowerCase().includes(query) ||
        vehicle.year?.toString().includes(query)
      );
    }

    return result;
  }, [sortedVehicles, searchQuery, showInactive, activeTab, selectedMake]);

  const inactiveCount = vehicles.filter(v => v.status !== 'active' && v.status !== 'maintenance').length;

  return (
    <div className="space-y-4">
      <QuickStats vehicles={vehicles} />

      <div className="sticky top-14 z-40 bg-background py-2">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('tabs')}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'tabs'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Needs Tabs {needsTabsCount > 0 && `(${needsTabsCount})`}
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'maintenance'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Maintenance {maintenanceCount > 0 && `(${maintenanceCount})`}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <SearchBar onSearch={setSearchQuery} />
          </div>
          {makes.length > 0 && (
            <select
              value={selectedMake}
              onChange={(e) => setSelectedMake(e.target.value)}
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="">All Makes</option>
              {makes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          )}
        </div>

        {activeTab === 'all' && inactiveCount > 0 && (
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

      {filteredVehicles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? 'No vehicles found matching your search' :
             activeTab === 'maintenance' ? 'No vehicles need maintenance' :
             activeTab === 'tabs' ? 'No vehicles need tabs renewed' : 'No vehicles yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVehicles.map(vehicle => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
    </div>
  );
}
