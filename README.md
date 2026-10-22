# User Management Monorepo

This repository contains the complete user-management system in one Nx-based
polyglot monorepo:

- React + TypeScript + Vite frontend
- Python + FastAPI backend
- PostgreSQL persistence
- Redis-backed rate limiting
- OpenAPI-driven frontend API types

Nx coordinates the applications and developer commands. The frontend keeps its
Node dependencies in `apps/frontend/package.json`; the backend keeps its Python
dependencies in `apps/backend/pyproject.toml` and is managed with `uv`.

## Architecture

```text
Browser
  │
  ▼
apps/frontend  ── credentialed HTTP ──►  apps/backend
 React/Vite                              FastAPI
                                             │
                              ┌──────────────┴──────────────┐
                              ▼                             ▼
                         PostgreSQL                      Redis
                       users/sessions              shared rate limits
```

The backend is a modular monolith with API routers, services, SQLAlchemy
models, and shared security/infrastructure code. The frontend is a component-
based React application with typed API clients, Redux state, protected routes,
and Material UI.

## Repository layout

```text
user-management/
├── apps/
│   ├── frontend/              # React, TypeScript, Vite, Redux, Playwright
│   └── backend/               # FastAPI, SQLAlchemy, Alembic, pytest
├── docs/
│   └── api/openapi.yaml       # API contract used to generate frontend types
├── infra/                     # Reserved for deployment/infrastructure assets
├── scripts/                   # Reserved for root automation scripts
├── nx.json                    # Nx targets, caching, and workspace defaults
├── package.json               # Root commands and frontend workspace
├── package-lock.json          # Root Node dependency lockfile
└── README.md
```

## Prerequisites

Install the following tools:

- Node.js 20.19 or newer
- npm
- Python 3.12
- `uv`
- Docker Engine
- Docker Compose
- PostgreSQL client tools such as `pg_isready`

Verify them:

```bash
node --version
npm --version
python --version
uv --version
docker --version
docker compose version
```

## First-time setup

Run these commands from the monorepo root:

```bash
cd /home/dhaval-tank/Project/user-management/user-management
npm install
uv sync --project apps/backend --dev
```

Create the application environment files:

```bash
cp apps/frontend/.env.example apps/frontend/.env
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` and set local values for:

```dotenv
POSTGRES_PASSWORD=<choose-a-local-database-password>
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=<choose-a-long-local-admin-password>
```

The backend `.env` is ignored by Git. Never commit it or place real
credentials in `.env.example`.

The frontend environment should point to the local API:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
```

## Start the system locally

### 1. Start PostgreSQL and Redis

```bash
npm run infra:up
```

Check service health:

```bash
docker compose \
  --env-file apps/backend/.env \
  -f apps/backend/docker-compose.yml ps
```

### 2. Apply database migrations

```bash
npm run db:migrate
```

Confirm the current migration:

```bash
npm run db:current
```

### 3. Start frontend and backend

Start both applications through Nx:

```bash
npm run dev:all
```

Or run them separately in different terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Local URLs:

- Frontend: http://127.0.0.1:3001
- Backend: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

The first backend startup creates the configured bootstrap administrator when
that email does not already exist. Bootstrap is idempotent and does not reset
an existing administrator password.

## Daily development commands

Run commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev:all` | Start frontend and backend together |
| `npm run dev:frontend` | Start Vite on port 3001 |
| `npm run dev:backend` | Start FastAPI on port 8000 |
| `npm run infra:up` | Start PostgreSQL and Redis |
| `npm run infra:down` | Stop and remove infrastructure containers |
| `npm run infra:logs` | Follow PostgreSQL and Redis logs |
| `npm run db:migrate` | Apply Alembic migrations |
| `npm run db:current` | Show the current database revision |
| `npm run db:history` | Show migration history |
| `npm run graph` | Open the Nx project graph |
| `npm run reset:nx` | Clear Nx cache and workspace state |

## Frontend commands

The frontend is an Nx project backed by its own Vite scripts:

