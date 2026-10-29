import type { SyncConflict, SyncConflictListResponse, SyncConflictResolutionRequest } from './clientTypes';
import { httpClient, type HttpClient } from './httpClient';

export interface SyncConflictApi {
  list(organizationId: string, status?: 'open' | 'resolved'): Promise<SyncConflictListResponse>;
  resolve(organizationId: string, conflictId: string, payload: SyncConflictResolutionRequest): Promise<SyncConflict>;
}

const path = (organizationId: string): string => `/api/v1/organizations/${encodeURIComponent(organizationId)}/sync/conflicts`;

export const createSyncConflictApi = (client: HttpClient): SyncConflictApi => ({
  list: (organizationId, status = 'open') => client.request<SyncConflictListResponse>(`${path(organizationId)}?status=${status}`),
  resolve: (organizationId, conflictId, payload) => client.request<SyncConflict>(`${path(organizationId)}/${encodeURIComponent(conflictId)}/resolve`, { method: 'POST', body: JSON.stringify(payload) }),
});

export const syncConflictApi = createSyncConflictApi(httpClient);
