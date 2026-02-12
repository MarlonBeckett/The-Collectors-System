import { useState, useCallback } from 'react';

const STORAGE_KEY = 'selectedCollectionId';

/**
 * Shared hook for persisting the selected collection across all pages.
 * Reads from localStorage on init, writes on change.
 */
export function useSelectedCollection(
  collections: { id: string; is_owner: boolean }[]
): [string, (id: string) => void] {
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window === 'undefined') return collections[0]?.id || '';

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && collections.some((c) => c.id === stored)) {
      return stored;
    }

    // Fallback: first owned, then first collection
    const owned = collections.find((c) => c.is_owner);
    return owned?.id || collections[0]?.id || '';
  });

  const setSelectedCollectionId = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  return [selectedId, setSelectedCollectionId];
}
