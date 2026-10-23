import type { components } from '../generated/api-types';
import { ApiError } from './errors';

export { ApiError } from './errors';

type ErrorResponse = components['schemas']['ErrorResponse'];

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Keep local browser requests on one loopback hostname. A session cookie set
// for 127.0.0.1 is not sent by a page opened at localhost (and vice versa),
// even though both names resolve to the same machine. Production API URLs are
// left untouched; only local loopback-to-loopback configuration is aligned.
const resolveApiBaseUrl = (): string => {
  const configuredUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  if (typeof window === 'undefined' || !LOOPBACK_HOSTS.has(window.location.hostname)) return configuredUrl;

  try {
    const apiUrl = new URL(configuredUrl, window.location.origin);
    if (LOOPBACK_HOSTS.has(apiUrl.hostname)) apiUrl.hostname = window.location.hostname;
    return apiUrl.toString().replace(/\/$/, '');
  } catch {
    return configuredUrl;
  }
};

export const API_BASE_URL = resolveApiBaseUrl();

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** A small transport port that keeps feature APIs independent from fetch. */
export interface HttpClient {
  request<Response>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<Response>;
  setCsrfToken(token: string): void;
  clearCsrfToken(): void;
}

export const getApiErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return 'The request could not be completed.';
};

export interface FetchHttpClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Fetch implementation of the transport port; it owns request security concerns. */
export class FetchHttpClient implements HttpClient {
  private csrfToken: string | null = null;

  private readonly baseUrl: string;

  private readonly fetchImpl: typeof fetch;

  constructor({ baseUrl = API_BASE_URL, fetchImpl }: FetchHttpClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    // Resolve the global fetch at request time so tests and hosts can replace it safely.
    this.fetchImpl = fetchImpl || ((input, init) => fetch(input, init));
  }

  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  clearCsrfToken(): void {
    this.csrfToken = null;
  }

  async request<Response>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (init.body && !headers.has('Content-Type') && !isFormDataBody) {
      headers.set('Content-Type', 'application/json');
    }
    if (UNSAFE_METHODS.has(method) && this.csrfToken) headers.set('X-CSRF-Token', this.csrfToken);

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      signal: signal || init.signal,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      let payload: Partial<ErrorResponse> = {};
      try {
        payload = (await response.json()) as Partial<ErrorResponse>;
      } catch {
        // The HTTP status text is the fallback when an upstream response is not JSON.
      }

      if (response.status === 401) {
        this.clearCsrfToken();
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:unauthorized'));
      }

      throw new ApiError(
        payload.message || response.statusText || 'The request failed.',
        response.status,
        payload.code,
        payload.requestId,
        response.headers
      );
    }

    if (response.status === 204) return undefined as Response;
    return (await response.json()) as Response;
  }
}

export const httpClient: HttpClient = new FetchHttpClient();
