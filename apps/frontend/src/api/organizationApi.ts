import type {
  ApiKeyCreatedResponse,
  ApiKeyListResponse,
  AuditLogListResponse,
  DashboardResponse,
  ImportCommitRequest,
  ImportPreviewResponse,
  Invitation,
  InvitationCreateRequest,
  InvitationListResponse,
  JobListResponse,
  JobResponse,
  MfaCodeRequest,
  MfaEnrollmentResponse,
  MfaRecoveryCodesResponse,
  NotificationListResponse,
  NotificationPreferences,
  NotificationPreferencesUpdateRequest,
  OrganizationListResponse,
  OrganizationSettings,
  OrganizationSettingsUpdateRequest,
  PermissionListResponse,
  Role,
  RoleCreateRequest,
  RoleListResponse,
  RoleUpdateRequest,
  Team,
  TeamCreateRequest,
  TeamListResponse,
  TeamUpdateRequest,
} from './clientTypes';
import { httpClient, type HttpClient } from './httpClient';

const segment = (value: string): string => encodeURIComponent(value);

/** Tenant-aware API port. Every method requires an explicit organization id. */
export interface OrganizationApi {
  listOrganizations(): Promise<OrganizationListResponse>;
  listPermissions(): Promise<PermissionListResponse>;
  getDashboard(organizationId: string): Promise<DashboardResponse>;
  getSettings(organizationId: string): Promise<OrganizationSettings>;
  updateSettings(organizationId: string, payload: OrganizationSettingsUpdateRequest): Promise<OrganizationSettings>;
  listRoles(organizationId: string): Promise<RoleListResponse>;
  createRole(organizationId: string, payload: RoleCreateRequest): Promise<Role>;
  updateRole(organizationId: string, roleId: string, payload: RoleUpdateRequest): Promise<Role>;
  deleteRole(organizationId: string, roleId: string): Promise<void>;
  listTeams(organizationId: string): Promise<TeamListResponse>;
  createTeam(organizationId: string, payload: TeamCreateRequest): Promise<Team>;
  updateTeam(organizationId: string, teamId: string, payload: TeamUpdateRequest): Promise<Team>;
  deleteTeam(organizationId: string, teamId: string): Promise<void>;
  listInvitations(organizationId: string, page?: number, pageSize?: number): Promise<InvitationListResponse>;
  createInvitation(organizationId: string, payload: InvitationCreateRequest): Promise<Invitation>;
  revokeInvitation(organizationId: string, invitationId: string): Promise<void>;
  resendInvitation(organizationId: string, invitationId: string): Promise<void>;
  listAuditLogs(organizationId: string, page?: number, pageSize?: number): Promise<AuditLogListResponse>;
  listNotifications(organizationId: string, page?: number, pageSize?: number): Promise<NotificationListResponse>;
  getNotificationPreferences(organizationId: string): Promise<NotificationPreferences>;
  updateNotificationPreferences(
    organizationId: string,
    payload: NotificationPreferencesUpdateRequest
  ): Promise<NotificationPreferences>;
  listApiKeys(organizationId: string): Promise<ApiKeyListResponse>;
  createApiKey(organizationId: string, name: string, scopes: string[]): Promise<ApiKeyCreatedResponse>;
  revokeApiKey(organizationId: string, apiKeyId: string): Promise<void>;
  previewImport(organizationId: string, file: File, mode?: 'createOnly' | 'upsert'): Promise<ImportPreviewResponse>;
  commitImport(organizationId: string, payload: ImportCommitRequest): Promise<JobResponse>;
  exportUsers(organizationId: string): Promise<JobResponse>;
  listJobs(organizationId: string, page?: number, pageSize?: number): Promise<JobListResponse>;
  getJob(organizationId: string, jobId: string): Promise<JobResponse>;
  cancelJob(organizationId: string, jobId: string): Promise<JobResponse>;
  beginMfaEnrollment(): Promise<MfaEnrollmentResponse>;
  verifyMfaEnrollment(payload: MfaCodeRequest): Promise<MfaRecoveryCodesResponse>;
  disableMfa(payload: MfaCodeRequest): Promise<void>;
  rotateMfaRecoveryCodes(): Promise<MfaRecoveryCodesResponse>;
}

const pageQuery = (page: number, pageSize: number): string => `?page=${page}&pageSize=${pageSize}`;

