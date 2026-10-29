# FlowSync CRM Product Documentation

**Document status:** Current local implementation reference  
**Product:** FlowSync CRM  
**Repository:** user-management Nx polyglot monorepo  
**Audience:** Product owners, developers, QA, support, and local operators  
**Last reviewed:** 2026-10-23

## 1. Product overview

FlowSync is an organization-scoped customer relationship management product
for managing accounts, contacts, deals, activities, users, permissions, and
administrative operations from a browser. It supports normal online work and
continues to provide a local CRM workspace when the browser temporarily loses
network connectivity.

The product has two complementary responsibilities:

1. **CRM work:** users view, create, edit, search, and organize business
   records.
2. **Reliable workspace operation:** the system protects tenant boundaries,
   records local offline changes, synchronizes them through an explicit
   operation log, and exposes conflicts instead of silently hiding them.

PostgreSQL is the durable server source of truth. IndexedDB is the current
browser cache and outbox adapter. FastAPI owns authentication, authorization,
validation, persistence, synchronization, and administrative workflows.

## 2. Current scope at a glance

| Area | Current state |
| --- | --- |
| Browser application | React, TypeScript, Vite, Material UI, Redux, protected routes |
| Backend | Python 3.12, FastAPI, SQLAlchemy async, Alembic, Pydantic |
| Database | PostgreSQL with organization-scoped relational models and migrations |
| Rate limiting | In-memory locally; Redis-backed configuration supported for shared environments |
| Authentication | Argon2 password hashing, opaque HttpOnly session cookie, CSRF token, session management |
| CRM | Accounts, contacts, deals, activities, dashboard, search, detail views, pipeline |
| Offline | IndexedDB cache, atomic local writes, outbox, reconnect push/pull, HLC ordering |
| Conflicts | Durable conflict queue, history, mine/theirs/custom resolution |
| Administration | Settings, roles, permissions, teams, invitations, audit, API keys, data jobs |
| User management | Organization-scoped CRUD, lifecycle actions, CSV import/export, localStorage migration |
| Notifications/security | Preferences, password change/recovery, sessions, MFA/TOTP API support |
| Verification | Frontend unit/type/build checks, backend tests, isolated API/browser/integration proof |

This document describes the current repository behavior. It does not claim
that every future roadmap item is production-ready.

## 3. Users and product roles

### Administrator

An administrator manages the organization, users, roles, teams, invitations,
API keys, data operations, audit history, and security settings. Administrator
access is enforced by the backend; hiding a menu item is not the security
boundary.

### Workspace member

A member uses the CRM according to organization permissions. The member can
work with the records and actions allowed by the assigned role and team policy.

### Offline field user

An offline field user loads organization data while connected, continues
working against the local cache during a network interruption, and allows the
sync engine to upload changes after reconnecting.

### Operator or developer

An operator starts Docker infrastructure, applies migrations, runs the API and
frontend, reads diagnostics, and validates health, sync, and database state.

## 4. Architecture

~~~text
                         credentialed HTTP
Browser UI ───────────────────────────────────────► FastAPI API
   │                                                   │
   │ React + MUI + Redux                               │ services
   │ typed API clients                                 │ authorization
   │                                                   │ validation
   │                                                   ▼
   │                                            PostgreSQL
   │                                             durable data
   │
   ├── CRM repository ──► IndexedDB records
   │                         + atomic outbox
   │                                  │
   └── sync engine ◄── push/pull ◄────┘
         HLC ordering, cursor, retry,
         leader tab, conflicts, history

                         optional shared limits
                              └────────► Redis
~~~

The backend is a modular monolith. It is split by responsibility into API
routers, services, SQLAlchemy models, generated schemas, and shared security
and infrastructure code. The frontend is a component-based React application
with typed API clients and replaceable browser-storage adapters.

### Source-of-truth rules

| Data | Authoritative location | Browser behavior |
| --- | --- | --- |
| Users, organizations, permissions | PostgreSQL/API | Read through API; user mutations require authorization |
| CRM records while online | PostgreSQL/API | API response updates local cache |
| CRM records while offline | IndexedDB cache | Writes are optimistic and produce outbox operations |
| Pending offline mutations | IndexedDB outbox | Retained until acknowledged or explicitly rejected |
| Sync order | Backend operation sequence plus client HLC | Cursor and HLC prevent ambiguous replay |
| Conflict decisions | PostgreSQL conflict records and resolution operation | Reviewed in the Conflicts module |
| Session credential | HttpOnly browser cookie | Raw session token is not placed in application storage |
| CSRF credential | Frontend memory | Sent on unsafe browser requests; rotated by the API |

