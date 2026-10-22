import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createAuthApi } from './authApi';
import type { HttpClient } from './httpClient';
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

    expect(request).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ method: 'POST', body: expect.any(String) }));
    expect(client.setCsrfToken).toHaveBeenCalledWith('csrf-token');
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
});
