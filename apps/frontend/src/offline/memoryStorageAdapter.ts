import type {
  CrmEntityName,
  LocalCrmRecord,
  LocalListOptions,
  OfflineStorageAdapter,
  OutboxOperation,
  PendingOutboxInput,
} from './types';

type StoredValue = Record<string, unknown>;

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const recordKey = (organizationId: string, entityId: string): string => `${organizationId}:${entityId}`;

const isDeleted = (value: StoredValue): boolean => typeof value.deletedAt === 'string' && value.deletedAt.length > 0;

const activeRecord = <T extends { id: string; organizationId: string }>(record: LocalCrmRecord<T>): LocalCrmRecord<T> => {
  const withoutTombstone = { ...record } as LocalCrmRecord<T>;
  delete withoutTombstone.deletedAt;
  return withoutTombstone as LocalCrmRecord<T>;
};

/**
 * Deterministic adapter used by unit tests and as a safe fallback when the
 * browser does not provide IndexedDB. It follows the same contract as the
 * persistent adapter, so repositories do not know which backend they use.
 */
export class MemoryStorageAdapter implements OfflineStorageAdapter {
  private readonly records = new Map<CrmEntityName, Map<string, StoredValue>>();

  private readonly outbox = new Map<string, OutboxOperation>();

  private readonly cursors = new Map<string, string>();

  private opened = false;

  async open(): Promise<void> {
    this.opened = true;
  }

  close(): void {
    this.opened = false;
  }

  async list<T extends { id: string; organizationId: string }>(
    entity: CrmEntityName,
    organizationId: string,
    options: LocalListOptions = {},
  ): Promise<Array<LocalCrmRecord<T>>> {
    this.assertOpen();
    const search = options.search?.trim().toLowerCase();
    const values = [...(this.records.get(entity)?.values() ?? [])];

    return values
      .filter((value) => value.organizationId === organizationId && !isDeleted(value))
      .filter((value) => !search || JSON.stringify(value).toLowerCase().includes(search))
      .map((value) => cloneValue(value) as LocalCrmRecord<T>);
  }

  async get<T extends { id: string; organizationId: string }>(
    entity: CrmEntityName,
    organizationId: string,
    entityId: string,
  ): Promise<LocalCrmRecord<T> | null> {
    this.assertOpen();
    const value = this.records.get(entity)?.get(recordKey(organizationId, entityId));
    if (!value || isDeleted(value)) return null;
    return cloneValue(value) as LocalCrmRecord<T>;
  }

  async putRemote<T extends { id: string; organizationId: string }>(entity: CrmEntityName, record: LocalCrmRecord<T>): Promise<void> {
    this.assertOpen();
    const entityRecords = this.getEntityRecords(entity);
    entityRecords.set(recordKey(String(record.organizationId), String(record.id)), cloneValue(activeRecord(record)) as StoredValue);
  }

  async removeRemote(entity: CrmEntityName, organizationId: string, entityId: string): Promise<void> {
    this.assertOpen();
    this.getEntityRecords(entity).delete(recordKey(organizationId, entityId));
  }

  async writeLocal<T extends { id: string; organizationId: string }>(
    entity: CrmEntityName,
    record: LocalCrmRecord<T>,
    operation: PendingOutboxInput<T>,
  ): Promise<void> {
    this.assertOpen();
    const entityRecords = this.getEntityRecords(entity);
    const storedRecord = operation.kind === 'delete'
      ? { ...record, deletedAt: new Date().toISOString() }
      : activeRecord(record);

    // The in-memory implementation performs both writes in one synchronous turn,
    // mirroring the IndexedDB transaction used in the browser.
    entityRecords.set(recordKey(operation.organizationId, operation.entityId), cloneValue(storedRecord) as StoredValue);
    this.outbox.set(operation.operationId, {
      ...cloneValue(operation),
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    });
  }

  async pendingOutbox(organizationId: string): Promise<Array<OutboxOperation>> {
    this.assertOpen();
    return [...this.outbox.values()]
      .filter((operation) => operation.organizationId === organizationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((operation) => cloneValue(operation));
  }

  async acknowledgeOutbox(operationId: string): Promise<void> {
    this.assertOpen();
    this.outbox.delete(operationId);
  }

  async failOutbox(operationId: string, error: string): Promise<void> {
    this.assertOpen();
    const operation = this.outbox.get(operationId);
    if (!operation) return;
    this.outbox.set(operationId, {
      ...operation,
      status: 'failed',
      attempts: operation.attempts + 1,
      lastError: error,
    });
  }

  async getSyncCursor(organizationId: string): Promise<string | null> {
    return this.cursors.get(organizationId) || null;
  }

  async setSyncCursor(organizationId: string, cursor: string): Promise<void> {
    this.cursors.set(organizationId, cursor);
  }

  async clearOrganization(organizationId: string): Promise<void> {
    this.assertOpen();
    this.records.forEach((entityRecords) => {
      [...entityRecords.entries()]
        .filter(([, value]) => value.organizationId === organizationId)
        .forEach(([key]) => entityRecords.delete(key));
    });
    [...this.outbox.values()]
      .filter((operation) => operation.organizationId === organizationId)
      .forEach((operation) => this.outbox.delete(operation.operationId));
    this.cursors.delete(organizationId);
  }

  private getEntityRecords(entity: CrmEntityName): Map<string, StoredValue> {
    const existing = this.records.get(entity);
    if (existing) return existing;
    const created = new Map<string, StoredValue>();
    this.records.set(entity, created);
    return created;
  }

  private assertOpen(): void {
    if (!this.opened) throw new Error('Offline storage adapter is not open');
  }
}

