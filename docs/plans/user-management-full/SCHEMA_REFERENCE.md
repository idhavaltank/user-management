# Verified Schema Reference

This document is the Phase 0 schema evidence for the local user-management
checkout. It is intentionally limited to structure and aggregate counts; it
does not contain passwords, session values, CSRF values, reset tokens, or other
secrets.

## Scope and evidence

- Repository: `/home/dhaval-tank/Project/user-management/user-management`
- Branch: `main`
- Baseline commit: `02d21e1 Align local frontend and API cookie hosts`
- Database: local Docker PostgreSQL 16.14 (`user_management` database)
- Redis: local Docker Redis 7 service running alongside PostgreSQL
- Migration revision: `20261023_0007` (head)
- Schema inspection: `2026-10-23`, using `psql` inside the local `backend-postgres-1` container
- Aggregate evidence after exact local smoke cleanup: `users=10`,
  `user_sessions=27`, `organizations=1`, `organization_memberships=10`,
  `organization_jobs=2`, `user_import_previews=2`
- Current generated-artifact hashes:
  - `docs/api/openapi.yaml`: `6299a9afe6cbc56df2850dd05688e920db4d55a35a6193f7d5fcb7fd5da3abbb`
  - `apps/frontend/src/generated/api-types.ts`: `e594dd4cce426def76eb6b114d3f6c42e8768fd3d239b9b01c31b9072ca5c82b`
  - `apps/backend/app/generated/schemas.py`: `4de526f4ac9e2432fb37975758d4b769208681585c128769bbd92ea9af6fee29`

## Live tables and columns

### `users`

| Column | PostgreSQL type | Nullable | Default | Current ORM/contract role |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary identity |
| `name` | `varchar` | no | — | Profile display name |
| `email` | `varchar` | no | — | Login and unique active identity |
| `password_hash` | `varchar` | yes | — | Argon2id hash; nullable for admin-created profiles |
| `gender` | `varchar` | no | — | Existing profile enum |
| `birth_date` | `date` | no | — | Existing profile field |
| `college` | `varchar` | no | — | Existing profile field |
| `address` | `varchar` | no | — | Existing profile field |
| `hobbies` | `text[]` | no | empty array | Existing profile list |
| `custom_hobbies` | `text[]` | no | empty array | Existing profile list |
| `role` | `varchar` | no | `user` | Transitional `admin`/`user` authorization field |
| `is_active` | `boolean` | no | `true` | Transitional active/deleted projection |
| `deleted_at` | `timestamptz` | yes | — | Soft-delete timestamp |
| `created_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | Audit timestamp |
| `updated_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | Audit timestamp |

### `user_sessions`

| Column | PostgreSQL type | Nullable | Default | Security role |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Session identifier |
| `user_id` | `uuid` | no | — | Owning user foreign key |
| `token_hash` | `varchar` | no | — | Hash of opaque HttpOnly session token |
| `csrf_token_hash` | `varchar` | no | — | Hash of memory-held CSRF token |
| `expires_at` | `timestamptz` | no | — | Session expiry |
| `revoked_at` | `timestamptz` | yes | — | Explicit revocation |
| `created_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | Session audit timestamp |
| `updated_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | Session audit timestamp |

The local database also contains Alembic's `alembic_version(version_num)` table.

### Current domain tables

The additive migrations now include the following domain tables in addition to
`users` and `user_sessions`:

- Identity/security: `one_time_tokens`, `audit_logs`.
- Tenant authorization: `organizations`, `organization_memberships`,
  `organization_roles`, `permissions`, `role_permissions`, `teams`.
- Tenant operations: `organization_invitations`, `organization_api_keys`,
  `organization_jobs`, `user_import_previews`.
- User experience: `notifications`, `notification_preferences`.

The current ORM definitions are in `apps/backend/app/models/` and the migration
chain is `20261022_0001` followed by `20261023_0002` through `20261023_0007`.

## Indexes and constraints

### Indexes

- `users.pk_users` — primary key on `id`.
- `users.uq_users_active_email` — unique `lower(email)` for rows where
  `is_active=true AND deleted_at IS NULL`.
- `users.ix_users_active_name` — `(is_active, name)` list lookup support.
- `users.ix_users_active_created_at` — `(is_active, created_at)` stable ordering support.
- `user_sessions.pk_user_sessions` — primary key on `id`.
- `user_sessions.uq_user_sessions_token_hash` — unique session-token hash.
- `user_sessions.ix_user_sessions_user_expires` — `(user_id, expires_at)` expiry/revocation lookup.

### Foreign keys and checks

- `user_sessions.user_id` references `users.id` with `ON DELETE CASCADE`.
- `users.birth_date` is between `1960-01-01` and `2000-01-01`.
- `users.role` is `admin` or `user`.
- `users.gender` is `Men` or `Women`.
- `users.name` is non-empty after trimming.
- `users.hobbies` and `users.custom_hobbies` have at most 20 items and no empty item.
- `users.is_active` and `users.deleted_at` are currently coupled: active rows have no
  deletion timestamp and inactive rows have one. Phase 5 must replace this transitional
  invariant with the planned canonical status model without losing existing rows.

## ORM and migration comparison

The live schema matches the current SQLAlchemy models in:

- `apps/backend/app/models/base.py`
- `apps/backend/app/models/user.py`
- `apps/backend/app/models/session.py`
- `apps/backend/alembic/versions/20261022_0001_initial_users_sessions.py`
- `apps/backend/alembic/versions/20261023_0002_security_organizations.py`
- `apps/backend/alembic/versions/20261023_0003_auth_lifecycle_tokens.py`
- `apps/backend/alembic/versions/20261023_0004_organization_operations.py`
- `apps/backend/alembic/versions/20261023_0005_organization_settings.py`
- `apps/backend/alembic/versions/20261023_0006_jobs.py`
- `apps/backend/alembic/versions/20261023_0007_import_previews.py`

Alembic is configured from the same `DATABASE_URL` used by the application and
imports `app.models.Base` as `target_metadata`. `npm run db:current` reports the
same `20261023_0007` revision that is present in the live `alembic_version` row.

## Phase 0 migration safety notes

1. Do not rewrite or reset the local database to make the plan fit. Future
   migrations must be additive/backfill-safe against the current local rows.
2. Existing active-email uniqueness must be preserved while status, membership,
   and organization tables are introduced.
3. Existing admin/user values are the only source available for the initial
   organization membership backfill; the backfill must be deterministic and
   local/test-safe.
4. Existing sessions must not become valid for a different user or organization.
   Security-sensitive migration changes must revoke or explicitly preserve
   sessions by documented policy and must be covered by tests.
5. All migration filenames must be generated by Alembic during implementation;
   fabricated timestamp names are not used.

## Reproduction commands

```bash
docker compose --env-file apps/backend/.env -f apps/backend/docker-compose.yml ps
npm run db:current
npm run db:history
npm run check:generated
```

The live SQL inspection used `psql` inside the local PostgreSQL container with
the container-provided database user and database name. Credentials were not
printed or copied into this document.