## 5. Domain model

### Organization and identity

- **Organization:** tenant boundary for CRM data and membership.
- **User:** person who can authenticate and belong to one or more organizations.
- **Role:** named permission bundle, including system roles and custom roles.
- **Team:** organization group used for administration and ownership workflows.
- **Invitation:** pending request for a person to join an organization.
- **Session:** server-side browser session represented by an opaque cookie.

### CRM entities

| Entity | Purpose | Main relationships | Important states |
| --- | --- | --- | --- |
| Account | Company or customer organization | Owns contacts, deals, activities | prospect, customer, inactive |
| Contact | Person connected to an account | Belongs optionally to an account; may relate to deals/activities | lead, active, inactive |
| Deal | Revenue opportunity | May link account, contact, and owner | lead, qualified, proposal, negotiation, won, lost |
| Activity | Call, email, meeting, task, or note | May link account, contact, deal, and owner | Kind: call, email, meeting, task, note; status: planned, completed, cancelled |

### Record conventions

- IDs are UUIDs.
- Records are organization-scoped.
- Deletes are soft deletes through tombstone timestamps.
- Names and required fields are validated at the API boundary.
- Related record references must belong to the same organization.
- Owners must be active organization members.
- Dates and timestamps are represented through the generated API contract.

## 6. Application modules

| Module | Frontend entry point | Backend responsibility |
| --- | --- | --- |
| Authentication | /login, auth API client, protected route | Login, logout, current user, CSRF, password and recovery flows |
| Dashboard | /dashboard | CRM aggregate metrics and pipeline summary |
| Accounts | /accounts, /accounts/:id | Account CRUD, filtering, ownership, status |
| Contacts | /contacts, /contacts/:id | Contact CRUD and account relationships |
| Deals | /deals, /deals/:id | Deal CRUD, stage, amount, expected close date |
| Pipeline | /deals/pipeline | Stage-oriented deal visualization and movement workflow |
| Activities | /activities and detail timelines | Activity planning, completion, cancellation, related record timeline |
| Search | Global search dialog, Ctrl+K | Organization-scoped account/contact/deal search |
| Offline and sync | Online/offline chip, diagnostics, /conflicts | Cache, outbox, push/pull, retry, cursor, HLC, conflict queue |
| Users | /user | User list, pagination, CRUD, lifecycle, CSV migration |
| Administration | /admin | Settings, roles, teams, invitations, audit, keys, jobs |
| Security | /security | Password change and session revocation |
| Notifications | /notifications | Email and in-app preference management |
| Theme and layout | Dashboard layout and theme | FlowSync/Hearth tokens, responsive navigation, status indicators |

### UI and UX rules

- Protected routes are behind the authenticated dashboard layout.
- Navigation groups CRM work separately from administration and security.
- The top bar keeps connectivity and synchronization visible while the user
  changes screens.
- Forms use typed API contracts and show server validation failures near the
  relevant action.
- Detail pages connect records to related activities so users do not have to
  reconstruct a customer timeline from separate lists.
- Offline writes are optimistic but visibly pending; the interface must not
  present an unacknowledged mutation as permanently synchronized.
- Conflict decisions are explicit and user-driven.
- Destructive or security-sensitive actions use confirmation and clear status
  feedback.

## 7. Main data flows

### 7.1 Online read

1. The protected route checks the current authenticated user.
2. The frontend calls a typed API client with credentialed HTTP.
3. FastAPI resolves the session or scoped API key.
4. The organization permission dependency verifies tenant membership and the
   required permission.
5. The service queries PostgreSQL, excluding deleted records unless an
   administrative endpoint specifically needs lifecycle data.
6. The frontend renders the response and may cache CRM records locally.

### 7.2 Online write

1. The user submits a validated form.
2. The frontend sends the request with the current CSRF token.
3. FastAPI validates fields, organization references, and permissions.
4. The service commits the change to PostgreSQL.
5. The frontend refreshes the relevant query/cache and shows the result.

