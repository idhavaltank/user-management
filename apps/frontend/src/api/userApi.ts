import type {
  ListUsersQuery,
  OrganizationUserListQuery,
  RestoreUserRequest,
  User,
  UserCreateRequest,
  UserListResponse,
  UserStatusUpdateRequest,
  UserUpdateRequest,
} from './clientTypes';
import { httpClient, type HttpClient } from './httpClient';

const serializeQuery = (query: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
};

const pathSegment = (value: string): string => encodeURIComponent(value);

/** User capability used by Redux and pages; it does not know how HTTP is implemented. */
export interface UserApi {
  listUsers(query?: ListUsersQuery, signal?: AbortSignal): Promise<UserListResponse>;
  createUser(payload: UserCreateRequest): Promise<User>;
  updateUser(userId: string, payload: UserUpdateRequest): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  listOrganizationUsers(
    organizationId: string,
    query?: OrganizationUserListQuery,
    signal?: AbortSignal
  ): Promise<UserListResponse>;
  createOrganizationUser(organizationId: string, payload: UserCreateRequest): Promise<User>;
  getOrganizationUser(organizationId: string, userId: string): Promise<User>;
  updateOrganizationUser(organizationId: string, userId: string, payload: UserUpdateRequest): Promise<User>;
  deleteOrganizationUser(organizationId: string, userId: string): Promise<void>;
  restoreOrganizationUser(organizationId: string, userId: string, payload?: RestoreUserRequest): Promise<User>;
  updateOrganizationUserStatus(organizationId: string, userId: string, payload: UserStatusUpdateRequest): Promise<User>;
}

export const createUserApi = (client: HttpClient): UserApi => ({
  listUsers(query = {}, signal) {
    const queryString = serializeQuery(query);
    return client.request<UserListResponse>(`/api/v1/users${queryString ? `?${queryString}` : ''}`, { signal }, signal);
  },

  createUser: (payload) =>
    client.request<User>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (userId, payload) =>
    client.request<User>(`/api/v1/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteUser: (userId) =>
    client.request<void>(`/api/v1/users/${pathSegment(userId)}`, {
      method: 'DELETE',
    }),

  listOrganizationUsers(organizationId, query = {}, signal) {
    const queryString = serializeQuery(query);
    return client.request<UserListResponse>(
      `/api/v1/organizations/${pathSegment(organizationId)}/users${queryString ? `?${queryString}` : ''}`,
      { signal },
      signal
    );
  },

  createOrganizationUser: (organizationId, payload) =>
    client.request<User>(`/api/v1/organizations/${pathSegment(organizationId)}/users`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrganizationUser: (organizationId, userId) =>
    client.request<User>(`/api/v1/organizations/${pathSegment(organizationId)}/users/${pathSegment(userId)}`),

  updateOrganizationUser: (organizationId, userId, payload) =>
    client.request<User>(`/api/v1/organizations/${pathSegment(organizationId)}/users/${pathSegment(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteOrganizationUser: (organizationId, userId) =>
    client.request<void>(`/api/v1/organizations/${pathSegment(organizationId)}/users/${pathSegment(userId)}`, {
      method: 'DELETE',
    }),

  restoreOrganizationUser: (organizationId, userId, payload) => {
    const init: RequestInit = { method: 'POST' };
    if (payload) init.body = JSON.stringify(payload);
    return client.request<User>(
      `/api/v1/organizations/${pathSegment(organizationId)}/users/${pathSegment(userId)}/restore`,
      init
    );
  },

  updateOrganizationUserStatus: (organizationId, userId, payload) =>
    client.request<User>(`/api/v1/organizations/${pathSegment(organizationId)}/users/${pathSegment(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
});

export const userApi = createUserApi(httpClient);
