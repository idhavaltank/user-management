/* eslint-disable no-await-in-loop, no-constant-condition, no-continue, no-restricted-syntax */
import { ApiError } from '../api/errors';
import { getApiErrorMessage } from '../api/httpClient';
import { createOfflineId, getDeviceId } from './ids';
import {
  DEFAULT_SYNC_BATCH_SIZE,
  serializeSyncOperation,
  type SyncAcknowledgement,
  type SyncApi,
  type SyncRemoteOperation,
  type SyncPullResponse,
} from './syncApi';
import type {
  CrmBaseRecord,
  CrmEntityName,
  LocalCrmRecord,
  OfflineStorageAdapter,
  OutboxOperation,
} from './types';

export type SyncStatus = 'idle' | 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncSnapshot {
  status: SyncStatus;
  pendingCount: number;
  cursor: string | null;
  lastAttemptAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type SyncEvent =
  | { type: 'status'; snapshot: SyncSnapshot }
  | { type: 'operation'; operationId: string; status: 'acked' | 'rejected'; error?: string }
  | { type: 'retry'; attempt: number; delayMs: number; error: string };

export type SyncListener = (snapshot: SyncSnapshot) => void;
export type SyncEventListener = (event: SyncEvent) => void;

export interface SyncRunResult {
  status: 'synced' | 'offline' | 'skipped' | 'error';
  pushed: number;
  pulled: number;
  rejected: number;
  error?: Error;
}

export interface SyncCursorStorage {
  getSyncCursor?(organizationId: string): Promise<string | null>;
  setSyncCursor?(organizationId: string, cursor: string): Promise<void>;
}

export interface SyncBroadcastChannel {
  addEventListener(type: 'message', listener: (event: MessageEvent<SyncBroadcastMessage>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<SyncBroadcastMessage>) => void): void;
  postMessage(message: SyncBroadcastMessage): void;
  close(): void;
}

export interface SyncLockManager {
  request<T>(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown | null) => Promise<T> | T,
  ): Promise<T>;
}

export interface SyncEngineOptions {
  storage: OfflineStorageAdapter;
  api: SyncApi;
  organizationId: string;
  deviceId?: string;
  batchSize?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  isOnline?: () => boolean;
  sleep?: (delayMs: number) => Promise<void>;
  now?: () => Date;
  lockManager?: SyncLockManager | null;
  broadcastChannelFactory?: (name: string) => SyncBroadcastChannel;
}

interface SyncBroadcastMessage {
  type: 'sync-request' | 'sync-completed';
  source: string;
  organizationId: string;
  cursor?: string | null;
}

interface SyncWorkResult {
  pushed: number;
  pulled: number;
  rejected: number;
}

const INITIAL_SNAPSHOT: SyncSnapshot = {
  status: 'idle',
  pendingCount: 0,
  cursor: null,
  lastAttemptAt: null,
  lastSyncedAt: null,
  lastError: null,
};

const isRetryable = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (error instanceof Error && error.name === 'AbortError') return false;
  return true;
};

const errorFromUnknown = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(getApiErrorMessage(error));
};

const isEntityName = (value: string): value is CrmEntityName =>
  value === 'accounts' || value === 'contacts' || value === 'deals' || value === 'activities';

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const isOnlineByDefault = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

const defaultSleep = (delayMs: number): Promise<void> => new Promise((resolve) => {
  window.setTimeout(resolve, delayMs);
});

const defaultBroadcastChannelFactory = (name: string): SyncBroadcastChannel =>
  new BroadcastChannel(name);

const defaultLockManager = (): SyncLockManager | null => {
  if (typeof navigator === 'undefined' || !navigator.locks) return null;
  return navigator.locks as unknown as SyncLockManager;
};

const toSnapshot = (snapshot: SyncSnapshot): SyncSnapshot => ({ ...snapshot });

/**
 * Coordinates outbox replay and server-log pull for one organization.
 *
 * The adapter is intentionally consumed through its existing methods. Future
 * adapters may optionally add getSyncCursor/setSyncCursor; without those
 * methods the cursor remains in this engine instance and a reload safely
 * replays the server cursor from the beginning.
 */
export class SyncEngine {
  private readonly storage: OfflineStorageAdapter;

  private readonly cursorStorage: SyncCursorStorage;

  private readonly api: SyncApi;

  private readonly organizationId: string;

  private readonly deviceId: string;

