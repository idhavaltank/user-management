import { authApi } from './authApi';
import { httpClient } from './httpClient';
import { userApi } from './userApi';
import { organizationApi } from './organizationApi';
import type {
  AcceptedResponse,
  ListUsersQuery,
  LoginRequest,
  LoginResponse,
  OrganizationUserListQuery,
  PasswordChangeRequest,
  PasswordResetConsumeRequest,
  PasswordResetRequest,
  RestoreUserRequest,
  SessionListResponse,
  TokenConsumeRequest,
  User,
  UserCreateRequest,
  UserListResponse,
  UserStatusUpdateRequest,
  UserUpdateRequest,
} from './clientTypes';

/**
 * Public API facade kept for existing Redux imports.
 * Feature code uses the smaller AuthApi/UserApi ports; this file composes the
 * default transport-backed implementations without exposing construction details.
 */
export type {
  AcceptedResponse,
  CsrfResponse,
  ListUsersQuery,
  LoginRequest,
  LoginResponse,
  OrganizationUserListQuery,
  PasswordChangeRequest,
  PasswordResetConsumeRequest,
  PasswordResetRequest,
  RestoreUserRequest,
  Session,
  SessionListResponse,
  TokenConsumeRequest,
  User,
  UserCreateRequest,
  UserListResponse,
  UserStatusUpdateRequest,
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
export { organizationApi, createOrganizationApi, type OrganizationApi } from './organizationApi';

export const clearCsrfToken = (): void => httpClient.clearCsrfToken();
export const login = (payload: LoginRequest): Promise<LoginResponse> => authApi.login(payload);
export const getCurrentUser = (): Promise<User> => authApi.getCurrentUser();
export const getCsrfToken = (): Promise<string> => authApi.getCsrfToken();
export const logout = (): Promise<void> => authApi.logout();
export const changePassword = (payload: PasswordChangeRequest): Promise<void> => authApi.changePassword(payload);
export const requestPasswordReset = (payload: PasswordResetRequest): Promise<AcceptedResponse> =>
  authApi.requestPasswordReset(payload);
export const resetPassword = (payload: PasswordResetConsumeRequest): Promise<void> => authApi.resetPassword(payload);
export const verifyEmail = (payload: TokenConsumeRequest): Promise<void> => authApi.verifyEmail(payload);
export const listSessions = (): Promise<SessionListResponse> => authApi.listSessions();
export const revokeOtherSessions = (): Promise<void> => authApi.revokeOtherSessions();
export const revokeSession = (sessionId: string): Promise<void> => authApi.revokeSession(sessionId);
export const listUsers = (query: ListUsersQuery = {}, signal?: AbortSignal): Promise<UserListResponse> =>
  userApi.listUsers(query, signal);
export const createUser = (payload: UserCreateRequest): Promise<User> => userApi.createUser(payload);
export const updateUser = (userId: string, payload: UserUpdateRequest): Promise<User> =>
  userApi.updateUser(userId, payload);
export const deleteUser = (userId: string): Promise<void> => userApi.deleteUser(userId);
export const listOrganizationUsers = (
  organizationId: string,
  query: OrganizationUserListQuery = {},
  signal?: AbortSignal
): Promise<UserListResponse> => userApi.listOrganizationUsers(organizationId, query, signal);
export const createOrganizationUser = (organizationId: string, payload: UserCreateRequest): Promise<User> =>
  userApi.createOrganizationUser(organizationId, payload);
export const getOrganizationUser = (organizationId: string, userId: string): Promise<User> =>
  userApi.getOrganizationUser(organizationId, userId);
export const updateOrganizationUser = (
  organizationId: string,
  userId: string,
  payload: UserUpdateRequest
): Promise<User> => userApi.updateOrganizationUser(organizationId, userId, payload);
export const deleteOrganizationUser = (organizationId: string, userId: string): Promise<void> =>
  userApi.deleteOrganizationUser(organizationId, userId);
export const restoreOrganizationUser = (
  organizationId: string,
  userId: string,
  payload?: RestoreUserRequest
): Promise<User> => userApi.restoreOrganizationUser(organizationId, userId, payload);
export const updateOrganizationUserStatus = (
  organizationId: string,
  userId: string,
  payload: UserStatusUpdateRequest
): Promise<User> => userApi.updateOrganizationUserStatus(organizationId, userId, payload);
export const listOrganizations = (): ReturnType<typeof organizationApi.listOrganizations> => organizationApi.listOrganizations();
