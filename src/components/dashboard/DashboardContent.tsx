'use client';

import { useState, useEffect, useMemo } from 'react';
import { Motorcycle } from '@/types/database';
import { VehicleList } from './VehicleList';
import { CollectionSwitcher, CollectionOption } from './CollectionSwitcher';
import UpgradeBanner from '@/components/subscription/UpgradeBanner';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';

interface UserCollection {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
  role: string;
  created_at: string;
}

interface SubscriptionInfo {
  isPro: boolean;
  vehicleCount: number;
  vehicleLimit: number;
}

interface DashboardContentProps {
  collections: UserCollection[];
  vehicles: Motorcycle[];
  vehiclePhotoMap: Record<string, string>;
  subscriptionInfo: SubscriptionInfo;
}

const STORAGE_KEY = 'selectedCollectionId';

export function DashboardContent({ collections, vehicles, vehiclePhotoMap, subscriptionInfo }: DashboardContentProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Preload first 5 showcase photos
  const preloadUrls = useMemo(
    () => Object.values(vehiclePhotoMap).slice(0, 5),
    [vehiclePhotoMap]
  );
  const { ready: imagesReady } = useImagePreloader(preloadUrls);

  // Load selected collection from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && collections.some((c) => c.id === stored)) {
      setSelectedCollectionId(stored);
    } else if (collections.length > 0) {
      setSelectedCollectionId(collections[0].id);
    }
    setIsLoaded(true);
  }, [collections]);

  const handleSelectCollection = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    localStorage.setItem(STORAGE_KEY, collectionId);
  };

  const filteredVehicles = selectedCollectionId
    ? vehicles.filter((v) => v.collection_id === selectedCollectionId)
    : vehicles;

  const collectionOptions: CollectionOption[] = collections.map((c) => ({
    id: c.id,
    name: c.name,
    owner_email: c.owner_email,
    owner_display_name: c.owner_display_name,
    is_owner: c.is_owner,
  }));

  if (!isLoaded || !imagesReady) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <CollectionSwitcher
          collections={collectionOptions}
          currentCollectionId={selectedCollectionId}
          onSelect={handleSelectCollection}
        />
      </div>

      {!subscriptionInfo.isPro && (
        <div className="mb-6">
          <UpgradeBanner vehicleCount={subscriptionInfo.vehicleCount} />
        </div>
      )}

      <VehicleList vehicles={filteredVehicles} vehiclePhotoMap={vehiclePhotoMap} />
    </div>
  );
}
