import { expect, test } from 'vitest';
import { USER_DELETED, USER_SAVED, USERS_LOADED } from '../Types';
import reducer, { initialUserState } from './userReducer';

const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  gender: 'Men' as const,
  birthDate: '1988-03-02',
  college: 'Test College',
  address: '1 Test Street',
  hobbies: ['Reading'],
  customHobbies: [],
  role: 'user' as const,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

test('stores server list and supports server-backed save/delete state updates', () => {
  const loaded = reducer(initialUserState, {
    type: USERS_LOADED,
    payload: { items: [user], page: 1, pageSize: 5, total: 1 },
  });
  expect(loaded.list).toHaveLength(1);
  expect(loaded.total).toBe(1);

  const saved = reducer(loaded, { type: USER_SAVED, payload: { ...user, name: 'Updated User' } });
  expect(saved.list[0].name).toBe('Updated User');
  expect(saved.total).toBe(1);

  const deleted = reducer(saved, { type: USER_DELETED, payload: user.id });
  expect(deleted.list).toHaveLength(0);
  expect(deleted.total).toBe(0);
});
