import type { CsrfResponse, LoginRequest, LoginResponse, User } from './clientTypes';
import { httpClient, type HttpClient } from './httpClient';

/** Auth capability exposed to the application; intentionally smaller than the transport. */
export interface AuthApi {
  login(payload: LoginRequest): Promise<LoginResponse>;
  getCurrentUser(): Promise<User>;
  getCsrfToken(): Promise<string>;
  logout(): Promise<void>;
}

export const createAuthApi = (client: HttpClient): AuthApi => ({
  async login(payload) {
    const response = await client.request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    client.setCsrfToken(response.csrfToken);
    return response;
  },

  getCurrentUser: () => client.request<User>('/api/v1/auth/me'),

  async getCsrfToken() {
    const response = await client.request<CsrfResponse>('/api/v1/auth/csrf');
    client.setCsrfToken(response.csrfToken);
    return response.csrfToken;
  },

  async logout() {
    try {
      await client.request<void>('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      client.clearCsrfToken();
    }
  },
});

export const authApi = createAuthApi(httpClient);
