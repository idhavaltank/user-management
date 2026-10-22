import type { Dispatch } from 'redux';
import {
  createUser as apiCreateUser,
  deleteUser as apiDeleteUser,
  getApiErrorMessage,
  listUsers,
  type ListUsersQuery,
  type User,
  type UserCreateRequest,
  type UserListResponse,
  type UserUpdateRequest,
  updateUser as apiUpdateUser,
} from '../../api/client';
import { USER_DELETED, USER_SAVED, USERS_FAILED, USERS_LOADED, USERS_REQUESTED } from '../Types';
import type { UserAction } from '../reducers/userReducer';

export const usersRequested = (query: ListUsersQuery): UserAction => ({ type: USERS_REQUESTED, payload: query });
export const usersLoaded = (response: UserListResponse): UserAction => ({
  type: USERS_LOADED,
  payload: response,
});
export const userSaved = (user: User): UserAction => ({ type: USER_SAVED, payload: user });
export const userDeleted = (userId: string): UserAction => ({ type: USER_DELETED, payload: userId });
export const usersFailed = (error: string): UserAction => ({ type: USERS_FAILED, payload: error });

export const fetchUsers = async (
  dispatch: Dispatch<UserAction>,
  query: ListUsersQuery = {},
  signal?: AbortSignal
): Promise<void> => {
  dispatch(usersRequested(query));

  try {
    dispatch(usersLoaded(await listUsers(query, signal)));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    dispatch(usersFailed(getApiErrorMessage(error)));
    throw error;
  }
};

export const saveUser = async (
  dispatch: Dispatch<UserAction>,
  userId: string,
  payload: UserCreateRequest | UserUpdateRequest
): Promise<User> => {
  try {
    const user = userId
      ? await apiUpdateUser(userId, payload as UserUpdateRequest)
      : await apiCreateUser(payload as UserCreateRequest);
    dispatch(userSaved(user));
    return user;
  } catch (error) {
    dispatch(usersFailed(getApiErrorMessage(error)));
    throw error;
  }
};

export const deleteUser = async (dispatch: Dispatch<UserAction>, userId: string): Promise<void> => {
  try {
    await apiDeleteUser(userId);
    dispatch(userDeleted(userId));
  } catch (error) {
    dispatch(usersFailed(getApiErrorMessage(error)));
    throw error;
  }
};
