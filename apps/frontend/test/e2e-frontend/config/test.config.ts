const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const apiUrl = process.env.API_URL || 'http://127.0.0.1:8000';

export const URLS = {
  FRONTEND: frontendUrl,
  API: apiUrl,
};

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@example.com',
  password: process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password',
};
