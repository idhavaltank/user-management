import type { User } from '../../api/client';
import {
  AUTH_LOGGED_OUT,
  AUTH_LOGIN_FAILED,
  AUTH_LOGIN_STARTED,
  AUTH_LOGIN_SUCCEEDED,
  AUTH_RESTORE_FAILED,
  AUTH_RESTORE_STARTED,
  AUTH_RESTORE_SUCCEEDED,
} from '../Types';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

export type AuthAction =
  | { type: typeof AUTH_RESTORE_STARTED }
  | { type: typeof AUTH_RESTORE_SUCCEEDED; payload: User }
  | { type: typeof AUTH_RESTORE_FAILED; payload: string | null }
  | { type: typeof AUTH_LOGIN_STARTED }
  | { type: typeof AUTH_LOGIN_SUCCEEDED; payload: User }
  | { type: typeof AUTH_LOGIN_FAILED; payload: string }
  | { type: typeof AUTH_LOGGED_OUT };

export const initialAuthState: AuthState = {
  status: 'checking',
  user: null,
  error: null,
};

const authReducer = (state: AuthState = initialAuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case AUTH_RESTORE_STARTED:
    case AUTH_LOGIN_STARTED:
      return { ...state, status: 'checking', error: null };
    case AUTH_RESTORE_SUCCEEDED:
    case AUTH_LOGIN_SUCCEEDED:
      return { status: 'authenticated', user: action.payload, error: null };
    case AUTH_RESTORE_FAILED:
      return { status: 'anonymous', user: null, error: action.payload };
    case AUTH_LOGIN_FAILED:
      return { status: 'anonymous', user: null, error: action.payload };
    case AUTH_LOGGED_OUT:
      return { status: 'anonymous', user: null, error: null };
    default:
      return state;
  }
};

export default authReducer;
