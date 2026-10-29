const ACTIVE_ORGANIZATION_KEY = 'flowsync.active-organization-id';

/**
 * Only the last selected tenant ID is kept in localStorage so an authenticated
 * user can reopen a cached CRM while offline. CRM records themselves remain in
 * the organization-scoped IndexedDB stores.
 */
export const getActiveOrganizationId = (): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
};

export const setActiveOrganizationId = (organizationId: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
    window.dispatchEvent(new CustomEvent('flowsync:organization-changed', { detail: organizationId }));
  }
};

