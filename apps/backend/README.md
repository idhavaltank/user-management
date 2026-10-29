# FlowSync CRM API

> This backend is part of the Nx monorepo. For complete local setup and
> frontend/backend orchestration, start with the repository-root README.

FastAPI backend for FlowSync. It provides authenticated CRM and user-management
APIs, PostgreSQL persistence, Redis-backed rate limiting, versioned Alembic
migrations, and an OpenAPI contract consumed by the TypeScript frontend.

## Responsibilities

- Expose health, readiness, authentication, organization, CRM, user-management,
  and operational endpoints.
- Validate request payloads and return consistent API error responses.
- Store users and browser sessions in PostgreSQL.
- Hash passwords before persistence; raw passwords are never stored.
- Authenticate browsers with an opaque HttpOnly session cookie.
- Protect unsafe requests with a rotated CSRF token.
- Restrict user mutations to administrators.
- Soft-delete user records instead of physically removing them.
- Apply request and login rate limits.
- Enforce organization membership and permission checks on tenant-scoped routes.
- Provide organization-scoped FlowSync accounts, contacts, deals, activities,
  and dashboard aggregates.
- Persist idempotent offline operations with cursor-based push/pull, tombstones,
  deterministic field clocks, conflict review, and record history.
- Provide bounded bulk/import/export job records, audit logs, notifications,
  invitations, teams, API-key management, and local MFA primitives.

## Request flow

```text
Browser frontend
    │ credentialed request
    ▼
FastAPI router
    │ validation and authorization
    ▼
Application service
    │ transaction boundary
    ▼
SQLAlchemy async session
    │ asyncpg
    ▼
PostgreSQL
```

Redis is used as the shared rate-limit store when REDIS_URL is configured.
Local development can use the in-memory limiter when Redis is intentionally
disabled.

## Repository layout

```text
backend/
├── app/
│   ├── api/             # FastAPI routers and endpoint contracts
│   ├── core/            # Settings, database, auth, delivery, security, middleware
│   ├── models/          # SQLAlchemy ORM models
│   ├── services/        # Business rules and transactions
│   └── generated/       # Generated Pydantic schemas; do not edit manually
├── alembic/
│   └── versions/        # Versioned database migrations
├── scripts/             # Contract and generated-file checks
├── tests/               # Unit and integration tests
├── .env.example         # Safe configuration template
├── docker-compose.yml   # Local PostgreSQL and Redis services
├── alembic.ini          # Alembic configuration
├── pyproject.toml       # Python dependencies and tool settings
└── uv.lock              # Reproducible Python dependency lockfile
```

## Prerequisites

Install:

- Python 3.12.x
- uv
- Docker Engine
- Docker Compose
- PostgreSQL client tools such as pg_isready

Verify the installation:

```bash
python --version
uv --version
docker --version
docker compose version
```

The project requires Python 3.12 and is intentionally bounded to Python
versions below 3.13 in pyproject.toml.

## Environment setup

Create the local environment file from the template:

```bash
cd apps/backend
cp .env.example .env
```

Set local database and administrator passwords before starting the API. Keep
both values only in the ignored `.env` file:

```dotenv
POSTGRES_PASSWORD=<choose-a-local-database-password>
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=<choose-a-long-local-password>
BOOTSTRAP_ADMIN_NAME=Administrator
```

The backend loads .env through the Pydantic Settings model in
app/core/config.py. Environment values override code defaults.

### Environment variables

