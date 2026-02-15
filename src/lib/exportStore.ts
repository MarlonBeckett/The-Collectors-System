/**
 * Persist export data in IndexedDB so downloads survive page refreshes.
 *
 * On mobile browsers, the page can refresh unexpectedly after a long export
 * (memory pressure, auth token refresh, etc.), losing the in-memory blob.
 *
 * IMPORTANT: We store the data as an ArrayBuffer (not a Blob) because Safari
 * has a long-standing bug where Blobs stored in IndexedDB silently become
 * unreadable after a page reload. ArrayBuffers survive reliably on all browsers.
 */

const DB_NAME = 'tcs-export';
const STORE_NAME = 'pending';
const KEY = 'latest';

/** What actually gets stored in IndexedDB (ArrayBuffer, not Blob). */
interface StoredExport {
  buffer: ArrayBuffer;
  mimeType: string;
  filename: string;
  totalFiles: number;
  skippedFiles: number;
  skippedDetails: string[];
  savedAt: number;
}

/** What the consumer gets back (a real Blob). */
export interface PendingExport {
  blob: Blob;
  filename: string;
  totalFiles: number;
  skippedFiles: number;
  skippedDetails: string[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Version 2: switched from Blob to ArrayBuffer storage
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Drop old store if upgrading from v1
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME);
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
    const buffer = await blob.arrayBuffer();
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: StoredExport = {
      buffer,
      mimeType: blob.type || 'application/zip',
      filename,
      totalFiles,
      skippedFiles,
      skippedDetails,
      savedAt: Date.now(),
    };
    store.put(entry, KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB not available or quota exceeded – silently ignore
  }
}

export async function loadPendingExport(): Promise<PendingExport | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY);
    const stored = await new Promise<StoredExport | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as StoredExport | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!stored || !stored.buffer) return null;

    // Discard entries older than 10 minutes
    if (Date.now() - stored.savedAt > 10 * 60 * 1000) {
      await clearPendingExport();
      return null;
    }

    // Reconstruct Blob from the stored ArrayBuffer
    const blob = new Blob([stored.buffer], { type: stored.mimeType });
    return {
      blob,
      filename: stored.filename,
      totalFiles: stored.totalFiles,
      skippedFiles: stored.skippedFiles,
      skippedDetails: stored.skippedDetails,
    };
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

/** Check if there's a pending export without loading the full data. */
export async function hasPendingExport(): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY);
    const stored = await new Promise<StoredExport | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as StoredExport | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!stored || !stored.buffer) return false;
    return Date.now() - stored.savedAt <= 10 * 60 * 1000;
  } catch {
    return false;
  }
}
