import type {
  AcceptedResponse,
  CsrfResponse,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
  PasswordResetConsumeRequest,
  PasswordResetRequest,
  SessionListResponse,
  TokenConsumeRequest,
  User,
} from './clientTypes';
import { httpClient, type HttpClient } from './httpClient';

/** Auth capability exposed to the application; intentionally smaller than the transport. */
export interface AuthApi {
  login(payload: LoginRequest): Promise<LoginResponse>;
  getCurrentUser(): Promise<User>;
  getCsrfToken(): Promise<string>;
  logout(): Promise<void>;
  changePassword(payload: PasswordChangeRequest): Promise<void>;
  requestPasswordReset(payload: PasswordResetRequest): Promise<AcceptedResponse>;
  resetPassword(payload: PasswordResetConsumeRequest): Promise<void>;
  verifyEmail(payload: TokenConsumeRequest): Promise<void>;
  listSessions(): Promise<SessionListResponse>;
  revokeOtherSessions(): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
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

  changePassword: (payload) =>
    client.request<void>('/api/v1/auth/password/change', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  requestPasswordReset: (payload) =>
    client.request<AcceptedResponse>('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetPassword: (payload) =>
    client.request<void>('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyEmail: (payload) =>
    client.request<void>('/api/v1/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listSessions: () => client.request<SessionListResponse>('/api/v1/auth/sessions'),

  revokeOtherSessions: () => client.request<void>('/api/v1/auth/sessions', { method: 'DELETE' }),

  revokeSession: (sessionId) =>
    client.request<void>(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }),
});

export const authApi = createAuthApi(httpClient);
