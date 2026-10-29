import { httpClient, type HttpClient } from '../api/httpClient';
import { nextHlc } from './hlc';
import type { CrmEntityName, OutboxOperation } from './types';

/** Default batch size keeps browser requests bounded while allowing catch-up. */
export const DEFAULT_SYNC_BATCH_SIZE = 50;

export type SyncAcknowledgementStatus = 'acked' | 'rejected';

export interface SyncOperationInput {
  opId: string;
  deviceId: string;
  entity: CrmEntityName;
  entityId: string;
  kind: 'upsert' | 'delete';
  changes: Record<string, unknown> | null;
  schemaVersion: number;
  hlc: string;
}

export interface SyncPushRequest {
  operations: SyncOperationInput[];
}

export interface SyncAcknowledgement {
  operationId: string;
  status: SyncAcknowledgementStatus;
  sequence?: number | string | null;
  cursor?: string | null;
  error?: string;
  record?: Record<string, unknown> | null;
}

export interface SyncPushResponse {
  acknowledgements: SyncAcknowledgement[];
  nextCursor?: string | null;
}

/** An operation emitted by the server operation log during pull. */
export interface SyncRemoteOperation {
  operationId: string;
  deviceId: string;
  organizationId: string;
  entity: CrmEntityName;
  entityId: string;
  kind: 'upsert' | 'delete';
  changes: Record<string, unknown> | null;
  schemaVersion: number;
  hlc?: string;
  createdAt: string;
  sequence?: number | string | null;
  record?: Record<string, unknown> | null;
}

export interface SyncPullResponse {
  operations: SyncRemoteOperation[];
  nextCursor?: string | null;
  cursor?: string | null;
  hasMore?: boolean;
}

export interface SyncApi {
  push(
    organizationId: string,
    payload: SyncPushRequest,
    signal?: AbortSignal,
  ): Promise<SyncPushResponse>;
  pull(
    organizationId: string,
    cursor: string | null,
    limit: number,
    signal?: AbortSignal,
  ): Promise<SyncPullResponse>;
}

const segment = (value: string): string => encodeURIComponent(value);

const syncPath = (organizationId: string, resource: 'push' | 'pull'): string =>
  `/api/v1/organizations/${segment(organizationId)}/sync/${resource}`;

const toSyncOperation = (operation: OutboxOperation): SyncOperationInput => ({
  opId: operation.operationId,
  deviceId: operation.deviceId,
  entity: operation.entity,
  entityId: operation.entityId,
  kind: operation.kind,
  changes: operation.changes ? { ...operation.changes } : null,
  schemaVersion: operation.schemaVersion,
  // Older outbox rows may predate HLC support; upgrade them at the wire edge.
  hlc: operation.hlc || nextHlc(),
});

interface BackendAcknowledgement {
  opId: string;
  status: 'accepted' | 'rejected';
  sequence?: number | null;
  error?: string | null;
}

interface BackendPushResponse {
  acknowledgements?: BackendAcknowledgement[];
  nextCursor?: number | null;
}

interface BackendChange {
  sequence: number;
  opId: string;
  deviceId: string;
  entity: CrmEntityName;
  entityId: string;
  kind: 'upsert' | 'delete';
  changes?: Record<string, unknown> | null;
  hlc: string;
  schemaVersion: number;
  occurredAt: string;
}

interface BackendPullResponse {
  changes?: BackendChange[];
  nextCursor?: number | null;
  hasMore?: boolean;
}

const normalizePushResponse = (response: BackendPushResponse): SyncPushResponse => ({
  acknowledgements: (response.acknowledgements || []).map((acknowledgement) => ({
    operationId: acknowledgement.opId,
    status: acknowledgement.status === 'accepted' ? 'acked' : 'rejected',
    sequence: acknowledgement.sequence,
    error: acknowledgement.error || undefined,
  })),
  nextCursor: response.nextCursor === undefined || response.nextCursor === null
    ? null
    : String(response.nextCursor),
});

const normalizePullResponse = (response: BackendPullResponse, organizationId: string): SyncPullResponse => ({
  operations: (response.changes || []).map((change) => ({
    operationId: change.opId,
    deviceId: change.deviceId,
    organizationId,
    entity: change.entity,
    entityId: change.entityId,
    kind: change.kind,
    changes: change.changes || null,
    schemaVersion: change.schemaVersion,
    hlc: change.hlc,
    createdAt: change.occurredAt,
    sequence: change.sequence,
  })),
  nextCursor: response.nextCursor === undefined || response.nextCursor === null
    ? null
    : String(response.nextCursor),
  hasMore: response.hasMore,
});

/**
 * Transport-backed sync API. It deliberately uses the existing HttpClient so
 * session cookies, CSRF headers, API base URL, and normalized API errors stay
 * consistent with the rest of the frontend.
 */
export const createSyncApi = (client: HttpClient = httpClient): SyncApi => ({
  push: async (organizationId, payload, signal) => {
    const response = await client.request<BackendPushResponse>(syncPath(organizationId, 'push'), {
      method: 'POST',
      body: JSON.stringify(payload),
    }, signal);
    return normalizePushResponse(response);
  },

  pull: async (organizationId, cursor, limit, signal) => {
    const normalizedCursor = cursor && /^\d+$/.test(cursor) ? cursor : '0';
    const params = new URLSearchParams({ cursor: normalizedCursor, limit: String(limit) });
    const response = await client.request<BackendPullResponse>(
      `${syncPath(organizationId, 'pull')}?${params.toString()}`,
      {},
      signal,
    );
    return normalizePullResponse(response, organizationId);
  },
});

/** Exported for tests and future adapters that need to build a wire payload. */
export const serializeSyncOperation = (operation: OutboxOperation): SyncOperationInput =>
  toSyncOperation(operation);

