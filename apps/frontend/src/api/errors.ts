/** Normalized server failure shared by transport and feature layers. */
export class ApiError extends Error {
  readonly status: number;

  readonly code?: string;

  readonly requestId?: string;

  readonly retryAfter?: string;

  readonly rateLimitLimit?: string;

  readonly rateLimitRemaining?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    requestId?: string,
    headers?: Headers
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = headers?.get('Retry-After') || undefined;
    this.rateLimitLimit = headers?.get('X-RateLimit-Limit') || undefined;
    this.rateLimitRemaining = headers?.get('X-RateLimit-Remaining') || undefined;
  }
}
