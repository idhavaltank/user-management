import { beforeEach, describe, expect, test } from 'vitest';
import type { CrmAccount } from '../api/clientTypes';
import { createLocalCrmRepository } from './crmRepository';
import { MemoryStorageAdapter } from './memoryStorageAdapter';

const account: CrmAccount = {
  id: 'repository-account-1',
  organizationId: 'repository-organization-1',
  name: 'Repository account',
  status: 'prospect',
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
};

describe('createLocalCrmRepository', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    window.localStorage.clear();
    storage = new MemoryStorageAdapter();
    await storage.open();
  });

  test('keeps UI-facing CRUD independent from the storage backend', async () => {
    const repository = createLocalCrmRepository<CrmAccount>(storage, 'accounts');

    const operation = await repository.write(account, { name: 'Repository account' });
    await expect(repository.get(account.organizationId, account.id)).resolves.toEqual(account);
    await expect(repository.pending(account.organizationId)).resolves.toMatchObject([
      { operationId: operation.operationId, entity: 'accounts', kind: 'upsert' },
    ]);

    const deleteOperation = await repository.remove(account);
    await expect(repository.list(account.organizationId)).resolves.toEqual([]);
    await expect(repository.pending(account.organizationId)).resolves.toHaveLength(2);
    expect(deleteOperation.kind).toBe('delete');
  });
});