  /** Unique per tab; deviceId is intentionally shared by tabs on one device. */
  private readonly sourceId: string;

  private readonly batchSize: number;

  private readonly maxRetries: number;

  private readonly retryBaseDelayMs: number;

  private readonly retryMaxDelayMs: number;

  private readonly isOnline: () => boolean;

  private readonly sleep: (delayMs: number) => Promise<void>;

  private readonly now: () => Date;

  private readonly lockManager: SyncLockManager | null;

  private readonly broadcastChannelFactory?: (name: string) => SyncBroadcastChannel;

  private readonly listeners = new Set<SyncListener>();

  private readonly eventListeners = new Set<SyncEventListener>();

  private snapshot: SyncSnapshot = toSnapshot(INITIAL_SNAPSHOT);

  private cursor: string | null = null;

  private inFlight: Promise<SyncRunResult> | null = null;

  private channel: SyncBroadcastChannel | null = null;

  private started = false;

  private disposed = false;

  private readonly lockName: string;

  private readonly onBroadcastMessage = (event: MessageEvent<SyncBroadcastMessage>): void => {
    const message = event.data;
    if (!message || message.source === this.sourceId || message.organizationId !== this.organizationId) return;
    if (message.type === 'sync-request' || message.type === 'sync-completed') {
      this.syncNow('broadcast').catch(() => undefined);
    }
  };

  constructor(options: SyncEngineOptions) {
    this.storage = options.storage;
    this.cursorStorage = options.storage as OfflineStorageAdapter & SyncCursorStorage;
    this.api = options.api;
    this.organizationId = options.organizationId;
    this.deviceId = options.deviceId || getDeviceId();
    this.sourceId = createOfflineId();
    // The live FastAPI contract caps both push and pull batches at 500.
    this.batchSize = Math.min(500, Math.max(1, options.batchSize || DEFAULT_SYNC_BATCH_SIZE));
    this.maxRetries = Math.max(0, options.maxRetries ?? 3);
    this.retryBaseDelayMs = Math.max(0, options.retryBaseDelayMs ?? 250);
    this.retryMaxDelayMs = Math.max(this.retryBaseDelayMs, options.retryMaxDelayMs ?? 5000);
    this.isOnline = options.isOnline || isOnlineByDefault;
    this.sleep = options.sleep || defaultSleep;
    this.now = options.now || (() => new Date());
    this.lockManager = options.lockManager === undefined ? defaultLockManager() : options.lockManager;
    this.broadcastChannelFactory = options.broadcastChannelFactory || (
      typeof BroadcastChannel === 'undefined' ? undefined : defaultBroadcastChannelFactory
    );
    this.lockName = `flowsync-sync:${this.organizationId}`;
  }

