import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createSyncApi, type SyncApi } from './syncApi';
import { SyncEngine, type SyncRunResult, type SyncSnapshot } from './syncEngine';
import { useConnectivity } from './connectivity';
import { getActiveOrganizationId } from './organization';
import { useOfflineStorage } from './OfflineStorageProvider';

export interface SyncContextValue {
  ready: boolean;
  snapshot: SyncSnapshot;
  syncNow: () => Promise<SyncRunResult>;
  engine: SyncEngine | null;
}

export interface SyncProviderProps extends PropsWithChildren {
  organizationId?: string | null;
  api?: SyncApi;
  enabled?: boolean;
  intervalMs?: number;
}

const EMPTY_SNAPSHOT: SyncSnapshot = {
  status: 'idle',
  pendingCount: 0,
  cursor: null,
  lastAttemptAt: null,
  lastSyncedAt: null,
  lastError: null,
};

const SyncContext = createContext<SyncContextValue>({
  ready: false,
  snapshot: EMPTY_SNAPSHOT,
  syncNow: async () => ({ status: 'skipped', pushed: 0, pulled: 0, rejected: 0 }),
  engine: null,
});

/**
 * Optional provider boundary for the app shell. It owns one engine per active
 * organization and retries automatically on reconnect or at a bounded interval.
 * The current App tree can adopt it without changing the storage provider.
 */
export const SyncProvider = ({
  children,
  organizationId = getActiveOrganizationId(),
  api,
  enabled = true,
  intervalMs = 30_000,
}: SyncProviderProps): JSX.Element => {
  const { adapter, ready: storageReady } = useOfflineStorage();
  const { online } = useConnectivity();
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(EMPTY_SNAPSHOT);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(organizationId);
  const syncApi = useMemo(() => api || createSyncApi(), [api]);

  useEffect(() => {
    const handleOrganizationChanged = (event: Event): void => {
      const { detail } = event as CustomEvent<string>;
      setActiveOrganizationId(detail || getActiveOrganizationId());
    };
    window.addEventListener('flowsync:organization-changed', handleOrganizationChanged);
    return () => window.removeEventListener('flowsync:organization-changed', handleOrganizationChanged);
  }, []);

  useEffect(() => {
    if (!enabled || !storageReady || !adapter || !activeOrganizationId) {
      setEngine(null);
      setSnapshot(EMPTY_SNAPSHOT);
      return undefined;
    }

    const nextEngine = new SyncEngine({
      storage: adapter,
      api: syncApi,
      organizationId: activeOrganizationId,
    });
    const unsubscribe = nextEngine.subscribe(setSnapshot);
    setEngine(nextEngine);
    nextEngine.start().catch(() => undefined);

    return () => {
      unsubscribe();
      nextEngine.dispose();
      setEngine((current) => (current === nextEngine ? null : current));
    };
  }, [activeOrganizationId, adapter, enabled, storageReady, syncApi]);

  useEffect(() => {
    if (engine) engine.setOnline(online);
    else setSnapshot({ ...EMPTY_SNAPSHOT, status: online ? 'idle' : 'offline' });
  }, [engine, online]);

  useEffect(() => {
    if (!engine || intervalMs <= 0) return undefined;
    const interval = window.setInterval(() => {
      engine.syncNow('interval').catch(() => undefined);
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [engine, intervalMs]);

  const syncNow = useCallback(async (): Promise<SyncRunResult> => {
    if (!engine) return { status: 'skipped', pushed: 0, pulled: 0, rejected: 0 };
    return engine.syncNow('manual');
  }, [engine]);

  const value = useMemo<SyncContextValue>(() => ({
    ready: Boolean(engine),
    snapshot,
    syncNow,
    engine,
  }), [engine, snapshot, syncNow]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = (): SyncContextValue => useContext(SyncContext);

