import { createOfflineId, getDeviceId } from './ids';
import { nextHlc } from './hlc';
import type {
  CrmEntityName,
  LocalCrmRecord,
  OfflineStorageAdapter,
  OutboxOperation,
} from './types';

export interface LocalCrmRepository<T extends { id: string; organizationId: string }> {
  list(organizationId: string, search?: string): Promise<Array<LocalCrmRecord<T>>>;
  get(organizationId: string, entityId: string): Promise<LocalCrmRecord<T> | null>;
  cacheFromServer(record: LocalCrmRecord<T>): Promise<void>;
  removeFromCache(organizationId: string, entityId: string): Promise<void>;
  write(
    record: LocalCrmRecord<T>,
    changes?: Partial<T> | null,
    operationId?: string,
  ): Promise<OutboxOperation<T>>;
  remove(record: LocalCrmRecord<T>, operationId?: string): Promise<OutboxOperation<T>>;
  pending(organizationId: string): Promise<Array<OutboxOperation>>;
}

const SYNC_FIELDS: Record<CrmEntityName, readonly string[]> = {
  accounts: ['name', 'industry', 'website', 'phone', 'address', 'ownerId', 'status', 'notes'],
  contacts: ['accountId', 'firstName', 'lastName', 'email', 'phone', 'jobTitle', 'ownerId', 'status', 'notes'],
  deals: ['accountId', 'contactId', 'ownerId', 'name', 'stage', 'amount', 'currency', 'expectedCloseDate', 'notes'],
  activities: ['accountId', 'contactId', 'dealId', 'ownerId', 'kind', 'status', 'subject', 'description', 'dueAt', 'completedAt'],
};

/** Keep local-only identity/timestamp/tombstone fields out of the wire payload. */
const toSyncChanges = (
  entity: CrmEntityName,
  changes: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (!changes) return null;
  return SYNC_FIELDS[entity].reduce<Record<string, unknown>>((result, field) => {
    if (field in changes) result[field] = changes[field];
    return result;
  }, {});
};

/**
 * Entity-specific repository boundary. UI components can use this interface
 * without knowing whether data is currently backed by IndexedDB or memory.
 */
export const createLocalCrmRepository = <T extends { id: string; organizationId: string }>(
  adapter: OfflineStorageAdapter,
  entity: CrmEntityName,
): LocalCrmRepository<T> => ({
  list: (organizationId, search) => adapter.list<T>(entity, organizationId, { search }),
  get: (organizationId, entityId) => adapter.get<T>(entity, organizationId, entityId),
  cacheFromServer: (record) => adapter.putRemote(entity, record),
  removeFromCache: (organizationId, entityId) => adapter.removeRemote(entity, organizationId, entityId),
  write: async (record, changes = null, operationId = createOfflineId()) => {
    const operation: OutboxOperation<T> = {
      operationId,
      deviceId: getDeviceId(),
      organizationId: String(record.organizationId),
      entity,
      entityId: String(record.id),
      kind: 'upsert',
      changes: toSyncChanges(entity, changes as Record<string, unknown>) as Partial<T> | null,
      schemaVersion: 1,
      hlc: nextHlc(),
      createdAt: '',
      status: 'pending',
      attempts: 0,
    };
    await adapter.writeLocal(entity, record, operation);
    return (await adapter.pendingOutbox(operation.organizationId)).find(
      (queued) => queued.operationId === operation.operationId,
    ) as OutboxOperation<T>;
  },
  remove: async (record, operationId = createOfflineId()) => {
    const operation: OutboxOperation<T> = {
      operationId,
      deviceId: getDeviceId(),
      organizationId: String(record.organizationId),
      entity,
      entityId: String(record.id),
      kind: 'delete',
      changes: null,
      schemaVersion: 1,
      hlc: nextHlc(),
      createdAt: '',
      status: 'pending',
      attempts: 0,
    };
    await adapter.writeLocal(entity, record, operation);
    return (await adapter.pendingOutbox(operation.organizationId)).find(
      (queued) => queued.operationId === operation.operationId,
    ) as OutboxOperation<T>;
  },
  pending: (organizationId) => adapter.pendingOutbox(organizationId),
});

