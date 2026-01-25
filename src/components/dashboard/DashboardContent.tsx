'use client';

import { useState, useEffect } from 'react';
import { Motorcycle } from '@/types/database';
import { VehicleList } from './VehicleList';
import { CollectionSwitcher, CollectionOption } from './CollectionSwitcher';

interface UserCollection {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  owner_display_name: string | null;
  join_code: string;
  is_owner: boolean;
  role: string;
  created_at: string;
}

interface DashboardContentProps {
  collections: UserCollection[];
  vehicles: Motorcycle[];
}

const STORAGE_KEY = 'selectedCollectionId';

export function DashboardContent({ collections, vehicles }: DashboardContentProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load selected collection from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && collections.some((c) => c.id === stored)) {
      setSelectedCollectionId(stored);
    } else if (collections.length > 0) {
      // Default to first collection (owned collections come first)
      setSelectedCollectionId(collections[0].id);
    }
    setIsLoaded(true);
  }, [collections]);

  // Save selected collection to localStorage
  const handleSelectCollection = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    localStorage.setItem(STORAGE_KEY, collectionId);
  };

  // Filter vehicles by selected collection
  const filteredVehicles = selectedCollectionId
    ? vehicles.filter((v) => v.collection_id === selectedCollectionId)
    : vehicles;

  // Convert to CollectionOption format
  const collectionOptions: CollectionOption[] = collections.map((c) => ({
    id: c.id,
    name: c.name,
    owner_email: c.owner_email,
    owner_display_name: c.owner_display_name,
    is_owner: c.is_owner,
  }));

  // Don't render until we've loaded from localStorage to prevent flash
  if (!isLoaded) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <CollectionSwitcher
          collections={collectionOptions}
          currentCollectionId={selectedCollectionId}
          onSelect={handleSelectCollection}
        />
        <p className="text-muted-foreground mt-1">
          {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''} in this collection
        </p>
      </div>

      <VehicleList vehicles={filteredVehicles} />
    </div>
  );
}