```bash
npm run build:frontend
npm run typecheck
npm run test:frontend
npm run lint:frontend
npm run test:e2e
```

E2E tests expect the backend and frontend to already be running. In a separate
terminal, use `npm run dev:all` before running this command. Playwright defaults
to the monorepo frontend port, 3001; override `FRONTEND_URL` and `API_URL` when
testing another environment.

Generate TypeScript API types from the checked-in OpenAPI contract:

```bash
npm run generate:api-types
```

The generated file is `apps/frontend/src/generated/api-types.ts`. Update the
backend contract first, regenerate the types, then run the frontend typecheck.

Check both generated API artifacts:

```bash
npm run check:generated
```

## Backend commands

The backend is an Nx project whose targets delegate to `uv`, Alembic, Ruff,
and pytest:

```bash
npm run backend:install
npm run test:backend
npm run lint:backend
npm run db:migrate
```

The equivalent direct commands are:

```bash
cd apps/backend
uv sync --dev
uv run alembic upgrade head
REDIS_URL= uv run pytest -q
uv run ruff check app tests alembic
```

The empty `REDIS_URL` override keeps the default foundation tests on the
in-memory limiter instead of sharing a local Redis client across test event
loops. Runtime development can still use Redis through `apps/backend/.env`.

## API and authentication

The backend exposes:

- `GET /health`
- `GET /ready`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/csrf`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{userId}`
- `PATCH /api/v1/users/{userId}`
- `DELETE /api/v1/users/{userId}`

Authentication uses an opaque HttpOnly session cookie. Unsafe requests require
the CSRF token returned by the login or CSRF endpoint. User mutations require
an administrator session, and deleted users are soft-deleted.

## Database and Docker lifecycle

Normal shutdown preserves the PostgreSQL volume:

```bash
npm run infra:down
```

To intentionally delete all local PostgreSQL data:

```bash
npm run infra:reset
npm run infra:up
npm run db:migrate
```

`infra:reset` is destructive for local database data. Use it only when a clean
database is intentional.

## Validation before committing

Run the complete local validation set:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run check:generated
```

For a focused backend validation:

```bash
npm run lint:backend
npm run test:backend
```

For a focused frontend validation:

```bash
npm run typecheck
npm run test:frontend
npm run build:frontend
```

## Troubleshooting

### Docker cannot read the environment file

Ensure the file exists:

```bash
test -f apps/backend/.env
```

If it does not, copy the template and fill in local values:

```bash
cp apps/backend/.env.example apps/backend/.env
```

### Alembic cannot connect

Check that PostgreSQL is running and that `DATABASE_URL` matches the
`POSTGRES_*` values in `apps/backend/.env`:

```bash
docker compose --env-file apps/backend/.env -f apps/backend/docker-compose.yml ps
npm run db:migrate
```

### Frontend reports `Failed to fetch`

Check that:

1. The backend is running on port 8000.
2. `apps/frontend/.env` contains the correct `VITE_API_URL`.
3. The frontend origin is listed in backend `FRONTEND_ORIGINS`.
4. The browser request is credentialed.
5. The backend was restarted after changing `.env`.

### Port already in use

```bash
ss -ltnp | grep -E ':3001|:8000|:5432|:6379'
```

Stop only a process you recognize, or change the local configuration
deliberately.

## Monorepo conventions

- Keep frontend-only code in `apps/frontend`.
- Keep Python backend code in `apps/backend`.
- Keep generated API types synchronized with `docs/api/openapi.yaml`.
- Do not add frontend dependencies to the backend or Python dependencies to npm.
- Keep secrets in ignored environment files or a deployment secret manager.
- Add shared libraries only when at least two applications genuinely reuse the
  same code.
- Use Nx targets for repeatable root workflows so local and CI commands match.
- Do not commit `node_modules`, `.venv`, build output, caches, or `.env` files.

## CI expectations

Pull requests should run at least:

1. Frontend typecheck, lint, unit tests, and build.
2. Backend Ruff checks and pytest.
3. Generated OpenAPI/type consistency checks.

The frontend and backend remain independently deployable even though they are
versioned in one repository.