| Variable                   | Role                                                      |
| -------------------------- | --------------------------------------------------------- |
| APP_NAME                   | API name shown in metadata and logs                       |
| ENVIRONMENT                | Runtime mode: local, test, staging, or production         |
| POSTGRES_DB                | Local Docker database name                                |
| POSTGRES_USER              | Local Docker database user                                |
| POSTGRES_PASSWORD          | Local Docker database password; never commit it          |
| DATABASE_URL               | Async SQLAlchemy PostgreSQL connection                    |
| FRONTEND_ORIGINS           | JSON list of credentialed browser origins allowed by CORS |
| TRUSTED_HOSTS              | Hosts accepted by TrustedHostMiddleware                   |
| TRUSTED_PROXY_IPS          | Proxies trusted to provide forwarded client IPs           |
| REQUEST_ID_HEADER          | Request-correlation header name                           |
| SESSION_COOKIE_NAME        | Browser session cookie name                               |
| SESSION_COOKIE_SECURE      | Must be true for production HTTPS                         |
| SESSION_COOKIE_SAME_SITE   | Cookie policy: lax, strict, or none                       |
| SESSION_TTL_SECONDS        | Session lifetime                                          |
| RATE_LIMIT_ENABLED         | Enable request limiting                                   |
| RATE_LIMIT_REQUESTS        | General request limit per window                          |
| RATE_LIMIT_WINDOW_SECONDS  | General limiter window                                    |
| RATE_LIMIT_LOGIN_REQUESTS  | Login attempt limit per window                            |
| REDIS_URL                  | Shared Redis limiter connection; optional locally         |
| BOOTSTRAP_ADMIN_EMAIL      | Email for optional first-admin provisioning               |
| BOOTSTRAP_ADMIN_PASSWORD   | Local first-admin password; never commit it               |
| BOOTSTRAP_ADMIN_NAME       | Display name for the bootstrap administrator              |
| BOOTSTRAP_ADMIN_BIRTH_DATE | Optional bootstrap administrator birth date               |
| MEDIA_STORAGE_PATH         | Local profile-image storage root                          |
| PROFILE_IMAGE_MAX_BYTES    | Maximum account/contact profile-image size                |

`ENVIRONMENT=local` selects the in-memory delivery sink for password-reset,
email-verification, and invitation tokens. Raw values are available only to
the local adapter object used by tests; they are not returned by API routes or
written to logs. Staging/production startup fails closed until an approved
provider-backed delivery adapter is supplied.

The .env file is ignored by apps/backend/.gitignore. Never commit passwords,
connection strings containing passwords, tokens, or production secrets.

### Local database connection

Docker Compose creates the local PostgreSQL service with these non-secret
connection attributes:

| Property | Local value                   |
| -------- | ----------------------------- |
| Host     | localhost                     |
| Port     | 5432                          |
| Database | user_management               |
| User     | Defined by docker-compose.yml |
| Driver   | postgresql+asyncpg            |

Keep DATABASE_URL and the Compose PostgreSQL settings in sync. The template
uses the POSTGRES_* variables to build DATABASE_URL; Docker Compose provides
the database service, while FastAPI resolves the same template before
connecting through DATABASE_URL. Pydantic does not expand dotenv references by
itself, so this resolution is handled by `app/core/config.py`.

## First-time local setup

Run these commands from the backend directory.

### 1. Install Python dependencies

```bash
cd apps/backend
uv sync --dev
```

The dev dependency group includes pytest, pytest-asyncio, httpx, and Ruff.

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
docker compose ps
```

Wait for PostgreSQL to become ready:

```bash
docker compose exec postgres pg_isready -U anthropic -d user_management
```

The default Compose user is `anthropic`; change the command only if you change
POSTGRES_USER in docker-compose.yml. The healthcheck in Compose also reports
when PostgreSQL is ready.

Inspect service logs when necessary:

```bash
docker compose logs -f postgres
docker compose logs -f redis
```

### 3. Apply the database schema

```bash
uv run alembic upgrade head
uv run alembic current
```

The migration chain currently ends at `20261023_0012`. It creates the users and
session foundation, lifecycle/token tables, organizations/roles/permissions,
teams, invitations, notifications/preferences, audit logs, API-key metadata,
durable jobs, import previews, FlowSync CRM tables, sync operation metadata, and
conflict records. It also adds account/contact profile-image metadata and
backfills the deterministic local organization and memberships for the existing
baseline users.

### Seed local load-test data

From the repository root, run:

```bash
SEED_USER_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')" \
  npm run db:seed-loadtest -- \
  --users 50 --accounts 1000 --contacts 1000 --deals 1000 --activities 1000
