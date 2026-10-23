import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthApi } from './authApi';
import type { HttpClient } from './httpClient';
import { createOrganizationApi } from './organizationApi';
import { createUserApi } from './userApi';

describe('API capability boundaries', () => {
  const request = vi.fn<HttpClient['request']>();
  const client: HttpClient = {
    request: request as HttpClient['request'],
    setCsrfToken: vi.fn(),
    clearCsrfToken: vi.fn(),
  };

  beforeEach(() => request.mockReset());

  test('auth capability uses an injected transport and stores CSRF state', async () => {
    request.mockResolvedValue({ csrfToken: 'csrf-token', user: { id: 'user-1' } });
    const authApi = createAuthApi(client);

    await authApi.login({ email: 'admin@example.com', password: 'long-enough-password' });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({ method: 'POST', body: expect.any(String) })
    );
    expect(client.setCsrfToken).toHaveBeenCalledWith('csrf-token');
  });

  test('auth lifecycle sends a typed password change through the shared transport', async () => {
    request.mockResolvedValue(undefined);
    const authApi = createAuthApi(client);

    await authApi.changePassword({ currentPassword: 'current-password', newPassword: 'new-password' });

    expect(request).toHaveBeenCalledWith('/api/v1/auth/password/change', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'current-password', newPassword: 'new-password' }),
    });
  });

  test('auth session capability lists and revokes a specific encoded session', async () => {
    request.mockResolvedValue({ items: [] });
    const authApi = createAuthApi(client);

    await authApi.listSessions();
    await authApi.revokeSession('session/with spaces');

    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/auth/sessions');
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/auth/sessions/session%2Fwith%20spaces', {
      method: 'DELETE',
    });
  });

  test('user capability serializes list controls through the same injected transport', async () => {
    request.mockResolvedValue({ items: [], page: 1, pageSize: 5, total: 0 });
    const userApi = createUserApi(client);

    await userApi.listUsers({ page: 2, pageSize: 5, search: 'Ada', sort: 'name', order: 'asc' });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/users?page=2&pageSize=5&search=Ada&sort=name&order=asc',
      { signal: undefined },
      undefined
    );
  });

  test('organization user capability lists users with tenant-scoped filters', async () => {
    request.mockResolvedValue({ items: [], page: 1, pageSize: 5, total: 0 });
    const userApi = createUserApi(client);

    await userApi.listOrganizationUsers('org/1', {
      page: 2,
      pageSize: 5,
      search: 'Ada Lovelace',
      sort: 'name',
      order: 'asc',
      status: 'active',
      role: 'administrator',
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/organizations/org%2F1/users?page=2&pageSize=5&search=Ada+Lovelace&sort=name&order=asc&status=active&role=administrator',
      { signal: undefined },
      undefined
    );
  });

  test('organization user capability updates status and restores with explicit lifecycle payload', async () => {
    request.mockResolvedValue({ id: 'user-1' });
    const userApi = createUserApi(client);

    await userApi.updateOrganizationUserStatus('org-1', 'user-1', { status: 'suspended' });
    await userApi.restoreOrganizationUser('org-1', 'user-1', { status: 'active' });

    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/organizations/org-1/users/user-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' }),
    });
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/organizations/org-1/users/user-1/restore', {
      method: 'POST',
      body: JSON.stringify({ status: 'active' }),
    });
  });

  test('organization administration capability keeps mutation paths tenant-scoped', async () => {
    request.mockResolvedValue({ items: [] });
    const organizationApi = createOrganizationApi(client);

    await organizationApi.listPermissions();
    await organizationApi.createRole('org/1', {
      name: 'Support',
      description: 'Support operators',
      permissions: ['users.read'],
    });
    await organizationApi.resendInvitation('org/1', 'invite/1');

    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/permissions');
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/organizations/org%2F1/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Support',
        description: 'Support operators',
        permissions: ['users.read'],
      }),
    });
    expect(request).toHaveBeenNthCalledWith(
      3,
      '/api/v1/organizations/org%2F1/invitations/invite%2F1/resend',
      { method: 'POST' }
    );
  });

  test('organization data operations preserve multipart boundaries and job polling paths', async () => {
    request.mockResolvedValue({ previewId: 'preview-1', totalRows: 1, acceptedRows: 1, rejectedRows: 0, rows: [] });
    const organizationApi = createOrganizationApi(client);
    const file = new File(['name,email'], 'users.csv', { type: 'text/csv' });

    await organizationApi.previewImport('org-1', file);
    await organizationApi.getJob('org-1', 'job/1');

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/v1/organizations/org-1/users/import/preview',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    );
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/organizations/org-1/jobs/job%2F1');
  });
});
