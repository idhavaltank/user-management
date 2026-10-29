import type {
  CrmEntityName,
  LocalCrmRecord,
  LocalListOptions,
  OfflineStorageAdapter,
  OutboxOperation,
  PendingOutboxInput,
} from './types';

export const FLOWSYNC_DATABASE_NAME = 'flowsync-crm-local';
export const FLOWSYNC_DATABASE_VERSION = 2;

const ENTITY_STORES: CrmEntityName[] = ['accounts', 'contacts', 'deals', 'activities'];
const OUTBOX_STORE = 'outbox';
const META_STORE = 'meta';

type StoredValue = Record<string, unknown>;

const isDeleted = (value: StoredValue): boolean => typeof value.deletedAt === 'string' && value.deletedAt.length > 0;

const activeRecord = <T extends { id: string; organizationId: string }>(record: LocalCrmRecord<T>): LocalCrmRecord<T> => {
  const withoutTombstone = { ...record } as LocalCrmRecord<T>;
  delete withoutTombstone.deletedAt;
  return withoutTombstone as LocalCrmRecord<T>;
};

const requestResult = <T,>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
});

/**
 * Persistent browser adapter. Each local mutation writes the entity row and
 * its outbox record in one IndexedDB transaction, which prevents a local
 * change from being visible without a corresponding sync operation.
 */
export class IndexedDbStorageAdapter implements OfflineStorageAdapter {
  private database: IDBDatabase | null = null;

  async open(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this browser');
    }
    if (this.database) return;

