# Offline/Online CRM Product Proposal

## Web-first product with future mobile offline and online support

**Document type:** Product and technical proposal  
**Status:** Proposed scope; not a claim that every capability is implemented  
**Repository:** `user-management/user-management`  
**Current baseline:** React/TypeScript/Vite frontend, FastAPI backend, PostgreSQL, Redis, Nx monorepo  
**Audience:** Product owners, engineering team, reviewers, and future mobile team  
**Last updated:** 2026-10-23

> This report is intentionally split into current verified capability, proposed web capability, and future mobile capability. A feature marked **Proposed** must not be presented as production-ready until its API, database path, UI path, security controls, and tests are complete.

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision and Scope](#2-product-vision-and-scope)
3. [Feature Coverage Summary](#3-feature-coverage-summary)
4. [Current Repository Baseline](#4-current-repository-baseline)
5. [Target Architecture](#5-target-architecture)
6. [Online Web Flow](#6-online-web-flow)
7. [Offline Web Flow](#7-offline-web-flow)
8. [Synchronization and Conflict Flow](#8-synchronization-and-conflict-flow)
9. [Future Mobile Flow](#9-future-mobile-flow)
10. [Domain and Data Model](#10-domain-and-data-model)
11. [Detailed Feature Proposal](#11-detailed-feature-proposal)
12. [Practical User Scenarios](#12-practical-user-scenarios)
13. [Edge Cases and Recovery](#13-edge-cases-and-recovery)
14. [UI/UX Proposal](#14-uiux-proposal)
15. [Security, Privacy, and Tenant Isolation](#15-security-privacy-and-tenant-isolation)
16. [Delivery Roadmap](#16-delivery-roadmap)
17. [Quality and Release Gates](#17-quality-and-release-gates)
18. [Limitations and Non-Goals](#18-limitations-and-non-goals)
19. [Open Product Decisions](#19-open-product-decisions)
20. [Conclusion](#20-conclusion)

---

## 1. Executive Summary

This proposal describes a web-first CRM that works in both online and offline
conditions. The web application remains useful when the network is unavailable,
stores a scoped local dataset, records local changes in an outbox, and safely
synchronizes those changes with the server when connectivity returns.

The existing user-management monorepo is a suitable foundation. The recommended
approach is to keep the current React/TypeScript frontend, FastAPI modular
backend, PostgreSQL database, Redis infrastructure, OpenAPI contract, and Nx
orchestration. CRM entities and offline synchronization should be added
incrementally instead of replacing the current backend or implementing the full
local-first system in one rewrite.

The product is divided into three delivery horizons:

1. **Current foundation:** secure user, organization, role, session, admin, and
   operational capabilities already present in the repository to different
   levels of local verification.
2. **Web CRM:** accounts, contacts, activities, deals, notes, search, imports,
   exports, offline local storage, synchronization, conflict handling, and
   administration.
3. **Future mobile:** native iOS/Android clients using the same contracts,
   synchronization semantics, authorization rules, and offline data model.

### 1.1 Proposed architecture at a glance

```text
                         ONLINE PATH
 ┌──────────────────┐   HTTPS + HttpOnly session   ┌──────────────────────┐
 │ React Web Client │ ────────────────────────────▶ │ FastAPI API          │
 │ TypeScript       │                              │ Auth/RBAC/CRM/Sync   │
 └────────┬─────────┘                              └──────────┬───────────┘
          │                                                   │
          │ local reads/writes                                │ transactions
          ▼                                                   ▼
 ┌──────────────────┐   push/pull operations       ┌──────────────────────┐
 │ Local Data Layer │ ◀──────────────────────────▶ │ PostgreSQL           │
 │ Worker + adapter │                              │ system of record     │
 │ outbox + cursor  │                              └──────────┬───────────┘
 └────────┬─────────┘                                         │
          │                                                     │ events/cache/jobs
          ▼                                                     ▼
 ┌──────────────────┐                              ┌──────────────────────┐
 │ Other browser    │ ◀── BroadcastChannel/Locks ─ │ Redis + workers       │
 │ tabs              │                              │ rate limits/fan-out  │
 └──────────────────┘                              └──────────────────────┘

                         FUTURE MOBILE PATH
 ┌──────────────────┐         same API and sync protocol
 │ iOS/Android App  │ ────────────────────────────────────────────────┐
 │ native storage   │                                                   │
 └──────────────────┘                                                   ▼
                                                       ┌──────────────────┐
                                                       │ FastAPI/Postgres │
                                                       └──────────────────┘
```

### 1.2 Core design principles

1. **Server-authoritative security:** Authentication, authorization, tenancy,
   and audit decisions are always enforced by the backend.
2. **Offline-capable, not offline-trusting:** Local data enables continuity,
   but local state never grants permissions or bypasses server policy.
3. **One product, multiple clients:** Web and mobile use the same domain
   vocabulary, OpenAPI contract, operation semantics, and authorization rules.
4. **Incremental delivery:** Each phase produces a usable and testable product
   slice before the next complexity layer is added.
5. **Deterministic synchronization:** Replayed, duplicated, delayed, or
   reordered operations must produce a predictable result.
6. **Explicit conflict handling:** High-risk business conflicts are shown to a
   user instead of being silently overwritten.
7. **Observable behavior:** Online, offline, pending, rejected, and conflicting
   states are visible to users and operators.
8. **Evidence before release:** Performance, accessibility, security,
   convergence, and recovery claims require repeatable proof.

---

## 2. Product Vision and Scope

### 2.1 Product statement

The product is a secure, multi-tenant CRM for managing organizations, accounts,
contacts, relationships, activities, deals, notes, and operational workflows.
Users can work online for real-time server interaction or continue working
offline with a scoped local dataset. Once connectivity returns, the system
reconciles local changes, reports conflicts, and preserves a recoverable history.

### 2.2 Primary personas

| Persona | Main needs | Main surfaces |
| --- | --- | --- |
| Organization owner | Configure organization, members, roles, security, and data policy | Admin, security, organization settings |
| Administrator | Manage users, teams, imports, exports, audit, and operational jobs | Admin console, user management, jobs |
| Sales/relationship user | Work with accounts, contacts, activities, and deals | CRM workspace, pipeline, timeline |
| Manager | Review team activity, pipeline, conflicts, and reports | Team views, dashboard, conflict queue |
| Mobile field user | Read and update assigned CRM records with intermittent connectivity | Future mobile app |
| Operator/developer | Run migrations, inspect health, monitor jobs, and recover services | Runbooks, metrics, logs, deployment tools |

### 2.3 Scope boundaries

#### Included in the web product

- Multi-tenant identity and organization management
- User and membership administration
- CRM accounts, contacts, activities, deals, notes, tags, and relationships
- Online CRUD and search
- Offline local cache and offline mutations
- Push/pull synchronization and conflict handling
- Import/export and bounded background jobs
- Auditability, notifications, security, accessibility, and observability

#### Planned for the future mobile product

- Native or cross-platform mobile client
- Offline assigned-record access
- Offline create/update workflows
- Mobile synchronization and conflict review
- Mobile authentication, device registration, and push notifications
- Native storage adapter without changing server semantics

#### Explicitly outside the first product horizon

- Billing and subscriptions
- Payment processing
- Full email marketing automation
- Multi-region active-active deployment
- Custom CRDT implementation for every entity
- AI features
- Full accounting, ERP, or inventory management

---

## 3. Feature Coverage Summary

The counts below are proposal-scope counts. They are not a statement that all
items are already implemented.

### 3.1 Coverage totals

| Scope | Domains | Feature capabilities | Status |
| --- | ---: | ---: | --- |
| Current user-management foundation | 12 implementation areas | 26 mapped capability rows | Locally implemented to different levels; gaps remain |
| Proposed web CRM | 12 domains | 94 feature capabilities | Product proposal |
| Future mobile application | 4 domains | 21 feature capabilities | Future scope |
| **Total product proposal** | **16 domains** | **115 capabilities** | **Web first, mobile later** |

The current foundation count is derived from the repository’s gap matrix and
implementation evidence. The web and mobile counts are the controlled scope of
this proposal and should become the product backlog baseline.

### 3.2 Proposed web domains

| # | Domain | Count | Summary |
| ---: | --- | ---: | --- |
| 1 | Identity and access | 8 | Login, sessions, passwords, verification, lockout, MFA, SSO |
| 2 | Organizations and authorization | 7 | Workspaces, memberships, roles, teams, invitations, API keys |
| 3 | Accounts and contacts | 8 | Company/contact records, lifecycle, relationships, custom data |
| 4 | Deals and pipeline | 8 | Stages, ownership, amount, board, transitions, outcomes |
| 5 | Activities and collaboration | 8 | Tasks, calls, meetings, timeline, notes, tags, reminders |
| 6 | Search and workspace views | 6 | Search, filters, sort, pagination, saved views, virtualization |
| 7 | Offline web data layer | 10 | Local database, worker, fallback, outbox, local search, quota |
| 8 | Synchronization and conflicts | 10 | Push/pull, cursors, idempotency, retries, merge, conflicts |
| 9 | Data operations | 7 | Import, export, bulk actions, previews, jobs, partial results |
| 10 | Notifications and integrations | 6 | In-app, email adapter, preferences, retries, audit, adapters |
| 11 | Administration and operations | 8 | Dashboard, settings, sessions, jobs, metrics, backups, recovery |
| 12 | UX, accessibility, and quality | 8 | Responsive UI, accessibility, states, performance, E2E, docs |
|  | **Total** | **94** |  |

### 3.3 Future mobile domains

| # | Domain | Count | Summary |
| ---: | --- | ---: | --- |
| 1 | Mobile foundation | 5 | App shell, authentication, navigation, device registration, secure storage |
| 2 | Mobile offline data | 5 | Scoped cache, offline CRUD, outbox, quota, local search |
| 3 | Mobile synchronization | 5 | Push/pull, retry, conflict review, background sync, cursor recovery |
| 4 | Mobile UX and security | 6 | Push notifications, biometrics, deep links, accessibility, telemetry, updates |
|  | **Total** | **21** |  |

---

## 4. Current Repository Baseline

This section records what is present in the current checkout, based on the
repository README, gap matrix, implementation evidence, backend entrypoints,
and frontend pages.

### 4.1 Verified current architecture

```text
apps/frontend
  React + TypeScript + Vite + Redux + Material UI + Playwright

apps/backend
  FastAPI + SQLAlchemy async + Alembic + pytest

Infrastructure
  PostgreSQL as data store
  Redis for shared infrastructure boundaries
  Docker Compose for local services

Contract
  docs/api/openapi.yaml
  generated TypeScript and Python schemas

Orchestration
  Nx workspace commands
```

### 4.2 Current capability areas

| Area | Current state | Important remaining boundary |
| --- | --- | --- |
| Contract | OpenAPI and generated artifacts are present | Every new CRM route must remain contract-first |
| Database | Migrations and local clean-database rehearsal exist | CRM entity schema is still to be added |
| Authentication | Server sessions, CSRF, password paths, verification, lockout, and revocation have local evidence | Production MFA, OIDC, provider configuration, and independent review remain open |
| Authorization | Organization membership and permission boundaries exist locally | Full tenant policy coverage must accompany CRM entities |
| User lifecycle | Organization-scoped CRUD, status, soft delete/restore, search, sort, pagination | Detail privacy model and full lifecycle review remain |
| Bulk/data workflows | Bulk routes and CSV surface exist locally | Durable worker execution and full UI need completion |
| Audit/notifications | Local audit and notification adapter boundaries exist | Provider delivery, retry, and operational visibility remain |
| Organizations | Organizations, roles, teams, invitations, and tenant checks exist locally | Broader CRM data isolation must be proven |
| Advanced identity | Local MFA/API-key boundaries and explicit OIDC boundary exist | Durable production MFA/SSO integration remains |
| Admin operations | Dashboard, settings, sessions, security, notification, and administration screens exist | Accessibility and production operations evidence remain |
| Frontend | Typed API integration, navigation, CRUD, admin surface, tests, and build exist | CRM screens and offline UI are proposed |
| Operations | Docker, migrations, startup, and troubleshooting documentation exist | Production deployment, backups, monitoring, and restore drill remain |

### 4.3 What should be reused

- Existing `apps/frontend` and `apps/backend` boundaries
- Existing OpenAPI generation workflow
- Existing organization and authorization policy boundaries
- Existing session and CSRF approach
- Existing PostgreSQL/Alembic migration workflow
- Existing Redis and Docker local infrastructure
- Existing Nx scripts and test commands
- Existing Playwright browser setup

### 4.4 What should be added

- CRM domain modules and migrations
- A storage adapter abstraction in the frontend
- A dedicated local database worker
- A durable outbox and sync protocol
- A shared, versioned operation format
- Conflict policy and resolution UI
- CRM pages and entity-specific authorization tests
- Mobile-ready sync-core interfaces without introducing mobile code early

---

## 5. Target Architecture

### 5.1 Layer responsibilities

| Layer | Responsibility | Must not own |
| --- | --- | --- |
| React UI | Rendering, user input, optimistic state, accessibility, status display | Final authorization or conflict decisions |
| Frontend repositories | Typed entity operations, local/remote selection, cache invalidation | Direct database assumptions in components |
| Local worker | SQLite/IndexedDB access, local transactions, FTS, outbox writes | Server authorization |
| Sync engine | Cursor management, push/pull, retry, idempotency, merge invocation | Password or role decisions |
| FastAPI API | Authentication, authorization, validation, server business rules | Browser-only storage logic |
| Domain services | CRM invariants, transaction boundaries, audit events | HTTP-specific concerns |
| PostgreSQL | Authoritative data, memberships, operations, audit, jobs | UI state |
| Redis | Rate limits, cache, pub/sub, worker transport where approved | Durable business truth |
| Mobile adapter | Native storage and lifecycle integration | Different business semantics from web |

### 5.2 Storage strategy decision

| Option | Advantages | Risks | Decision |
| --- | --- | --- | --- |
| Server-only | Simplest consistency model and fastest initial delivery | No offline CRUD; poor field experience without connectivity | Use for initial CRM vertical slice |
| IndexedDB adapter | Low initial complexity and broad browser availability | Query/index ergonomics and large-dataset performance need proof | Use for first local-cache spike |
| SQLite WASM + OPFS worker | SQL queries, indexes, FTS, and strong local data model | Worker-only storage, browser/VFS differences, multi-tab complexity | Target after benchmark and browser spike |
| Native mobile SQLite | Mature mobile storage and offline capability | Platform lifecycle and migration differences | Future mobile adapter |

SQLite’s official WASM documentation confirms that OPFS is browser-persistent
storage available in Worker contexts and that VFS choices affect concurrency.
The implementation should therefore hide storage behind an adapter instead of
coupling the product directly to one browser storage mechanism.

### 5.3 Proposed repository interfaces

```typescript
/** Supported CRM entity names shared by web and future mobile clients. */
type EntityName =
  | 'account'
  | 'contact'
  | 'deal'
  | 'activity'
  | 'note'
  | 'tag';

/** Source used to satisfy a read or mutation. */
type DataSource = 'server' | 'local' | 'optimistic' | 'reconciled';

/** Result metadata that lets the UI explain freshness and synchronization. */
interface DataResult<T> {
  /** Entity payload returned to the caller. */
  data: T;
  /** Whether the payload came from the server, local store, or optimistic state. */
  source: DataSource;
  /** Whether the local payload has a pending server operation. */
  pendingSync: boolean;
  /** Server cursor or version used to produce the result, when available. */
  cursor?: string;
}

/** Storage boundary used by the web worker and future mobile adapters. */
interface EntityRepository<T, CreateInput, UpdateInput> {
  /** Create a local or online entity and return its local operation metadata. */
  create(input: CreateInput): Promise<DataResult<T>>;
  /** Update only permitted fields and append an outbox operation atomically. */
  update(id: string, input: UpdateInput): Promise<DataResult<T>>;
  /** Mark an entity deleted locally and queue a tombstone operation. */
  remove(id: string): Promise<DataResult<T>>;
  /** Read a single entity using the selected freshness policy. */
  get(id: string): Promise<DataResult<T> | null>;
  /** List entities using filters, stable ordering, and a cursor or page. */
  list(query: Record<string, unknown>): Promise<DataResult<T[]>>;
}

/** Operation sent from a client outbox to the server. */
interface SyncOperation {
  /** Globally unique operation ID used for idempotency. */
  opId: string;
  /** Stable device or browser-installation identity. */
  deviceId: string;
  /** Organization that owns the operation. */
  organizationId: string;
  /** Entity type affected by the operation. */
  entity: EntityName;
  /** Entity identifier generated or retained by the client. */
  entityId: string;
  /** Changed field values; server validation remains authoritative. */
  changes: Record<string, unknown>;
  /** Logical timestamp used for deterministic merge ordering. */
  hlc: string;
  /** Protocol/schema version used to validate the operation. */
  schemaVersion: number;
  /** Whether the operation is an upsert or a tombstone delete. */
  kind: 'upsert' | 'delete';
}

/** Durable state for retrying a local operation. */
interface OutboxEntry {
  /** Local primary key for the outbox record. */
  id: string;
  /** Operation payload to send to the API. */
  operation: SyncOperation;
  /** Current delivery state. */
  status: 'pending' | 'sending' | 'acked' | 'rejected' | 'conflict';
  /** Number of delivery attempts already made. */
  attempts: number;
  /** Next eligible retry time, when delivery is delayed. */
  nextAttemptAt?: string;
  /** Server or policy explanation when the operation is rejected. */
  errorMessage?: string;
}

/** User-visible conflict requiring a resolution decision. */
interface ConflictRecord {
  /** Conflict identifier. */
  id: string;
  /** Entity affected by the conflict. */
  entity: EntityName;
  /** Entity identifier affected by the conflict. */
  entityId: string;
  /** Field classified as review-required. */
  field: string;
  /** Value currently stored by the server. */
  serverValue: unknown;
  /** Value produced by the local operation. */
  localValue: unknown;
  /** Human-readable reason the field needs review. */
  reason: string;
  /** Current conflict status. */
  status: 'open' | 'resolved' | 'dismissed';
}
```

---

## 6. Online Web Flow

### 6.1 Online login and workspace loading

```text
User opens web app
        │
        ▼
Frontend restores in-memory session
        │
        ├── session valid ──▶ load active organization and scoped data
        │
        └── session missing/expired ──▶ show login form
                                      │
                                      ▼
                              POST credentials
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼                                         ▼
          Authenticated                         Invalid/blocked
          HttpOnly session                      Error, rate limit,
          + CSRF token                           or recovery path
                 │
                 ▼
       Verify organization membership and permissions
                 │
                 ▼
       Load dashboard, entity lists, and sync status
```

### 6.2 Online record mutation

1. The user opens an account, contact, deal, or activity.
2. The frontend validates required fields and displays field-level errors.
3. The API validates the session, CSRF requirements, organization membership,
   permission, entity invariants, and optimistic version/cursor if applicable.
4. The domain service writes the entity and audit event in one transaction.
5. The API returns the canonical record and a server version/cursor.
6. The frontend updates the local cache and visible list.
7. Notification or background-job work is dispatched only after the business
   transaction has been accepted.

### 6.3 Online UI state table

| State | List | Form | Primary action | User message |
| --- | --- | --- | --- | --- |
| Loading | Skeleton rows | Disabled controls | Disabled | `Loading your workspace…` |
| Ready | Data and counts visible | Enabled | Enabled | None |
| Saving | Existing data remains visible | Edited fields locked or marked pending | Disabled | `Saving changes…` |
| Saved | Canonical server data visible | Enabled | Enabled | `Changes saved.` |
| Validation error | Existing list remains | Invalid fields highlighted | Enabled after correction | Exact field error beside field |
| Permission denied | Existing permitted data only | Read-only or hidden action | Disabled/hidden | `You do not have permission to perform this action.` |
| Network failure | Cached data marked stale | Mutation enters pending state if allowed | Retry available | `Connection lost. Your change is saved locally and will retry.` |
| Session expired | Data access paused | Form closed or preserved locally | Sign in | `Your session expired. Sign in to continue.` |

---

## 7. Offline Web Flow

### 7.1 Offline read and mutation flow

```text
Browser detects offline or API timeout
        │
        ▼
Sync engine changes state to OFFLINE
        │
        ▼
UI reads only the permitted local organization scope
        │
        ├── record exists locally ──▶ render stale/local record
        │
        └── record not local ───────▶ show "Not available offline"

User edits a cached record
        │
        ▼
Validate locally using shared schema
        │
        ├── invalid ──▶ do not write; show field errors
        │
        └── valid ────▶ local transaction:
                        1. update record
                        2. append outbox operation
                        3. update pending count
                        4. notify subscribed UI queries
```

### 7.2 Offline guarantees

The web client may guarantee offline operation only for data that was already
replicated into the local scope. It must not imply that the entire organization
database is available locally.

The UI must show:

- Current connectivity state
- Last successful synchronization time
- Number of pending operations
- Number of rejected operations
- Number of conflicts requiring action
- Local storage usage and quota warning
- Whether a record is local, stale, pending, or reconciled

### 7.3 Local write transaction

```text
BEGIN LOCAL TRANSACTION
  validate entity input
  read current local record and field clocks
  apply optimistic change
  create operation ID and HLC value
  append operation to outbox
  update local query indexes
  publish change notification
COMMIT LOCAL TRANSACTION
```

The UI should update after the local transaction commits, not after a network
request. The operation remains pending until the server acknowledges it.

---

## 8. Synchronization and Conflict Flow

### 8.1 Push/pull synchronization

```text
Connectivity returns
        │
        ▼
Acquire one sync leader for the browser profile
        │
        ▼
Read pending outbox operations in stable order
        │
        ▼
POST bounded push batch with idempotency IDs
        │
        ├── accepted ─────▶ mark acked and store canonical server values
        ├── duplicate ────▶ treat as already accepted; mark acked
        ├── rejected ─────▶ mark rejected; show reason and recovery action
        └── conflict ─────▶ create conflict record; preserve both values
        │
        ▼
Pull server changes after the local cursor
        │
        ▼
Apply each page in one local transaction
        │
        ▼
Advance cursor only after successful local commit
        │
        ▼
Broadcast changed queries to other tabs
```

### 8.2 Conflict classification

| Field class | Examples | Default behavior |
| --- | --- | --- |
| Low risk | Contact phone, address, note metadata, tags | Deterministic field-level merge |
| Medium risk | Contact title, activity due date, account status | Merge if clocks are ordered; otherwise show warning |
| High risk | Deal stage, owner, amount, organization membership | Create review-required conflict |
| Destructive | Delete versus edit, restore versus delete | Preserve tombstone and require policy decision |

### 8.3 Conflict resolution flow

```text
Conflict detected
        │
        ▼
Preserve local value, server value, operation metadata, and history
        │
        ▼
Show side-by-side review
        │
        ├── Keep server ──▶ emit resolution operation using server value
        ├── Keep local ────▶ emit resolution operation using local value
        └── Edit manually ─▶ validate new value and emit resolution operation
        │
        ▼
Resolution enters the normal outbox
        │
        ▼
Server acknowledges resolution and all devices pull the result
```

### 8.4 Synchronization rules

1. Every operation has a unique `opId` and is safe to retry.
2. The server validates organization membership for every operation.
3. A rejected operation is not silently discarded.
4. A cursor advances only after local application succeeds.
5. A deleted record remains as a tombstone until the retention policy permits
   compaction.
6. A new local operation after a conflict must reference the latest local state.
7. One browser profile runs one active sync loop; other tabs observe it.
8. Server-side business rules override client assumptions.

---

## 9. Future Mobile Flow

### 9.1 Mobile architecture goal

The future mobile application should reuse:

- OpenAPI-generated API types
- Authentication and authorization contracts
- Entity validation rules
- Sync operation format
- Conflict policy
- Audit and telemetry event vocabulary

It should provide a separate storage adapter and UI lifecycle without copying
web-specific components or assuming a DOM environment.

### 9.2 Mobile online/offline flow

```text
Mobile app starts
        │
        ▼
Load encrypted/local scoped data
        │
        ├── online ──▶ authenticate, refresh scope, sync, render current data
        │
        └── offline ─▶ render cached permitted data and enable supported writes

User changes a record
        │
        ▼
Write local transaction and outbox entry
        │
        ▼
OS/network lifecycle reports connectivity
        │
        ▼
Background or foreground sync attempts push/pull
        │
        ▼
Show acknowledgement, rejection, or conflict review
```

### 9.3 Mobile-specific requirements

- Device registration and revocation
- Secure credential/session storage appropriate to the platform
- Biometric app lock as an optional local control
- Background sync that respects battery and OS scheduling
- Push notifications for assignments, mentions, and conflicts
- Deep links into records after authentication checks
- Explicit local-data wipe on logout or account switch
- Graceful upgrade when the local schema or sync protocol changes

Mobile should not be started until the web sync protocol has deterministic
convergence tests and a stable versioning policy.

---

## 10. Domain and Data Model

### 10.1 Core logical entities

```text
Organization
 ├── Membership ── User
 ├── Team ──────── User
 ├── Account
 │    └── Contact
 ├── Deal ──────── Account + owner User
 ├── Activity ──── Account/Contact/Deal + owner User
 ├── Note ──────── Account/Contact/Deal
 ├── Tag ───────── Account/Contact/Deal/Activity
 ├── AuditEvent
 ├── BackgroundJob
 └── DeviceSyncCursor

User ──< OrganizationMembership >── Organization
Device ──< SyncOperation >── Organization
Conflict ── references ── SyncOperation + entity field
```

### 10.2 Data ownership rules

| Data | Authoritative owner | Offline copy |
| --- | --- | --- |
| User identity | PostgreSQL | Limited profile/session metadata only |
| Organization membership | PostgreSQL | Read-only scoped snapshot |
| CRM entity | PostgreSQL after reconciliation | Scoped local replica |
| Pending mutation | Local outbox and server acknowledgement state | Yes, until resolved |
| Audit event | PostgreSQL append-only record | Read-only cached history |
| Conflict | PostgreSQL/local conflict state after detection | Yes, until resolution |
| Session secret | HttpOnly browser cookie/platform secure storage | Never in ordinary local tables |

### 10.3 Required server-side invariants

- Every CRM row has an organization identifier.
- Every organization-scoped read verifies membership.
- Every mutation verifies the required permission.
- Active uniqueness constraints are enforced by the database.
- Audit events are written with the state-changing transaction.
- Soft deletes are represented explicitly and are not confused with inactive
  users or archived business records.
- Sync operations are idempotent by `opId`.
- Job and import records have bounded payloads and retry state.

---

## 11. Detailed Feature Proposal

### 11.1 Identity and access — 8 capabilities

1. Email/password login
2. Logout and session revocation
3. Session restoration and expiry handling
4. Password change and password reset
5. Email verification
6. Login failure tracking and account lockout
7. MFA/TOTP and recovery-code lifecycle
8. Provider-neutral OIDC/SSO integration boundary

### 11.2 Organizations and authorization — 7 capabilities

1. Organization/workspace creation and settings
2. Membership lifecycle and invitations
3. Roles and permission assignment
4. Centralized permission policy checks
5. Team creation and team membership
6. Tenant isolation for every CRM resource
7. Scoped API keys with one-time display and revocation

### 11.3 Accounts and contacts — 8 capabilities

1. Account/company CRUD
2. Contact CRUD
3. Account-contact relationships
4. Contact profile/detail screen
5. Account and contact lifecycle status
6. Soft delete, restore, and archive behavior
7. Validated custom fields
8. Duplicate detection and merge-review workflow

### 11.4 Deals and pipeline — 8 capabilities

1. Deal CRUD
2. Configurable pipeline stages
3. Deal owner assignment
4. Amount, currency, probability, and expected close date
5. Drag-and-drop stage movement
6. Stage transition history
7. Won/lost outcome and reason
8. Pipeline summary and manager view

### 11.5 Activities and collaboration — 8 capabilities

1. Tasks
2. Calls
3. Meetings
4. Activity due dates and reminders
5. Unified account/contact/deal timeline
6. Notes with local-first editing
7. Tags and tag filtering
8. Activity ownership and completion state

### 11.6 Search and workspace views — 6 capabilities

1. Global search across permitted entities
2. Entity-specific filters
3. Stable sorting and pagination/keyset navigation
4. Saved views and saved filters
5. Virtualized large lists
6. Search result freshness and offline indicators

### 11.7 Offline web data layer — 10 capabilities

1. Local storage adapter boundary
2. Dedicated Web Worker database execution
3. SQLite WASM/OPFS implementation after proof
4. IndexedDB fallback
5. Scoped local replication
6. Offline reads for cached records
7. Offline create/update/delete for supported entities
8. Transactional outbox
9. Local full-text search
10. Storage quota, local wipe, and account-switch handling

### 11.8 Synchronization and conflicts — 10 capabilities

1. Push endpoint for operation batches
2. Pull endpoint using a durable cursor
3. Idempotency by operation ID
4. Per-operation acknowledgement and rejection
5. Exponential retry with backoff and jitter
6. Browser-tab leader election
7. Deterministic logical-clock ordering
8. Field-level low-risk merge
9. High-risk conflict queue and review UI
10. Tombstones, history, and cursor-expiry recovery

### 11.9 Data operations — 7 capabilities

1. CSV import preview
2. Validated CSV import commit
3. CSV and JSON export
4. Bulk status updates
5. Bulk role or team updates
6. Bulk delete and restore
7. Job progress, partial results, retry, and failure visibility

### 11.10 Notifications and integrations — 6 capabilities

1. In-app notifications
2. Email delivery adapter
3. Notification preferences
4. Delivery retries and failure state
5. Audit event visibility
6. Provider-neutral integration adapter boundary

### 11.11 Administration and operations — 8 capabilities

1. Organization dashboard
2. User and organization settings
3. Active-session listing and revocation
4. Audit-log search and detail
5. Background-job administration
6. Structured logs and request correlation
7. Metrics, tracing, and sync diagnostics
8. Backup, restore, migration, and release runbooks

### 11.12 UX, accessibility, and quality — 8 capabilities

1. Responsive desktop/tablet/mobile web layout
2. Keyboard navigation and focus management
3. Accessible labels, roles, contrast, and announcements
4. Loading, empty, error, offline, stale, pending, and conflict states
5. Performance budgets for lists, search, sync, and bundle size
6. Contract, unit, integration, and browser test pyramid
7. Property-based merge and convergence simulation
8. User, operator, and developer documentation

### 11.13 Future mobile — 21 capabilities

#### Mobile foundation — 5

1. Mobile application shell
2. Shared authentication/session flow
3. Mobile navigation and deep links
4. Device registration and revocation
5. Secure platform storage integration

#### Mobile offline data — 5

1. Scoped local CRM cache
2. Offline account/contact/deal/activity reads
3. Offline supported mutations
4. Mobile outbox and local validation
5. Local storage quota and wipe controls

#### Mobile synchronization — 5

1. Foreground push/pull synchronization
2. Background synchronization where the OS permits it
3. Retry, cursor recovery, and partial acknowledgement
4. Mobile conflict review
5. Sync diagnostics and last-sync state

#### Mobile UX and security — 6

1. Push notifications
2. Optional biometric app lock
3. Deep-link authorization checks
4. Mobile accessibility support
5. Mobile telemetry and crash diagnostics
6. Versioned local schema and safe app upgrade

---

## 12. Practical User Scenarios

### Scenario 1: Online user creates a contact

1. A sales user signs in and selects an organization.
2. The user opens an account and selects **Add contact**.
3. The form validates name, email, phone, and account relationship locally.
4. The API verifies the session, organization membership, and create permission.
5. PostgreSQL stores the contact and an audit event in one transaction.
6. The response returns the canonical contact ID and timestamps.
7. The UI updates the account timeline and contact list.

**Final state:** `saved`, `pendingSync=false`, audit event present, available to
other permitted users after their next read or push notification.

### Scenario 2: User creates a contact while offline

1. The user opens the CRM before losing connectivity.
2. The account and existing contacts are already in the local scope.
3. The user creates a new contact while offline.
4. The local worker validates and writes the contact plus an outbox operation
   in one transaction.
5. The UI immediately displays the contact with an `Offline` and `Pending`
   badge.
6. Connectivity returns and the sync leader pushes the operation.
7. The server accepts it, returns the canonical record, and the outbox entry
   becomes `acked`.

**Final state:** local and server identifiers are reconciled, pending count
decreases, and the contact becomes visible to other permitted clients.

### Scenario 3: Low-risk concurrent edits

1. Browser A changes a contact phone number offline.
2. Browser B changes the same contact’s address online.
3. Browser A reconnects and pushes its phone update.
4. The server compares field-level clocks.
5. Phone and address are different low-risk fields, so both changes are
   retained.
6. Both browsers pull the canonical record.

**Final state:** phone comes from A, address comes from B, no user conflict is
created, and the history shows both operations.

### Scenario 4: High-risk deal conflict

1. Manager A moves a deal to `Won` offline.
2. Manager B changes the same deal owner online.
3. The server classifies stage and owner as high-risk fields.
4. The operation is accepted only with a conflict record rather than silently
   overwriting the other high-risk decision.
5. The manager opens the conflict queue and sees server value, local value,
   actor, timestamp, and reason.
6. The manager chooses **Keep server**, **Keep mine**, or **Edit manually**.
7. The choice becomes a new auditable operation.

**Final state:** one canonical deal state exists, the losing value remains in
history, and all clients converge after the resolution operation.

### Scenario 5: CSV import with partial failures

1. An administrator uploads a CSV file.
2. The API validates file size, headers, encoding, organization scope, and row
   shape.
3. The preview reports valid rows, duplicate candidates, and invalid rows.
4. The administrator confirms the import.
5. A bounded job processes rows in chunks.
6. Valid rows are committed with audit events; invalid rows receive row-level
   error details.
7. The UI displays completed, failed, skipped, and retryable counts.

**Final state:** successful rows are durable, failed rows are exportable for
correction, and the job does not claim success until all chunks finish.

### Scenario 6: Mobile user resumes after a long offline period

1. A mobile user edits assigned activities while traveling without network.
2. The mobile outbox stores operations and shows pending count.
3. The app is suspended by the operating system.
4. The app resumes later and detects that its cursor is expired.
5. The sync engine preserves pending local operations, downloads a scoped
   snapshot, then reapplies pending operations.
6. Accepted operations are acknowledged; rejected or conflicting operations
   are shown in the mobile review queue.

**Final state:** the user does not lose pending work because cursor recovery and
outbox preservation are separate transactions.

---

## 13. Edge Cases and Recovery

| # | Situation | Required behavior |
| ---: | --- | --- |
| 1 | Session expires while the user is offline | Permit local work only within the previously authorized scope; require re-authentication before server push; never extend server authorization locally. |
| 2 | User changes organization while local data exists | Stop reads, wipe or isolate the previous organization scope, load the new scope, and never display records across organizations. |
| 3 | Operation is retried after an uncertain network timeout | Reuse the same `opId`; server returns the original acknowledgement instead of creating a duplicate. |
| 4 | Permission is revoked while operations are pending | Server rejects affected operations with a reason; UI keeps the local value in a rejected queue and offers export or discard. |
| 5 | Record is deleted remotely while edited locally | Preserve the tombstone and local edit; show restore-or-discard policy based on permission and business rules. |
| 6 | Two browser tabs start synchronization | Web Locks or equivalent leader coordination permits one active sync loop; other tabs observe BroadcastChannel events. |
| 7 | Local storage quota is nearly exhausted | Warn before writes fail, show usage, allow scope eviction, preserve pending operations before eviction, and never fail silently. |
| 8 | Browser storage is corrupted | Run integrity check, export pending operations if possible, wipe only the affected local scope, and resync from a server snapshot. |
| 9 | Push batch has mixed results | Acknowledge accepted operations, retain rejected/conflicting operations, and retry only retryable entries. |
| 10 | Schema/protocol version is newer than the client | Stop applying unsafe operations, prompt for app refresh/update, preserve the outbox, and avoid destructive fallback parsing. |
| 11 | Duplicate contact is created offline | Keep the local record, mark a duplicate candidate after server comparison, and require merge review rather than auto-deleting. |
| 12 | Notification provider is unavailable | Commit the business operation and audit event, enqueue delivery retry, show delivery failure separately from business failure, and alert operators. |

---

## 14. UI/UX Proposal

### 14.1 Main workspace layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Product │ Organization ▼ │ Search │ Sync: Online · 3 pending │ User ▼ │
├─────────┬────────────────────────────────────────────────────────────┤
│ Dashboard│ Breadcrumb / workspace title                               │
│ Accounts │ [Create] [Import] [Export] [Saved view ▼]                 │
│ Contacts ├────────────────────────────────────────────────────────────┤
│ Deals    │ Filters: Status ▼ Owner ▼ Tag ▼ Date ▼                    │
│ Activity ├────────────────────────────────────────────────────────────┤
│ Reports  │ Record list / pipeline / timeline                         │
│ Admin    │                                                            │
│         │ Offline/pending/conflict state is shown per record          │
└─────────┴────────────────────────────────────────────────────────────┘
```

### 14.2 Synchronization indicator states

| State | Indicator | Tooltip/message | Action |
| --- | --- | --- | --- |
| Online/synced | Green dot | `All changes synced.` | Open sync details |
| Syncing | Spinner | `Syncing 3 changes…` | Open details; do not duplicate sync |
| Offline | Gray cloud | `Offline. Showing cached data.` | Open offline help |
| Pending | Amber badge | `3 changes waiting to sync.` | Open outbox |
| Conflict | Red badge | `1 change needs review.` | Open conflict queue |
| Rejected | Red/black badge | `1 change was rejected.` | Open rejected queue |
| Storage warning | Amber storage icon | `Local storage is almost full.` | Manage local scope |

### 14.3 Accessibility requirements

- All form fields have visible labels and programmatic descriptions.
- Loading, offline, conflict, and save announcements use accessible live regions.
- Every operation is keyboard reachable without requiring drag and drop.
- Pipeline drag and drop has a keyboard alternative.
- Color is not the only signal for state.
- Focus returns to the triggering control after dialogs close.
- Tables and virtualized lists expose row and column semantics.
- Error messages identify the field and the recovery action.
- Mobile controls meet platform touch-target and screen-reader expectations.

---

## 15. Security, Privacy, and Tenant Isolation

### 15.1 Authentication and sessions

- Use server-managed opaque sessions in HttpOnly cookies.
- Keep CSRF protection for browser mutations.
- Never store session values, passwords, API-key secrets, or recovery codes in
  ordinary local storage.
- Require re-authentication before sensitive actions when policy demands it.
- Revoke sessions and devices on account security events.

### 15.2 Authorization

Every online and synchronization request must validate:

1. Session or API-key authentication
2. Organization membership
3. Resource organization ownership
4. Required permission and scope
5. Entity lifecycle state
6. Operation/schema version

The client may hide unavailable actions for usability, but only the backend
can enforce authorization.

### 15.3 Local-data privacy

Browser and mobile local storage are treated as potentially inspectable by a
device owner or malware. The product must document:

- Which entities are replicated locally
- How long local data remains after logout
- Whether local encryption is available on each platform
- What happens when storage is cleared
- How account switching prevents data leakage
- Which fields are excluded from offline replication

### 15.4 Audit requirements

Audit events must cover:

- Authentication and session changes
- Role and permission changes
- Organization and membership changes
- CRM create/update/delete/restore operations
- Import/export and bulk jobs
- Sync rejection and conflict resolution
- API-key and device lifecycle
- Security and recovery events

Secrets, raw session values, passwords, tokens, and private payloads must not be
written to logs, screenshots, telemetry, or documentation.

---

## 16. Delivery Roadmap

### Phase 0 — Product decisions and baseline

**Outcome:** approved scope and stable architectural boundaries.

- Confirm personas and first release user stories.
- Confirm organization, account, contact, deal, activity, and note vocabulary.
- Freeze the first web feature cut line.
- Define conflict field classes.
- Define offline replication scopes.
- Record ADRs for storage, sync, conflict, and mobile readiness.

**Exit evidence:** signed product scope, domain glossary, architecture ADRs,
and acceptance criteria.

### Phase 1 — CRM online vertical slice

**Outcome:** useful online CRM with no offline complexity.

- Add account and contact migrations.
- Add FastAPI models, services, policies, and routes.
- Extend OpenAPI and generated artifacts.
- Build account/contact list, detail, create, edit, delete, search, and audit.
- Add organization isolation tests and browser flows.

**Exit evidence:** complete account/contact vertical slice passes API, database,
authorization, and browser tests.

### Phase 2 — Deals, activities, notes, and pipeline

**Outcome:** core CRM workflow is useful online.

- Add deals and pipeline stages.
- Add activities and timelines.
- Add notes and tags.
- Add manager views and saved filters.
- Add performance measurement on representative data.

**Exit evidence:** users can manage a complete customer relationship online.

### Phase 3 — Local storage spike

**Outcome:** prove local storage without committing the whole product to an
unverified browser implementation.

- Define the storage adapter interface.
- Implement a small IndexedDB or SQLite WASM prototype.
- Run inside a Worker.
- Replicate one entity and one search query.
- Test browser restart, tab behavior, quota, and logout wipe.
- Measure local read/write/search performance.

**Exit evidence:** storage benchmark and browser compatibility decision.

### Phase 4 — Offline cache and outbox

**Outcome:** users can read scoped data and create/update supported records
offline.

- Add local query subscriptions.
- Add offline indicator and stale state.
- Add transactional outbox.
- Add optimistic local mutations.
- Add pending/rejected operation UI.

**Exit evidence:** offline CRUD for the selected entity passes browser tests and
does not leak data between organizations or accounts.

### Phase 5 — Synchronization v1

**Outcome:** two clients converge for low-risk operations.

- Implement push/pull contracts.
- Add cursor and idempotency handling.
- Add retry/backoff and partial acknowledgement.
- Add multi-tab leader coordination.
- Add deterministic merge test vectors.
- Add two-browser reconnect tests.

**Exit evidence:** no duplicate or lost operations in retry, reorder, and
reconnect simulations.

### Phase 6 — Conflicts, history, and resilience

**Outcome:** high-risk concurrent changes are safe and understandable.

- Add conflict records and review UI.
- Add field-level policies.
- Add tombstones and restore behavior.
- Add history and undo/recovery where supported.
- Add cursor-expiry snapshot recovery.
- Add corruption and quota recovery.

**Exit evidence:** every conflict class has a test and visible recovery path.

### Phase 7 — Scale, security, and production operations

**Outcome:** the web product is operationally ready.

- Benchmark large local and server datasets.
- Run load tests and sync simulations.
- Complete accessibility review.
- Complete metrics, tracing, backup, and restore rehearsal.
- Complete CI release gates and deployment runbook.

**Exit evidence:** performance table, security review, restore evidence, and
release checklist are complete.

### Phase 8 — Mobile foundation

**Outcome:** mobile implementation can start without changing server semantics.

- Stabilize sync protocol versioning.
- Extract platform-independent domain and sync contracts.
- Build mobile storage adapter spike.
- Implement authentication, scoped cache, and read-only mobile pilot.

**Exit evidence:** mobile pilot can authenticate, read scoped records, and
respect the same organization and permission policy.

### Phase 9 — Mobile offline and online delivery

**Outcome:** mobile users can safely work offline and synchronize later.

- Add offline mutations and outbox.
- Add foreground/background sync.
- Add conflict review.
- Add push notifications and device controls.
- Add platform-specific accessibility, telemetry, and release automation.

**Exit evidence:** mobile convergence, security, crash recovery, and app-store
release gates pass.

---

## 17. Quality and Release Gates

### 17.1 Test pyramid

| Layer | Required proof |
| --- | --- |
| Unit | Validation, permissions, HLC/order, merge rules, repository behavior |
| Property-based | Idempotency, commutativity where intended, convergence invariants |
| Backend integration | Real PostgreSQL, migrations, tenant isolation, transactions |
| Worker/infrastructure | Redis, job lease/retry, outbox dispatch, crash recovery |
| Contract | OpenAPI response/error shapes and generated artifacts |
| Browser E2E | Login, CRUD, offline mode, reconnect, conflict, imports, accessibility |
| Multi-client simulation | Multiple devices/tabs, reorder, duplicates, drops, clock skew |
| Performance | Local query, search, scrolling, sync, server list, bundle budgets |
| Security | Session, CSRF, authorization, secret redaction, API-key, MFA, SSO boundaries |

### 17.2 Suggested performance budgets

These are proposal targets and must be measured before being treated as product
guarantees:

- Local indexed read: under 20 ms p95 at 100,000 local rows
- Optimistic local write: under 50 ms from click to visible update
- Local full-text search: under 100 ms p95
- Virtualized list: stable 60 FPS with no long task over 50 ms
- Initial scoped sync: under 15 seconds for 50,000 records
- Incremental sync: under 1 second for 100 operations
- Server search: under 150 ms p95 at target dataset size
- Initial route bundle: under 200 KB gzipped where practical
- Convergence: 100% in deterministic simulation seeds

### 17.3 Release gate

The product is not ready for a release claim until:

1. Current migrations work from empty and baseline databases.
2. All API behavior is contract-first and generated artifacts are current.
3. Organization isolation and permission denial paths pass.
4. Offline operations are durable across refresh and restart.
5. Retry and duplicate operation behavior is proven.
6. Conflicts preserve both values and are resolvable.
7. Accessibility and performance budgets have evidence.
8. Backup and restore have been rehearsed.
9. No high-severity security finding remains open.
10. Web and future mobile protocol versions are documented.

---

## 18. Limitations and Non-Goals

### 18.1 Technical limitations

- Offline data is limited to a scoped local replica, not the full organization.
- A browser cannot guarantee secure storage against a compromised device.
- Background synchronization depends on browser and mobile operating-system
  lifecycle rules.
- Multi-tab local database behavior varies by storage implementation and browser.
- Conflict-free automatic merging is not appropriate for every business field.
- Large local datasets increase storage, migration, and recovery complexity.
- Email, SSO, MFA providers, and production monitoring require explicit provider
  configuration and operational ownership.

### 18.2 Product limitations

- The first release is not a full ERP or accounting product.
- Mobile is future scope and should not block the first web CRM release.
- AI, billing, and marketing automation are not included in the first horizon.
- Custom CRDT behavior is limited to domains where it has a clear business need,
  such as collaborative notes.

### 18.3 Risk mitigations

| Risk | Mitigation |
| --- | --- |
| Sync bugs consume the schedule | Build a small vertical slice and simulation tests early |
| Offline data leaks across tenants | Scope local keys by organization and test account switching |
| Browser storage incompatibility | Adapter boundary, browser matrix, IndexedDB fallback |
| Conflict policy becomes unclear | Classify fields before implementing merge behavior |
| Background jobs lose work | Durable job record, outbox handoff, lease, retry, dead-letter state |
| Feature scope expands endlessly | Freeze the MVP cut line and maintain a later backlog |
| Production claims are premature | Separate local, provider, and production evidence |

---

## 19. Open Product Decisions

| Decision | Why it matters | Suggested owner | Needed before |
| --- | --- | --- | --- |
| First CRM persona and industry focus | Determines entity fields and workflow priority | Product owner | Phase 0 |
| First MVP entity set | Prevents accounts, contacts, deals, and activities from expanding indefinitely | Product + engineering | Phase 0 |
| Offline replication scope | Controls privacy, storage size, and sync complexity | Product + security | Phase 0 |
| IndexedDB versus SQLite WASM first | Determines local query and migration strategy | Frontend lead | Phase 3 |
| Conflict policy for deal stage, owner, and amount | Determines user trust and resolution UI | Product + domain owner | Phase 3 |
| Notes collaboration requirement | Determines whether Yjs/CRDT work is required | Product owner | Phase 5 |
| Email, SSO, MFA, and push providers | Determines production adapters and operational cost | Platform/security owner | Phase 7 |
| Mobile technology choice | Determines native storage, release, and background sync behavior | Mobile lead | Phase 8 |
| Retention and local-data wipe policy | Determines privacy, compliance, and recovery behavior | Security/legal owner | Phase 3 |
| Performance dataset and hardware baseline | Makes performance budgets reproducible | Engineering lead | Phase 3 |

---

## 20. Conclusion

The best product strategy is to build a dependable online CRM foundation first,
then add offline storage, outbox behavior, synchronization, conflict handling,
and mobile support as independently verified layers.

The current monorepo already provides the right starting shape: React and
TypeScript on the web, FastAPI as a modular backend, PostgreSQL for durable
business state, Redis for shared infrastructure, OpenAPI for contracts, and Nx
for orchestration. The major future work is not a framework rewrite; it is the
careful addition of CRM domain models, scoped local storage, deterministic sync,
conflict policy, and client-specific lifecycle handling.

The proposal therefore recommends this release sequence:

```text
Secure user-management foundation
        ↓
Online accounts + contacts
        ↓
Online deals + activities + notes
        ↓
Scoped local cache + offline outbox
        ↓
Push/pull synchronization
        ↓
Conflict resolution + history
        ↓
Scale, security, accessibility, and operations
        ↓
Mobile read pilot
        ↓
Mobile offline and online synchronization
```

This sequence delivers user value at every stage while preserving the long-term
offline and mobile vision.

### Reference documents

- [Current repository README](../../../../README.md)
- [Current full user-management implementation plan](../user-management-full-implementation-plan.md)
- [Current feature gap matrix](../GAP_MATRIX.md)
- [Current implementation evidence](../evidence/implementation-evidence-20261023.md)
- [Local-first CRM implementation checklist](../Local-first%20CRM%20web%20implementation%20plan.md)
- [FastAPI larger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [SQLite WASM persistent storage and OPFS](https://www.sqlite.org/wasm/doc/trunk/persistence.md)
- [PostgreSQL logical replication](https://www.postgresql.org/docs/current/logical-replication.html)

