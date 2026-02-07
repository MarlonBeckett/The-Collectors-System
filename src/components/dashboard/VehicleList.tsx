'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { FunnelIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import { Motorcycle } from '@/types/database';
import { VehicleCard } from './VehicleCard';
import { SearchBar } from './SearchBar';
import { QuickStats } from './QuickStats';
import { daysUntilExpiration } from '@/lib/dateUtils';

interface VehicleListProps {
  vehicles: Motorcycle[];
}

type FilterTab = 'all' | 'tabs' | 'maintenance' | 'sold';
type SortOption = 'expiration-asc' | 'expiration-desc' | 'name-asc' | 'name-desc' | 'year-desc' | 'year-asc' | 'added-desc' | 'added-asc';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'name-asc', label: 'Name (A\u2013Z)' },
  { key: 'name-desc', label: 'Name (Z\u2013A)' },
  { key: 'year-desc', label: 'Year (newest first)' },
  { key: 'year-asc', label: 'Year (oldest first)' },
  { key: 'expiration-asc', label: 'Expiration (soonest first)' },
  { key: 'expiration-desc', label: 'Expiration (furthest first)' },
  { key: 'added-desc', label: 'Date Added (newest first)' },
  { key: 'added-asc', label: 'Date Added (oldest first)' },
];

export function VehicleList({ vehicles }: VehicleListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('vehicleSortPreference') as SortOption) || 'expiration-asc';
    }
    return 'expiration-asc';
  });
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sortOpen]);

  const handleSortChange = (option: SortOption) => {
    setSortBy(option);
    localStorage.setItem('vehicleSortPreference', option);
    setSortOpen(false);
  };

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
    return [...vehicles].sort((a, b) => {
      // Primary: active vehicles come before inactive
      const aActive = a.status === 'active' || a.status === 'maintenance';
      const bActive = b.status === 'active' || b.status === 'maintenance';
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // Secondary: sort by selected option
      switch (sortBy) {
        case 'expiration-asc': {
          const daysA = daysUntilExpiration(a.tab_expiration);
          const daysB = daysUntilExpiration(b.tab_expiration);
          if (daysA === null && daysB === null) return a.name.localeCompare(b.name);
          if (daysA === null) return 1;
          if (daysB === null) return -1;
          return daysA - daysB || a.name.localeCompare(b.name);
        }
        case 'expiration-desc': {
          const daysA = daysUntilExpiration(a.tab_expiration);
          const daysB = daysUntilExpiration(b.tab_expiration);
          if (daysA === null && daysB === null) return a.name.localeCompare(b.name);
          if (daysA === null) return 1;
          if (daysB === null) return -1;
          return daysB - daysA || a.name.localeCompare(b.name);
        }
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'year-desc': {
          if (a.year === null && b.year === null) return a.name.localeCompare(b.name);
          if (a.year === null) return 1;
          if (b.year === null) return -1;
          return b.year - a.year || a.name.localeCompare(b.name);
        }
        case 'year-asc': {
          if (a.year === null && b.year === null) return a.name.localeCompare(b.name);
          if (a.year === null) return 1;
          if (b.year === null) return -1;
          return a.year - b.year || a.name.localeCompare(b.name);
        }
        case 'added-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.name.localeCompare(b.name);
        case 'added-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [vehicles, sortBy]);

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
    } else if (activeTab === 'sold') {
      result = result.filter(v => v.status !== 'active' && v.status !== 'maintenance');
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

  const activeFilterCount = [activeTab !== 'all', selectedMake !== '', showInactive].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <QuickStats vehicles={vehicles} />

      <div className="sticky top-14 z-40 bg-background py-2">
        {/* Search + Sort + Filter Toggle */}
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchBar onSearch={setSearchQuery} />
          </div>
          {/* Sort Button */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className={`flex items-center justify-center w-12 h-full shrink-0 border transition-colors ${
                sortOpen
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
              aria-label="Sort vehicles"
            >
              <ArrowsUpDownIcon className="w-5 h-5" />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border shadow-lg z-50">
                {SORT_OPTIONS.map((option, i) => (
                  <div key={option.key}>
                    {i > 0 && i % 2 === 0 && (
                      <div className="border-t border-border" />
                    )}
                    <button
                      onClick={() => handleSortChange(option.key)}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-muted transition-colors ${
                        sortBy === option.key ? 'text-primary font-medium' : 'text-foreground'
                      }`}
                    >
                      {option.label}
                      {sortBy === option.key && (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`relative flex items-center justify-center w-12 shrink-0 border transition-colors ${
              filtersOpen
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
            aria-label="Toggle filters"
          >
            <FunnelIcon className="w-5 h-5" />
            {activeFilterCount > 0 && !filtersOpen && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expandable Filter Panel */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            filtersOpen ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border border-border bg-card p-3 space-y-3">
            {/* Filter Tabs */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filter</span>
              <div className="flex gap-2 mt-1 overflow-x-auto">
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
                {inactiveCount > 0 && (
                  <button
                    onClick={() => setActiveTab('sold')}
                    className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === 'sold'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Sold {inactiveCount > 0 && `(${inactiveCount})`}
                  </button>
                )}
              </div>
            </div>

            {/* Make Dropdown */}
            {makes.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Make</span>
                <select
                  value={selectedMake}
                  onChange={(e) => setSelectedMake(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="">All Makes</option>
                  {makes.map((make) => (
                    <option key={make} value={make}>
                      {make}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show/Hide Sold */}
            {activeTab === 'all' && inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`text-sm px-3 py-1 border ${
                  showInactive
                    ? 'bg-muted border-border text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {showInactive ? 'Hide' : 'Show'} sold in All
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredVehicles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? 'No vehicles found matching your search' :
             activeTab === 'maintenance' ? 'No vehicles need maintenance' :
             activeTab === 'tabs' ? 'No vehicles need tabs renewed' :
             activeTab === 'sold' ? 'No sold vehicles' : 'No vehicles yet'}
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
