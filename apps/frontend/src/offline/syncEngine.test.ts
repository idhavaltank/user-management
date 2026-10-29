import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '../api/errors';
import type { CrmAccount } from '../api/clientTypes';
import { MemoryStorageAdapter } from './memoryStorageAdapter';
import { createSyncApi, type SyncApi } from './syncApi';
import { SyncEngine, type SyncLockManager } from './syncEngine';

const account = (overrides: Partial<CrmAccount> = {}): CrmAccount => ({
  id: 'account-1',
  organizationId: 'organization-1',
  name: 'Acme',
  status: 'prospect',
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
  ...overrides,
});

const operation = {
  operationId: 'operation-1',
  deviceId: 'device-1',
  organizationId: 'organization-1',
  entity: 'accounts' as const,
  entityId: 'account-1',
  kind: 'upsert' as const,
  changes: { name: 'Local Acme' },
  schemaVersion: 1,
};

const createStorage = async (): Promise<MemoryStorageAdapter> => {
  const storage = new MemoryStorageAdapter();
  await storage.open();
  return storage;
};

const emptyPull = { operations: [], hasMore: false };

describe('SyncEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('pushes outbox batches, applies pull operations, and emits status events', async () => {
    const storage = await createStorage();
    await storage.writeLocal('accounts', account(), operation);
    await storage.writeLocal('accounts', account({ id: 'account-3', name: 'Second local account' }), {
      ...operation,
      operationId: 'operation-3',
      entityId: 'account-3',
      changes: { name: 'Second local account' },
      hlc: '200.3',
    });
    const push = vi.fn<SyncApi['push']>().mockImplementation(async (_organizationId, payload) => ({
      acknowledgements: payload.operations.map((queued) => ({
        operationId: queued.opId,
        status: 'acked' as const,
      })),
    }));
    const pull = vi.fn<SyncApi['pull']>().mockResolvedValue({
      operations: [{
        operationId: 'remote-1',
        deviceId: 'device-2',
        organizationId: 'organization-1',
        entity: 'accounts',
        entityId: 'account-2',
        kind: 'upsert',
        changes: { name: 'Remote account' },
        record: account({ id: 'account-2', name: 'Remote account' }),
        schemaVersion: 1,
        createdAt: '2026-10-23T00:01:00.000Z',
        sequence: 2,
      }],
      nextCursor: '2',
      hasMore: false,
    });
    const events: string[] = [];
    const engine = new SyncEngine({
      storage,
      api: { push, pull },
      organizationId: 'organization-1',
      deviceId: 'device-1',
      batchSize: 1,
      isOnline: () => true,
      lockManager: null,
    });
    engine.subscribe((snapshot) => events.push(snapshot.status));

    const result = await engine.start();

    expect(result).toMatchObject({ status: 'synced', pushed: 2, pulled: 1, rejected: 0 });
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith('organization-1', expect.objectContaining({ operations: [
      expect.objectContaining({ opId: 'operation-1', changes: { name: 'Local Acme' } }),
    ]}));
    expect(push.mock.calls[0][1].operations[0].hlc).toMatch(/^\d+\.\d+$/);
    expect(push.mock.calls[1][1].operations[0].hlc).toBe('200.3');
    expect(pull).toHaveBeenCalledWith('organization-1', null, 1);
    await expect(storage.pendingOutbox('organization-1')).resolves.toEqual([]);
    await expect(storage.get<CrmAccount>('accounts', 'organization-1', 'account-2')).resolves.toMatchObject({
      name: 'Remote account',
    });
    expect(events).toContain('syncing');
    expect(events.at(-1)).toBe('synced');
    engine.dispose();
  });

  test('retries transient failures with exponential backoff and then acknowledges', async () => {
    const storage = await createStorage();
    await storage.writeLocal('accounts', account(), operation);
    const push = vi.fn<SyncApi['push']>()
      .mockRejectedValueOnce(new ApiError('temporary', 503))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce({ acknowledgements: [{ operationId: 'operation-1', status: 'acked' }] });
    const sleep = vi.fn<(delayMs: number) => Promise<void>>().mockResolvedValue(undefined);
    const retries: number[] = [];
    const engine = new SyncEngine({
      storage,
      api: { push, pull: vi.fn<SyncApi['pull']>().mockResolvedValue(emptyPull) },
      organizationId: 'organization-1',
      isOnline: () => true,
      lockManager: null,
      retryBaseDelayMs: 10,
      retryMaxDelayMs: 100,
      sleep,
    });
    engine.subscribeToEvents((event) => {
      if (event.type === 'retry') retries.push(event.delayMs);
    });

    const result = await engine.start();

    expect(result.status).toBe('synced');
    expect(push).toHaveBeenCalledTimes(3);
    expect(retries).toEqual([10, 20]);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
    await expect(storage.pendingOutbox('organization-1')).resolves.toEqual([]);
    engine.dispose();
  });

  test('keeps a non-retryable rejected batch failed for inspection', async () => {
    const storage = await createStorage();
    await storage.writeLocal('accounts', account(), operation);
    const push = vi.fn<SyncApi['push']>().mockRejectedValue(new ApiError('invalid operation', 400));
    const engine = new SyncEngine({
      storage,
      api: { push, pull: vi.fn<SyncApi['pull']>().mockResolvedValue(emptyPull) },
      organizationId: 'organization-1',
      isOnline: () => true,
      lockManager: null,
      sleep: vi.fn<(delayMs: number) => Promise<void>>().mockResolvedValue(undefined),
    });

    const result = await engine.start();

    expect(result.status).toBe('error');
    expect(push).toHaveBeenCalledTimes(1);
    await expect(storage.pendingOutbox('organization-1')).resolves.toMatchObject([
      { operationId: 'operation-1', status: 'failed', attempts: 1, lastError: 'invalid operation' },
    ]);
    expect(engine.getSnapshot()).toMatchObject({ status: 'error', pendingCount: 1, lastError: 'invalid operation' });
    engine.dispose();
  });

  test('surfaces an acknowledged server rejection without looping the failed operation', async () => {
    const storage = await createStorage();
    await storage.writeLocal('accounts', account(), operation);
    const push = vi.fn<SyncApi['push']>().mockResolvedValue({
      acknowledgements: [{ operationId: 'operation-1', status: 'rejected', error: 'conflict' }],
    });
    const operationEvents: string[] = [];
    const engine = new SyncEngine({
      storage,
      api: { push, pull: vi.fn<SyncApi['pull']>().mockResolvedValue(emptyPull) },
      organizationId: 'organization-1',
      isOnline: () => true,
      lockManager: null,
    });
    engine.subscribeToEvents((event) => {
      if (event.type === 'operation') operationEvents.push(`${event.status}:${event.error || ''}`);
    });

    const result = await engine.start();

    expect(result).toMatchObject({ status: 'error', pushed: 0, pulled: 0, rejected: 1 });
    expect(push).toHaveBeenCalledTimes(1);
    expect(operationEvents).toEqual(['rejected:conflict']);
    await expect(storage.pendingOutbox('organization-1')).resolves.toMatchObject([
      { operationId: 'operation-1', status: 'failed', attempts: 1, lastError: 'conflict' },
    ]);
    engine.dispose();
  });

  test('does not run while offline and resumes when connectivity returns', async () => {
    const storage = await createStorage();
    let online = false;
    const api: SyncApi = {
      push: vi.fn<SyncApi['push']>().mockResolvedValue({ acknowledgements: [] }),
      pull: vi.fn<SyncApi['pull']>().mockResolvedValue(emptyPull),
    };
    const engine = new SyncEngine({
      storage,
      api,
      organizationId: 'organization-1',
      isOnline: () => online,
      lockManager: null,
    });

    await expect(engine.start()).resolves.toMatchObject({ status: 'offline' });
    expect(api.pull).not.toHaveBeenCalled();
    online = true;
    engine.setOnline(true);
    await vi.waitFor(() => expect(api.pull).toHaveBeenCalledTimes(1));
    expect(engine.getSnapshot().status).toBe('synced');
    engine.dispose();
  });

  test('skips when another tab owns the Web Lock', async () => {
    const storage = await createStorage();
    const lockManager: SyncLockManager = {
      request: vi.fn(async (_name, _options, callback) => callback(null)),
    };
    const pull = vi.fn<SyncApi['pull']>().mockResolvedValue(emptyPull);
    const engine = new SyncEngine({
      storage,
      api: { push: vi.fn<SyncApi['push']>(), pull },
      organizationId: 'organization-1',
      isOnline: () => true,
      lockManager,
    });

    await expect(engine.start()).resolves.toMatchObject({ status: 'skipped' });
    expect(pull).not.toHaveBeenCalled();
    expect(engine.getSnapshot().pendingCount).toBe(0);
    engine.dispose();
  });
});

