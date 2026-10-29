import type { CrmAccount, CrmActivity, CrmContact, CrmDeal } from '../api/clientTypes';

/**
 * The local database is deliberately limited to CRM entities in this phase.
 * Authentication, users, and permissions remain server-owned data.
 */
export type CrmEntityName = 'accounts' | 'contacts' | 'deals' | 'activities';

export type CrmEntityRecord = {
  accounts: CrmAccount;
  contacts: CrmContact;
  deals: CrmDeal;
  activities: CrmActivity;
};

export type CrmBaseRecord = {
  id: string;
  organizationId: string;
};

/** A server record with the local-only tombstone marker used for deletes. */
export type LocalCrmRecord<T extends CrmBaseRecord> = T & {
  deletedAt?: string | null;
};

export type OutboxKind = 'upsert' | 'delete';
export type OutboxStatus = 'pending' | 'failed';

/**
 * An outbox operation contains enough information for the later sync engine to
 * replay a local mutation without inspecting browser UI state.
 */
export interface OutboxOperation<T extends CrmBaseRecord = CrmBaseRecord & Record<string, unknown>> {
  operationId: string;
  deviceId: string;
  organizationId: string;
  entity: CrmEntityName;
  entityId: string;
  kind: OutboxKind;
  changes: Partial<T> | null;
  schemaVersion: number;
  /** Physical milliseconds plus logical counter used by server-side merge. */
  hlc?: string;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
}

/** Fields supplied by a repository before persistence adds queue metadata. */
export type PendingOutboxInput<T extends CrmBaseRecord = CrmBaseRecord & Record<string, unknown>> = Omit<
  OutboxOperation<T>,
  'createdAt' | 'status' | 'attempts'
>;

export interface LocalListOptions {
  search?: string;
}

export interface OfflineStorageAdapter {
  open(): Promise<void>;
  close(): void;
  list<T extends CrmBaseRecord>(
    entity: CrmEntityName,
    organizationId: string,
    options?: LocalListOptions,
  ): Promise<Array<LocalCrmRecord<T>>>;
  get<T extends CrmBaseRecord>(
    entity: CrmEntityName,
    organizationId: string,
    entityId: string,
  ): Promise<LocalCrmRecord<T> | null>;
  putRemote<T extends CrmBaseRecord>(entity: CrmEntityName, record: LocalCrmRecord<T>): Promise<void>;
  removeRemote(entity: CrmEntityName, organizationId: string, entityId: string): Promise<void>;
  writeLocal<T extends CrmBaseRecord>(
    entity: CrmEntityName,
    record: LocalCrmRecord<T>,
    operation: PendingOutboxInput<T>,
  ): Promise<void>;
  pendingOutbox(organizationId: string): Promise<Array<OutboxOperation>>;
  acknowledgeOutbox(operationId: string): Promise<void>;
  failOutbox(operationId: string, error: string): Promise<void>;
  getSyncCursor?(organizationId: string): Promise<string | null>;
  setSyncCursor?(organizationId: string, cursor: string): Promise<void>;
  clearOrganization(organizationId: string): Promise<void>;
}

