import type { components, operations } from '../generated/api-types';

export type User = components['schemas']['User'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type LoginResponse = components['schemas']['LoginResponse'];
export type UserCreateRequest = components['schemas']['UserCreateRequest'];
export type UserUpdateRequest = components['schemas']['UserUpdateRequest'];
export type UserListResponse = operations['listUsers']['responses'][200]['content']['application/json'];
export type ListUsersQuery = NonNullable<operations['listUsers']['parameters']['query']>;
export type CsrfResponse = operations['getCsrfToken']['responses'][200]['content']['application/json'];
