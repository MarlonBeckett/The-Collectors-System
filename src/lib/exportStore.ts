/**
 * Persist export blobs in IndexedDB so downloads survive page refreshes.
 *
 * On mobile browsers, the page can refresh unexpectedly after a long export
 * (memory pressure, auth token refresh, etc.), losing the in-memory blob.
 * This store keeps the blob available across page loads.
 */

const DB_NAME = 'tcs-export';
const STORE_NAME = 'pending';
const KEY = 'latest';

interface PendingExport {
  blob: Blob;
  filename: string;
  totalFiles: number;
  skippedFiles: number;
  skippedDetails: string[];
  savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingExport(
  blob: Blob,
  filename: string,
  totalFiles: number,
  skippedFiles: number,
  skippedDetails: string[],
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: PendingExport = { blob, filename, totalFiles, skippedFiles, skippedDetails, savedAt: Date.now() };
    store.put(entry, KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB not available – silently ignore
  }
}

export async function loadPendingExport(): Promise<PendingExport | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY);
    const result = await new Promise<PendingExport | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as PendingExport | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!result) return null;
    // Discard entries older than 10 minutes
    if (Date.now() - result.savedAt > 10 * 60 * 1000) {
      await clearPendingExport();
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

export async function clearPendingExport(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