    this.database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(FLOWSYNC_DATABASE_NAME, FLOWSYNC_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        ENTITY_STORES.forEach((storeName) => {
          const store = database.objectStoreNames.contains(storeName)
            ? request.transaction?.objectStore(storeName)
            : database.createObjectStore(storeName, { keyPath: 'id' });
          if (store && !store.indexNames.contains('organizationId')) {
            store.createIndex('organizationId', 'organizationId', { unique: false });
          }
        });

        const outbox = database.objectStoreNames.contains(OUTBOX_STORE)
          ? request.transaction?.objectStore(OUTBOX_STORE)
          : database.createObjectStore(OUTBOX_STORE, { keyPath: 'operationId' });
        if (outbox && !outbox.indexNames.contains('organizationId')) {
          outbox.createIndex('organizationId', 'organizationId', { unique: false });
        }
        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'));
    });
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  async list<T extends { id: string; organizationId: string }>(
    entity: CrmEntityName,
    organizationId: string,
    options: LocalListOptions = {},
  ): Promise<Array<LocalCrmRecord<T>>> {
    const values = await this.readAll(entity);
    const search = options.search?.trim().toLowerCase();
    return values
      .filter((value) => value.organizationId === organizationId && !isDeleted(value))
      .filter((value) => !search || JSON.stringify(value).toLowerCase().includes(search))
      .map((value) => value as LocalCrmRecord<T>);
  }

  async get<T extends { id: string; organizationId: string }>(
    entity: CrmEntityName,
    organizationId: string,
    entityId: string,
  ): Promise<LocalCrmRecord<T> | null> {
    const value = await this.request<StoredValue | undefined>([entity], 'readonly', (transaction) => (
      transaction.objectStore(entity).get(entityId)
    ));
    if (!value || value.organizationId !== organizationId || isDeleted(value)) return null;
    return value as LocalCrmRecord<T>;
  }

  async putRemote<T extends { id: string; organizationId: string }>(entity: CrmEntityName, record: LocalCrmRecord<T>): Promise<void> {
    await this.transaction([entity], 'readwrite', (transaction) => {
      transaction.objectStore(entity).put(activeRecord(record));
    });
  }

  async removeRemote(entity: CrmEntityName, organizationId: string, entityId: string): Promise<void> {
    const current = await this.get(entity, organizationId, entityId);
    if (!current) return;
    await this.transaction([entity], 'readwrite', (transaction) => {
      transaction.objectStore(entity).delete(entityId);
    });
  }

  async writeLocal<T extends { id: string; organizationId: string }>(
    entity: CrmEntityName,
    record: LocalCrmRecord<T>,
    operation: PendingOutboxInput<T>,
  ): Promise<void> {
    const storedRecord = operation.kind === 'delete'
      ? { ...record, deletedAt: new Date().toISOString() }
      : activeRecord(record);
    const outbox: OutboxOperation<T> = {
      ...operation,
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };

    await this.transaction([entity, OUTBOX_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(entity).put(storedRecord);
      transaction.objectStore(OUTBOX_STORE).put(outbox);
    });
  }

  async pendingOutbox(organizationId: string): Promise<Array<OutboxOperation>> {
    const values = await this.request<StoredValue[]>([OUTBOX_STORE], 'readonly', (transaction) => (
      transaction.objectStore(OUTBOX_STORE).getAll()
    ));
    return values
      .filter((value) => value.organizationId === organizationId)
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))) as unknown as Array<OutboxOperation>;
  }

  async acknowledgeOutbox(operationId: string): Promise<void> {
    await this.transaction([OUTBOX_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(OUTBOX_STORE).delete(operationId);
    });
  }

  async failOutbox(operationId: string, error: string): Promise<void> {
    const existing = await this.request<OutboxOperation | undefined>([OUTBOX_STORE], 'readonly', (transaction) => (
      transaction.objectStore(OUTBOX_STORE).get(operationId)
    ));
    if (!existing) return;
    await this.transaction([OUTBOX_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(OUTBOX_STORE).put({
        ...existing,
        status: 'failed',
        attempts: existing.attempts + 1,
        lastError: error,
      });
    });
  }

  async getSyncCursor(organizationId: string): Promise<string | null> {
    const value = await this.request<{ value?: string } | undefined>([META_STORE], 'readonly', (transaction) => (
      transaction.objectStore(META_STORE).get(`cursor:${organizationId}`)
    ));
    return value?.value || null;
  }

  async setSyncCursor(organizationId: string, cursor: string): Promise<void> {
    await this.transaction([META_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(META_STORE).put({ key: `cursor:${organizationId}`, value: cursor });
    });
  }

  async clearOrganization(organizationId: string): Promise<void> {
    await Promise.all(ENTITY_STORES.map(async (storeName) => {
      const values = await this.readAll(storeName);
      await this.transaction([storeName], 'readwrite', (transaction) => {
        const store = transaction.objectStore(storeName);
        values
          .filter((value) => value.organizationId === organizationId)
        .forEach((value) => store.delete(String(value.id)));
      });
    }));

    const outbox = await this.request<OutboxOperation[]>([OUTBOX_STORE], 'readonly', (transaction) => (
      transaction.objectStore(OUTBOX_STORE).getAll()
    ));
    await this.transaction([OUTBOX_STORE], 'readwrite', (transaction) => {
      const store = transaction.objectStore(OUTBOX_STORE);
      outbox
        .filter((operation) => operation.organizationId === organizationId)
        .forEach((operation) => store.delete(operation.operationId));
    });
    await this.transaction([META_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(META_STORE).delete(`cursor:${organizationId}`);
    });
  }

  private async readAll(storeName: CrmEntityName): Promise<StoredValue[]> {
    return this.request<StoredValue[]>([storeName], 'readonly', (transaction) => (
      transaction.objectStore(storeName).getAll()
    ));
  }

  private request<T>(
    stores: string[],
    mode: IDBTransactionMode,
    createRequest: (transaction: IDBTransaction) => IDBRequest<T>,
  ): Promise<T> {
    const database = this.requireDatabase();
    const transaction = database.transaction(stores, mode);
    return requestResult(createRequest(transaction));
  }

  private transaction(
    stores: string[],
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => void,
  ): Promise<void> {
    const database = this.requireDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(stores, mode);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      try {
        operation(transaction);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  private requireDatabase(): IDBDatabase {
    if (!this.database) throw new Error('IndexedDB storage adapter is not open');
    return this.database;
  }
}

