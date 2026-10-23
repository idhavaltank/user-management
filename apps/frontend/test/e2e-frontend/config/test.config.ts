const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const configuredApiUrl = process.env.API_URL || 'http://127.0.0.1:8000';
const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Keep response assertions aligned with the frontend transport. A host-only
// session cookie is scoped to the exact loopback hostname used by the page.
const resolveApiUrl = (): string => {
  try {
    const frontend = new URL(frontendUrl);
    const api = new URL(configuredApiUrl, frontend.origin);
    if (loopbackHosts.has(frontend.hostname) && loopbackHosts.has(api.hostname)) {
      api.hostname = frontend.hostname;
    }
    return api.toString().replace(/\/$/, '');
  } catch {
    return configuredApiUrl.replace(/\/$/, '');
  }
};

const apiUrl = resolveApiUrl();

export const URLS = {
  FRONTEND: frontendUrl,
  API: apiUrl,
};

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@example.com',
  password: process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password',
};
