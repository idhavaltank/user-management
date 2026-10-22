import type { ListUsersQuery, User, UserCreateRequest, UserListResponse, UserUpdateRequest } from './clientTypes';
import { httpClient, type HttpClient } from './httpClient';

/** User capability used by Redux and pages; it does not know how HTTP is implemented. */
export interface UserApi {
  listUsers(query?: ListUsersQuery, signal?: AbortSignal): Promise<UserListResponse>;
  createUser(payload: UserCreateRequest): Promise<User>;
  updateUser(userId: string, payload: UserUpdateRequest): Promise<User>;
  deleteUser(userId: string): Promise<void>;
}

export const createUserApi = (client: HttpClient): UserApi => ({
  listUsers(query = {}, signal) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const queryString = params.toString();
    return client.request<UserListResponse>(
      `/api/v1/users${queryString ? `?${queryString}` : ''}`,
      { signal },
      signal
    );
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
    client.request<void>(`/api/v1/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
});

export const userApi = createUserApi(httpClient);
