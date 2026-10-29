import { IndexedDbStorageAdapter } from './indexedDbStorageAdapter';
import { MemoryStorageAdapter } from './memoryStorageAdapter';
import type { OfflineStorageAdapter } from './types';

export type StorageBackend = 'indexeddb' | 'memory';

export interface OfflineStorageSelection {
  adapter: OfflineStorageAdapter;
  backend: StorageBackend;
  persistentStorageGranted: boolean;
}

/** Ask the browser to keep the local CRM database during storage pressure. */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
};

/**
 * Selects the persistent browser adapter when available. Memory fallback is
 * intentional for private browsing, older browsers, and deterministic tests.
 */
export const createOfflineStorage = async (): Promise<OfflineStorageSelection> => {
  if (typeof indexedDB !== 'undefined') {
    try {
      const adapter = new IndexedDbStorageAdapter();
      await adapter.open();
      return {
        adapter,
        backend: 'indexeddb',
        persistentStorageGranted: await requestPersistentStorage(),
      };
    } catch {
      // Fall through to the in-memory adapter when browser storage is blocked.
    }
  }

  const adapter = new MemoryStorageAdapter();
  await adapter.open();
  return { adapter, backend: 'memory', persistentStorageGranted: false };
};

