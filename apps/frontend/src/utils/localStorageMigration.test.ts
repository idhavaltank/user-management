import { beforeEach, expect, test } from 'vitest';
import { LEGACY_USER_STORAGE_KEY, MIGRATION_STATE_KEY, pendingLegacyUsers } from './localStorageMigration';

beforeEach(() => {
  window.localStorage.clear();
});

test('reads legacy records until migration is explicitly complete', () => {
  const record = { userId: 'legacy-1', name: 'Legacy User', email: 'legacy@example.com' };
  window.localStorage.setItem(LEGACY_USER_STORAGE_KEY, JSON.stringify([record]));
  expect(pendingLegacyUsers()).toEqual([record]);

  window.localStorage.setItem(MIGRATION_STATE_KEY, 'complete');
  expect(pendingLegacyUsers()).toEqual([]);
});

test('retains malformed array entries as retryable records instead of throwing', () => {
  window.localStorage.setItem(LEGACY_USER_STORAGE_KEY, JSON.stringify([null, 'invalid', { name: 'Incomplete' }]));

  expect(pendingLegacyUsers()).toHaveLength(3);
  expect(() => pendingLegacyUsers()).not.toThrow();
});