### 7.3 Offline CRM write

1. The browser detects that the API is unavailable or the user selects offline
   work through the browser network state.
2. The repository writes the record and outbox entry in one IndexedDB
   transaction.
3. The UI updates optimistically from the local record.
4. The sync indicator reports a pending operation.
5. The sync engine waits for reconnect or its scheduled retry.
6. The operation is pushed with organization, entity, operation ID, device ID,
   HLC, schema version, and changed fields.
7. The server acknowledges or rejects each operation independently.
8. Rejected operations remain inspectable; accepted changes are pulled back
   through the cursor stream.

### 7.4 Reconnect and pull

~~~text
pending outbox
   │ batch max 500
   ▼
POST /sync/push ──► per-operation accepted/rejected acknowledgements
   │
   ▼
GET /sync/pull?cursor=N ──► ordered remote operations
   │
   ▼
apply to local record + advance cursor
   │
   ▼
synced or conflict-review state
~~~

The engine retains failed outbox entries, retries with backoff, and uses a
single leader tab when browser coordination primitives are available. A
BroadcastChannel communicates status to other tabs.

### 7.5 Conflict handling

1. The server compares field-level HLC values when an operation arrives.
2. Fields that can be automatically ordered are applied deterministically.
3. Review-required changes create a durable conflict record.
4. The Conflicts page displays local value, remote value, entity, field, and
   history context.
5. A user chooses Mine, Theirs, or Custom.
6. The resolution is written as a normal sync upsert and the conflict is
   marked resolved with an audit note.

The current conflict policy is documented in
[docs/conflict-policy.md](../conflict-policy.md).

## 8. Authentication and security

### Browser session flow

1. POST /api/v1/auth/login validates the normalized email and password.
2. Passwords are verified with Argon2; failed attempts can lock an account.
3. The server creates a database-backed session and returns an opaque session
   cookie plus a CSRF token.
4. The cookie is HttpOnly and is not readable by frontend JavaScript.
5. Unsafe requests send X-CSRF-Token from frontend memory.
6. GET /api/v1/auth/me resolves the current identity on page load.
7. Logout revokes the current session and removes the browser cookie.

PostgreSQL stores hashes of session and CSRF values, not their raw values.
Production requires secure-cookie settings and a provider-backed delivery
adapter for reset, verification, and invitation tokens.

### Authorization boundaries

- Authentication answers “who is this?”
- Organization authorization answers “which tenant and permission apply?”
- Administrator checks protect administrative operations.
- API keys are scoped bearer credentials for permitted organization routes.
- Browser-only identity/session endpoints reject API-key credentials.
- CORS and trusted-host settings are environment-controlled.
- Request IDs and structured events support diagnosis without logging secrets
  or CRM payload values.

## 9. API surface

The checked-in OpenAPI contract is the source for generated frontend types.
The main route groups are:

