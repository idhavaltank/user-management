import { beforeEach, describe, expect, test } from 'vitest';
import type { CrmAccount } from '../api/clientTypes';
import { MemoryStorageAdapter } from './memoryStorageAdapter';
import type { OutboxOperation } from './types';

const account = (overrides: Partial<CrmAccount> = {}): CrmAccount => ({
  id: 'account-1',
  organizationId: 'organization-1',
  name: 'Acme',
  status: 'prospect',
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
  ...overrides,
});

describe('MemoryStorageAdapter', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    await storage.open();
  });

  test('writes a CRM record and its outbox operation atomically', async () => {
    await storage.writeLocal('accounts', account(), {
      operationId: 'operation-1',
      deviceId: 'device-1',
      organizationId: 'organization-1',
      entity: 'accounts',
      entityId: 'account-1',
      kind: 'upsert',
      changes: { name: 'Acme' },
      schemaVersion: 1,
    });

    await expect(storage.list<CrmAccount>('accounts', 'organization-1')).resolves.toEqual([account()]);
    await expect(storage.pendingOutbox('organization-1')).resolves.toMatchObject([
      { operationId: 'operation-1', entityId: 'account-1', kind: 'upsert', status: 'pending' },
    ]);
  });

  test('keeps tombstones out of active lists while retaining delete operations', async () => {
    await storage.writeLocal('accounts', account(), {
      operationId: 'operation-2',
      deviceId: 'device-1',
      organizationId: 'organization-1',
      entity: 'accounts',
      entityId: 'account-1',
      kind: 'delete',
      changes: null,
      schemaVersion: 1,
    });

    await expect(storage.list<CrmAccount>('accounts', 'organization-1')).resolves.toEqual([]);
    await expect(storage.pendingOutbox('organization-1')).resolves.toMatchObject([
      { kind: 'delete', entityId: 'account-1' },
    ]);
  });

  test('marks an operation acknowledged without touching the cached record', async () => {
    await storage.writeLocal('accounts', account(), {
      operationId: 'operation-3',
      deviceId: 'device-1',
      organizationId: 'organization-1',
      entity: 'accounts',
      entityId: 'account-1',
      kind: 'upsert',
      changes: { name: 'Acme' },
      schemaVersion: 1,
    });

    await storage.acknowledgeOutbox('operation-3');

    await expect(storage.pendingOutbox('organization-1')).resolves.toEqual([]);
    await expect(storage.get<CrmAccount>('accounts', 'organization-1', 'account-1')).resolves.toEqual(account());
  });

  test('does not leak records or operations between organizations', async () => {
    const operation: Omit<OutboxOperation, 'createdAt' | 'status' | 'attempts'> = {
      operationId: 'operation-4',
      deviceId: 'device-1',
      organizationId: 'organization-2',
      entity: 'accounts',
      entityId: 'account-2',
      kind: 'upsert',
      changes: { name: 'Other' },
      schemaVersion: 1,
    };
    await storage.writeLocal('accounts', account({ id: 'account-2', organizationId: 'organization-2' }), operation);

    await expect(storage.list<CrmAccount>('accounts', 'organization-1')).resolves.toEqual([]);
    await expect(storage.pendingOutbox('organization-1')).resolves.toEqual([]);
  });

  test('records a failed operation for a later retry', async () => {
    await storage.writeLocal('accounts', account(), {
      operationId: 'operation-5',
      deviceId: 'device-1',
      organizationId: 'organization-1',
      entity: 'accounts',
      entityId: 'account-1',
      kind: 'upsert',
      changes: { name: 'Acme updated' },
      schemaVersion: 1,
    });

    await storage.failOutbox('operation-5', 'temporary network failure');

    await expect(storage.pendingOutbox('organization-1')).resolves.toMatchObject([
      { operationId: 'operation-5', status: 'failed', attempts: 1, lastError: 'temporary network failure' },
    ]);
  });
});