export const createOrganizationApi = (client: HttpClient): OrganizationApi => ({
  listOrganizations: () => client.request<OrganizationListResponse>('/api/v1/organizations'),

  listPermissions: () => client.request<PermissionListResponse>('/api/v1/permissions'),

  getDashboard: (organizationId) =>
    client.request<DashboardResponse>(`/api/v1/organizations/${segment(organizationId)}/dashboard`),

  getSettings: (organizationId) =>
    client.request<OrganizationSettings>(`/api/v1/organizations/${segment(organizationId)}/settings`),

  updateSettings: (organizationId, payload) =>
    client.request<OrganizationSettings>(`/api/v1/organizations/${segment(organizationId)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listRoles: (organizationId) =>
    client.request<RoleListResponse>(`/api/v1/organizations/${segment(organizationId)}/roles`),

  createRole: (organizationId, payload) =>
    client.request<Role>(`/api/v1/organizations/${segment(organizationId)}/roles`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRole: (organizationId, roleId, payload) =>
    client.request<Role>(
      `/api/v1/organizations/${segment(organizationId)}/roles/${segment(roleId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    ),

  deleteRole: (organizationId, roleId) =>
    client.request<void>(
      `/api/v1/organizations/${segment(organizationId)}/roles/${segment(roleId)}`,
      { method: 'DELETE' }
    ),

  listTeams: (organizationId) =>
    client.request<TeamListResponse>(`/api/v1/organizations/${segment(organizationId)}/teams`),

  createTeam: (organizationId, payload) =>
    client.request<Team>(`/api/v1/organizations/${segment(organizationId)}/teams`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTeam: (organizationId, teamId, payload) =>
    client.request<Team>(
      `/api/v1/organizations/${segment(organizationId)}/teams/${segment(teamId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    ),

  deleteTeam: (organizationId, teamId) =>
    client.request<void>(
      `/api/v1/organizations/${segment(organizationId)}/teams/${segment(teamId)}`,
      { method: 'DELETE' }
    ),

  listInvitations: (organizationId, page = 1, pageSize = 20) =>
    client.request<InvitationListResponse>(
      `/api/v1/organizations/${segment(organizationId)}/invitations${pageQuery(page, pageSize)}`
    ),

  createInvitation: (organizationId, payload) =>
    client.request<Invitation>(`/api/v1/organizations/${segment(organizationId)}/invitations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revokeInvitation: (organizationId, invitationId) =>
    client.request<void>(
      `/api/v1/organizations/${segment(organizationId)}/invitations/${segment(invitationId)}`,
      { method: 'DELETE' }
    ),

  resendInvitation: (organizationId, invitationId) =>
    client.request<void>(
      `/api/v1/organizations/${segment(organizationId)}/invitations/${segment(invitationId)}/resend`,
      { method: 'POST' }
    ).then(() => undefined),

  listAuditLogs: (organizationId, page = 1, pageSize = 20) =>
    client.request<AuditLogListResponse>(
      `/api/v1/organizations/${segment(organizationId)}/audit-logs${pageQuery(page, pageSize)}`
    ),

  listNotifications: (organizationId, page = 1, pageSize = 20) =>
    client.request<NotificationListResponse>(
      `/api/v1/organizations/${segment(organizationId)}/notifications${pageQuery(page, pageSize)}`
    ),

  getNotificationPreferences: (organizationId) =>
    client.request<NotificationPreferences>(
      `/api/v1/organizations/${segment(organizationId)}/notifications/preferences`
    ),

  updateNotificationPreferences: (organizationId, payload) =>
    client.request<NotificationPreferences>(
      `/api/v1/organizations/${segment(organizationId)}/notifications/preferences`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    ),

  listApiKeys: (organizationId) =>
    client.request<ApiKeyListResponse>(`/api/v1/organizations/${segment(organizationId)}/api-keys`),

  createApiKey: (organizationId, name, scopes) =>
    client.request<ApiKeyCreatedResponse>(`/api/v1/organizations/${segment(organizationId)}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({ name, scopes }),
    }),

  revokeApiKey: (organizationId, apiKeyId) =>
    client.request<void>(
      `/api/v1/organizations/${segment(organizationId)}/api-keys/${segment(apiKeyId)}`,
      { method: 'DELETE' }
    ),

  previewImport: (organizationId, file, mode = 'createOnly') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    return client.request<ImportPreviewResponse>(
      `/api/v1/organizations/${segment(organizationId)}/users/import/preview`,
      { method: 'POST', body: formData }
    );
  },

  commitImport: (organizationId, payload) =>
    client.request<JobResponse>(
      `/api/v1/organizations/${segment(organizationId)}/users/import/commit`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  exportUsers: (organizationId) =>
    client.request<JobResponse>(`/api/v1/organizations/${segment(organizationId)}/users/export`),

  listJobs: (organizationId, page = 1, pageSize = 20) =>
    client.request<JobListResponse>(
      `/api/v1/organizations/${segment(organizationId)}/jobs${pageQuery(page, pageSize)}`
    ),

  getJob: (organizationId, jobId) =>
    client.request<JobResponse>(
      `/api/v1/organizations/${segment(organizationId)}/jobs/${segment(jobId)}`
    ),

  cancelJob: (organizationId, jobId) =>
    client.request<JobResponse>(
      `/api/v1/organizations/${segment(organizationId)}/jobs/${segment(jobId)}/cancel`,
      { method: 'POST' }
    ),

  beginMfaEnrollment: () => client.request<MfaEnrollmentResponse>('/api/v1/auth/mfa/enroll', { method: 'POST' }),

  verifyMfaEnrollment: (payload) =>
    client.request<MfaRecoveryCodesResponse>('/api/v1/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  disableMfa: (payload) =>
    client.request<void>('/api/v1/auth/mfa/disable', { method: 'POST', body: JSON.stringify(payload) }),

  rotateMfaRecoveryCodes: () =>
    client.request<MfaRecoveryCodesResponse>('/api/v1/auth/mfa/recovery-codes/rotate', { method: 'POST' }),
});

export const organizationApi = createOrganizationApi(httpClient);
