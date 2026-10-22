# Deployment and cutover runbook

This runbook is provider-neutral because the deployment target has not been selected yet. It is the release checklist for the current FastAPI + PostgreSQL + React architecture.

## Required configuration

Backend secrets must be provided by the deployment platform's secret manager, never committed to `.env` files or CI logs:

- `DATABASE_URL` — PostgreSQL connection string using `postgresql+asyncpg`.
- `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` — set only for the first controlled bootstrap, then remove or rotate.
- `FRONTEND_ORIGINS` — exact HTTPS frontend origin(s), not a wildcard.
- `TRUSTED_HOSTS` — exact API hostnames.
- `TRUSTED_PROXY_IPS` — only the platform's known proxy addresses.
- `SESSION_COOKIE_SECURE=true` and `SESSION_COOKIE_SAME_SITE=lax` in staging/production.
- `REDIS_URL` — required outside local/test when rate limiting is enabled.

## Release sequence

1. Build and test the frontend and backend artifacts in CI.
2. Provision PostgreSQL and Redis, then verify connectivity from the staging API.
3. Run `uv run alembic upgrade head` as the release migration step.
4. Start the API and verify `/health` and `/ready`.
5. Run the browser CRUD smoke test against staging with non-production credentials.
6. Publish the frontend with `REACT_APP_API_URL` set to the staging/production API origin.
7. Confirm cookie attributes, CORS, request IDs, rate-limit headers, and error responses.
8. Enable the API-backed UI for the intended users.
9. Import legacy browser records using the in-app backup/import flow only after confirming the backup file.
10. Monitor API errors, database health, session failures, and migration counts before removing the legacy migration fallback.

## Rollback

- Keep the previous frontend build available and point the frontend back to it if the UI must be reverted.
- Revoke active sessions by removing or revoking `user_sessions` records if credentials are suspected to be compromised.
- Do not downgrade a production schema automatically. Take a database backup and review the reverse migration first.
- Preserve each browser's downloaded legacy backup until the import is confirmed.
- If the API is unavailable, restore the previous frontend only if its local-storage behavior is an intentionally approved temporary fallback.

## Current proof boundary

Local implementation, disposable PostgreSQL migration, backend integration, and browser CRUD verification are complete. A production deployment, backup restore drill, and provider-specific monitoring setup remain pending a deployment target and credentials.
