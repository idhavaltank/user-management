import type { ListUsersQuery, User, UserListResponse } from '../../api/client';
import { USER_DELETED, USER_SAVED, USERS_FAILED, USERS_LOADED, USERS_REQUESTED } from '../Types';

export type UserRequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface UserState {
  list: User[];
  page: number;
  pageSize: number;
  total: number;
  status: UserRequestStatus;
  error: string | null;
  query: ListUsersQuery;
}

export type UserAction =
  | { type: typeof USERS_REQUESTED; payload: ListUsersQuery }
  | { type: typeof USERS_LOADED; payload: UserListResponse }
  | { type: typeof USER_SAVED; payload: User }
  | { type: typeof USER_DELETED; payload: string }
  | { type: typeof USERS_FAILED; payload: string };

export const initialUserState: UserState = {
  list: [],
  page: 1,
  pageSize: 5,
  total: 0,
  status: 'idle',
  error: null,
  query: {},
};

const userReducer = (state: UserState = initialUserState, action: UserAction): UserState => {
  switch (action.type) {
    case USERS_REQUESTED:
      return { ...state, status: 'loading', error: null, query: action.payload };
    case USERS_LOADED:
      return {
        ...state,
        list: action.payload.items,
        page: action.payload.page,
        pageSize: action.payload.pageSize,
        total: action.payload.total,
        status: 'succeeded',
        error: null,
      };
    case USER_SAVED: {
      const exists = state.list.some((user) => user.id === action.payload.id);
      const list = exists
        ? state.list.map((user) => (user.id === action.payload.id ? action.payload : user))
        : [action.payload, ...state.list];

      return {
        ...state,
        list,
        total: exists ? state.total : state.total + 1,
        status: 'succeeded',
        error: null,
      };
    }
    case USER_DELETED:
      return {
        ...state,
        list: state.list.filter((user) => user.id !== action.payload),
        total: Math.max(0, state.total - 1),
        status: 'succeeded',
        error: null,
      };
    case USERS_FAILED:
      return { ...state, status: 'failed', error: action.payload };
    default:
      return state;
  }
};

export default userReducer;