  getSnapshot(): SyncSnapshot {
    return toSnapshot(this.snapshot);
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeToEvents(listener: SyncEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async start(): Promise<SyncRunResult> {
    if (this.disposed) throw new Error('Sync engine has been disposed');
    if (this.started) return { status: 'skipped', pushed: 0, pulled: 0, rejected: 0 };
    this.started = true;
    this.channel = this.createChannel();
    this.channel?.addEventListener('message', this.onBroadcastMessage);
    this.cursor = await this.cursorStorage.getSyncCursor?.(this.organizationId) || null;
    this.setSnapshot({ cursor: this.cursor });
    return this.syncNow('startup');
  }

  stop(): void {
    this.started = false;
    this.channel?.removeEventListener('message', this.onBroadcastMessage);
    this.channel?.close();
    this.channel = null;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.listeners.clear();
    this.eventListeners.clear();
  }

  setOnline(online: boolean): void {
    if (!online) {
      this.setSnapshot({ status: 'offline' });
      return;
    }
    if (this.started) this.syncNow('online').catch(() => undefined);
  }

  async syncNow(reason: 'startup' | 'manual' | 'online' | 'interval' | 'broadcast' = 'manual'): Promise<SyncRunResult> {
    if (this.disposed) throw new Error('Sync engine has been disposed');
    if (this.inFlight) return this.inFlight;
    if (!this.isOnline()) {
      await this.refreshPendingCount();
      this.setSnapshot({ status: 'offline' });
      return { status: 'offline', pushed: 0, pulled: 0, rejected: 0 };
    }

    if (reason !== 'broadcast') this.broadcast({ type: 'sync-request' });
    this.inFlight = this.runWithSingleTabLock(reason);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async runWithSingleTabLock(reason: 'startup' | 'manual' | 'online' | 'interval' | 'broadcast'): Promise<SyncRunResult> {
    const run = async (): Promise<SyncRunResult> => {
      try {
        const work = await this.performSync(reason);
        const status: SyncRunResult['status'] = work.rejected > 0 ? 'error' : 'synced';
        return { status, ...work };
      } catch (error) {
        const normalized = errorFromUnknown(error);
        await this.refreshPendingCount();
        this.setSnapshot({ status: 'error', lastError: normalized.message });
        return { status: 'error', pushed: 0, pulled: 0, rejected: 0, error: normalized };
      }
    };

    if (!this.lockManager) return run();

    let result: SyncRunResult | null = null;
    await this.lockManager.request(this.lockName, { ifAvailable: true }, async (lock) => {
      if (!lock) return;
      result = await run();
    });

    if (result) return result;
    await this.refreshPendingCount();
    return { status: 'skipped', pushed: 0, pulled: 0, rejected: 0 };
  }

  private async performSync(reason: 'startup' | 'manual' | 'online' | 'interval' | 'broadcast'): Promise<SyncWorkResult> {
    this.setSnapshot({
      status: 'syncing',
      lastAttemptAt: this.now().toISOString(),
      lastError: null,
    });

    let pushed = 0;
    let rejected = 0;
    let pending = await this.storage.pendingOutbox(this.organizationId);
    await this.setPendingCount(pending.length);

    while (pending.length > 0) {
      const batch = pending.slice(0, this.batchSize);
      let response;
      try {
        response = await this.withRetry(
          () => this.api.push(this.organizationId, { operations: batch.map(serializeSyncOperation) }),
          batch,
        );
      } catch (error) {
        await this.markBatchFailed(batch, errorFromUnknown(error).message);
        throw error;
      }

      const batchResult = await this.applyAcknowledgements(batch, response.acknowledgements);
      pushed += batchResult.pushed;
      rejected += batchResult.rejected;
      if (batchResult.rejected > 0) break;
      pending = await this.storage.pendingOutbox(this.organizationId);
      await this.setPendingCount(pending.length);
    }

    const pullResult = await this.pullUntilCaughtUp();
    const lastError = rejected > 0 ? 'One or more operations were rejected by the server.' : null;
    this.setSnapshot({
      status: rejected > 0 ? 'error' : 'synced',
      lastError,
      lastSyncedAt: this.now().toISOString(),
    });
    if (reason !== 'broadcast') this.broadcast({ type: 'sync-completed', cursor: this.cursor });
    return { pushed, pulled: pullResult, rejected };
  }

  private async applyAcknowledgements(
    batch: OutboxOperation[],
    acknowledgements: SyncAcknowledgement[],
  ): Promise<{ pushed: number; rejected: number }> {
    const byId = new Map(acknowledgements.map((acknowledgement) => [acknowledgement.operationId, acknowledgement]));
    let pushed = 0;
    let rejected = 0;

    for (const operation of batch) {
      const acknowledgement = byId.get(operation.operationId);
      if (!acknowledgement) {
        const error = `The server did not acknowledge operation ${operation.operationId}.`;
        await this.storage.failOutbox(operation.operationId, error);
        this.emit({ type: 'operation', operationId: operation.operationId, status: 'rejected', error });
        rejected += 1;
        continue;
      }

      if (acknowledgement.status === 'acked') {
        await this.storage.acknowledgeOutbox(operation.operationId);
        this.emit({ type: 'operation', operationId: operation.operationId, status: 'acked' });
        pushed += 1;
        continue;
      }

      const error = acknowledgement.error || 'The server rejected this operation.';
      await this.storage.failOutbox(operation.operationId, error);
      this.emit({ type: 'operation', operationId: operation.operationId, status: 'rejected', error });
      rejected += 1;
    }

    return { pushed, rejected };
  }

  private async pullUntilCaughtUp(): Promise<number> {
    let pulled = 0;
    let continuePulling = true;
    let pages = 0;

    while (continuePulling && pages < 100) {
      const response: SyncPullResponse = await this.withRetry(
        () => this.api.pull(this.organizationId, this.cursor, this.batchSize),
        [],
      );
      const previousCursor = this.cursor;
      const pending = await this.storage.pendingOutbox(this.organizationId);
      for (const operation of response.operations) {
        await this.applyRemoteOperation(operation, pending);
        pulled += 1;
      }

      const nextCursor = response.nextCursor ?? response.cursor ?? this.cursorFromOperations(response.operations);
      if (nextCursor) {
        this.cursor = nextCursor;
        await this.cursorStorage.setSyncCursor?.(this.organizationId, nextCursor);
        this.setSnapshot({ cursor: nextCursor });
      }

      const cursorAdvanced = this.cursor !== previousCursor;
      continuePulling = Boolean(response.hasMore && cursorAdvanced && response.operations.length > 0);
      pages += 1;
      if (response.operations.length === 0) continuePulling = false;
    }

    await this.refreshPendingCount();
    return pulled;
  }

  private async applyRemoteOperation(operation: SyncRemoteOperation, pending: OutboxOperation[]): Promise<void> {
    if (operation.organizationId !== this.organizationId || !isEntityName(operation.entity)) return;

    const localOperations = pending.filter((candidate) =>
      candidate.entity === operation.entity && candidate.entityId === operation.entityId
      && candidate.operationId !== operation.operationId,
    );
    const localDelete = localOperations.some((candidate) => candidate.kind === 'delete');
    if (localDelete && operation.kind !== 'delete') return;

    if (operation.kind === 'delete') {
      await this.storage.removeRemote(operation.entity, this.organizationId, operation.entityId);
    } else {
      const current = await this.storage.get<CrmBaseRecord>(
        operation.entity,
        this.organizationId,
        operation.entityId,
      );
      const serverRecord = operation.record || {
        ...(current || {}),
        ...asRecord(operation.changes),
      };
      const rebasedRecord = localOperations
        .filter((candidate) => candidate.kind === 'upsert')
        .reduce<Record<string, unknown>>(
          (record, candidate) => ({ ...record, ...asRecord(candidate.changes) }),
          {
            ...serverRecord,
            id: operation.entityId,
            organizationId: this.organizationId,
          },
        );

      const record = {
        ...rebasedRecord,
        id: String(rebasedRecord.id || operation.entityId),
        organizationId: this.organizationId,
      } as LocalCrmRecord<CrmBaseRecord>;
      await this.storage.putRemote(operation.entity, record);
    }

    if (pending.some((candidate) => candidate.operationId === operation.operationId)) {
      await this.storage.acknowledgeOutbox(operation.operationId);
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, batch: OutboxOperation[]): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        const normalized = errorFromUnknown(error);
        if (!isRetryable(error) || attempt >= this.maxRetries) throw error;
        const delayMs = Math.min(this.retryMaxDelayMs, this.retryBaseDelayMs * (2 ** attempt));
        this.emit({ type: 'retry', attempt: attempt + 1, delayMs, error: normalized.message });
        if (batch.length > 0) await this.markBatchFailed(batch, normalized.message);
        await this.sleep(delayMs);
        attempt += 1;
      }
    }
  }

  private async markBatchFailed(batch: OutboxOperation[], error: string): Promise<void> {
    await Promise.all(batch.map((operation) => this.storage.failOutbox(operation.operationId, error)));
    await this.setPendingCount((await this.storage.pendingOutbox(this.organizationId)).length);
  }

  private async refreshPendingCount(): Promise<void> {
    await this.setPendingCount((await this.storage.pendingOutbox(this.organizationId)).length);
  }

  private async setPendingCount(pendingCount: number): Promise<void> {
    this.setSnapshot({ pendingCount });
  }

  private setSnapshot(changes: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
    this.emit({ type: 'status', snapshot });
  }

  private emit(event: SyncEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  private createChannel(): SyncBroadcastChannel | null {
    if (!this.broadcastChannelFactory) return null;
    try {
      return this.broadcastChannelFactory(this.lockName);
    } catch {
      return null;
    }
  }

  private broadcast(message: Omit<SyncBroadcastMessage, 'source' | 'organizationId'>): void {
    try {
      this.channel?.postMessage({
        ...message,
        source: this.sourceId,
        organizationId: this.organizationId,
      });
    } catch {
      // BroadcastChannel is an optional coordination optimization.
    }
  }

  private cursorFromOperations(operations: SyncRemoteOperation[]): string | null {
    const last = operations[operations.length - 1];
    if (!last || last.sequence === undefined || last.sequence === null) return this.cursor;
    return String(last.sequence);
  }
}

