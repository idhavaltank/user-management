import type { Dispatch } from 'redux';
import {
  ApiError,
  clearCsrfToken,
  getApiErrorMessage,
  getCsrfToken,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  type LoginRequest,
  type User,
} from '../../api/client';
import {
  AUTH_LOGGED_OUT,
  AUTH_LOGIN_FAILED,
  AUTH_LOGIN_STARTED,
  AUTH_LOGIN_SUCCEEDED,
  AUTH_RESTORE_FAILED,
  AUTH_RESTORE_STARTED,
  AUTH_RESTORE_SUCCEEDED,
} from '../Types';
import type { AuthAction } from '../reducers/authReducer';

export const authRestoreStarted = (): AuthAction => ({ type: AUTH_RESTORE_STARTED });
export const authRestoreSucceeded = (user: User): AuthAction => ({
  type: AUTH_RESTORE_SUCCEEDED,
  payload: user,
});
export const authRestoreFailed = (error: string | null): AuthAction => ({
  type: AUTH_RESTORE_FAILED,
  payload: error,
});
export const authLoginStarted = (): AuthAction => ({ type: AUTH_LOGIN_STARTED });
export const authLoginSucceeded = (user: User): AuthAction => ({
  type: AUTH_LOGIN_SUCCEEDED,
  payload: user,
});
export const authLoginFailed = (error: string): AuthAction => ({ type: AUTH_LOGIN_FAILED, payload: error });
export const authLoggedOut = (): AuthAction => ({ type: AUTH_LOGGED_OUT });

export const restoreSession = async (dispatch: Dispatch<AuthAction>): Promise<void> => {
  dispatch(authRestoreStarted());

  try {
    const user = await getCurrentUser();
    await getCsrfToken();
    dispatch(authRestoreSucceeded(user));
  } catch (error) {
    clearCsrfToken();
    const isUnauthorized = error instanceof ApiError && error.status === 401;
    dispatch(authRestoreFailed(isUnauthorized ? null : getApiErrorMessage(error)));
  }
};

export const loginUser = async (dispatch: Dispatch<AuthAction>, credentials: LoginRequest): Promise<void> => {
  dispatch(authLoginStarted());

  try {
    const response = await apiLogin(credentials);
    dispatch(authLoginSucceeded(response.user));
  } catch (error) {
    const message = getApiErrorMessage(error);
    dispatch(authLoginFailed(message));
    throw error;
  }
};

export const logoutUser = async (dispatch: Dispatch<AuthAction>): Promise<void> => {
  try {
    await apiLogout();
  } finally {
    dispatch(authLoggedOut());
  }
};
