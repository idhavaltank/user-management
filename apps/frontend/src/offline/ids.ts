/**
 * Creates identifiers for locally-created records and outbox entries.
 * crypto.randomUUID is preferred; the fallback keeps local development usable
 * in older browsers and test environments without exposing user data.
 */
export const createOfflineId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const DEVICE_ID_KEY = 'flowsync.device-id';

/** Device identity is local metadata only; it never contains credentials. */
export const getDeviceId = (): string => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'server-rendered-device';
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const created = createOfflineId();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
};

