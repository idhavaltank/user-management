import type { OfflineStorageAdapter, OutboxOperation } from './types';

export interface StorageEstimate {
  usageBytes: number | null;
  quotaBytes: number | null;
  usagePercent: number | null;
}

export interface OfflineDiagnostics {
  backend: string;
  persistentStorageGranted: boolean;
  organizationId: string;
  cursor: string | null;
  deviceId: string;
  pendingCount: number;
  failedCount: number;
  lastError: string | null;
  estimate: StorageEstimate;
}

/**
 * Reads browser storage pressure without depending on a particular adapter.
 * Browsers may withhold usage/quota values, so null is an explicit result.
 */
export const readStorageEstimate = async (): Promise<StorageEstimate> => {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usageBytes: null, quotaBytes: null, usagePercent: null };
  }

  const estimate = await navigator.storage.estimate();
  const usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
  const quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
  return {
    usageBytes,
    quotaBytes,
    usagePercent: usageBytes !== null && quotaBytes ? (usageBytes / quotaBytes) * 100 : null,
  };
};

/**
 * Builds a user-safe export containing sync metadata, not CRM payload values.
 * This lets support inspect a rejected queue without copying customer data.
 */
export const createRejectedOperationExport = (
  operations: OutboxOperation[],
  diagnostics: Pick<OfflineDiagnostics, 'backend' | 'organizationId' | 'cursor' | 'deviceId'>,
): string => JSON.stringify({
  product: 'FlowSync',
  exportedAt: new Date().toISOString(),
  backend: diagnostics.backend,
  organizationId: diagnostics.organizationId,
  cursor: diagnostics.cursor,
  deviceId: diagnostics.deviceId,
  rejectedOperations: operations
    .filter((operation) => operation.status === 'failed')
    .map((operation) => ({
      operationId: operation.operationId,
      entity: operation.entity,
      entityId: operation.entityId,
      kind: operation.kind,
      schemaVersion: operation.schemaVersion,
      createdAt: operation.createdAt,
      attempts: operation.attempts,
      lastError: operation.lastError || 'Unknown sync error',
    })),
}, null, 2);

/** Trigger a local download without sending diagnostics to a server. */
export const downloadDiagnostics = (filename: string, content: string): void => {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const readOfflineDiagnostics = async (
  adapter: OfflineStorageAdapter,
  backend: string,
  persistentStorageGranted: boolean,
  organizationId: string,
  deviceId: string,
  cursor: string | null,
  lastError: string | null,
): Promise<OfflineDiagnostics> => {
  const operations = await adapter.pendingOutbox(organizationId);
  return {
    backend,
    persistentStorageGranted,
    organizationId,
    cursor,
    deviceId,
    pendingCount: operations.length,
    failedCount: operations.filter((operation) => operation.status === 'failed').length,
    lastError,
    estimate: await readStorageEstimate(),
  };
};
