import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createOfflineStorage, type StorageBackend } from './storageFactory';
import type { OfflineStorageAdapter } from './types';

export interface OfflineStorageContextValue {
  adapter: OfflineStorageAdapter | null;
  backend: StorageBackend | null;
  persistentStorageGranted: boolean;
  ready: boolean;
}

const OfflineStorageContext = createContext<OfflineStorageContextValue>({
  adapter: null,
  backend: null,
  persistentStorageGranted: false,
  ready: false,
});

/** Opens one storage adapter for the application lifetime. */
export const OfflineStorageProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [selection, setSelection] = useState<OfflineStorageContextValue>({
    adapter: null,
    backend: null,
    persistentStorageGranted: false,
    ready: false,
  });

  useEffect(() => {
    let disposed = false;
    let activeAdapter: OfflineStorageAdapter | null = null;

    createOfflineStorage().then((result) => {
      activeAdapter = result.adapter;
      if (disposed) {
        result.adapter.close();
        return;
      }
      setSelection({ ...result, ready: true });
    });

    return () => {
      disposed = true;
      activeAdapter?.close();
    };
  }, []);

  const value = useMemo(() => selection, [selection]);
  return <OfflineStorageContext.Provider value={value}>{children}</OfflineStorageContext.Provider>;
};

export const useOfflineStorage = (): OfflineStorageContextValue => useContext(OfflineStorageContext);