```

The seed script is intentionally limited to local development. It creates or
reuses the `local` organization, generates 50 deterministic test users, and
creates up to 2,000 accounts, contacts, deals, and activities per invocation.
It is safe to rerun with the same counts: records are identified by stable
`FlowSync Load Test` names and are not duplicated. The password must be at
least 12 characters. Set it only in the current shell or an ignored
`apps/backend/.env` entry named `SEED_USER_PASSWORD`; never commit it. Generated
emails use the `@loadtest.dev` domain so they satisfy the API's email contract
without representing real customer addresses.

When rerunning the command, the supplied password is applied to the generated
seed users. This lets a developer rotate the local test password deliberately
without exposing a generated credential.

Supported options:

| Option | Default | Range / purpose |
| --- | ---: | --- |
| `--organization-slug` | `local` | Target organization slug |
| `--users` | `50` | Generated test users, 1–2,000 |
| `--accounts` | `1000` | Accounts, 1–2,000 |
| `--contacts` | `1000` | Contacts, 1–2,000 |
| `--deals` | `1000` | Deals, 1–2,000 |
| `--activities` | `1000` | Activities, 1–2,000 |
| `--records-per-user` | unset | Bulk mode: 1–100,000 per entity per user |
| `--user-batch-size` | `10` | Bulk transaction size, 1–100 users |

The seeded dataset is suitable for browser pagination/search checks and local
API profiling. It is not a production-capacity benchmark. The script does not
upload binary images automatically; use the CRM detail-page upload flow to
exercise real multipart image requests.

For a large per-user dataset, use PostgreSQL bulk mode:

```bash
SEED_USER_PASSWORD="<your-local-password>" \
  npm run db:seed-loadtest -- \
  --users 1000 --records-per-user 10000 --user-batch-size 10
