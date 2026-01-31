'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface CollectionOption {
  id: string;
  name: string;
  owner_email: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
}

interface CollectionSwitcherProps {
  collections: CollectionOption[];
  currentCollectionId: string | null;
  onSelect: (collectionId: string) => void;
}

function getDisplayName(collection: CollectionOption): string {
  return collection.name;
}

export function CollectionSwitcher({
  collections,
  currentCollectionId,
  onSelect,
}: CollectionSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentCollection = collections.find((c) => c.id === currentCollectionId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If only one collection, don't show dropdown
  if (collections.length <= 1) {
    return (
      <h1 className="text-2xl font-bold text-foreground">
        {currentCollection ? getDisplayName(currentCollection) : 'Your Collection'}
      </h1>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-2xl font-bold text-foreground hover:text-primary transition-colors"
      >
        {currentCollection ? getDisplayName(currentCollection) : 'Select Collection'}
        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border shadow-lg z-50">
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => {
                onSelect(collection.id);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{getDisplayName(collection)}</div>
                {!collection.is_owner && (
                  <div className="text-xs text-muted-foreground">Shared with you</div>
                )}
              </div>
              {collection.id === currentCollectionId && (
                <CheckIcon className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