describe('createSyncApi', () => {
  test('serializes push and pull routes through the shared HTTP port', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        acknowledgements: [{ opId: 'operation-1', status: 'accepted', sequence: 1 }],
        nextCursor: 1,
      })
      .mockResolvedValueOnce({
        changes: [{
          sequence: 1,
          opId: 'remote-1',
          deviceId: 'device-2',
          entity: 'accounts',
          entityId: 'account-2',
          kind: 'upsert',
          changes: { name: 'Remote' },
          hlc: '100.0',
          schemaVersion: 1,
          occurredAt: '2026-10-23T00:01:00.000Z',
        }],
        nextCursor: 1,
        hasMore: false,
      });
    const client = {
      request,
      setCsrfToken: vi.fn(),
      clearCsrfToken: vi.fn(),
    };
    const api = createSyncApi(client);

    await expect(api.push('organization/1', { operations: [] })).resolves.toMatchObject({
      acknowledgements: [{ operationId: 'operation-1', status: 'acked', sequence: 1 }],
      nextCursor: '1',
    });
    await expect(api.pull('organization/1', 'cursor-1', 25)).resolves.toMatchObject({
      operations: [{ operationId: 'remote-1', organizationId: 'organization/1', hlc: '100.0' }],
      nextCursor: '1',
    });

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/v1/organizations/organization%2F1/sync/push',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ operations: [] }) }),
      undefined,
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/api/v1/organizations/organization%2F1/sync/pull?cursor=0&limit=25',
      {},
      undefined,
    );
  });
});

