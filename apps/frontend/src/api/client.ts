import { authApi } from './authApi';
import { httpClient } from './httpClient';
import { userApi } from './userApi';
import type {
  ListUsersQuery,
  LoginRequest,
  LoginResponse,
  User,
  UserCreateRequest,
  UserListResponse,
  UserUpdateRequest,
} from './clientTypes';

/**
 * Public API facade kept for existing Redux imports.
 * Feature code uses the smaller AuthApi/UserApi ports; this file composes the
 * default transport-backed implementations without exposing construction details.
 */
export type {
  CsrfResponse,
  ListUsersQuery,
  LoginRequest,
  LoginResponse,
  User,
  UserCreateRequest,
  UserListResponse,
  UserUpdateRequest,
} from './clientTypes';
export { authApi, createAuthApi, type AuthApi } from './authApi';
export { userApi, createUserApi, type UserApi } from './userApi';
export {
  API_BASE_URL,
  ApiError,
  FetchHttpClient,
  getApiErrorMessage,
  httpClient,
  type FetchHttpClientOptions,
  type HttpClient,
} from './httpClient';

export const clearCsrfToken = (): void => httpClient.clearCsrfToken();
export const login = (payload: LoginRequest): Promise<LoginResponse> => authApi.login(payload);
export const getCurrentUser = (): Promise<User> => authApi.getCurrentUser();
export const getCsrfToken = (): Promise<string> => authApi.getCsrfToken();
export const logout = (): Promise<void> => authApi.logout();
export const listUsers = (query: ListUsersQuery = {}, signal?: AbortSignal): Promise<UserListResponse> =>
  userApi.listUsers(query, signal);
export const createUser = (payload: UserCreateRequest): Promise<User> => userApi.createUser(payload);
export const updateUser = (userId: string, payload: UserUpdateRequest): Promise<User> =>
  userApi.updateUser(userId, payload);
export const deleteUser = (userId: string): Promise<void> => userApi.deleteUser(userId);
