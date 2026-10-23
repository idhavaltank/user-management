import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError, API_BASE_URL, clearCsrfToken, listUsers, login } from './client';

describe('API client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    clearCsrfToken();
  });

  test('sends credentials and serializes server-side list controls', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], page: 1, pageSize: 5, total: 0 }),
    } as unknown as Response);

    await listUsers({ page: 2, pageSize: 5, search: 'Ada', sort: 'name', order: 'asc' });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/users?page=2&pageSize=5&search=Ada&sort=name&order=asc`,
      expect.objectContaining({ credentials: 'include' })
    );
  });

  test('stores the CSRF token returned by login and normalizes API failures', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'csrf-token-value', user: { id: '1' } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({ code: 'email_conflict', message: 'Email already exists.' }),
      } as unknown as Response);

    await login({ email: 'admin@example.com', password: 'long-enough-password' });

    await expect(listUsers()).rejects.toEqual(new ApiError('Email already exists.', 409, 'email_conflict', undefined));
  });

  test('normalizes non-JSON failures with status and rate-limit metadata', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({
        'Retry-After': '30',
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0',
      }),
      json: async () => {
        throw new SyntaxError('not json');
      },
    } as unknown as Response);

    await expect(listUsers()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Too Many Requests',
      status: 429,
      retryAfter: '30',
      rateLimitLimit: '60',
      rateLimitRemaining: '0',
    });
  });
});