```

This creates 10,000 accounts, 10,000 contacts, 10,000 deals, and 10,000
activities for every generated user: 40 million records in total. Bulk mode
uses deterministic UUIDs, server-side `generate_series`, and a committed
transaction per user batch. Rerunning the same command is safe and resumes
without duplicate bulk rows. `--records-per-user` accepts 1–100,000, but the
required disk space grows linearly and should be checked before increasing it.

### 4. Start FastAPI

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API is available at http://127.0.0.1:8000.

Verify both health endpoints:

```bash
curl -i http://127.0.0.1:8000/health
curl -i http://127.0.0.1:8000/ready
```

The health endpoint checks that the process is alive. The readiness endpoint
also checks required dependencies such as PostgreSQL.

Interactive API documentation:

- http://127.0.0.1:8000/docs
- http://127.0.0.1:8000/redoc
- http://127.0.0.1:8000/openapi.json

### 5. Bootstrap the first administrator

When BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are set, startup
creates the administrator if that email does not already exist. The operation
is idempotent and does not overwrite an existing account or password.

If the administrator already exists with a different password, changing .env
does not reset it. Use the approved account-management process or reset the
disposable local database.

## API endpoints

All user endpoints require an authenticated administrator. POST, PATCH, and
DELETE operations additionally require the CSRF header issued for the current
session.

| Method | Endpoint               | Purpose                        | Protection     |
| ------ | ---------------------- | ------------------------------ | -------------- |
| GET    | /health                | Process health                 | Public         |
| GET    | /ready                 | Dependency readiness           | Public         |
| POST   | /api/v1/auth/login     | Create browser session         | Rate limited   |
| POST   | /api/v1/auth/logout    | Revoke current session         | Session + CSRF |
| GET    | /api/v1/auth/me        | Return current user            | Session        |
| GET    | /api/v1/auth/csrf      | Issue/rotate CSRF token        | Session        |
| GET    | /api/v1/organizations | Active organizations           | Session        |
| GET    | /api/v1/organizations/{organizationId}/users | Tenant user list | Membership + permission |
| POST   | /api/v1/organizations/{organizationId}/users | Create pending member | Permission + CSRF |
| PATCH  | /api/v1/organizations/{organizationId}/users/{userId} | Update profile | Permission + CSRF |
| DELETE | /api/v1/organizations/{organizationId}/users/{userId} | Soft-delete member | Permission + CSRF |
| PATCH  | /api/v1/organizations/{organizationId}/users/{userId}/status | Lifecycle transition | Permission + CSRF |
| POST   | /api/v1/organizations/{organizationId}/users/import/preview | Validate CSV | Permission + CSRF |
| POST   | /api/v1/organizations/{organizationId}/users/import/commit | Commit preview | Permission + CSRF |
| GET    | /api/v1/organizations/{organizationId}/dashboard | Dashboard counts | Membership + permission |
| GET    | /api/v1/organizations/{organizationId}/crm/dashboard | FlowSync CRM metrics and pipeline | CRM read permission |
| GET/POST | /api/v1/organizations/{organizationId}/accounts | Account list/create | CRM read/write + CSRF for create |
| GET/PATCH/DELETE | /api/v1/organizations/{organizationId}/accounts/{accountId} | Account detail and CRUD | CRM permission + CSRF for mutations |
| GET/POST | /api/v1/organizations/{organizationId}/contacts | Contact list/create | CRM read/write + CSRF for create |
| GET/PATCH/DELETE | /api/v1/organizations/{organizationId}/contacts/{contactId} | Contact detail and CRUD | CRM permission + CSRF for mutations |
| GET/POST | /api/v1/organizations/{organizationId}/deals | Deal list/create | CRM read/write + CSRF for create |
| GET/PATCH/DELETE | /api/v1/organizations/{organizationId}/deals/{dealId} | Deal detail and CRUD | CRM permission + CSRF for mutations |
| GET/POST | /api/v1/organizations/{organizationId}/activities | Activity list/create | CRM read/write + CSRF for create |
| GET/PATCH/DELETE | /api/v1/organizations/{organizationId}/activities/{activityId} | Activity detail and CRUD | CRM permission + CSRF for mutations |
| POST/GET/DELETE | /api/v1/organizations/{organizationId}/accounts/{accountId}/profile-image | Account profile image upload, retrieval, and removal | CRM read/write + CSRF for mutations |
| POST/GET/DELETE | /api/v1/organizations/{organizationId}/contacts/{contactId}/profile-image | Contact profile image upload, retrieval, and removal | CRM read/write + CSRF for mutations |
| POST | /api/v1/organizations/{organizationId}/sync/push | Idempotent offline operation batch | CRM write + CSRF |
| GET | /api/v1/organizations/{organizationId}/sync/pull | Cursor-based accepted operation feed | CRM read |
| GET | /api/v1/organizations/{organizationId}/sync/status | Latest organization cursor | CRM read |
| GET | /api/v1/organizations/{organizationId}/sync/conflicts | Open/resolved conflict queue | CRM read |
| POST | /api/v1/organizations/{organizationId}/sync/conflicts/{conflictId}/resolve | Resolve via a new sync operation | CRM write + CSRF |
| GET | /api/v1/organizations/{organizationId}/sync/history/{entity}/{entityId} | Record operation history | CRM read |
| GET    | /api/v1/organizations/{organizationId}/audit-logs | Paginated audit events | Audit permission |
| GET    | /api/v1/organizations/{organizationId}/jobs | Paginated job history | Membership + permission |
| GET    | /api/v1/organizations/{organizationId}/jobs/{jobId} | Job status | Membership + permission |
| GET/PATCH | /api/v1/organizations/{organizationId}/notifications/preferences | Notification settings | Membership |
| POST   | /api/v1/organizations/{organizationId}/api-keys | Create scoped key | Settings + CSRF |
| POST   | /api/v1/auth/mfa/enroll | Begin local TOTP enrollment | Session + CSRF |

The original `/api/v1/users` CRUD routes remain available as a compatibility
adapter for older clients. New UI code should use organization-scoped routes.

### Profile-image storage behavior

Account and contact profile images are validated by content signature and
declared MIME type, not by filename alone. JPEG, PNG, and WebP are accepted up
to `PROFILE_IMAGE_MAX_BYTES` (5 MB by default). The local storage adapter writes
files atomically below `MEDIA_STORAGE_PATH`, while PostgreSQL stores the key,
MIME type, byte size, and SHA-256 checksum. The API returns a relative
`profileImageUrl` in the CRM record and serves the binary only after the same
organization permission check.

This first implementation is online-only by design: image bytes are not sent
through the IndexedDB operation outbox. Offline CRM records continue to work,
and a profile-image action can be retried after connectivity returns. A future
object-storage adapter can implement the same service boundary without
changing the CRM API contract.

List controls supported by GET /api/v1/users include page, pageSize, search,
sort, and order. The supported sort fields are name, email, birthDate,
createdAt, and updatedAt.

## Authentication model

1. The browser posts credentials to /api/v1/auth/login.
2. FastAPI validates the password hash and sets an opaque HttpOnly session
   cookie.
3. The response supplies a CSRF token that the frontend keeps in memory.
4. The frontend sends X-CSRF-Token for unsafe methods.
5. FastAPI validates the session, expiry, revocation state, role, and CSRF
   token before mutations.
6. Logout revokes the server-side session and clears the browser cookie.

When no browser session cookie is present, organization read routes may accept
an `Authorization: Bearer umk_<prefix>_<secret>` API key if its stored scope
matches the requested permission. API keys cannot call login, logout, CSRF,
password/session management, or unsafe mutation routes.

Raw session tokens and CSRF tokens are not stored in PostgreSQL. Only hashes
and session metadata are persisted.

## Migration workflow

Run all Alembic commands from apps/backend/ with DATABASE_URL available.

### Inspect migration state

```bash
uv run alembic current
uv run alembic history
```

### Apply migrations

```bash
uv run alembic upgrade head
uv run alembic upgrade +1
```

### Create a migration

After changing SQLAlchemy models:

```bash
uv run alembic revision --autogenerate -m "describe the schema change"
uv run alembic upgrade head
```

Review every generated migration before applying it. Do not edit a migration
that has already been applied to a shared environment; create a new revision.

### Roll back a local migration

```bash
uv run alembic downgrade -1
```

Use downgrades only for disposable/local environments unless a backup and
rollback plan have been approved.

### Reset local PostgreSQL data

This permanently deletes the Docker PostgreSQL volume:

```bash
docker compose down -v
docker compose up -d postgres redis
uv run alembic upgrade head
```

Use this only when a clean local database is intentional.

## Verification and quality checks

Run the backend checks from apps/backend/:

```bash
uv run ruff check app tests alembic
# Keep foundation tests on the in-memory limiter. This prevents a developer's
# Redis client from being shared across TestClient event loops.
REDIS_URL= uv run pytest
uv run alembic current
```

The test suite is database-independent unless a test explicitly starts a real
integration environment. Keep `REDIS_URL` empty for the default unit and
foundation test run; configure Redis only when manually exercising the
Redis-backed runtime path.

Run the generated-contract check from the repository root:

```bash
./scripts/check_generated.sh
```

The generated Pydantic schemas in app/generated/ and the OpenAPI document are
contract artifacts. Update the source contract and regenerate them through the
documented workflow; do not hand-edit generated files.

## Docker lifecycle

Stop containers but preserve the PostgreSQL volume:

```bash
docker compose stop
```

Stop and remove containers while preserving the named volume:

```bash
docker compose down
```

Remove containers and all local PostgreSQL data:

```bash
docker compose down -v
```

The last command is destructive.

## Troubleshooting

### Alembic cannot connect to PostgreSQL

Check that the container is running and healthy:

```bash
docker compose ps
docker compose exec postgres pg_isready -U anthropic -d user_management
```

Then confirm DATABASE_URL points to localhost:5432 and that its database,
username, and password match docker-compose.yml.

### relation or table does not exist

Apply migrations:

```bash
uv run alembic upgrade head
```

### Frontend reports Failed to fetch

Check that:

1. FastAPI is running on port 8000.
2. The frontend VITE_API_URL points to the API.
3. The frontend origin is included in FRONTEND_ORIGINS.
4. The browser request includes credentials.
5. The backend was restarted after changing .env.

### Login fails

Check that:

1. PostgreSQL is ready.
2. The schema is migrated.
3. Bootstrap administrator variables are set before the first startup.
4. The login email matches the configured administrator.
5. The account was not previously created with another password.

### Port already in use

Inspect local listeners:

```bash
ss -ltnp | grep -E ':8000|:5432|:6379'
```

Stop only a process you recognize, or change the local configuration
deliberately.

### Redis connection errors

Inspect Redis:

```bash
docker compose ps redis
docker compose logs redis
```

For local development, Redis may be disabled by leaving REDIS_URL empty. When
rate limiting is enabled in staging or production, configure shared Redis.

## Production safety notes

- Use managed PostgreSQL and Redis rather than local Docker services.
- Inject secrets through a secret manager or deployment environment.
- Set ENVIRONMENT=production.
- Set SESSION_COOKIE_SECURE=true when serving over HTTPS.
- Use an approved administrator provisioning workflow instead of bootstrap
  credentials.
- Configure REDIS_URL for multi-instance rate limiting.
- Restrict FRONTEND_ORIGINS and TRUSTED_HOSTS to real deployment values.
- Do not run database downgrades without backups and release review.
- Never commit .env files or credentials.