| Route group | Examples | Purpose |
| --- | --- | --- |
| Health | GET /health, GET /ready | Process and dependency readiness |
| Auth | /api/v1/auth/* | Login, logout, identity, CSRF, password, sessions, verification |
| Organizations | /api/v1/organizations | Organization list, settings, members, permissions |
| CRM | /api/v1/organizations/{organizationId}/accounts, contacts, deals, activities | Organization-scoped CRM CRUD and dashboard |
| Sync | /api/v1/organizations/{organizationId}/sync/push, pull, status | Offline operation exchange |
| Conflicts | /sync/conflicts, /sync/conflicts/{conflictId}/resolve, /sync/history/... | Review and resolve synchronization conflicts |
| Users | /api/v1/organizations/{organizationId}/users | Canonical user CRUD and lifecycle |
| Administration | roles, teams, invitations, audit, API keys, settings, jobs | Organization governance and data operations |
| Compatibility | /api/v1/users | Legacy user CRUD adapter for older clients |

### CRM CRUD pattern

For each CRM collection, the API follows the same organization-scoped pattern:

| Method | Path pattern | Purpose |
| --- | --- | --- |
| GET | /api/v1/organizations/{organizationId}/{entity} | Paginated list with search and entity filters |
| POST | /api/v1/organizations/{organizationId}/{entity} | Create an entity with crm.write permission and CSRF |
| GET | /api/v1/organizations/{organizationId}/{entity}/{entityId} | Read one entity |
| PATCH | /api/v1/organizations/{organizationId}/{entity}/{entityId} | Update selected fields |
| DELETE | /api/v1/organizations/{organizationId}/{entity}/{entityId} | Soft-delete an entity |

The entity value is accounts, contacts, deals, or activities. The dashboard
uses GET /api/v1/organizations/{organizationId}/crm/dashboard.

### Sync contract limits

- Push accepts at most 500 operations per request.
- Pull accepts a limit from 1 to 500 and returns operations after a cursor.
- Every operation includes an operation ID, device ID, entity, entity ID, kind,
  HLC, and schema version.
- A push response acknowledges each operation independently.
- Duplicate operation replay is idempotent.

## 10. Integration points

| Integration | Boundary | Current behavior |
| --- | --- | --- |
| Browser to API | Credentialed HTTP, CORS, CSRF | Typed frontend clients call FastAPI routes |
| Frontend to storage | Storage adapter port | IndexedDB is preferred; memory adapter supports tests/fallback |
| API to database | Async SQLAlchemy and Alembic | PostgreSQL stores durable tenant, CRM, auth, and sync state |
| API to rate limiter | Configured Redis URL | Local mode can use an in-memory limiter; shared environments need Redis |
| API to delivery | DeliveryAdapter | Local/test token delivery is in-memory; non-local provider is required |
| API contract to frontend | OpenAPI and generated TypeScript | Backend contract changes are followed by type regeneration |
| Future mobile client | Versioned sync endpoints | Mobile is a future client, not part of the current web release |

## 11. Persistence

### PostgreSQL responsibilities

PostgreSQL stores users, organizations, memberships, roles, teams,
invitations, sessions, tokens, CRM entities, audit records, API keys, jobs,
sync operations, record state, and conflicts. Alembic migrations are the
versioned schema change mechanism.

### Main server tables

| Table group | Tables |
| --- | --- |
| Identity and sessions | users, user_sessions, one_time_tokens |
| Tenant and access | organizations, permissions, organization_roles, role_permissions, organization_memberships |
| Organization operations | teams, organization_invitations, notifications, notification_preferences, organization_api_keys, audit_logs, organization_jobs, user_import_previews |
| CRM | crm_accounts, crm_contacts, crm_deals, crm_activities |
| Synchronization | sync_operations, sync_record_states, sync_conflicts |

Table names are implementation details for operators and migrations. Product
features should use API contracts and services rather than querying these
tables directly.

### Browser storage responsibilities

The IndexedDB adapter keeps organization-scoped local records and outbox
operations. The storage port permits a memory adapter for deterministic tests
and leaves room for a future SQLite WASM/OPFS adapter after benchmarking.

The browser clears active-organization local data on logout or organization
switch to avoid cross-tenant leakage. Persistent storage is requested when the
browser supports the Storage API, but the browser may deny the request.

## 12. Practical product scenarios

### Scenario A: Administrator signs in

The administrator opens /login, submits the email and password, receives a
session cookie and CSRF token, and is redirected to /dashboard. On a reload,
the frontend calls /auth/me; it does not read the session cookie directly.

### Scenario B: Member creates an account online

The member opens Accounts, submits company name and status, and receives a
server-created UUID. The API validates membership and crm.write, persists the
record, and the frontend refreshes the account list and local cache.

### Scenario C: Field user creates a contact offline

The user opens the CRM while connected, loses connectivity, creates the
contact, and continues seeing it in the local list. The record is marked as
pending. After reconnect, the operation is pushed and the pending indicator
clears after acknowledgement.

### Scenario D: Two devices edit the same deal

Each device submits a change with its own HLC. The server applies deterministic
fields and creates a review conflict for a field requiring human choice. A user
selects Mine, Theirs, or Custom; the choice becomes a new auditable operation.

### Scenario E: Administrator imports users

The administrator opens Administration → Data operations, selects a CSV, sees
accepted and rejected rows in preview, and commits accepted rows. The backend
creates a job record and the UI shows job progress/status rather than requiring
the browser to hold the whole import in memory.

### Scenario F: User changes security settings

The user changes a password from Security. The backend preserves only the
active session and makes other sessions invalid. The user can also list and
revoke individual sessions or all other sessions.

## 13. Edge cases and expected behavior

| Situation | Expected behavior |
| --- | --- |
| No session | API returns 401; frontend returns to login or shows authentication state |
| Expired/revoked session | API rejects it; browser must authenticate again |
| Missing/wrong CSRF | Unsafe request returns 403 csrf_failed |
| Wrong credentials | API returns a generic 401; account existence is not disclosed |
| Too many login attempts | Account can be temporarily locked and requests remain generic |
| Missing organization permission | API returns 403; frontend must not treat it as a network failure |
| Cross-organization relation | API validation rejects the reference |
| Duplicate sync operation | Operation ID makes replay idempotent |
| Mixed sync batch | Successful operations are acknowledged while rejected operations remain visible |
| Soft-deleted record | Normal lists exclude it; tombstone prevents an old change from silently resurrecting it |
| Offline cache unavailable | Memory fallback can keep the session usable, but durable offline guarantees are unavailable |
| Browser denies persistent storage | Diagnostics reports the capability; the app must not claim durable offline storage |
| Cursor recovery requirement | Current cursor pull is implemented; snapshot/cursor-expiry recovery remains a production hardening item |
| API key creation | Secret is shown once and must be copied immediately; only a hash is retained |
| Existing bootstrap admin | Startup is idempotent and does not reset an existing administrator password |
| Delivery provider unavailable | Non-local environments fail closed until a provider-backed adapter is configured |

## 14. Current limitations and deferred work

The following items are intentionally outside the verified current slice:

- SQLite WASM/OPFS adapter and benchmark-based adapter selection.
- Production-scale performance benchmark results and k6/load evidence.
- Full cursor-expiry snapshot recovery and automated local corruption repair.
- Device registration/revocation and stronger multi-device governance.
- Rich collaborative notes such as Yjs/CRDT editing.
- Advanced CRM features such as tags, custom fields, richer reporting, and
  attachment storage.
- Hosted production deployment, managed PostgreSQL/Redis, monitoring, and
  alerting.
- Public demo workspace and customer-data migration.
- Native mobile clients for iOS/Android.
- Complete dependency vulnerability remediation; audit findings require a
  separate compatibility-reviewed upgrade effort.

These are roadmap items, not hidden assumptions about the current release.

## 15. Local operation

From the monorepo root:

~~~bash
npm install
uv sync --project apps/backend --dev
cp apps/frontend/.env.example apps/frontend/.env
cp apps/backend/.env.example apps/backend/.env
npm run infra:up
npm run db:migrate
npm run dev:all
~~~

Local URLs:

- Frontend: http://127.0.0.1:3001
- API: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

Set a local POSTGRES_PASSWORD, BOOTSTRAP_ADMIN_EMAIL, and
BOOTSTRAP_ADMIN_PASSWORD in apps/backend/.env. Never put real credentials in
a committed document or .env.example.

Useful verification commands:

~~~bash
npm run validate:full
git diff --check
npm run test:e2e
~~~

See the root [README.md](../../README.md), backend
[README.md](../../apps/backend/README.md), and operations
[release checklist](../operations/flowsync-release-checklist.md) for complete
setup and handoff procedures.

## 16. Documentation map

- [Feature and module guide](../guides/flowsync-feature-and-module-guide.md)
- [Architecture guide](../architecture.md)
- [Offline foundation](../architecture/flowsync-offline-foundation.md)
- [Conflict policy](../conflict-policy.md)
- [Resilience runbook](../operations/flowsync-resilience-runbook.md)
- [Testing and proof matrix](../operations/flowsync-testing-and-proof-matrix.md)
- [Roadmap progress](../plans/user-management-full/flowsync-roadmap-progress.md)
- [API contract](../api/openapi.yaml)

## 17. Open questions for the next release

1. What production dataset size and offline retention window must be supported?
2. Which fields require human conflict review for each CRM entity?
3. What retention, export, and deletion policy applies to audit and sync data?
4. Which delivery provider will be approved for email and invitation tokens?
5. Should the next durable browser adapter be SQLite WASM/OPFS or remain
   IndexedDB after benchmark results?
6. Which mobile platform and authentication handoff should consume the same
   sync contract?

