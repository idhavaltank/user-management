import type { Dispatch } from 'redux';
import {
  createUser,
  createOrganizationUser,
  getApiErrorMessage,
  type UserCreateRequest,
  type User,
} from '../api/client';
import { userSaved } from '../redux/actions/userAction';
import type { UserAction } from '../redux/reducers/userReducer';

export const LEGACY_USER_STORAGE_KEY = 'userList';
export const MIGRATION_STATE_KEY = 'userListMigration';
export const MIGRATION_BACKUP_KEY = 'userListMigrationBackup';

export interface LegacyUser {
  userId?: string;
  name?: string;
  email?: string;
  gender?: 'Men' | 'Women';
  birthDate?: string;
  college?: string;
  address?: string;
  hobbies?: string[] | string;
  customHobbies?: string[] | string;
}

interface PartialMigrationState {
  status: 'partial';
  failed: LegacyUser[];
}

const asList = (value: LegacyUser['hobbies']): string[] => {
  const values = Array.isArray(value) ? value : value ? String(value).split(',') : [];
  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);
};

const isLegacyRecord = (value: unknown): value is LegacyUser =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const readState = (): 'complete' | PartialMigrationState | null => {
  const raw = window.localStorage.getItem(MIGRATION_STATE_KEY);
  if (!raw) return null;
  if (raw === 'complete') return 'complete';
  try {
    const state = JSON.parse(raw) as PartialMigrationState;
    return state.status === 'partial' && Array.isArray(state.failed) ? state : null;
  } catch {
    return null;
  }
};

export const readLegacyUsers = (): LegacyUser[] => {
  try {
    const raw = window.localStorage.getItem(LEGACY_USER_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.map((item) => (isLegacyRecord(item) ? item : {})) : [];
  } catch {
    return [];
  }
};

export const pendingLegacyUsers = (): LegacyUser[] => {
  const state = readState();
  if (state === 'complete') return [];
  if (state && state.status === 'partial') return state.failed;
  return readLegacyUsers();
};

export const downloadLegacyBackup = (): void => {
  const raw = window.localStorage.getItem(MIGRATION_BACKUP_KEY) || window.localStorage.getItem(LEGACY_USER_STORAGE_KEY);
  if (!raw) return;
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `user-management-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const toCreatePayload = (user: LegacyUser): UserCreateRequest | null => {
  if (
    !isNonEmptyString(user.name) ||
    !isNonEmptyString(user.email) ||
    !isNonEmptyString(user.birthDate) ||
    !isNonEmptyString(user.college) ||
    !isNonEmptyString(user.address) ||
    (user.gender !== 'Men' && user.gender !== 'Women')
  ) {
    return null;
  }
  const birthDate = user.birthDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  return {
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
    gender: user.gender,
    birthDate,
    college: user.college.trim(),
    address: user.address.trim(),
    hobbies: asList(user.hobbies),
    customHobbies: asList(user.customHobbies),
    role: 'user',
  };
};

export interface MigrationResult {
  imported: number;
  duplicates: number;
  failed: number;
  failures: string[];
}

const createMigratedUser = (organizationId: string | undefined, payload: UserCreateRequest): Promise<User> =>
  organizationId ? createOrganizationUser(organizationId, payload) : createUser(payload);

export const migrateLegacyUsers = async (
  dispatch: Dispatch<UserAction>,
  organizationId?: string
): Promise<MigrationResult> => {
  const legacyUsers = pendingLegacyUsers();
  const backup = window.localStorage.getItem(LEGACY_USER_STORAGE_KEY);
  if (backup) window.localStorage.setItem(MIGRATION_BACKUP_KEY, backup);

  const failed: LegacyUser[] = [];
  const failures: string[] = [];
  let imported = 0;
  let duplicates = 0;

  for (let index = 0; index < legacyUsers.length; index += 1) {
    const legacyUser = legacyUsers[index];
    const payload = toCreatePayload(legacyUser);
    if (!payload) {
      failed.push(legacyUser);
      failures.push(`${legacyUser.email || 'unknown record'}: missing required fields`);
    } else {
      try {
        // Keep imports sequential so the backend and browser state remain deterministic.
        // eslint-disable-next-line no-await-in-loop
        const created: User = await createMigratedUser(organizationId, payload);
        dispatch(userSaved(created));
        imported += 1;
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'email_conflict'
        ) {
          duplicates += 1;
        } else {
          failed.push(legacyUser);
          failures.push(`${payload.email}: ${getApiErrorMessage(error)}`);
        }
      }
    }

    const remaining = legacyUsers.slice(index + 1);
    if (failed.length || remaining.length) {
      const state: PartialMigrationState = { status: 'partial', failed: [...failed, ...remaining] };
      window.localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
    }
  }

  if (failed.length) {
    const state: PartialMigrationState = { status: 'partial', failed };
    window.localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
  } else {
    window.localStorage.setItem(MIGRATION_STATE_KEY, 'complete');
  }

  return { imported, duplicates, failed: failed.length, failures };
};
