# User Management Monorepo — Full Feature Implementation Plan

**Plan type:** Fullstack implementation plan
**Repository:** `/home/dhaval-tank/Project/user-management/user-management`
**Current branch:** `main`
**Baseline verified at:** `02d21e1 Align local frontend and API cookie hosts`
**Architecture:** Nx polyglot monorepo with React/TypeScript frontend, FastAPI backend, PostgreSQL, Redis, OpenAPI-generated types, and Playwright E2E tests
**Plan status:** Local provider-neutral implementation executed and evidenced on 2026-10-23; production/provider-backed work and independent review gates remain explicitly open. See `evidence/implementation-evidence-20261023.md`.

## Scope

This plan takes the current user-management monorepo from its working CRUD foundation to a complete, secure, provider-neutral production-readiness baseline. It covers the browser workflows used by administrators and managed users, the FastAPI/PostgreSQL API, session and identity security, role and permission management, user lifecycle operations, bulk data workflows, notifications, auditability, organizations and teams, accessibility, observability, testing, deployment preparation, and local-operator documentation.

The plan intentionally stays inside this repository and its existing architecture:

- `apps/frontend` remains the React + TypeScript + Vite application.
- `apps/backend` remains the FastAPI + SQLAlchemy + Alembic application.
- `docs/api/openapi.yaml` remains the contract source of truth.
- `apps/frontend/src/generated/api-types.ts` and `apps/backend/app/generated/schemas.py` remain generated artifacts.
- PostgreSQL remains the system of record; Redis remains the shared rate-limit/cache/infrastructure boundary where required.
- Nx remains the local orchestration layer for frontend and backend targets.

The observable end state is an administrator who can securely authenticate, manage users individually or in bulk, control roles and permissions, inspect activity, manage sessions and organizations, import/export data, receive notifications, and use the application through accessible responsive screens. Operators can migrate, test, build, monitor, back up, and recover the system using documented commands and evidence-backed release gates. Provider-specific production deployment remains a separately blocked decision until a hosting provider, secret manager, backup target, and monitoring destination are approved.

## Execution snapshot — 2026-10-23

The approved continuous execution run completed the local implementation slice
through contract, migration, authentication, authorization, organization,
user-lifecycle, bulk API, notification, API-key, dashboard, security, and
frontend integration work. The current migration is `20261023_0007`; contract,
generated-artifact, lint, typecheck, unit, backend, build, and headed/headless
Playwright checks passed.

This is not a production-release claim. Provider-backed delivery, durable
workers, persistent production MFA/OIDC, complete administration screens,
clean-database/restore rehearsals, independent reviewer PASS verdicts, commit,
and push remain open. The exact evidence and scope boundaries are recorded in
`docs/plans/user-management-full/evidence/implementation-evidence-20261023.md`.

## Definition of Done

The plan is complete only when every item below is independently verifiable:

- [ ] Every feature in the Feature Coverage Matrix is implemented end to end in the API, database path, frontend workflow, and verification suite.
- [ ] All new and changed API behavior is defined in `docs/api/openapi.yaml` before backend implementation begins.
- [ ] Generated Python and TypeScript contract artifacts are regenerated and pass `npm run check:generated`.
- [ ] PostgreSQL migrations are applied successfully from a clean database and from a database containing the current baseline data.
- [ ] Authentication uses secure server-managed sessions, password hashing, CSRF protection, session revocation, password recovery, account lockout, email verification, and MFA behavior as specified by the phases.
- [ ] Authorization prevents unauthorized actions, role escalation, cross-organization access, and tenant data leakage.
- [ ] User CRUD, status changes, soft delete/restore, profile management, search, filtering, sorting, pagination, bulk actions, import, and export work through the API-backed UI.
- [ ] Audit logs cover authentication, authorization changes, user lifecycle mutations, bulk operations, imports/exports, organization changes, invitations, and security events without storing secrets.
- [ ] Notifications support in-app delivery, email delivery through an adapter, notification preferences, retries, and failure visibility.
- [ ] Organizations, teams, invitations, and membership isolation are enforced at the database/service/API/frontend boundaries.
- [ ] The UI covers loading, empty, validation, unauthorized, forbidden, conflict, rate-limited, dependency-failure, retry, success, and destructive-confirmation states.
- [ ] The UI passes keyboard, focus, semantic-label, contrast, responsive-layout, and screen-reader verification for all new screens and workflows.
- [ ] Every backend behavior change and frontend hook/function behavior change has RED → GREEN → REFACTOR evidence, including telemetry assertions.
- [ ] Unit, integration, contract, security, accessibility, and headless Playwright E2E tests pass in CI with disposable PostgreSQL/Redis services.
- [ ] Every phase has a reviewer PASS verdict, with no unresolved CRITICAL or HIGH findings and every finding dispositioned as `FIXED`, `REJECTED: false positive`, `REJECTED: scope expansion`, or `BLOCKED: requires human decision`.
- [ ] Provider-neutral production configuration is fail-closed: secret injection, secure cookies, exact HTTPS CORS origins, trusted proxy configuration, Redis-backed rate limiting, migration gates, backup/restore procedures, monitoring interfaces, and rollback instructions are verified. Provider-specific deployment is not marked complete without the decision listed in Scope Cuts.
- [ ] Root README, backend README, API documentation, architecture decisions, deployment runbook, local environment examples, and troubleshooting guidance are current.
- [ ] A real-user browser walkthrough passes from login through user administration, bulk workflow, audit review, session management, and logout.
- [ ] The monorepo working tree is clean, all intended changes are committed, and the release commit is traceable to the verified test and provider-neutral release evidence. A provider-specific deployment gate is explicitly marked blocked unless approved.

## Flags

None. This plan does not use feature flags, config gates, kill switches, or rollout gates. New behavior is released through the existing Git/CI/deployment process.

## Non-Goals

The following are intentionally outside this plan because they are not user-management features:

- Billing, subscriptions, payments, or invoices.
- Chat, social feeds, content publishing, or collaboration documents.
- A separate microservice split; the backend remains a modular monolith.
- Replacing React, TypeScript, FastAPI, PostgreSQL, Redis, Nx, or Material UI with another stack.
- Rewriting the historical source repositories outside this monorepo.
- Provider-specific deployment, secret-manager integration, backup-provider configuration, external monitoring/SIEM integration, and production credential onboarding before those providers are explicitly selected.

## User Requirements

The following requirement was provided by the user and is non-negotiable:

> now do one thing make a full proof plan proper phase wise that cover all the feature for implemtned in monorepo make sure you check properly and don;t mess and miss feature just make plan in well stcture format with checklist

The plan also preserves the previously established repository constraints: keep the implementation in the Nx monorepo, follow the existing React/TypeScript + FastAPI/PostgreSQL architecture, use the current generated OpenAPI workflow, preserve unrelated source repositories, and maintain a clear local setup path.

## ⚠️ Scope Cuts Requiring Approval

The following decision is intentionally unresolved and blocks provider-specific release work only; it does not block local development, schema work, contract work, or provider-neutral CI:

- [ ] Select the hosting provider, secret manager/KMS, backup target, and monitoring/error-reporting destination. Until selected, implement and verify provider-neutral containers, config validation, health/readiness, CI, backup/restore procedure templates, and rollback decision rules, but mark actual production deployment, provider-specific rollback automation, provider dashboards, and real restore drills as `BLOCKED: requires human decision`.

All other user-management features in the Feature Coverage Matrix remain in scope. Any later proposal that adds unrelated product scope must be recorded here before implementation.

## Codex Coordinator Role

The Codex coordinator owns execution of the plan: creates the task checklist, chooses what to do locally, delegates only when sub-agents are explicitly authorized, verifies evidence, manages reviews, and enforces gates. The Codex coordinator does not advance to a later phase until the current phase exit criteria are documented as met and any required review findings are dispositioned.

## Global Execution Rules

- Contract-first is mandatory. OpenAPI changes happen before backend code, generated schemas, or frontend API code.
- Load the `test-authoring` skill before writing any test code in every implementation phase that adds or changes tests.
- Use RED → GREEN → REFACTOR for backend service behavior and frontend hook/function behavior. A test that only checks rendering without asserting behavior is insufficient.
- Generated DTOs/types are produced from the OpenAPI contract. Do not hand-edit generated files.
- Every phase has one accountable owner: the Codex coordinator or one explicitly authorized worker with a disjoint write scope.
- Every phase gets a separate reviewer pass. Reviewers verify scope, contracts, tests, security, data exposure, telemetry, paths, and exit criteria.
- Scope-expanding reviewer suggestions are documented and rejected unless the user explicitly expands scope. Mechanical correctness findings are fixed.
- Database work begins only after Phase 0 verifies the live schema, current migration state, naming conventions, indexes, and data constraints.
- Migration filenames are produced by Alembic during execution; the plan uses descriptive placeholders such as `<alembic-generated-add-user-security-fields>.py` and never fabricates timestamps.
- Every endpoint is rate-limit reviewed, documents `429`, returns the standard error envelope, includes request correlation, and verifies trusted-proxy behavior.
- Authentication and other security-sensitive mutations use two limiter stages. Pre-auth middleware uses only bounded `ip + normalizedEmailHash`, `ip + opaque invitation digest`, or `ip + challenge digest` keys; post-auth dependencies add `userId`, `organizationId`, or authenticated API-key ID. Keys never require identity that is unavailable before route authentication and never contain raw request-body tokens. Authentication mutations fail closed when the shared limiter is unavailable; explicitly documented low-risk reads may fail open with telemetry. Local fallback storage is local/test-only, bounded by a configured maximum key count, prunes on insert, evicts deterministically, and emits memory-pressure telemetry.
- Every new behavior emits structured telemetry for success, rejection, failure, fallback, timeout, and dependency-unavailable branches. Tests use a recording telemetry implementation.
- Secrets, password values, reset/verification/invitation tokens, raw session values, recovery codes, and private customer data never enter source control, telemetry, screenshots, fixtures, or plan evidence. The browser-readable CSRF token is returned only by the designated login/CSRF responses, held in memory, marked `Cache-Control: no-store`, never logged or persisted, and is excluded from the generic token prohibition. A newly created API key is returned once over TLS and is never logged or persisted by the server.
- Request telemetry records route templates, never raw URL paths containing credentials or tokens; invitation acceptance uses a request-body token rather than a token-bearing URL. A centralized scrubber rejects sensitive keys and redacts exception metadata before logging or telemetry.
- The scrubber is mandatory at every sink boundary: structured logs, framework/access logs, telemetry, traces, frontend error reporting, exception strings, headers, query strings, and nested metadata. Prefer event-specific allowlists and fail closed on unknown sensitive fields; direct-sink tests cover reset, invitation, OIDC, MFA, API-key, CSRF, and password values.
- Production and staging configuration fail closed: no localhost CORS/trusted-host defaults, HTTPS origins are exact, forwarded headers are accepted only from configured proxy CIDRs, bootstrap credentials are disabled outside local/test, and `SESSION_COOKIE_SECURE=true` is mandatory outside local/test.
- Browser verification uses headless Playwright in automated execution. A human may perform a separate headed walkthrough, but CI commands must not use `--ui` or `--headed`.
- Services are restarted after relevant changes before live verification. A passing unit test with a stale process is not release evidence.
- The root `validate` script is treated as a partial fast check until a separate `validate:full` command includes lint, build, contract, generated-artifact, database, security, and E2E gates.

## ⛔ Execution Gate

Before executing any phase:

- [ ] Read this plan and create a task-based checklist from the Execution Checklist section.
- [ ] Confirm the current checkout, branch, clean/dirty state, and target environment.
- [ ] Identify which work is coordinator-owned and which bounded review or implementation work is delegated.
- [ ] Confirm the current database is disposable/local or that an approved backup exists before migration work.
- [ ] Confirm no real secrets will be copied into tracked files, logs, fixtures, screenshots, or generated artifacts.
- [ ] Load `test-authoring` before writing tests and `playwright-testing` before writing or running E2E tests.

## Execution Checklist

When this plan is executed, the coordinator will create tasks for the following exact sequence. Every phase is followed by a separate review task.

- [ ] Phase 0: Baseline, schema discovery, and gap inventory
- [ ] Review Phase 0: Verify repository paths, live schema evidence, and scope coverage
- [ ] Phase 1: Contract expansion and generated-artifact pipeline
- [ ] Review Phase 1: Verify OpenAPI completeness, response/error contracts, and generation
- [ ] Phase 2: Database foundation and migration/backfill safety
- [ ] Review Phase 2: Verify schema, indexes, migration reversibility, and tenant/data boundaries
- [ ] Phase 3: Authentication, account security, and session lifecycle
- [ ] Review Phase 3: Verify password, session, CSRF, lockout, recovery, verification, and MFA security
- [ ] Phase 4: Roles, permissions, and authorization policy
- [ ] Review Phase 4: Verify privilege boundaries, denial paths, and permission tests
- [ ] Phase 5: User lifecycle, profile, status, soft delete, and restore
- [ ] Review Phase 5: Verify CRUD invariants, recovery behavior, privacy, and audit events
- [ ] Phase 6: Search, filtering, bulk actions, import, and export
- [ ] Review Phase 6: Verify data validation, limits, duplicate handling, and job/error behavior
- [ ] Phase 7: Audit logs, notifications, email delivery, and preferences
- [ ] Review Phase 7: Verify audit completeness, notification delivery, retry, and secret redaction
- [ ] Phase 8: Organizations, teams, memberships, invitations, and tenant isolation
- [ ] Review Phase 8: Verify isolation, membership transitions, invitations, and cross-tenant denial
- [ ] Phase 9: MFA, SSO/OIDC, API keys, and advanced identity integrations
- [ ] Review Phase 9: Verify authentication assurance, token handling, revocation, and provider failures
- [ ] Phase 10: Admin dashboard, settings, sessions, and operational controls
- [ ] Review Phase 10: Verify dashboard accuracy, settings authorization, session controls, and UI states
- [ ] Phase 11: Complete frontend experience, accessibility, responsive behavior, and design consistency
- [ ] Review Phase 11: Verify real browser flows, accessibility, visual states, and frontend scope
- [ ] Phase 12: Test pyramid, security verification, performance, and contract evidence
- [ ] Review Phase 12: Verify meaningful assertions, negative paths, coverage of every feature, and no flaky tests
- [ ] Phase 13: Deployment, observability, backups, recovery, CI/CD, and release documentation
- [ ] Review Phase 13: Verify operational readiness, rollback, secrets, monitoring, and runbooks
- [ ] Phase 14: Final integration, user walkthrough, adversarial review, and release gate
- [ ] Run final iterative adversarial review on the full implementation
- [ ] Verify all reviews completed with zero CRITICAL and zero HIGH findings
- [ ] Restart affected services and complete live browser verification
- [ ] Commit and push only the verified implementation after the release gate passes

## EXIT VERIFICATION

| Phase | Status | TDD evidence | Tests passing | Reviewer verdict |
| --- | --- | --- | --- | --- |
| Phase 0: Baseline/schema | Local evidence recorded | N/A | PASS | Not independently reviewed |
| Phase 1: Contracts | Local contract and generated artifacts implemented | Local generation check | PASS | Not independently reviewed |
| Phase 2: Database foundation | Migrations through `20261023_0007` applied to current and disposable clean local DBs | Migration/model checks | PASS | Not independently reviewed |
| Phase 3: Authentication/security | Local lifecycle/security paths implemented | Backend tests and auth smoke | PASS | Not independently reviewed |
| Phase 4: Authorization | Organization roles, permissions, membership and API-key boundaries implemented | Focused denial smoke | PASS | Not independently reviewed |
| Phase 5: User lifecycle | Canonical organization CRUD, status, soft-delete/restore paths implemented | Backend + browser CRUD | PASS | Not independently reviewed |
| Phase 6: Bulk/data workflows | Local bulk/import/export API surface and admin operations UI implemented | Focused API/browser smoke | PASS for local surface; worker/download pending | Not independently reviewed |
| Phase 7: Audit/notifications | Audit, notification preferences and local delivery adapter implemented | Delivery/API smoke | PASS for local adapter; provider delivery pending | Not independently reviewed |
| Phase 8: Organizations/teams | Organization, role, team, membership and invitation API paths plus admin UI implemented | Tenant/invitation/browser smoke | PASS for local surface | Not independently reviewed |
| Phase 9: Advanced identity | Local MFA/API-key boundary and explicit OIDC dependency boundary implemented | MFA/API-key/OIDC smoke | PASS for local boundaries; production identity pending | Not independently reviewed |
| Phase 10: Admin operations | Dashboard, organization admin, security/session and notification preference screens implemented | Frontend checks and browser admin/CRUD flows | PASS for implemented screens | Not independently reviewed |
| Phase 11: Frontend completion | Typed canonical API integration and admin/core screens implemented | Lint/typecheck/unit/build/E2E | PASS for implemented surface; accessibility audit pending | Not independently reviewed |
| Phase 12: Test/security/performance | Local validation and browser evidence captured | Contract, generated, lint, typecheck, unit, backend, build, E2E | PASS for executed checks | Not independently reviewed |
| Phase 13: Operations/release docs | Local Docker/migration/startup/troubleshooting documentation updated | Local health and migration checks | PASS locally; production ops pending | Not independently reviewed |
| Phase 14: Final integration/release | Local integration completed; release gate intentionally open | Headed/headless CRUD E2E | PASS locally; release artifacts pending | BLOCKED: no independent PASS, commit, push, or deployment approval |

The coordinator updates this table in the plan after each phase and review. A phase cannot be marked complete from a passing test command alone; its user-visible behavior, evidence, documentation, and review gate must pass.

## Current-State Evidence

The plan was grounded in the current checkout, not the historical JavaScript structure:

- Nx currently discovers `frontend` and `backend` projects through `apps/frontend/project.json` and `apps/backend/project.json`.
- The frontend is React + TypeScript + Vite with Redux, Material UI, generated OpenAPI types, Vitest, and Playwright.
- The backend is FastAPI + SQLAlchemy async + Alembic + PostgreSQL + optional Redis.
- Existing authentication uses database-backed opaque sessions, HttpOnly cookies, CSRF tokens, Argon2id password hashes, and admin-protected CRUD routes.
- Existing user routes cover list, create, get, patch, and soft-delete. List supports page, page size, search, allowlisted sort, and order.
- Existing user data contains profile fields, hobbies, custom hobbies, role, active state, timestamps, and soft-delete state.
- Existing infrastructure includes request IDs, structured telemetry, health/readiness endpoints, rate-limit headers, CORS, trusted hosts, generated artifacts, CI, and Docker Compose for PostgreSQL/Redis.
- Existing frontend screens are login and user management. Existing UI handles loading, empty search, API error, create/edit/delete, pagination, sorting, and one-time legacy localStorage import/backup.
- Current gaps include password/account lifecycle, permissions beyond the initial admin boundary, rich user lifecycle management, audit UI, notification delivery, organization isolation, MFA/SSO, bulk workflows, dashboard/settings, production operations, and complete E2E evidence.

## Resolved Architecture Decisions

These are engineering defaults for this plan and do not require a separate owner decision:

| Area | Decision |
| --- | --- |
| Backend shape | Keep one FastAPI modular monolith; separate API, service, model, and core policy boundaries. |
| Contract source | Keep `docs/api/openapi.yaml` as the only hand-authored API contract. |
| Database | PostgreSQL with async SQLAlchemy and Alembic migrations. |
| Cache/rate limits | Redis for shared rate limiting, worker transport, and cacheable read models where needed; PostgreSQL remains authoritative for jobs and business state. |
| Sessions | Opaque, hashed, revocable server sessions in HttpOnly cookies; no access tokens in localStorage. |
| Passwords | Argon2id; raw passwords never logged or persisted. |
| MFA | TOTP with hashed recovery codes and explicit enrollment/revocation events. |
| SSO | Provider-neutral OIDC adapter with configuration-driven issuer/client settings; no provider lock-in. |
| Authorization | `organization_memberships.role_id` plus `role_permissions` is the canonical authorization source for organization-scoped requests. The legacy `users.role` field is mapped during migration, becomes read-only compatibility data, is removed from authorization code, and is dropped only after the contract migration. Route handlers call one centralized policy dependency. |
| Identity versus tenancy | Users are global identities. Organization membership owns visibility and role. Tenant resources use a verified `organizationId` path context; a session `active_organization_id` is only a UI convenience and is never trusted without membership verification. Jobs, audit rows, notifications, API keys, exports, and caches carry organization context explicitly. |
| User lifecycle | `users.status` is canonical with `pending`, `active`, `inactive`, `suspended`, `locked`, and `deleted` values. `deleted_at` is set only for `deleted`; `is_active` is removed from write requests and exposed only as a derived compatibility response until the contract cutover. This permits deactivation without soft deletion. |
| Deletion | Soft delete maps to `status=deleted` and `deleted_at`; restore maps to `status=inactive` or `active` by explicit operator choice. Active-email uniqueness is a partial normalized-email index for all non-deleted records. Physical deletion is an operator-controlled retention action, not a UI CRUD shortcut. |
| Email | Provider-neutral email port; local development uses a safe sink, while staging/production injects a real provider. |
| File import/export | Bounded, validated CSV first; reject oversized or malformed files with explicit limits and row-level results. |
| Background work | Use PostgreSQL `background_jobs` plus a transactional `job_dispatch_outbox` as the durable record/dispatch handoff and an `arq` Redis worker as execution transport. Jobs have a lease, idempotency key, bounded retries/backoff, cancellation state, heartbeat, dead-letter/failed state, and a dedicated Nx/Docker worker target. |
| CSRF | Keep the current response-plus-memory double-submit model: login and `GET /auth/csrf` return the token, the frontend stores it only in memory, mutations send `X-CSRF-Token`, and responses use `Cache-Control: no-store` and `Vary: Cookie`. Rotate on login/session restoration and recover safely on `403`. |
| MFA secret protection | Encrypt TOTP secrets at rest using an approved runtime key supplied by environment/secret manager; document key rotation and fail closed if the key is absent outside local/test. No new KMS vendor is selected by this plan. |
| API-key transport | Use `Authorization: Bearer umk_<prefix>_<secret>` only; never accept keys in query strings, cookies, or CSRF headers. API-key requests do not require browser CSRF, have explicit scope/organization binding, and cannot call browser-only session endpoints. |
| Audit durability | Write the audit row in the same database transaction as the state mutation. Use an outbox only for notifications/email. Application roles cannot update/delete audit rows; PostgreSQL privileges and an append-only trigger enforce this, with retention documented. |
| Rollout | Normal branch/CI/deployment release; no new feature-flag system. |

## Feature Coverage Matrix

| Feature | Current baseline | Planned phase | Required proof |
| --- | --- | --- | --- |
| Admin login/logout/session restore | Implemented | Phase 3 hardening | API + browser auth tests |
| HttpOnly sessions and CSRF | Implemented | Phase 3 hardening | Cookie, CSRF, expiry, revocation tests |
| Password change/reset | Local API and security UI implemented; provider delivery remains local-only | Phase 3 | Contract, service, delivery, E2E |
| Email verification | Local token lifecycle and delivery boundary implemented | Phase 3 | Token expiry/replay and delivery tests |
| Account lockout/login history | Local failure counters and lockout behavior implemented | Phase 3 | Failure counter and audit tests |
| MFA/TOTP/recovery codes | Local-process enrollment boundary implemented | Phase 9 | Persistent production secret/challenge review remains |
| SSO/OIDC | Explicit provider-unavailable boundary implemented | Phase 9 | Provider adapter and issuer decision remain |
| User CRUD | Implemented | Phase 5 hardening | CRUD, conflict, authorization, browser flow |
| User profile/detail | Organization-scoped profile read/edit path and CRUD UI implemented | Phase 5/11 | Detail, edit, privacy, UI tests |
| Activate/deactivate | Canonical status transition API implemented | Phase 5 | Lifecycle and access denial tests |
| Soft delete/restore | Explicit organization restore and soft-delete paths implemented | Phase 5 | Restore, uniqueness, audit tests |
| Search/filter/sort/pagination | Implemented basic | Phase 6 | Query, index, UI, limit tests |
| Bulk actions | Local bounded API/job records and admin job history UI implemented | Phase 6 | Worker/retry/crash-recovery proof remains |
| CSV import/export | Local preview/commit/export routes and admin UI implemented | Phase 6 | Worker/download delivery remains |
| Roles and permissions | Organization role/permission policy and admin UI implemented | Phase 4 | Policy matrix and denial tests |
| Audit logs | Organization audit route and admin history UI implemented | Phase 7 | Append-only database enforcement remains |
| In-app/email notifications | In-app/preferences and local delivery adapter implemented | Phase 7 | Provider delivery/retry remains |
| Sessions page/revocation | Security screen lists and revokes sessions | Phase 10 | Revoke current/other session tests |
| Admin dashboard | Dashboard route and screen implemented | Phase 10 | Aggregate accuracy and permissions |
| System/user settings | Organization settings route and admin screen implemented | Phase 10/11 | Configuration and validation tests |
| Organizations/teams | Tenant, team, membership, and admin team screen implemented | Phase 8 | Cross-tenant and membership UI tests |
| Invitations | Token lifecycle, delivery boundary, and admin invitation screen implemented | Phase 8 | Token, expiry, accept/revoke tests |
| API keys | Hashing, scopes, revocation, and admin screen implemented | Phase 9 | Exposure and revocation tests |
| Responsive/accessibility UI | Partial | Phase 11 | Automated and manual browser evidence |
| Observability/metrics | Basic structured logs | Phase 13 | Event/metric assertions and dashboards |
| Backups/recovery/deployment | Local runbook only | Phase 13/14 | Restore drill and release evidence |

## Contract Surface

All endpoints below are contract-first. Exact request/response schemas, error codes, pagination fields, `429` responses, security requirements, and audit semantics are defined in OpenAPI before implementation.

### Authentication endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Authenticate with email/password and return either an authenticated session response or an expiring MFA challenge response; never issue a session before MFA verification. |
| `POST` | `/api/v1/auth/logout` | Revoke the current session and clear the cookie. |
| `GET` | `/api/v1/auth/me` | Return the authenticated user. |
| `GET` | `/api/v1/auth/csrf` | Rotate/return the current CSRF token. |
| `POST` | `/api/v1/auth/password/change` | Change the authenticated user's password. |
| `POST` | `/api/v1/auth/password/forgot` | Request a reset without revealing account existence. |
| `POST` | `/api/v1/auth/password/reset` | Consume a one-time reset token. |
| `POST` | `/api/v1/auth/password/set-initial` | Set the first password for an invited/pending account after invitation validation. |
| `POST` | `/api/v1/auth/email/verify` | Verify an email token. |
| `POST` | `/api/v1/auth/mfa/enroll` | Begin TOTP enrollment. |
| `POST` | `/api/v1/auth/mfa/verify` | Confirm TOTP enrollment. |
| `POST` | `/api/v1/auth/mfa/challenge/verify` | Complete a pending login/step-up MFA challenge and issue/upgrade a session. |
| `POST` | `/api/v1/auth/mfa/disable` | Disable MFA with current assurance. |
| `POST` | `/api/v1/auth/mfa/recovery-codes/rotate` | Rotate recovery codes after step-up authentication. |
| `POST` | `/api/v1/auth/mfa/recovery-codes/use` | Consume one recovery code during a challenge. |
| `POST` | `/api/v1/auth/oidc/start` | Create a short-lived OIDC transaction for existing-user login or a verified invitation-bound flow; organization/invitation context is validated from the request body and persisted in the transaction. |
| `GET` | `/api/v1/auth/oidc/{provider}/callback` | Validate state/nonce/PKCE and complete provider sign-in. |
| `POST` | `/api/v1/organizations/{organizationId}/auth/oidc/{provider}/link` | Link a verified external identity after step-up authentication and verified membership in that organization. |
| `GET` | `/api/v1/auth/sessions` | List active sessions without raw tokens. |
| `DELETE` | `/api/v1/auth/sessions/{sessionId}` | Revoke one session. |
| `DELETE` | `/api/v1/auth/sessions` | Revoke all other sessions. |

### User and administration endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/organizations/{organizationId}/users` | Search, filter, sort, and paginate users visible in one organization. |
| `POST` | `/api/v1/organizations/{organizationId}/users` | Create a pending profile with an organization membership. |
| `GET` | `/api/v1/organizations/{organizationId}/users/{userId}` | Return one visible organization-scoped profile. |
| `PATCH` | `/api/v1/organizations/{organizationId}/users/{userId}` | Update profile fields. |
| `DELETE` | `/api/v1/organizations/{organizationId}/users/{userId}` | Soft-delete a profile. |
| `POST` | `/api/v1/organizations/{organizationId}/users/{userId}/restore` | Restore a soft-deleted profile. |
| `PATCH` | `/api/v1/organizations/{organizationId}/users/{userId}/status` | Activate, deactivate, suspend, or lock a profile. |
| `GET` | `/api/v1/organizations/{organizationId}/users/{userId}/activity` | Return authorized user activity. |
| `POST` | `/api/v1/organizations/{organizationId}/users/bulk/status` | Apply bounded status changes. |
| `POST` | `/api/v1/organizations/{organizationId}/users/bulk/delete` | Soft-delete a bounded authorized selection. |
| `POST` | `/api/v1/organizations/{organizationId}/users/bulk/restore` | Restore a bounded authorized selection. |
| `POST` | `/api/v1/organizations/{organizationId}/users/bulk/roles` | Apply a validated role assignment to a bounded selection. |
| `POST` | `/api/v1/organizations/{organizationId}/users/import/preview` | Validate an uploaded CSV without mutation. |
| `POST` | `/api/v1/organizations/{organizationId}/users/import/commit` | Commit an approved import with row results. |
| `GET` | `/api/v1/organizations/{organizationId}/users/export` | Export authorized filtered users; register before the `/{userId}` route. |
| `GET` | `/api/v1/organizations/{organizationId}/jobs/{jobId}` | Read a caller-authorized organization job status. |
| `POST` | `/api/v1/organizations/{organizationId}/jobs/{jobId}/cancel` | Cancel a queued or running organization job. |
| `POST` | `/api/v1/organizations/{organizationId}/users/{userId}/avatar` | Upload a bounded validated avatar through a storage adapter. |
| `GET` | `/api/v1/organizations/{organizationId}/users/{userId}/avatar` | Read an authorized avatar reference. |
| `DELETE` | `/api/v1/organizations/{organizationId}/users/{userId}/avatar` | Remove an authorized avatar. |
| `GET` | `/api/v1/organizations/{organizationId}/users/{userId}/roles` | List effective and assigned roles. |
| `POST` | `/api/v1/organizations/{organizationId}/users/{userId}/roles` | Assign an allowed organization role. |
| `DELETE` | `/api/v1/organizations/{organizationId}/users/{userId}/roles/{roleId}` | Remove an allowed organization role. |
| `GET` | `/api/v1/organizations/{organizationId}/dashboard` | Return authorized dashboard aggregates. |
| `GET` | `/api/v1/organizations/{organizationId}/settings` | Read administrative settings. |
| `PATCH` | `/api/v1/organizations/{organizationId}/settings` | Update validated administrative settings. |
| `GET` | `/api/v1/organizations/{organizationId}/roles` | List organization roles and permissions. |
| `POST` | `/api/v1/organizations/{organizationId}/roles` | Create a managed organization role. |
| `PATCH` | `/api/v1/organizations/{organizationId}/roles/{roleId}` | Update role permissions. |
| `DELETE` | `/api/v1/organizations/{organizationId}/roles/{roleId}` | Delete a role after assignment checks. |
| `GET` | `/api/v1/permissions` | Return the global permission catalog; no tenant data is returned. |
| `GET` | `/api/v1/organizations/{organizationId}/audit-logs` | Filter and paginate immutable organization audit entries. |

### Organization, team, invitation, notification, and integration endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/organizations` | List organizations available to the caller. |
| `POST` | `/api/v1/organizations` | Create an organization. |
| `GET` | `/api/v1/organizations/{organizationId}` | Read organization identity/metadata. |
| `PATCH` | `/api/v1/organizations/{organizationId}` | Update organization identity/metadata. |
| `GET` | `/api/v1/organizations/{organizationId}/members` | List organization members. |
| `POST` | `/api/v1/organizations/{organizationId}/members` | Add an existing user. |
| `PATCH` | `/api/v1/organizations/{organizationId}/members/{userId}` | Change membership role/status. |
| `DELETE` | `/api/v1/organizations/{organizationId}/members/{userId}` | Remove membership. |
| `GET` | `/api/v1/organizations/{organizationId}/teams` | List teams. |
| `POST` | `/api/v1/organizations/{organizationId}/teams` | Create a team. |
| `PATCH` | `/api/v1/organizations/{organizationId}/teams/{teamId}` | Update a team. |
| `DELETE` | `/api/v1/organizations/{organizationId}/teams/{teamId}` | Delete a team. |
| `POST` | `/api/v1/organizations/{organizationId}/invitations` | Send an invitation. |
| `GET` | `/api/v1/organizations/{organizationId}/invitations` | List authorized invitations. |
| `POST` | `/api/v1/invitations/accept` | Accept an invitation using a body token; tokens never appear in URL paths or telemetry. |
| `DELETE` | `/api/v1/organizations/{organizationId}/invitations/{invitationId}` | Revoke an invitation. |
| `POST` | `/api/v1/organizations/{organizationId}/invitations/{invitationId}/resend` | Resend an invitation within abuse limits. |
| `GET` | `/api/v1/organizations/{organizationId}/notifications` | List organization notifications for the current user and return `unreadCount`. |
| `PATCH` | `/api/v1/organizations/{organizationId}/notifications/{notificationId}/read` | Mark one notification read. |
| `POST` | `/api/v1/organizations/{organizationId}/notifications/read-all` | Mark all visible notifications read. |
| `GET` | `/api/v1/organizations/{organizationId}/notifications/preferences` | Read delivery preferences. |
| `PATCH` | `/api/v1/organizations/{organizationId}/notifications/preferences` | Update delivery preferences. |
| `GET` | `/api/v1/organizations/{organizationId}/api-keys` | List organization-bound API-key metadata. |
| `POST` | `/api/v1/organizations/{organizationId}/api-keys` | Create an API key and show its raw value once over TLS. |
| `DELETE` | `/api/v1/organizations/{organizationId}/api-keys/{apiKeyId}` | Revoke an API key. |

Every endpoint has an endpoint-specific applicability matrix for `401`, `403`, `404`, `409`, `413`, `422`, `429`, `500`, and dependency-specific errors; the contract does not claim inapplicable responses. Every response includes the standard error envelope where relevant, and every response that can expose correlation includes `X-Request-ID`. Login/CSRF responses explicitly document the session-cookie and CSRF headers/body, `Cache-Control: no-store`, and `Vary: Cookie`.

OIDC uses authorization-code + state/nonce/PKCE routes and a persisted short-lived transaction. API keys use a separate `apiKey` security scheme with `Authorization: Bearer`, explicit route allowlists, organization scope, and no CSRF requirement. Browser session authentication remains the default for UI routes.

Tenant routing rule: users, roles, dashboard, settings, audit logs, teams, invitations, notifications, API keys, jobs, exports, imports, and membership mutations are organization-path scoped. The only global exceptions are authentication/session routes, organization discovery/creation, the permission catalog, and body-token invitation acceptance; each exception has its own membership or transaction validation rule and returns no unrelated tenant data.

## Target Data Model

The schema verifier must compare every field below with the live database before migrations are authored. The list is the target design, not permission to skip discovery.

| Table | Core fields and constraints |
| --- | --- |
| `users` | Existing profile fields, password state, `email_verified_at` and verification policy, lockout counters, last-login metadata, avatar reference, canonical `status` enum (`pending`, `active`, `inactive`, `suspended`, `locked`, `deleted`), `deleted_at` only when deleted, timestamps, normalized-email uniqueness for `deleted_at IS NULL`. Existing `is_active` is transitional compatibility data and is not authoritative. |
| `user_sessions` | Existing hashed session/CSRF tokens, user, `active_organization_id` convenience field, expiry (idle and absolute), revocation, `auth_level`, `step_up_expires_at`, device metadata, last-used timestamp, IP/user-agent redaction policy, security epoch/version. Session context must be rechecked against membership. |
| `roles` | Name, description, system/custom marker, organization scope, timestamps, uniqueness. Organization membership role assignment is canonical; the legacy user role is backfilled then retired. |
| `permissions` | Stable permission key, description, resource/action taxonomy. |
| `role_permissions` | Role/permission join with unique constraint and audit boundary. |
| `user_roles` | Optional global/system role join only; organization roles are held by `organization_memberships.role_id`. No two competing organization role sources are allowed. |
| `organizations` | Name, slug, status, settings, creator, timestamps, soft-delete policy. |
| `organization_memberships` | User/organization, membership status, canonical `role_id`, invited/accepted timestamps, uniqueness. Every tenant query joins this table or an equivalent scoped repository predicate. |
| `teams` | Organization, name, description, status, timestamps, unique name per organization. |
| `team_memberships` | Team/user join, membership role/status, uniqueness. |
| `invitations` | Organization/email/token hash, role ID, expiry, accepted/revoked timestamps, attempt limits, idempotency key; raw token is accepted only in a request body and never stored/logged. |
| `password_reset_tokens` | User/token hash, expiry, consumed timestamp, purpose, no raw token storage. |
| `email_verification_tokens` | User/token hash, expiry, consumed timestamp, no raw token storage. |
| `mfa_methods` | User, encrypted TOTP secret/reference, key version, enabled state, enrollment expiry, last-used, timestamps. Runtime key material is configuration/secret-manager supplied. |
| `mfa_recovery_codes` | MFA method, individually hashed code, generation, consumed timestamp, created timestamp, uniqueness/indexes, and atomic one-time consumption. |
| `mfa_challenges` | User, pending login/step-up transaction, requested assurance, attempt counter, expiry, consumed timestamp, organization context, and session-intent metadata. No session is issued before successful verification. |
| `oidc_transactions` | Provider, state hash, nonce hash, encrypted PKCE verifier with key version, exact redirect URI, expiry, one-time consumed timestamp, intended organization/invitation context. |
| `external_identities` | User, issuer, subject hash, provider metadata, verified email/link timestamp; unique `(issuer, subject)`, no email-only automatic linking. |
| `audit_logs` | Actor, organization, action, resource type/id, outcome, request ID, safe metadata, timestamp, immutable insert-only policy enforced by PostgreSQL privileges/trigger, retention metadata. |
| `notifications` | Recipient, explicit organization (or documented global-security scope), type, title/body, read state, delivery state, related resource, idempotency key, timestamps. |
| `notification_preferences` | User/organization preferences with safe defaults and validation. |
| `email_outbox` | Organization (or documented global-security scope), template, recipient reference, delivery state, retry count, provider ID, idempotency key, last error redacted, timestamps. |
| `api_keys` | User/organization, key hash, prefix, label, scopes, expiry, last-used, revoked timestamp; raw value shown once only. |
| `background_jobs` | Job type, owner, organization, status (`queued`, `running`, `succeeded`, `failed`, `cancelled`, `expired`), bounded progress, idempotency key, lease/heartbeat, retry state, error code, timestamps. PostgreSQL is authoritative; Redis is only execution transport. |
| `job_dispatch_outbox` | Job ID, dispatch state, attempt count, lease, idempotency key, and timestamps; written in the job transaction and reconciled by a worker/dispatcher so a DB/Redis crash cannot strand work. |
| `security_controls` | Exactly one global singleton row containing `security_epoch` and `worker_generation`, protected by a uniqueness constraint and atomic update procedure; every API/worker instance validates both values at startup and before resuming traffic/work. |

## Telemetry

All events use the existing backend `Telemetry` interface and a new equivalent frontend adapter. Events are structured, request-correlated, and redacted. High-cardinality values belong in `meta`; metric labels remain low-cardinality. Every behavior test injects a recording telemetry implementation and asserts the relevant events.

| Event family | Side | Required outcome events | Meta fields |
| --- | --- | --- | --- |
| `auth.login` | both | `started`, `succeeded`, `invalid_credentials`, `locked`, `rate_limited`, `dependency_failed` | `requestId`, safe user identifier hash, `durationMs`, `errorCode` |
| `auth.session` | server | `created`, `restored`, `expired`, `revoked`, `invalid`, `dependency_failed` | `requestId`, `userId`, `sessionId`, reason, `durationMs` |
| `auth.password` | both | `change_succeeded`, `change_rejected`, `reset_requested`, `reset_completed`, `reset_failed`, `token_expired`, `token_replayed` | `requestId`, userId where known, reason, duration |
| `auth.email` | both | `verification_sent`, `verified`, `invalid`, `expired`, `delivery_failed` | requestId, userId, provider outcome |
| `auth.mfa` | both | `enrollment_started`, `enrollment_succeeded`, `challenge_succeeded`, `challenge_failed`, `replayed`, `disabled`, `recovery_used` | requestId, userId, method, reason |
| `auth.sso` | both | `redirect_started`, `callback_succeeded`, `callback_rejected`, `provider_failed`, `state_replayed` | requestId, provider, subject hash, errorCode |
| `permission.check` | server | `allowed`, `unauthenticated`, `forbidden`, `tenant_denied`, `policy_failed` | requestId, userId, organizationId, permission, resource type |
| `user.lifecycle` | both | `created`, `updated`, `activated`, `deactivated`, `soft_deleted`, `restored`, `conflict`, `not_found`, `failed` | requestId, actorId, userId, changed fields allowlist |
| `user.bulk` | both | `started`, `validated`, `committed`, `partial`, `rejected`, `failed`, `rate_limited` | requestId, actorId, count, result counts, jobId |
| `user.import` | both | `previewed`, `committed`, `row_rejected`, `duplicate`, `oversized`, `failed` | requestId, actorId, file metadata without content, counts |
| `user.export` | both | `started`, `completed`, `oversized`, `forbidden`, `failed` | requestId, actorId, filter hash, count, duration |
| `audit.log` | server | `appended`, `rejected`, `failed` | requestId, actorId, action, resource, outcome |
| `notification` | both | `created`, `read`, `read_all`, `delivery_started`, `delivered`, `retried`, `failed`, `preference_rejected` | requestId, userId, notificationId, channel, attempt |
| `organization.membership` | both | `added`, `updated`, `removed`, `invited`, `accepted`, `revoked`, `tenant_denied`, `failed` | requestId, actorId, organizationId, userId, role |
| `api_key` | both | `created`, `listed`, `revoked`, `expired`, `rejected`, `failed` | requestId, actorId, keyId, scope count; never raw key |
| `job` | both | `queued`, `started`, `progressed`, `completed`, `retried`, `failed`, `cancelled`, `expired` | requestId, jobId, jobType, progress, duration |
| `ui.workflow` | client | `started`, `succeeded`, `validation_failed`, `unauthorized`, `forbidden`, `conflict`, `retry`, `failed` | route, workflow, requestId, duration, errorCode |

Required metrics include request duration by route/outcome, authentication failure count, active sessions, rate-limit rejects, import/export row counts, job duration/failures, notification delivery outcome, database pool health, Redis health, and active users. No user email, raw token, password, MFA secret, or full request body is placed in metric labels or logs.

### Rate-limit budget contract

Thresholds are configuration-backed, returned through standard `429` headers, and covered by boundary tests. Values below are the initial local/staging/production policy; a change requires a security review and documented config diff.

| Operation | Pre-auth budget | Post-auth/org budget | Redis failure policy |
| --- | --- | --- | --- |
| Login | 10/IP/15m and 5/normalized-email-hash/15m; account lock after 5 failed attempts/15m | N/A | Fail closed |
| Password forgot/reset/set-initial | 10/IP/15m and 3/email-hash/1h; 5 token attempts | N/A | Fail closed |
| MFA challenge/recovery | 20/IP/5m and 5/challenge-or-user/5m | 10/user/5m | Fail closed |
| OIDC start/callback | 20/IP/provider/15m and one active transaction/user | 20/user/org/15m | Fail closed for start/callback |
| Invitation send/resend | N/A | 10/org/1h and 3/recipient-hash/1h; 20/actor/org/1h | Fail closed |
| Invitation accept | 10/IP/15m and 5/opaque-token-digest/15m before validation; 5 token attempts | 10/resolved-recipient/org/1h after successful context resolution | Fail closed |
| API-key create/revoke | N/A | 5/actor/org/1h | Fail closed |
| Bulk/import/job admission | N/A | 20/actor/org/15m; one active import/export per actor/org | Fail closed |
| Export/download | N/A | 10/actor/org/15m; two concurrent jobs | Fail closed |
| Low-risk list/read | IP/path baseline 120/min | user/org/path 240/min | May fail open only with telemetry |

## Phase 0: Baseline, Schema Discovery, and Gap Inventory

**Owner:** Codex coordinator
**Purpose:** Establish a verified baseline before changing contracts or tables.

### Scope checklist

- [ ] Confirm the checkout is `/home/dhaval-tank/Project/user-management/user-management` on `main` and record `git status`, latest commit, and remote.
- [ ] Run `npx nx show projects` and record `frontend` and `backend` targets.
- [ ] Read current root README, backend README, API README, architecture decisions, and deployment runbook.
- [ ] Inspect every current API route, Pydantic schema, SQLAlchemy model, migration, frontend route, API client, Redux action/reducer, and E2E test.
- [ ] Start only the approved local disposable PostgreSQL/Redis services and verify readiness without printing credentials.
- [ ] Inspect live PostgreSQL tables, columns, indexes, constraints, extensions, migration revision, and row counts using a redacted schema report.
- [ ] Compare live schema to `Base.metadata` and the current Alembic revision.
- [ ] Record current generated-artifact hashes and contract validation status.
- [ ] Record current dependency warnings and known vulnerability findings without applying unsafe upgrades.
- [ ] Produce the gap matrix mapping every requested feature to route, schema, model, service, screen, test, telemetry, documentation, and owner phase.

### RED → GREEN → REFACTOR

This discovery phase has no behavior change. Its RED/GREEN evidence is the deliberate verification of commands and the redacted schema report; no implementation begins until the report is complete.

### File Manifest

| File | Purpose |
| --- | --- |
| `docs/plans/user-management-full/SCHEMA_REFERENCE.md` | Verified live schema, migration, indexes, constraints, and naming reference produced before database work. |
| `docs/plans/user-management-full/GAP_MATRIX.md` | Feature-to-artifact matrix with current status and phase ownership. |

### Hard Exit Criteria

- [ ] `npx nx show projects`, `npm run validate:api`, `npm run check:generated`, frontend checks, backend checks, and local service health have recorded output.
- [ ] `SCHEMA_REFERENCE.md` contains verified live database evidence and no secrets.
- [ ] `GAP_MATRIX.md` covers every row in the Feature Coverage Matrix.
- [ ] No migration or implementation work started against an unverified schema.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

The reviewer checks repository paths, current behavior, schema evidence, contract drift, feature coverage, and whether any planned feature was accidentally omitted.

## Phase 1: Contract Expansion and Generated Artifacts

**Owner:** Codex coordinator or contract-design worker
**Required skill:** `contract-designer`
**Dependency:** Phase 0 PASS

### Scope checklist

- [ ] Update `docs/api/openapi.yaml` for every route in the Contract Surface section.
- [ ] Define request/response schemas for profiles, statuses, permissions, roles, sessions, audit logs, notifications, organizations, teams, invitations, MFA, OIDC, API keys, import/export results, jobs, dashboard aggregates, and settings.
- [ ] Define success, validation, unauthorized, forbidden, conflict, not-found, oversized, rate-limited, dependency-failure, and internal-error responses.
- [ ] Define cookie, CSRF, API-key, MFA, OIDC-state, and organization security requirements.
- [ ] Choose and document the CSRF response-plus-memory model: raw CSRF is allowed only in the login/CSRF response body, never in logs, persistence, screenshots, or generic error details; add `Cache-Control: no-store` and `Vary: Cookie`.
- [ ] Add an endpoint applicability table for `401`, `403`, `404`, `409`, `413`, `422`, `429`, `500`, and dependency failures instead of claiming every response on every route.
- [ ] Define `Authorization: Bearer umk_...` as the only API-key transport, its route allowlist, scope/organization binding, precedence with browser sessions, and no query/cookie transport.
- [ ] Define OIDC start/callback/link routes, transaction persistence fields, issuer/audience/redirect validation, and account-linking behavior.
- [ ] Define pagination/filter/sort semantics and stable ordering.
- [ ] Define idempotency keys for password reset, invitations, imports, bulk writes, notification delivery, and job submission where applicable.
- [ ] Add `429` documentation for every rate-limited endpoint.
- [ ] Validate that all public fields use the existing camelCase contract convention.
- [ ] Regenerate Python schemas and TypeScript API types using existing scripts.
- [ ] Update `scripts/check_generated.sh`, `scripts/generate_python_schemas.sh`, and `scripts/validate_api_contract.sh` only if the expanded contract requires it.
- [ ] Add contract fixtures for all error envelopes and representative payloads without secrets.

### RED → GREEN → REFACTOR

- [ ] RED: Add contract validation tests for missing schemas, missing error responses, and generated-artifact drift.
- [ ] GREEN: Expand the OpenAPI document and generation commands until validation passes.
- [ ] REFACTOR: Remove duplication, keep schemas composable, and verify generated outputs are deterministic.

### File Manifest

| File | Purpose |
| --- | --- |
| `docs/api/openapi.yaml` | Expanded API contract and security/error definitions. |
| `apps/backend/app/generated/schemas.py` | Generated Pydantic schemas; never hand-edit. |
| `apps/frontend/src/generated/api-types.ts` | Generated TypeScript types; never hand-edit. |
| `scripts/check_generated.sh` | Contract drift gate. |
| `scripts/generate_python_schemas.sh` | Backend schema generation. |
| `scripts/validate_api_contract.sh` | OpenAPI validation gate. |
| `apps/backend/tests/test_contract_schemas.py` | Backend schema/error contract tests. |
| `apps/frontend/src/api/contract.test.ts` | Frontend contract shape tests. |

### Telemetry

Contract validation emits `contract.validation.started`, `contract.validation.failed`, `contract.validation.succeeded`, `contract.generation.failed`, and `contract.generation.succeeded` in CI metadata. Tests assert command exit status, generated file existence, and deterministic output; no payload secrets are logged.

### Hard Exit Criteria

- [ ] OpenAPI validates successfully.
- [ ] Generated Python and TypeScript artifacts are current.
- [ ] Every endpoint has auth, error, rate-limit, and request-ID documentation.
- [ ] Contract tests fail when a generated artifact is intentionally changed and pass after regeneration.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Contract, schema, rate-limit, and directory/path reviewers verify the complete route inventory and reject hand-written DTO/type drift.

## Phase 2: Database Foundation and Migration Safety

**Owner:** Codex coordinator or database worker
**Dependency:** Phase 0 and Phase 1 PASS

### Scope checklist

- [ ] Add or alter tables from the Target Data Model only after comparing with `SCHEMA_REFERENCE.md`.
- [ ] Add required PostgreSQL extensions and indexes with explicit migration guards.
- [ ] Preserve current profile data and active-email behavior.
- [ ] Add security, role, organization, notification, audit, API-key, and job fields/tables in dependency order.
- [ ] Write bounded backfills for existing rows; record counts before and after.
- [ ] Add database constraints for ownership, uniqueness, enum/status values, timestamps, and soft-delete consistency.
- [ ] Replace the current `is_active`/`deleted_at` check with canonical `users.status`: backfill deleted rows to `deleted`, non-deleted rows with a password and verified email to `active`, and passwordless or unverified rows to `pending`; preserve active-email behavior with a partial normalized-email index. `inactive` must be representable without `deleted_at`.
- [ ] During the compatibility window, dual-write `status` and a derived `is_active` projection (`active` only => true; `pending`, `inactive`, `suspended`, `locked`, and `deleted` => false), switch every auth/list reader to `status`, explicitly reject pending users in old readers, remove the old check constraint, then drop the old column only after frontend/API cutover. Test the exact ordering against both old and new readers.
- [ ] For local/test only, create one deterministic default organization before backfilling tenant data, assign existing users to it, map legacy `users.role=admin` to system/org-owner and all other users to org-member, and assign/reconcile the bootstrap admin atomically. For staging/production, require an explicit mapping artifact and abort on ambiguous or unmapped rows; never silently collapse unknown tenant ownership.
- [ ] Add `email_verified_at` with a deterministic legacy policy: existing baseline users are marked verified only when an approved migration input explicitly says so; otherwise they remain `pending` and must complete verification/set-initial-password. Local/test bootstrap sets the generated admin as verified and active atomically; production bootstrap requires explicit provisioning input.
- [ ] Make `organization_memberships.role_id` the only canonical organization authorization source. Keep `users.role` read-only only during the compatibility window, remove it from authorization, and define the migration that drops it after frontend/API cutover.
- [ ] Add a durable `background_jobs` table before worker code; add organization ownership, idempotency uniqueness, lease/heartbeat, retry/backoff, and cancellation constraints.
- [ ] Add `job_dispatch_outbox` and a reconciler/dispatcher so job creation and dispatch intent commit atomically; prove recovery from a crash between PostgreSQL commit and Redis enqueue.
- [ ] Add `security_controls` with the authoritative `security_epoch` and `worker_generation` controls used by restore/rollback fencing.
- [ ] Add locked runtime dependency bands through `uv add`: `arq>=0.26,<1` for the Redis worker, `authlib>=1.3,<2` for OIDC, `pyotp>=2.9,<3` for TOTP, `cryptography>=42,<47` for envelope encryption, and `python-multipart>=0.0.9,<1` for bounded uploads. Add `pip-audit` and `gitleaks` as explicitly pinned CI/dev tools; run `uv lock` and record the resulting `uv.lock` diff.
- [ ] Add `oidc_transactions` and `external_identities` with unique `(issuer, subject)` and one-time transaction consumption.
- [ ] Add PostgreSQL privileges/triggers that make `audit_logs` append-only to application roles.
- [ ] Add query indexes for email, status, organization, team, search, audit time/resource, notification state, and job state.
- [ ] Ensure migrations are transactional where possible and fail closed where not.
- [ ] Add a documented forward migration and reviewed rollback/restore procedure; do not invent migration timestamps.
- [ ] Use the explicit revision IDs and parent chain in the manifest (`0002` -> `0003` -> `0004` -> `0005`) with the current baseline revision as the root parent. Record `alembic history` and the final file paths in `SCHEMA_REFERENCE.md`.
- [ ] Verify a fresh database, current local database, and representative legacy data database.

### RED → GREEN → REFACTOR

- [ ] RED: Add migration/schema tests that fail against the old schema for each new invariant.
- [ ] GREEN: Implement Alembic migrations and backfills generated with Alembic naming.
- [ ] REFACTOR: Consolidate indexes/constraints, remove duplicate migration logic, and make backfills idempotent.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/models/user.py` | Extend user security/profile/lifecycle fields. |
| `apps/backend/app/models/session.py` | Extend session device/revocation metadata. |
| `apps/backend/app/models/role.py` | Roles, permissions, and assignment models. |
| `apps/backend/app/models/oidc.py` | OIDC transaction and external-identity models. |
| `apps/backend/app/models/mfa_challenge.py` | Pending login/step-up MFA challenge model. |
| `apps/backend/app/models/organization.py` | Organization and membership models. |
| `apps/backend/app/models/team.py` | Team and team-membership models. |
| `apps/backend/app/models/invitation.py` | Invitation lifecycle model. |
| `apps/backend/app/models/password_reset.py` | Password/email token models. |
| `apps/backend/app/models/mfa.py` | MFA method and recovery-code models. |
| `apps/backend/app/models/audit.py` | Immutable audit-log model. |
| `apps/backend/app/models/notification.py` | Notification, preference, and outbox models. |
| `apps/backend/app/models/api_key.py` | Hashed API-key metadata model. |
| `apps/backend/app/models/job.py` | Durable import/export/background-job model. |
| `apps/backend/app/models/job_dispatch.py` | Transactional job-dispatch outbox model and reconciliation state. |
| `apps/backend/app/models/security_control.py` | Security epoch and worker-generation control model. |
| `apps/backend/alembic/versions/0002_user_security_foundation.py` | User/session status and security migration; create with `alembic revision --rev-id 0002_user_security_foundation`. |
| `apps/backend/alembic/versions/0003_authorization_foundation.py` | Roles/permissions migration; parent `0002_user_security_foundation`. |
| `apps/backend/alembic/versions/0004_organizations_and_teams.py` | Organization/team/membership migration and deterministic legacy backfill; parent `0003_authorization_foundation`. |
| `apps/backend/alembic/versions/0005_audit_notifications_identity_jobs.py` | Audit, notification, OIDC, API-key, and job/security-control migration; parent `0004_organizations_and_teams`. |
| `apps/backend/app/main.py` | Register every new router, middleware, exception handler, and startup/shutdown dependency. |
| `apps/backend/app/models/__init__.py` | Register every ORM model for metadata and migration discovery. |
| `apps/backend/alembic/env.py` | Import complete metadata and apply redacted migration configuration. |
| `apps/backend/app/core/config.py` | Add environment-specific fail-closed validation and new dependency settings. |
| `apps/backend/app/core/tenant.py` | Tenant context dependency and scoped repository contract. |
| `apps/backend/app/worker.py` | Durable Redis worker entry point and graceful shutdown. |
| `apps/backend/project.json` | Migration, worker, readiness, and integration-test targets. |
| `apps/backend/docker-compose.yml` | Local worker and dependency health checks. |
| `apps/backend/pyproject.toml` | Explicit dependencies for worker, OIDC, MFA, email, storage, metrics, and test tooling. |
| `apps/backend/uv.lock` | Reproducible backend dependency lockfile. |
| `apps/backend/tests/test_schema_migrations.py` | Fresh/current/legacy migration verification. |

### Telemetry

Migration tooling emits `migration.started`, `migration.succeeded`, `migration.failed`, `migration.backfill.started`, `migration.backfill.completed`, and `migration.backfill.failed` with revision, duration, and row counts only.

### Hard Exit Criteria

- [ ] Phase 0 schema reference matches every migration field and index.
- [ ] Fresh and current databases reach the same revision.
- [ ] Backfills are idempotent and row counts reconcile.
- [ ] Constraints prevent invalid direct writes.
- [ ] Migration and provider-neutral restore simulation procedures are documented and exercised; a real provider backup/restore drill is explicitly `BLOCKED: requires human decision` until the Scope Cuts decision is approved.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Schema reviewer verifies every column, join, constraint, index, migration dependency, and rollback statement against the live/schema reference. Security reviewer verifies token and secret storage.

## Phase 3: Authentication, Account Security, and Session Lifecycle

**Owner:** Codex coordinator or authentication worker
**Dependency:** Phases 1–2 PASS

### Scope checklist

- [ ] Preserve login/logout/current-user/CSRF behavior and fix host/cookie consistency across local, staging, and production.
- [ ] Make login return a discriminated `authenticated` or `challengeRequired` response. For MFA-enabled users create a durable expiring `mfa_challenges` row and do not issue an authenticated session until `/auth/mfa/challenge/verify` succeeds; sessions record `auth_level` and step-up expiry.
- [ ] Define browser authentication origin policy for login, session restoration, logout, and identity linking: validate exact configured `Origin` when present, reject disallowed origins, apply Fetch Metadata checks, and define the missing-`Origin` behavior for same-origin/non-browser clients. Add cross-site POST and missing-origin tests.
- [ ] Add password change with current-password verification, explicit password length/complexity/breached-password policy, Argon2id parameters, rehash-on-login policy, mandatory current-session rotation, and mandatory revoke-all-other-sessions behavior after password change/reset.
- [ ] Add password-reset request and completion with one-time hashed tokens, expiry, replay protection, enumeration-safe responses, and email delivery.
- [ ] Add pending-account provisioning: administrator-created users receive `status=pending`, cannot log in until invitation/set-initial-password and required verification complete, and transition explicitly to `active`.
- [ ] Add email verification with one-time hashed tokens, expiry, replay protection, and verified-state enforcement policy.
- [ ] Add atomic failed-login tracking keyed by account and IP, explicit threshold/window/duration, generic lockout response, safe admin/unlock recovery, and audit events. Reset counters only after a successful authenticated login transaction.
- [ ] Add login history with privacy-safe device/IP metadata and retention controls defined in configuration.
- [ ] Add session listing with device/browser metadata, last-used timestamp, expiry, current-session marker, and revoke-one/revoke-all-other operations.
- [ ] Define idle and absolute session expiry, session-version checks, mandatory revocation after password recovery and MFA changes, and a restore/rollback `SESSION_EPOCH` rotation procedure.
- [ ] Use the response-plus-memory CSRF model: raw CSRF may appear only in the designated login/CSRF response body; all other raw password, session, reset, verification, invitation, and recovery values stay out of logs, database, telemetry, screenshots, fixtures, and unrelated API responses.
- [ ] Make the configured session-cookie name the only source of truth in `config.py`, auth dependencies, OpenAPI, and tests; no hardcoded `session_id` fallback remains.
- [ ] Add `Cache-Control: no-store` and `Vary: Cookie` to login/CSRF responses and define multi-tab rotation/retry behavior after a CSRF `403`.
- [ ] Keep bootstrap-admin behavior idempotent and provide a documented post-bootstrap credential rotation flow.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add service tests for valid/invalid password, reset expiry/replay, verification, lockout, session expiry/revocation, and cookie policy.
- [ ] GREEN: Implement service/API behavior and secure token lifecycle.
- [ ] RED: Add route tests for every status and error envelope.
- [ ] GREEN: Implement contract-compliant routes and middleware wiring.
- [ ] REFACTOR: Centralize policy, remove duplicated token logic, and verify failure timing/enumeration behavior.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/api/auth.py` | Authentication, password, verification, and session routes. |
| `apps/backend/app/core/auth.py` | Session, CSRF, authentication assurance, and policy dependencies. |
| `apps/backend/app/core/security.py` | Password/token/MFA hashing and verification helpers. |
| `apps/backend/app/core/email.py` | Email delivery port and safe local sink. |
| `apps/backend/app/core/rate_limit.py` | Operation-specific authentication/security rate limits and failure policy. |
| `apps/backend/app/core/logging.py` | Central sensitive-field scrubber used before logs/telemetry. |
| `apps/backend/app/services/auth.py` | Password, verification, lockout, session, and recovery business rules. |
| `apps/backend/app/services/sessions.py` | Session listing, revocation, and device metadata service. |
| `apps/backend/app/models/mfa_challenge.py` | Durable pending login/step-up MFA challenge model and lifecycle. |
| `apps/frontend/src/api/authApi.ts` | Handwritten typed authentication adapter using generated OpenAPI types. |
| `apps/frontend/src/api/httpClient.ts` | CSRF in-memory header, 401/403 recovery, request correlation, and safe retry transport owner. |
| `apps/frontend/src/api/httpClient.test.ts` | Transport tests for CSRF rotation, 401 logout, 403 retry limits, idempotency, and correlation headers. |
| `apps/frontend/src/pages/ForgotPasswordPage.tsx` | Password-reset request screen. |
| `apps/frontend/src/pages/ResetPasswordPage.tsx` | Password-reset completion screen. |
| `apps/frontend/src/pages/ProfilePage.tsx` | Profile/password/session security screen. |
| `apps/frontend/src/pages/EmailVerificationPage.tsx` | Email verification screen. |
| `apps/frontend/src/components/auth/MfaChallenge.tsx` | MFA challenge UI. |
| `apps/backend/tests/test_auth_service.py` | Authentication service RED/GREEN tests. |
| `apps/backend/tests/test_auth_api.py` | Authentication route/error/cookie tests. |
| `apps/frontend/src/api/authApi.test.ts` | Auth API behavior tests. |
| `apps/frontend/src/pages/auth.test.tsx` | Form, error, loading, and recovery UI tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/auth-security.spec.ts` | Login, reset, verification, session, and logout E2E. |

### Telemetry

Implement all `auth.login`, `auth.session`, `auth.password`, and `auth.email` events listed in the Telemetry section. Every success, rejection, expiry, replay, lockout, rate limit, and dependency failure has a test assertion.

### Hard Exit Criteria

- [ ] All auth routes match OpenAPI and return standard errors.
- [ ] Cookies have correct `HttpOnly`, `Secure`, `SameSite`, path, expiry, and host behavior in each environment; the configured cookie name is used consistently.
- [ ] Reset, verification, lockout, and session revocation are one-time/expiry-safe.
- [ ] Argon2id parameters, rehash policy, password policy, lockout thresholds, idle/absolute session expiry, and session epoch behavior are documented and tested.
- [ ] CSRF responses are explicitly no-store, raw CSRF is memory-only in the frontend, and multi-tab/rotation/replay behavior is tested.
- [ ] Security tests prove raw secrets are never persisted or logged.
- [ ] Browser E2E completes login, protected navigation, password/security workflow, logout, and session revocation.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Security/auth reviewer verifies session fixation, CSRF, cookie, password, enumeration, replay, lockout, and token-storage behavior.

## Phase 4: Roles, Permissions, and Authorization Policy

**Owner:** Codex coordinator or authorization worker
**Dependency:** Phase 3 PASS

### Scope checklist

- [ ] Define the permission catalog for users, roles, organizations, teams, audit logs, notifications, imports/exports, settings, API keys, and sessions.
- [ ] Implement system roles (`admin`, `manager`, `user`) and organization-scoped custom roles.
- [ ] Implement role assignment/removal with last-admin and membership invariants.
- [ ] Replace ad-hoc admin checks with reusable permission dependencies and policy functions.
- [ ] Enforce deny-by-default for new protected routes.
- [ ] Separate authentication, global authorization, organization membership, and resource ownership checks.
- [ ] Publish `docs/permissions-matrix.md` with every route, method, required permission, organization context, resource-owner rule, last-admin rule, denial status, and non-disclosure behavior. Use it as the source for route dependencies and security tests.
- [ ] Make `organization_memberships.role_id` the only canonical organization role source; the migrated legacy `users.role` value is never consulted by authorization.
- [ ] Ensure role changes invalidate relevant sessions/caches and write audit events.
- [ ] Add permission matrix documentation and fixture data without real users.
- [ ] Add `required_auth_level` (`password`, `mfa`, `recent_mfa`) and `max_auth_age_seconds` to every sensitive action in `docs/permissions-matrix.md`. Bind step-up challenges to user, session, organization, action, and expiry; password recovery/recovery codes cannot satisfy owner-level actions unless the matrix explicitly says so.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add policy tests for each role/action/resource, unauthenticated requests, cross-organization requests, last-admin protection, and stale-session behavior.
- [ ] GREEN: Implement centralized permission checks and route dependencies.
- [ ] REFACTOR: Remove duplicated route-level role checks and make policy names contract-visible.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/core/permissions.py` | Permission constants, policy evaluation, and dependency helpers. |
| `apps/backend/app/api/roles.py` | Role and permission management routes. |
| `apps/backend/app/services/permissions.py` | Role assignment and permission business rules. |
| `apps/backend/app/core/tenant.py` | Verified organization context used by each permission check. |
| `docs/permissions-matrix.md` | Route/action/resource/tenant permission contract. |
| `apps/frontend/src/api/rolesApi.ts` | Role/permission API boundary. |
| `apps/frontend/src/pages/RoleManagementPage.tsx` | Role and permission administration UI. |
| `apps/frontend/src/components/authorization/PermissionGate.tsx` | Safe UI capability gating that never replaces server authorization. |
| `apps/backend/tests/test_permissions.py` | Permission matrix and invariant tests. |
| `apps/backend/tests/test_roles_api.py` | Role route tests. |
| `apps/frontend/src/pages/RoleManagementPage.test.tsx` | Role UI behavior tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/authorization.spec.ts` | Role and denied-action E2E. |

### Telemetry

Implement `permission.check.allowed`, `permission.check.unauthenticated`, `permission.check.forbidden`, `permission.check.tenant_denied`, and `permission.check.policy_failed`, plus `role.assigned`, `role.removed`, `role.updated`, and `role.rejected`.

### Hard Exit Criteria

- [ ] Every protected endpoint names its required permission.
- [ ] The permission matrix is complete and matches OpenAPI, route dependencies, and negative tests.
- [ ] Role changes cannot grant access outside the caller's authority.
- [ ] Cross-organization and unauthenticated/forbidden negative tests pass.
- [ ] UI gates are consistent with server decisions but cannot bypass server checks.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Authorization reviewer verifies privilege escalation, object-level authorization, last-admin safety, tenant boundaries, and denial telemetry.

## Phase 5: User Lifecycle, Profile, Status, Soft Delete, and Restore

**Owner:** Codex coordinator or user-domain worker
**Dependency:** Phases 1–4 PASS

### Scope checklist

- [ ] Keep existing CRUD contract behavior and extend it with profile/detail fields approved for display.
- [ ] Implement canonical `status` transitions: `pending -> active`, `active <-> inactive`, `active/inactive -> suspended`, and any non-deleted state -> `deleted`; restore requires an explicit target status and never treats `is_active` as an independent authority.
- [ ] Add explicit activate/deactivate/suspend operations with reason, actor, permission, and audit record.
- [ ] Add soft-delete restore with partial normalized-email uniqueness, email reuse rules, and restored-state validation.
- [ ] Add profile self-service and administrator profile editing with field-level authorization.
- [ ] Add avatar/profile-image metadata through a storage adapter, size/type limits, safe deletion, and no arbitrary file paths.
- [ ] Enforce validation at OpenAPI, service, database, and authorization boundaries where applicable.
- [ ] Preserve birth-date, hobby, email, and role invariants from the current baseline unless a contract change explicitly documents them.
- [ ] Never expose password hashes, security metadata, raw tokens, or internal audit metadata in profile responses.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add service/API tests for create/update/delete/restore/status/profile/avatar, duplicate email, last-admin, blank fields, date bounds, and inactive access.
- [ ] GREEN: Implement lifecycle services and routes.
- [ ] REFACTOR: Centralize normalization, transaction handling, serialization, and audit construction.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/api/users.py` | Extended lifecycle/profile routes. |
| `apps/backend/app/services/users.py` | Lifecycle, profile, restore, status, and avatar rules. |
| `apps/backend/app/core/storage.py` | Avatar/file storage abstraction and safe local adapter. |
| `apps/frontend/src/api/userApi.ts` | Extended user API boundary. |
| `apps/frontend/src/pages/UserPage.tsx` | Existing list workflow owner; update rather than creating a parallel list. |
| `apps/frontend/src/modals/AddEditUserModal.tsx` | Existing create/edit form owner; migrate to status/profile contracts. |
| `apps/frontend/src/modals/ConfirmationModal.tsx` | Existing confirmation owner; upgrade title/focus/loading semantics rather than duplicating it. |
| `apps/frontend/src/redux/actions/userAction.ts` | Existing user action owner; update or explicitly retire after replacement verification. |
| `apps/frontend/src/redux/reducers/userReducer.ts` | Existing user state owner; update or explicitly retire after replacement verification. |
| `apps/frontend/src/pages/UserDetailPage.tsx` | User profile/detail and lifecycle screen. |
| `apps/frontend/src/components/users/UserStatusBadge.tsx` | Accessible status presentation. |
| `apps/frontend/src/components/users/UserLifecycleActions.tsx` | Activate/deactivate/restore/delete actions. |
| `apps/frontend/src/components/users/UserProfileForm.tsx` | Shared profile form with validation. |
| `apps/backend/tests/test_user_lifecycle.py` | Lifecycle service and invariant tests. |
| `apps/backend/tests/test_users_api.py` | User route/serialization/error tests. |
| `apps/frontend/src/pages/UserDetailPage.test.tsx` | Detail and lifecycle UI tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/user-lifecycle.spec.ts` | User profile/status/delete/restore E2E. |

### Telemetry

Implement all `user.lifecycle.*` events and `ui.workflow.*` events for profile/lifecycle actions, including validation, conflict, forbidden, not-found, dependency, and stale-data failures.

### Hard Exit Criteria

- [ ] Existing CRUD behavior remains contract-compatible.
- [ ] Status, soft delete, restore, last-admin, and email reuse invariants pass at service and database levels.
- [ ] Profile and avatar workflows enforce field-level access and size/type limits.
- [ ] Browser users can see and recover from every documented state.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

User-domain reviewer verifies data exposure, mutation invariants, deletion/recovery behavior, and compatibility with the current frontend data model.

## Phase 6: Search, Filtering, Bulk Actions, Import, and Export

**Owner:** Codex coordinator or data-workflow worker
**Dependency:** Phases 1–5 PASS

### Scope checklist

- [ ] Extend list queries with status, role, organization, team, date-range, verification, and activity filters.
- [ ] Keep sort fields allowlisted and add stable tie-break ordering.
- [ ] Add query/index verification for search and filters; prevent arbitrary SQL identifiers and unbounded result sets.
- [ ] Add bounded bulk activate/deactivate/restore/delete/role-assignment operations with per-row results and idempotency keys.
- [ ] Add CSV preview validation with header/schema checks, row limits, field limits, duplicate handling, and safe error details.
- [ ] Add import commit with transaction strategy, partial-result reporting, audit events, and retry-safe idempotency.
- [ ] Add CSV export with authorized fields only, filter parity with list queries, escaping, streaming/size limits, and safe failure behavior.
- [ ] Add job records when imports/exports exceed synchronous limits; expose progress and terminal failure states.
- [ ] Use the durable `background_jobs` record and a dedicated `arq` worker for asynchronous work. Define lease, heartbeat, retry/backoff, idempotency, cancellation, stale-job recovery, and terminal failed state before adding UI polling.
- [ ] Use the exact worker command `uv run arq app.worker.WorkerSettings`, expose a worker heartbeat/readiness probe, and make `tools/e2e/wait-for-worker.sh` fail if the heartbeat is absent. The Nx backend target is named `worker`; its readiness target is `worker-readiness`.
- [ ] Implement `JobDispatchService` with a PostgreSQL `FOR UPDATE SKIP LOCKED` claim/lease loop over `job_dispatch_outbox`, idempotent Redis enqueue, retry/backoff, heartbeat, lease expiry recovery, and reconciliation on worker startup. Register it in the worker process and cover DB-commit/Redis-enqueue crash recovery.
- [ ] Keep localStorage legacy migration as a separate, backup-first import workflow and do not silently delete browser data.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add query, limit, import-row, duplicate, partial-failure, idempotency, export-escaping, and job-state tests.
- [ ] GREEN: Implement services/routes and UI operations.
- [ ] REFACTOR: Centralize filtering, validation, result aggregation, and job state transitions.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/api/user_bulk.py` | Bulk user action routes. |
| `apps/backend/app/api/user_import_export.py` | Import preview/commit and export routes. |
| `apps/backend/app/services/import_export.py` | CSV validation, streaming, result aggregation, and idempotency. |
| `apps/backend/app/services/jobs.py` | Bounded job submission/progress/failure behavior. |
| `apps/backend/app/api/jobs.py` | Job status/cancellation routes. |
| `apps/backend/app/worker.py` | `arq` worker entry point and job handlers. |
| `apps/backend/app/services/job_dispatcher.py` | Transactional outbox claim, Redis enqueue, lease/retry, reconciliation, and worker-fence handling. |
| `apps/backend/project.json` | Worker, job-health, migration, and E2E dependency targets. |
| `apps/backend/docker-compose.yml` | Local worker plus Redis/PostgreSQL health checks. |
| `apps/backend/pyproject.toml` | Explicit worker/import-export dependencies. |
| `apps/backend/uv.lock` | Locked backend dependencies. |
| `apps/frontend/src/api/bulkUserApi.ts` | Bulk operation API boundary. |
| `apps/frontend/src/api/importExportApi.ts` | Import/export API boundary. |
| `apps/frontend/src/components/users/UserFilters.tsx` | Advanced filter controls. |
| `apps/frontend/src/components/users/BulkActionsToolbar.tsx` | Selection and bulk actions. |
| `apps/frontend/src/components/users/ImportExportDialog.tsx` | Preview, validation, and commit workflow. |
| `apps/frontend/src/components/jobs/JobProgressPanel.tsx` | Job progress/error display. |
| `apps/backend/tests/test_user_queries.py` | Search/filter/sort/pagination tests. |
| `apps/backend/tests/test_user_bulk.py` | Bulk validation and authorization tests. |
| `apps/backend/tests/test_import_export.py` | CSV and job behavior tests. |
| `apps/frontend/src/components/users/UserFilters.test.tsx` | Filter/bulk UI tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/user-bulk-import-export.spec.ts` | Full bulk/import/export E2E. |

### Telemetry

Implement `user.bulk.*`, `user.import.*`, `user.export.*`, and `job.*` events for start, validation, progress, success, partial result, cancellation, size rejection, rate limit, dependency failure, retry, and terminal failure.

### Hard Exit Criteria

- [ ] Query performance is verified against representative row counts and indexes.
- [ ] Bulk operations are bounded, idempotent, auditable, and report row-level outcomes.
- [ ] Import cannot write before preview/validation and cannot exceed configured size/row limits.
- [ ] Export never includes password/security fields and handles CSV injection/escaping.
- [ ] Job terminal states are durable and visible to the initiating user.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Data-workflow reviewer verifies limits, query safety, duplicate/partial semantics, CSV security, job recovery, and audit completeness.

## Phase 7: Audit Logs, Notifications, Email Delivery, and Preferences

**Owner:** Codex coordinator or audit/notification worker
**Dependency:** Phases 1–6 PASS

### Scope checklist

- [ ] Record immutable audit events for authentication, permission decisions that change state, user lifecycle, roles, bulk actions, imports/exports, sessions, invitations, organization/team changes, API keys, settings, and MFA.
- [ ] Store safe structured metadata with actor/resource/request IDs and outcome; never store secrets or full sensitive payloads.
- [ ] Write each mutation audit row in the same database transaction as the mutation. Use the email outbox only after the transaction commits; if audit persistence fails, fail the mutation closed and do not return success.
- [ ] Enforce append-only audit storage with PostgreSQL privileges and an insert-only trigger; define retention, tenant-scoped visibility, export redaction, and the operator break-glass path.
- [ ] Define break-glass as a separate time-bound database maintenance role, never a normal API endpoint: least privilege, explicit reason/ticket, independent approval, immutable invocation record, session/worker fencing, and tests proving application roles cannot update/delete audit rows.
- [ ] Add admin-filterable audit log API and UI with pagination and time/resource/action filters.
- [ ] Add in-app notification creation, list, unread count endpoint/field, read, read-all, and preferences.
- [ ] Add email templates for welcome, verification, password reset, invitation, lockout/security alert, and administrative events.
- [ ] Add provider-neutral email adapter, local development sink, retries, idempotency, outbox state, and failure visibility.
- [ ] Add notification preferences with secure defaults and mandatory security-message rules.
- [ ] Add redaction tests for logs, telemetry, audit metadata, and email content.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add audit immutability, event coverage, notification state, delivery retry, preference, and redaction tests.
- [ ] GREEN: Implement audit/outbox/notification services and APIs.
- [ ] REFACTOR: Centralize event construction, delivery policy, retry behavior, and provider boundaries.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/api/audit.py` | Audit log listing and filtering routes. |
| `apps/backend/app/api/notifications.py` | Notification and preference routes. |
| `apps/backend/app/services/audit.py` | Immutable audit event service. |
| `apps/backend/app/services/notifications.py` | In-app and email notification orchestration. |
| `apps/backend/app/core/email.py` | Email provider interface, local sink, and delivery policy. |
| `apps/backend/app/core/logging.py` | Shared sensitive-field scrubber for logs, telemetry, exceptions, and audit metadata. |
| `apps/frontend/src/api/auditApi.ts` | Audit API boundary. |
| `apps/frontend/src/api/notificationApi.ts` | Notification API boundary. |
| `apps/frontend/src/pages/AuditLogPage.tsx` | Audit log administration UI. |
| `apps/frontend/src/components/notifications/NotificationCenter.tsx` | Notification list/unread/read UI. |
| `apps/frontend/src/pages/NotificationPreferencesPage.tsx` | Notification preferences screen. |
| `apps/backend/tests/test_audit.py` | Audit creation, immutability, and redaction tests. |
| `apps/backend/tests/test_notifications.py` | Notification/outbox/provider/retry tests. |
| `apps/frontend/src/pages/AuditLogPage.test.tsx` | Audit UI tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/audit-notifications.spec.ts` | Audit and notification E2E. |

### Telemetry

Implement `audit.log.*` and `notification.*` events for every creation, delivery, retry, read, preference rejection, provider failure, and redacted fallback. Delivery metrics use channel/outcome labels only.

### Hard Exit Criteria

- [ ] Every state-changing feature writes an audit record in the same transaction or has an explicit durable failure path.
- [ ] Audit records are append-only to application roles and filterable by authorized administrators.
- [ ] Direct application-role update/delete attempts on audit rows fail at the database layer, and retention/break-glass behavior is documented.
- [ ] Email failures do not block unrelated user operations and are visible/retryable.
- [ ] Notification preferences cannot suppress mandatory security events.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Security/observability reviewer verifies audit completeness, secret redaction, notification retry/idempotency, and unauthorized audit access.

## Phase 8: Organizations, Teams, Memberships, Invitations, and Tenant Isolation

**Owner:** Codex coordinator or organization-domain worker
**Dependency:** Phases 1–7 PASS

### Scope checklist

- [ ] Implement organization creation, settings, status, soft deletion, and membership lifecycle.
- [ ] Implement teams and team memberships with organization ownership.
- [ ] Implement invitations with hashed tokens, expiration, revoke, resend limits, accept flow, and email delivery.
- [ ] Establish organization context from a verified `organizationId` path parameter for tenant resources. A session `active_organization_id` may optimize the UI but is never trusted without membership verification; header-only context is not accepted.
- [ ] Add database/service/query guards so users cannot read or mutate another organization.
- [ ] Define organization owner/admin/member roles and transition invariants.
- [ ] Add organization/team filters to user list, audit, dashboard, notification, and export workflows.
- [ ] Ensure background jobs, notifications, audit events, and API keys carry organization context.
- [ ] Backfill all existing users, sessions, audits, jobs, notifications, email-outbox rows, and API-key records into the deterministic local/test default organization before tenant predicates become mandatory. In staging/production use an explicit mapping artifact and abort on ambiguity; record the owner/member mapping and reject any unassigned row.
- [ ] Add tenant-scoped repository/query helpers and, where feasible, PostgreSQL row-level security or equivalent database-enforced predicates. Cache keys, export jobs, notification queries, and background handlers must include organization ID.
- [ ] Keep invitation acceptance at `POST /api/v1/invitations/accept` with token in the request body so request paths, rate-limit keys, and telemetry cannot leak it. Hash the token, enforce expiry/attempt limits/single use, and require membership policy before SSO or password setup.
- [ ] Add safe local bootstrap data with no production credentials.
- [ ] Make bootstrap order explicit and idempotent: migration creates default roles/organization, bootstrap creates or locates the admin and its owner membership atomically, and startup reconciliation fails closed if any bootstrap administrator lacks a valid membership.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add cross-tenant read/write denial, membership transition, invitation replay/expiry, team ownership, and organization deletion tests.
- [ ] GREEN: Implement tenant context, models, services, routes, and UI.
- [ ] REFACTOR: Remove route-specific tenant filtering and centralize organization-scoped query helpers.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/api/organizations.py` | Organization and membership routes. |
| `apps/backend/app/api/teams.py` | Team routes. |
| `apps/backend/app/api/invitations.py` | Invitation routes. |
| `apps/backend/app/core/tenant.py` | Organization-context resolution and tenant policy. |
| `apps/backend/app/core/bootstrap.py` | Deterministic default-organization/bootstrap-admin assignment and safe local-only seed rules. |
| `apps/backend/app/services/organizations.py` | Organization/membership business rules. |
| `apps/backend/app/services/teams.py` | Team business rules. |
| `apps/backend/app/services/invitations.py` | Invitation token/lifecycle rules. |
| `apps/frontend/src/api/organizationApi.ts` | Organization/membership API boundary. |
| `apps/frontend/src/api/teamApi.ts` | Team API boundary. |
| `apps/frontend/src/api/invitationApi.ts` | Invitation API boundary. |
| `apps/frontend/src/pages/OrganizationPage.tsx` | Organization management UI. |
| `apps/frontend/src/pages/TeamPage.tsx` | Team management UI. |
| `apps/frontend/src/pages/InvitationPage.tsx` | Invitation acceptance/revocation UI. |
| `apps/frontend/src/components/organization/OrganizationSwitcher.tsx` | Current organization context UI. |
| `apps/backend/tests/test_tenant_isolation.py` | Cross-organization security tests. |
| `apps/backend/tests/test_organizations.py` | Organization/team/invitation tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/organizations.spec.ts` | Tenant and membership E2E. |

### Telemetry

Implement `organization.*`, `organization.membership.*`, `team.*`, and `invitation.*` events for success, duplicate, denied, expired, replayed, revoked, provider failure, and cross-tenant rejection.

### Hard Exit Criteria

- [ ] Every tenant-scoped query requires and verifies path-derived organization context and membership; unscoped repository calls fail closed.
- [ ] Cross-organization API and UI attempts return the documented denial without data leakage.
- [ ] Invitation tokens are hashed, single-use, expiring, revocable, and never logged.
- [ ] Existing baseline users and bootstrap admin have deterministic organization memberships; no tenant-scoped row is null after backfill.
- [ ] Organization/team/member state changes are audited and visible to authorized users.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Tenant-isolation reviewer verifies database, service, route, background-job, cache, export, notification, and frontend organization boundaries.

## Phase 9: MFA, SSO/OIDC, API Keys, and Advanced Identity Integrations

**Owner:** Codex coordinator or identity-integration worker
**Dependency:** Phases 3, 4, 7, and 8 PASS

### Scope checklist

- [ ] Implement TOTP enrollment, confirmation, challenge, disable, recovery-code rotation, and replay prevention.
- [ ] Define TOTP parameters (algorithm, digits, period, allowed clock skew), enrollment expiry, challenge retry limits, atomic one-time replay handling, recovery-code count, hashed storage, rotation, and mandatory step-up for sensitive actions.
- [ ] Encrypt TOTP secrets at rest using a runtime key configured outside source control; fail closed outside local/test when the key is missing and document key rotation without selecting a provider-specific KMS.
- [ ] Store an encryption key ID/version with MFA and OIDC verifier ciphertext, support dual-read with current/previous keys during rotation, run idempotent re-encryption, retire the previous key only after verification, and test missing-key/backup-restore behavior.
- [ ] Require stronger assurance for password reset, API-key creation, role changes, and organization-owner changes where policy requires.
- [ ] Implement provider-neutral OIDC authorization-code flow with state, nonce, PKCE, callback validation, account-linking policy, and failure-safe behavior.
- [ ] Persist OIDC transactions with hashed state/nonce, encrypted PKCE verifier plus key version, exact redirect URI, expiry, one-time consumption, intended organization/invitation context, and multi-instance-safe replay protection.
- [ ] Use a configured provider registry only: fixed issuer/client/redirect values, HTTPS issuer outside local/test, no request-controlled discovery URL, bounded discovery/JWKS HTTP timeouts and response sizes, JWKS cache/rotation, and validation of `exp`, `iat`, `azp`, issuer, audience, nonce, and PKCE. Strip callback query parameters immediately and prohibit query/referrer logging.
- [ ] Validate provider errors and bind external identities by unique `(issuer, subject)`; never auto-link by email alone.
- [ ] Separate existing-user SSO login from invitation-bound SSO: an invitation-bound `oidc/start` request carries only an opaque invitation transaction/body token, the server resolves and persists verified organization context, and callback rejects missing/expired/mismatched context. Unauthenticated OIDC can never choose an organization or create an unscoped member.
- [ ] Make OIDC callback return the same `authenticated | challengeRequired` discriminator as password login. If the resolved user requires MFA, bind `mfa_challenges` to the OIDC transaction/user/session intent and issue no cookie until MFA or an allowed recovery code succeeds.
- [ ] Ensure SSO-created accounts cannot bypass organization invitation/membership policy.
- [ ] Implement scoped API-key creation, one-time raw display, hashed persistence, expiry, last-used tracking, and revocation.
- [ ] Generate API keys with a CSPRNG and at least 256 bits of secret entropy; use a non-secret prefix for lookup, a versioned HMAC-SHA-256 hash with a runtime pepper for storage, constant-time comparison, unique prefix/collision retry, and explicit expiry/revocation tests. Raw values are returned once over TLS and never accepted from query/cookie.
- [ ] Add API-key authentication through `Authorization: Bearer umk_<prefix>_<secret>` only; reject query-string/cookie transport, define session-versus-key precedence, route allowlists, organization binding, scope evaluation, last-used update strategy, revocation, and API-key-specific rate-limit identity.
- [ ] Keep API-key requests separate from browser session requests: no browser CSRF requirement for key-authenticated API calls, and no API key accepted by login/logout/CSRF/session-management routes.
- [ ] Document local fake/sink identity-provider behavior for tests and real provider configuration for staging/production.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add TOTP, recovery, replay, OIDC state/nonce/PKCE, account-linking, API-key scope, expiry, and revocation tests.
- [ ] GREEN: Implement adapters and routes.
- [ ] REFACTOR: Isolate provider SDKs, centralize assurance policy, and verify secrets are configuration-only.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/core/mfa.py` | TOTP/recovery-code primitives and policy. |
| `apps/backend/app/core/oidc.py` | Provider-neutral OIDC adapter. |
| `apps/backend/app/core/api_key_auth.py` | API-key header parsing, authentication precedence, and route policy. |
| `apps/backend/app/api/identity.py` | OIDC callback and identity-linking routes. |
| `apps/backend/app/api/api_keys.py` | API-key management routes. |
| `apps/backend/app/services/mfa.py` | MFA lifecycle and assurance service. |
| `apps/backend/app/services/identity.py` | OIDC account-linking and callback service. |
| `apps/backend/app/services/api_keys.py` | API-key hashing, scope, expiry, and revocation. |
| `apps/frontend/src/api/identityApi.ts` | Identity/MFA API boundary. |
| `apps/frontend/src/api/apiKeyApi.ts` | API-key API boundary. |
| `apps/frontend/src/pages/MfaSettingsPage.tsx` | MFA enrollment/challenge/recovery UI. |
| `apps/frontend/src/pages/ApiKeysPage.tsx` | API-key management UI. |
| `apps/frontend/src/pages/SsoCallbackPage.tsx` | SSO callback state UI. |
| `apps/backend/tests/test_mfa.py` | MFA and assurance tests. |
| `apps/backend/tests/test_oidc.py` | OIDC adapter/security tests. |
| `apps/backend/tests/test_api_keys.py` | API-key lifecycle/security tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/advanced-identity.spec.ts` | MFA/API-key/identity E2E with test provider. |

### Telemetry

Implement `auth.mfa.*`, `auth.sso.*`, and `api_key.*` events for all success, rejection, replay, expiry, provider failure, revocation, and dependency paths. Never record raw MFA secrets, recovery codes, authorization codes, or API keys.

### Hard Exit Criteria

- [ ] MFA cannot be bypassed through alternate login or recovery paths.
- [ ] TOTP secret encryption/key availability, skew, retry limits, recovery-code hashing/rotation, enrollment expiry, replay prevention, and step-up assurance are tested.
- [ ] OIDC callback rejects invalid state, nonce, PKCE, issuer, audience, and account-linking cases.
- [ ] OIDC transactions and external identities survive multi-instance execution without replay or email-only linking.
- [ ] API keys are shown once, stored hashed, scope-limited, expiring, revocable, and auditable.
- [ ] Browser and API-key authentication have separate, documented security policies, transport rules, precedence, organization binding, and rate limits.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Identity/security reviewer verifies cryptographic handling, replay protection, provider failure behavior, account linking, and secret exposure.

## Phase 10: Admin Dashboard, Settings, Sessions, and Operational Controls

**Owner:** Codex coordinator or administration worker
**Dependency:** Phases 3–9 PASS

### Scope checklist

- [ ] Add dashboard aggregates for total, active, inactive, verified, locked, recently created, recently active, and organization-scoped users.
- [ ] Add trend/time-window query behavior with bounded ranges and indexed queries.
- [ ] Add admin settings for validated security, notification, import/export, and organization policies.
- [ ] Add session management screen with current-session marker, revoke-one, revoke-all-other, expiry, and safe device metadata.
- [ ] Add audit/security event summaries and links into detailed views.
- [ ] Add role/permission settings navigation and organization context navigation.
- [ ] Ensure dashboard aggregates respect current actor permissions and organization scope.

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring`.
- [ ] RED: Add aggregate accuracy, authorization, time-window, settings validation, session revoke, and empty/dependency tests.
- [ ] GREEN: Implement API and UI.
- [ ] REFACTOR: Centralize dashboard query objects and settings policy; avoid N+1 queries.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/app/api/admin.py` | Dashboard and settings routes. |
| `apps/backend/app/services/dashboard.py` | Authorized aggregate queries. |
| `apps/backend/app/services/settings.py` | Validated admin/system settings. |
| `apps/frontend/src/api/adminApi.ts` | Dashboard/settings API boundary. |
| `apps/frontend/src/api/sessionApi.ts` | Session API boundary. |
| `apps/frontend/src/pages/AdminDashboardPage.tsx` | Dashboard screen. |
| `apps/frontend/src/pages/AdminSettingsPage.tsx` | Settings screen. |
| `apps/frontend/src/pages/SessionsPage.tsx` | Session-management screen. |
| `apps/frontend/src/components/dashboard/MetricCard.tsx` | Accessible metrics presentation. |
| `apps/frontend/src/components/dashboard/ActivitySummary.tsx` | Activity summary presentation. |
| `apps/backend/tests/test_dashboard.py` | Aggregate and scope tests. |
| `apps/backend/tests/test_settings.py` | Settings validation/authorization tests. |
| `apps/frontend/test/e2e-frontend/phase-tests/admin-operations.spec.ts` | Dashboard/settings/session E2E. |

### Telemetry

Implement `admin.dashboard.*`, `admin.settings.*`, and `auth.session.*` UI/API events for load success, empty, invalid setting, forbidden, dependency failure, retry, and session revocation.

### Hard Exit Criteria

- [ ] Dashboard totals reconcile with filtered database queries.
- [ ] Settings are permission-protected, validated, audited, and do not expose secrets.
- [ ] Session controls revoke the selected server session and update the UI.
- [ ] Loading, empty, failure, forbidden, and retry states are verified in the browser.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Admin-product reviewer verifies aggregate correctness, authorization, empty/error states, and accidental secret exposure.

## Phase 11: Complete Frontend Experience, Accessibility, and Responsive Behavior

**Owner:** Codex coordinator or frontend worker
**Required skills:** `frontend-design`, `playwright-testing`, `test-authoring`
**Dependency:** Contract and backend phases for each screen PASS

### Scope checklist

- [ ] Update `routes.tsx` with all authenticated, security, admin, organization, notification, and invitation routes.
- [ ] Build a consistent protected shell with organization context, navigation, notification center, account menu, and logout.
- [ ] Complete user list with server-side filters, selection, bulk actions, status badges, responsive columns, export/import entry points, and empty/error/retry states.
- [ ] Add detail/profile pages with editable fields, lifecycle actions, activity, sessions, security, and organization membership sections.
- [ ] Add login, reset, verification, MFA, SSO callback, API key, dashboard, role, audit, notification, organization, team, invitation, settings, and session screens.
- [ ] Add accessible form labels, descriptions, validation summaries, focus restoration, keyboard menus, table semantics, dialog semantics, live regions, and non-color status indicators.
- [ ] Target WCAG 2.2 AA. Add `@axe-core/playwright` route/state scans, `eslint-plugin-jsx-a11y`, keyboard/focus assertions, and a documented manual screen-reader pass for login, table, dialogs, filters, import, settings, and organization workflows.
- [ ] Add and lock `@axe-core/playwright` in `apps/frontend/package.json` and the root workspace `package-lock.json`; `test:a11y` must run the exact accessibility spec under `apps/frontend/test/e2e-frontend/`.
- [ ] Verify mobile/tablet/desktop layouts at the defined Playwright viewports and usable touch targets of at least the project accessibility standard.
- [ ] Verify no console errors, stale API calls, duplicate submissions, or auth loops.
- [ ] Keep API/state boundaries SOLID: typed API adapters, isolated feature components, explicit loading/error state, and no direct localStorage CRUD.
- [ ] Preserve one-time legacy localStorage migration and backup behavior until the cutover gate confirms imported data; show a warning, expose explicit download/delete controls, define a retention period, and never silently retain or delete private browser data.

### Route, guard, and navigation matrix

| Route | Entry/guard | Success destination | Reload/deep-link behavior | Failure recovery |
| --- | --- | --- | --- | --- |
| `/login` | Public; clear stale protected state | `/app` or intended safe return path | Reload stays public and never loops | Invalid credentials stay on form; rate-limit/lockout shows safe guidance |
| `/` | Public route resolver | `/app` when authenticated, otherwise `/login` | Reload rechecks session once | No redirect loop; dependency failure has retry |
| `/forgot-password`, `/reset-password`, `/verify-email` | Public token/identifier workflows | `/login` or `/app/profile` | Token is read once from URL then removed from browser history; no token telemetry | Expired/replayed token shows restart action |
| `/auth/oidc/:provider/callback` | Public callback with server transaction | `/app` or invitation acceptance | Callback transaction is one-time and refresh-safe | Invalid state/provider error returns to `/login` without account disclosure |
| `/invitations/accept` | Public token form; membership policy enforced server-side | `/login` or `/app` | Token is not retained after submission | Expired/revoked/unauthorized invitation offers restart/contact action |
| `/app/*` | Valid session; restore before rendering protected shell | Requested child route | Deep links restore session and organization context before data load | `401` -> `/login`; `403` -> forbidden state; dependency error has retry |
| `/app` | Valid session; organization resolver | `/app/organizations/:organizationId/dashboard` | Reload restores session then resolves a verified organization | No organization -> organization-empty state; dependency failure has retry |
| `/app/profile` | Valid session; current-user profile permission | Same route after save | Reload refetches current profile | Validation/conflict/step-up errors preserve form state |
| `/app/organizations/:organizationId/dashboard` | `dashboard.read` plus verified membership | Same route | Aggregates reload with bounded time window and revalidated membership | Empty/dependency states have explanation and retry |
| `/app/organizations/:organizationId/users`, `/app/organizations/:organizationId/users/:userId` | `users.read`; mutation controls gated by permissions | Detail after create/update; list after delete/bulk | Query/filter state is URL-addressable and org membership is revalidated | Conflict preserves form/table state and offers refresh/retry |
| `/app/organizations/:organizationId/roles`, `/app/organizations/:organizationId/audit`, `/app/organizations/:organizationId/settings` | Corresponding permission plus verified membership | Same route | Unauthorized deep links render `403`, not a blank shell | Retry and safe navigation to permitted area |
| `/app/organizations`, `/app/organizations/:organizationId/teams`, `/app/organizations/:organizationId/invitations` | Organization membership plus resource permission | Same route; organization switcher updates path | Organization path is canonical; reload revalidates membership | Cross-tenant path returns safe denial and clears invalid context |
| `/app/security/mfa`, `/app/security/sessions`, `/app/security/api-keys` | Authenticated user; step-up for sensitive mutations | Same route | Sensitive state is refetched after reload; raw values are not persisted | Step-up expiry returns a clear re-auth action |
| `/app/organizations/:organizationId/notifications`, `/app/organizations/:organizationId/notifications/preferences` | Authenticated user plus verified membership | Same route | Read state and preferences reload from server | Retry without losing unread/read intent |
| Unknown route/wildcard | Public or protected resolver based on session | Explicit not-found page or safe dashboard redirect | Reload preserves a safe 404/redirect decision | Never silently redirects an unauthorized deep link to a data page; provides navigation/retry |

### Workflow-state matrix

| Workflow | Required states | Required controls/behavior |
| --- | --- | --- |
| Login/session restore | idle, submitting, invalid, locked, rate-limited, dependency-failed, authenticated | Disable duplicate submit, preserve safe email, generic errors, retry dependency, no auth loop, focus first error |
| User list/search/filter | loading, populated, initial-empty, search-empty, forbidden, unauthorized, stale, dependency-failed | Skeleton/empty distinction, clear filters, retry, stable selection, URL query state, abort stale requests |
| Create/edit/profile | pristine, dirty, validating, submitting, success, conflict, forbidden, timeout | Unsaved-change guard, field summary, disable duplicate submit, preserve inputs on failure, refresh conflict |
| Delete/status/role mutation | confirm, submitting, succeeded, partial, conflict, forbidden, dependency-failed | Confirmation remains open while submitting, progress/row result, retry idempotently, focus returned |
| Import/export/job | selecting, validating, previewed, committing, queued, running, partial, cancelled, failed, expired, completed | File/row limits, preview-before-write, cancel, progress polling/backoff, download result, error rows without secrets |
| Organization/invitation | loading, no-membership, switching, invited, accepted, expired, revoked, forbidden | Canonical path switch, membership revalidation, safe token handling, retry/resend controls |
| Audit/notifications/settings | loading, empty, filtered, saved, invalid, forbidden, dependency-failed | Clear filters, read/read-all confirmation, validation, retry, no secret values |
| Password reset/email verification | idle, submitting, sent, validating, expired, replayed, completed, dependency-failed | Enumeration-safe response, token removed from URL after read, restart action, success destination, no token persistence |
| MFA enrollment/challenge/recovery | idle, enrolling, QR/secret displayed once, verifying, challenge-required, invalid, replayed, expired, recovery-used, disabled | Never persist secret/recovery codes, one-time display, retry limits, step-up expiry, safe recovery path |
| OIDC link/callback | redirecting, callback-validating, invalid-state, provider-failed, linked, already-linked | Fixed provider, no query/referrer leakage, one-time transaction, safe return to login/settings |
| API-key lifecycle | creating, raw-value-once, copied/acknowledged, listed, revoked, expired, forbidden | Raw key shown once in memory, no screenshot/log persistence, explicit copy acknowledgement, revoke confirmation |
| Legacy localStorage migration | detected, warning, exported, imported, skipped, deleted, retained-until-expiry | Explicit download/delete, retention countdown, clear source distinction, no silent deletion or active CRUD fallback |
| Dashboard/session/logout | loading, empty, loaded, dependency-failed, retry, revoke-submitting, revoked, logout, expired | Bounded aggregate states, revoke confirmation, logout clears memory/redirects, expiry returns focus to login |

### Accessibility evidence matrix

| Evidence | Required coverage | Proof/artifact |
| --- | --- | --- |
| Automated axe | Every route above plus open dialogs, validation summary, table empty/populated, import preview, forbidden, and notification states | `apps/frontend/test/e2e-frontend/accessibility.spec.ts`, `npm run test:a11y`, no unexplained violations; exclusions require a comment and reviewer approval. |
| Browser projects/viewports | Chromium desktop `1440x900`, Chromium tablet `768x1024`, Chromium mobile `390x844`; keyboard-only in every project | Playwright project config and trace/screenshot evidence under `test-results/`, redacted before retention. |
| Keyboard/focus | Tab order, visible focus, Escape/return focus for dialogs/menus, skip navigation, keyboard table selection, no focus loss after mutation | Assertions in page/component tests and `docs/accessibility-manual-checklist.md`. |
| Semantics/contrast | Labels/descriptions, heading hierarchy, table headers, dialog title/description, status not conveyed by color alone, WCAG 2.2 AA contrast | axe plus manual checklist; no permanent axe suppression for missing semantics/contrast. |
| Touch/responsive | Critical actions remain usable at the three viewports; target size follows WCAG 2.2 AA target-size policy or documented exception | Responsive screenshots and checklist entry per route. |
| Manual screen reader | Login, user list/detail, destructive dialog, import preview, organization switcher, MFA, settings, and notifications | Named reviewer, date, browser/AT combination, findings, and redacted evidence in `docs/release-evidence/accessibility.md`. |

### RED → GREEN → REFACTOR

- [ ] Load `test-authoring` and `playwright-testing`.
- [ ] RED: Add component/hook tests for each loading/error/empty/success/permission state.
- [ ] GREEN: Implement screens and API wiring from generated types.
- [ ] REFACTOR: Extract reusable form/table/filter/notification/session components without speculative abstractions.
- [ ] Capture screenshots for loading, populated, empty, validation, forbidden, dependency failure, and success states.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/frontend/src/routes.tsx` | Complete route/protection/navigation map. |
| `apps/frontend/src/App.tsx` | Session restoration, unauthorized event handling, and protected-shell lifecycle. |
| `apps/frontend/src/pages/LoginPage.tsx` | Login/MFA challenge response and origin-safe recovery UI. |
| `apps/frontend/src/redux/actions/authAction.ts` | Auth/session state transitions and CSRF memory lifecycle. |
| `apps/frontend/src/redux/reducers/authReducer.ts` | Auth state, challenge-required state, and recovery state. |
| `apps/frontend/src/layouts/dashboard/DashboardLayout.tsx` | Protected application shell. |
| `apps/frontend/src/components/navigation/AppNavigation.tsx` | Accessible feature navigation. |
| `apps/frontend/src/components/organization/OrganizationSwitcher.tsx` | Single organization context switcher; no duplicate navigation implementation. |
| `apps/frontend/src/components/common/LoadingState.tsx` | Shared loading state. |
| `apps/frontend/src/components/common/ErrorState.tsx` | Shared error/retry state. |
| `apps/frontend/src/components/common/EmptyState.tsx` | Shared empty state. |
| `apps/frontend/src/modals/ConfirmationModal.tsx` | Existing confirmation owner upgraded with title, focus trap, labelled description, loading, and error semantics. |
| `apps/frontend/src/components/users/UserFilters.tsx` | Advanced user filters. |
| `apps/frontend/src/components/users/BulkActionsToolbar.tsx` | Bulk selection/actions. |
| `apps/frontend/src/components/users/ImportExportDialog.tsx` | Data workflow UI. |
| `apps/frontend/src/sections/user/UserListToolbar.tsx` | Existing search/filter owner; labels, retry, state, and keyboard updates. |
| `apps/frontend/src/sections/user/UserListHead.tsx` | Existing sortable table header owner; semantic sort/focus updates. |
| `apps/frontend/src/pages/UserDetailPage.tsx` | User detail/profile screen. |
| `apps/frontend/src/pages/AdminDashboardPage.tsx` | Admin dashboard. |
| `apps/frontend/src/pages/RoleManagementPage.tsx` | Roles and permissions. |
| `apps/frontend/src/pages/AuditLogPage.tsx` | Audit log. |
| `apps/frontend/src/pages/NotificationPreferencesPage.tsx` | Notification preferences. |
| `apps/frontend/src/pages/OrganizationPage.tsx` | Organization management. |
| `apps/frontend/src/pages/TeamPage.tsx` | Team management. |
| `apps/frontend/src/pages/AdminSettingsPage.tsx` | Admin settings. |
| `apps/frontend/src/pages/SessionsPage.tsx` | Session management. |
| `apps/frontend/src/telemetry/index.ts` | Frontend telemetry adapter. |
| `apps/frontend/src/telemetry/recordingTelemetry.ts` | Test telemetry recorder. |
| `apps/frontend/src/pages/UserPage.test.tsx` | User list behavior tests. |
| `apps/frontend/src/pages/UserDetailPage.test.tsx` | User detail/lifecycle behavior tests. |
| `apps/frontend/src/pages/AdminDashboardPage.test.tsx` | Dashboard state behavior tests. |
| `apps/frontend/src/pages/RoleManagementPage.test.tsx` | Role UI behavior tests. |
| `apps/frontend/src/pages/AuditLogPage.test.tsx` | Audit UI behavior tests. |
| `apps/frontend/src/pages/OrganizationPage.test.tsx` | Organization UI behavior tests. |
| `apps/frontend/src/pages/SessionsPage.test.tsx` | Session UI behavior tests. |
| `apps/frontend/vite.config.ts` | Component test setup and accessibility matchers. |
| `apps/frontend/playwright.config.ts` | Web-server/readiness, projects/viewports, retries, and artifact policy. |
| `apps/frontend/package.json` | Accessibility/component/E2E tooling scripts and dependencies. |
| `package-lock.json` | Root workspace lockfile for frontend tooling dependencies. |
| `apps/frontend/.env.example` | Environment-required frontend/API/E2E variables with no fallback credential. |
| `docs/accessibility-manual-checklist.md` | WCAG 2.2 AA keyboard, focus, contrast, viewport, and screen-reader checklist with owner/evidence fields. |
| `tools/e2e/redact-artifacts.sh` | Remove/verify absence of tokens, credentials, private data, and raw payloads before artifact retention. |
| `apps/frontend/test/e2e-frontend/phase-tests/full-admin-workflows.spec.ts` | Full browser workflow coverage. |

### Telemetry

Implement `ui.workflow.*`, `ui.auth.*`, `ui.user.*`, `ui.bulk.*`, `ui.import.*`, `ui.export.*`, `ui.notification.*`, and `ui.organization.*` for user-visible starts, success, validation, forbidden, unauthorized, conflict, retry, cancellation, and failure states. Tests assert events and request correlation.

### Hard Exit Criteria

- [ ] Every planned route has a reachable screen or an explicit protected redirect.
- [ ] Every screen has loading, empty, error, retry, success, and permission states as applicable.
- [ ] WCAG 2.2 AA automated axe scans, keyboard/focus assertions, defined viewport checks, and documented manual screen-reader checks pass for the route/state matrix.
- [ ] Generated types are used at API boundaries; no new `any` or hand-written duplicate DTOs are introduced.
- [ ] Headless Playwright workflows pass with no unexpected console errors.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Frontend/product-flow reviewer verifies real browser navigation, data binding, interactions, responsive behavior, accessibility, and absence of localStorage as the active source of truth.

## Phase 12: Test Pyramid, Security Verification, Performance, and Contract Evidence

**Owner:** Codex coordinator or verification worker
**Dependency:** Phases 1–11 PASS

### Chosen verification topology

Nx is the single entry point for local and CI verification, while one shell supervisor owns the child-service lifecycle for each E2E/a11y run. Playwright does not start servers. The root project is explicitly named `workspace`. The root targets delegate to these commands:

| Target | Owner/executor | Depends on | Readiness/teardown/cache rule |
| --- | --- | --- | --- |
| `infra-up` | root `project.json` run-commands | none | `docker compose --wait` starts disposable PostgreSQL/Redis; never cache. |
| `db-migrate` | backend target `migrate` | `infra-up` | `uv run alembic upgrade head`; fail on any migration error; never cache. |
| `backend:serve` | backend target `serve` | `db-migrate` | Continuous API process; the wrapper polls `/health/ready` and emits `BACKEND_READY`; never cache. |
| `backend:readiness` | backend target `readiness` | `backend:serve` | Poll `/health/ready`; finite target exits 0/1. |
| `worker` | backend target `worker` | `infra-up`, `db-migrate` | Continuous `uv run arq app.worker.WorkerSettings`; heartbeat readiness; never cache. |
| `worker:readiness` | backend target `worker-readiness` | `worker` | Poll worker heartbeat; finite target exits 0/1. |
| `frontend:serve` | frontend target `serve` | `backend:readiness` | Continuous Vite process; the wrapper polls HTTP and emits `FRONTEND_READY`; never cache. |
| `e2e-ci` | root `project.json` -> `tools/e2e/run-e2e.sh` | none; the script starts its own disposable dependencies and child services | The script owns child PIDs, runs migrations/readiness, headless Playwright, artifact redaction, and trap-based teardown; no cache. It does not invoke separate long-running Nx service targets. |
| `a11y` | root `project.json` -> `tools/e2e/run-a11y.sh` | none; the script starts disposable PostgreSQL/Redis, migrates, seeds deterministic organization/permissions, starts API/worker/frontend, and waits for all readiness checks | The script owns service PIDs, runs the full authenticated/forbidden route-state axe matrix, redacts artifacts, records manual-evidence checklist, and tears down; no cache. |
| `validate-full` | root `project.json` run-commands | `validate:api`, `check:generated`, frontend/backend lint/typecheck/build/unit/integration, `security-gates`, `e2e-ci`, `a11y` | Required merge/release gate; no stale cache across environment changes; emits redacted evidence manifest. |
| `security-gates` | root `project.json` run-commands | `infra-up`, `db-migrate`, backend security/integration tests, frontend security tests, dependency audit, secret scan | Required merge/release gate; no silent skips; always tears down disposable services. |
| `infra-down` | root `project.json` run-commands | none | Idempotent cleanup in CI `always()` and local trap. |

`project.json` at the repository root must contain `"name": "workspace"`; it, `package.json`, `nx.json`, `apps/backend/project.json`, `apps/frontend/project.json`, `tools/e2e/run-e2e.sh`, `tools/e2e/run-a11y.sh`, and `tools/e2e/stop-services.sh` must implement this exact topology. Shell supervisors poll HTTP/worker readiness themselves, emit named readiness lines, propagate child failures, and guarantee teardown. `playwright.config.ts` owns browser projects, base URL, viewport matrix, retries, and artifact policy only; it does not own service startup/readiness.

### Scope checklist

- [ ] Load `test-authoring` and `playwright-testing`.
- [ ] Add unit tests for service policies, validators, query builders, token/MFA utilities, serializers, and frontend reducers/hooks.
- [ ] Add API integration tests against disposable PostgreSQL/Redis for auth, CRUD, bulk, imports, organizations, notifications, roles, API keys, and dashboard.
- [ ] Add contract tests comparing API responses and error fields to OpenAPI.
- [ ] Add security tests for authentication, CSRF, CORS, trusted hosts/proxies, rate limits, privilege escalation, IDOR, tenant leakage, CSV injection, file limits, secret exposure, and replay.
- [ ] Add accessibility checks for every route and important modal/table/form state.
- [ ] Add headless Playwright E2E for all primary and negative workflows.
- [ ] Add performance checks for list/search/filter/dashboard queries and bounded imports/exports.
- [ ] Add failure-injection tests for PostgreSQL, Redis, email, OIDC, storage, and job boundaries.
- [ ] Add deterministic test bootstrap: disposable PostgreSQL/Redis services, Alembic migration, local-only seeded admin generated from CI environment variables, deterministic fixture cleanup/reset, and no fallback production-like credentials.
- [ ] Configure Playwright browser projects, base URL, retries, trace/screenshot/video-on-failure, and test isolation; Nx owns service startup/readiness/migration/teardown as defined above.
- [ ] Add Nx targets for `infra-up`, `db-migrate`, `backend:serve`, `backend:readiness`, `frontend:serve`, `worker`, `worker:readiness`, `e2e-ci`, `a11y`, `security-gates`, `validate-full`, and `infra-down`; declare environment inputs so tests cannot use stale Nx cache. E2E/a11y targets use the shell-supervisor scripts and do not also depend on separately started long-running services.
- [ ] Make PostgreSQL/Redis integration tests fail when required service variables are absent in CI; skips are allowed only for explicitly marked local-only tests.
- [ ] Add dependency audit and secret-scan commands with reviewed baselines; do not use `npm audit fix --force` or unreviewed major upgrades as a security fix.
- [ ] Pin the verification tools and CI policy: `npm audit --omit=dev --audit-level=high`, `pip-audit==2.9.0` installed through the backend uv tool/development group, and the official `gitleaks` v8.24.2 binary with a recorded SHA-256 checksum. High/critical production dependency findings fail CI unless a time-bound, owner-approved exception is recorded; synthetic test credentials are generated from CI variables and never committed.
- [ ] CI starts PostgreSQL and Redis service containers, exports non-empty `TEST_DATABASE_URL`/`REDIS_URL`, runs migrations and security/integration tests, and fails rather than blanking a dependency variable or accepting a silent skip.
- [ ] Define one required CI status check named `validate-full` (including the `security-gates` job) and require it in the repository branch-protection/release policy. The check fails on missing services, high/critical unapproved audit findings, secret-scan findings, contract drift, integration skips, or E2E failures; baseline exceptions include owner, reason, expiry, and approval.
- [ ] Remove or repair tests that pass without asserting behavior; run an adversarial test-quality pass.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/tests/test_security.py` | Cross-cutting security tests. |
| `apps/backend/tests/test_contracts.py` | OpenAPI/API response compatibility tests. |
| `apps/backend/tests/test_performance.py` | Query and bounded-operation performance tests. |
| `apps/frontend/test/e2e-frontend/accessibility.spec.ts` | Route/state WCAG 2.2 AA axe and keyboard checks. |
| `apps/frontend/test/e2e-frontend/phase-tests/full-platform.spec.ts` | Full headless workflow suite. |
| `apps/frontend/test/e2e-frontend/phase-tests/negative-workflows.spec.ts` | Denial, validation, retry, and failure E2E. |
| `apps/frontend/test/e2e-frontend/config/test.config.ts` | CI-injected URLs and generated test credentials; no committed fallback secret. |
| `apps/frontend/test/e2e-frontend/global-setup.ts` | Deterministic seed, migration/readiness gate, and fixture cleanup. |
| `apps/frontend/test/e2e-frontend/global-teardown.ts` | Browser/service artifact cleanup without raw secrets. |
| `project.json` | Root Nx project named `workspace`, with orchestration targets and required CI target definitions. |
| `tools/e2e/run-e2e.sh` | Local/CI child-process startup, readiness, Playwright execution, artifact handling, and trap-based teardown. |
| `tools/e2e/run-a11y.sh` | Accessibility server readiness and axe execution. |
| `tools/e2e/wait-for-worker.sh` | Worker heartbeat readiness check with timeout. |
| `tools/e2e/stop-services.sh` | Idempotent teardown. |
| `apps/frontend/playwright.config.ts` | Headless browser projects, base URL, exact viewports, retries, and failure artifacts only; no service startup. |
| `apps/backend/tests/conftest.py` | Disposable database/Redis fixtures, generated admin credentials, and cleanup. |
| `apps/backend/tests/test_tenant_isolation.py` | Cross-organization security tests. |
| `apps/backend/tests/test_rate_limits.py` | Operation-specific thresholds and Redis failure policy. |
| `apps/backend/tests/test_redaction.py` | Log/telemetry/exception scrubber tests. |
| `apps/backend/tests/test_restore_fencing.py` | Security epoch, worker generation, restore, and lease-fencing tests. |
| `apps/backend/pyproject.toml` | Pinned backend test/security/worker dependencies. |
| `apps/backend/uv.lock` | Reproducible backend dependency lockfile. |
| `apps/frontend/package.json` | Playwright, axe, component-test, and validation scripts/dependencies. |
| `package.json` | Root `validate:full`, `test:e2e:ci`, `test:a11y`, audit, secret-scan, and Nx orchestration scripts. |
| `nx.json` | Target defaults, `dependsOn`, named inputs, environment inputs, and cache/output policy. |
| `apps/backend/project.json` | Backend readiness/migration/worker/integration targets and dependencies. |
| `apps/frontend/project.json` | Frontend serve/build/typecheck/E2E/accessibility targets and dependencies. |
| `apps/frontend/.env.example` | No fallback real-looking credential; CI credentials are required through environment injection. |
| `apps/frontend/test/e2e-frontend/config/test.config.ts` | Environment-required test values and fail-fast validation. |
| `.github/workflows/ci.yml` | Complete contract, backend, frontend, security, and E2E gates. |
| `docs/testing-strategy.md` | Test pyramid, fixtures, data reset, and evidence policy. |

### Telemetry

Verification records `test.started`, `test.failed`, `test.succeeded`, `e2e.workflow.started`, `e2e.workflow.failed`, and `e2e.workflow.succeeded` without including credentials or raw payloads.

### Hard Exit Criteria

- [ ] All unit, integration, contract, security, accessibility, performance, and E2E suites pass in CI-compatible commands.
- [ ] Tests prove negative/security behavior rather than only happy paths.
- [ ] No test depends on a developer's local database, credentials, browser state, or untracked source files; absent CI dependencies fail the job instead of silently skipping the security/integration suite.
- [ ] Playwright runs from a clean checkout with migration, seed, readiness, cleanup, and artifacts proven by the command output.
- [ ] Nx target dependencies prevent frontend/backend/E2E race conditions and stale cache reuse.
- [ ] The exact Nx topology is implemented and documented: root `workspace:e2e-ci` and `workspace:a11y` invoke only their shell supervisors; those supervisors start/migrate/readiness-check/teardown their own services; teardown always runs; service logs/artifacts are uploaded redacted; all environment variables that affect behavior are Nx inputs.
- [ ] The full feature matrix links to at least one backend and one frontend proof per user-visible feature.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Test-quality and security reviewers verify assertion strength, failure coverage, fixture isolation, and no false-positive tests.

## Phase 13: Deployment, Observability, Backups, Recovery, CI/CD, and Documentation

**Owner:** Codex coordinator or operations worker
**Dependency:** Phases 0–12 PASS

### Scope checklist

- [ ] Add production-safe backend container/runtime configuration without committing secrets.
- [ ] Add exact local/staging/production environment variable documentation and a provider-neutral secret-injection contract; record provider-specific mapping only after the Scope Cuts decision is approved. Tracked `.env.example` files contain names/placeholders only and never fallback credentials.
- [ ] Enforce fail-closed non-local configuration: `SESSION_COOKIE_SECURE=true`, exact HTTPS CORS origins, explicit trusted hosts, configured trusted-proxy CIDRs/forwarded-chain handling, Redis-backed rate limiting, disabled bootstrap credentials, and no localhost defaults.
- [ ] Add health/readiness checks for PostgreSQL, Redis, email provider, storage, job worker, and identity provider where configured.
- [ ] Add structured request/event logs with correlation, metrics, traces, error tracking, and redaction rules.
- [ ] Add migration release gate, startup dependency behavior, graceful shutdown, worker retry, and stuck-job recovery.
- [ ] Add provider-neutral PostgreSQL backup/restore procedure, retention requirements, restore verification checklist, and evidence template. The actual backup target and restore drill remain blocked until the Scope Cuts decision is approved.
- [ ] Add provider-neutral rollback, mandatory `SESSION_EPOCH` increment after database restore/rollback, schema rollback decision, and data-import recovery procedures.
- [ ] Define restore fencing as an ordered procedure: stop ingress, pause/drain workers, invalidate Redis consumers/leases, reconcile durable jobs and email outbox, increment the authoritative `security_controls.security_epoch` and `worker_generation`, verify every API/worker instance observes both values, then resume traffic. A process-local or uncoordinated environment variable is not sufficient.
- [ ] Add dependency audit policy and safe upgrade process; do not use force upgrades without compatibility review.
- [ ] Update root README, backend README, API README, architecture decisions, deployment runbook, testing strategy, and troubleshooting.
- [ ] Correct known documentation contradictions explicitly: replace `frontend/src`/`backend/app` with `apps/frontend`/`apps/backend`, replace `cd frontend` with root/Nx commands, replace historical CRA/JavaScript wording in `docs/architecture-decisions.md`, and replace `REACT_APP_API_URL` with the Vite `VITE_API_URL` contract.
- [ ] Validate every documented command from a clean checkout or label it as environment/provider-dependent; record the exact command result in release evidence.
- [ ] Ensure CI runs contract validation, generated drift, typecheck, lint, backend tests, frontend tests, security checks, dependency/secret scans, and headless E2E with disposable dependencies. Do not add a provider deployment workflow before provider selection.

### File Manifest

| File | Purpose |
| --- | --- |
| `apps/backend/Dockerfile` | Reproducible production API image. |
| `apps/backend/docker-compose.prod.example.yml` | Non-secret deployment reference. |
| `apps/backend/docker-compose.yml` | Local API, worker, PostgreSQL, Redis, health checks, and isolated test profile. |
| `.github/workflows/ci.yml` | Complete CI gates. |
| `docs/provider-deployment-decision.md` | Explicit provider/secret-manager/backup/monitoring decision record; blocked until approved. |
| `docs/observability-runbook.md` | Logs, metrics, alerts, redaction, and incident response. |
| `docs/backup-restore-runbook.md` | Backup, restore, verification, and rollback evidence. |
| `docs/testing-strategy.md` | Full test/evidence policy. |
| `docs/deployment-runbook.md` | Updated release and rollback instructions. |
| `docs/architecture-decisions.md` | Current Nx/React/TypeScript/FastAPI architecture; supersedes historical CRA/JavaScript wording. |
| `README.md` | Complete local monorepo setup and operations. |
| `apps/backend/README.md` | Backend configuration, migrations, and troubleshooting. |
| `docs/api/README.md` | Contract and generated-artifact workflow. |
| `apps/frontend/README.md` | Frontend Nx/Vite environment, local run, deterministic E2E, accessibility, and troubleshooting commands. |
| `package.json` | Root local/CI commands including `validate:full`, `test:e2e:ci`, `test:a11y`, audit, and secret scan. |
| `project.json` | Root Nx orchestration target implementation. |

### Telemetry

Implement `service.health.*`, `dependency.*`, `deployment.*`, `backup.*`, `restore.*`, `worker.*`, and `release.*` events with low-cardinality metrics and redacted correlation metadata. Alert on authentication failures, 5xx, rate-limit spikes, database/Redis health, job failures, email failures, migration failures, and restore verification failures.

### Hard Exit Criteria

- [ ] Provider-neutral CI is reproducible from a clean checkout, including service startup, migrations, readiness, worker, tests, artifacts, and teardown.
- [ ] Production secrets are injected only through approved configuration, never source control or logs.
- [ ] Health/readiness, migration, provider-neutral backup/restore procedure, rollback/session-epoch, and incident runbooks are exercised where the environment is available; provider-specific drills are explicitly marked blocked when not approved.
- [ ] Observability can trace a request from browser/API through database/job/notification boundaries without leaking sensitive values.
- [ ] Any provider-specific deployment or external monitoring claim is verified from the selected provider configuration or marked `BLOCKED: requires human decision`; it is never inferred from a passing build.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Operations/security reviewer verifies deployment safety, secret handling, proxy/cookie policy, backup recovery, monitoring, and rollback claims.

## Phase 14: Final Integration, Real-User Walkthrough, and Release Gate

**Owner:** Codex coordinator
**Dependency:** All previous phase and review gates PASS

### Scope checklist

- [ ] Re-run schema, contract, generated-artifact, lint, typecheck, unit, integration, security, accessibility, performance, and headless E2E checks from a clean environment.
- [ ] Start PostgreSQL, Redis, backend, and frontend using only the documented local commands.
- [ ] Perform a real-user browser walkthrough: bootstrap/login, password/security path, dashboard, create/edit user, activate/deactivate, search/filter/sort, bulk action, import preview/commit, export, audit review, notification read, organization/team membership, invitation, role/permission change, session revocation, logout, and recovery from errors.
- [ ] Verify every route returns the expected contract and every mutation has audit/telemetry evidence.
- [ ] Verify migration from current baseline data and legacy localStorage backup/import path.
- [ ] Capture final screenshots and command outputs without credentials or private data.
- [ ] Run final adversarial review categories: plan accuracy, architecture, schema, security, directory/path, frontend/product flow, API contract, test quality, and operations.
- [ ] Fix every in-scope CRITICAL/HIGH finding; document scope-expansion rejections.
- [ ] Update EXIT VERIFICATION and feature matrix with evidence links.
- [ ] Restart affected services and repeat the smoke workflow after restart.
- [ ] Mark provider-specific deployment, external secret-manager/monitoring integration, and provider backup drill as `BLOCKED: requires human decision` unless the Scope Cuts decision is approved; do not infer these from local or CI evidence.
- [ ] Create the release commit and push only after all in-scope gates pass; do not push provider-specific claims that are still blocked.

### File Manifest

| File | Purpose |
| --- | --- |
| `docs/plans/user-management-full/user-management-full-implementation-plan.md` | This execution checklist and evidence record. |
| `docs/release-evidence/user-management-release-{commit}.md` | Redacted release evidence linked to the verified commit. |
| `docs/release-evidence/accessibility.md` | Redacted WCAG/manual screen-reader evidence with reviewer/date/tool details. |
| `docs/release-evidence/screenshots/` | Browser screenshots for the final user walkthrough. |

### Telemetry

Final verification records `release.preflight.started`, `release.preflight.failed`, `release.preflight.succeeded`, `release.user_walkthrough.started`, `release.user_walkthrough.failed`, `release.user_walkthrough.succeeded`, `release.restart.completed`, and `release.rollback.ready`.

### Hard Exit Criteria

- [ ] Every prior phase is marked complete with evidence and reviewer PASS.
- [ ] Clean-environment local setup works from the root README.
- [ ] Full real-user browser walkthrough succeeds after service restart.
- [ ] No CRITICAL or HIGH review finding remains unresolved.
- [ ] Feature matrix has no unchecked feature or undocumented cut.
- [ ] All provider-specific scope cuts are explicitly listed with owner/decision/evidence status.
- [ ] Release evidence contains no credentials, tokens, private data, or raw payloads.
- [ ] Reviewer writes: `PASS: all exit criteria met`.

### Required secondary review

Final reviewer independently checks the end-to-end feature matrix, evidence, user-visible behavior, security boundaries, operational claims, and release cleanliness.

## Edge Cases and Required Behavior

| Scenario | Required behavior |
| --- | --- |
| Login before session exists | Return documented `401`; frontend remains on login without an auth loop. |
| Login succeeds but cookie is not retained | Surface a safe session error, emit telemetry, and document host/CORS/cookie diagnostics. |
| Wrong password or unknown email | Same safe external response shape and timing policy; no account enumeration. |
| Locked account | Reject login, show generic recovery guidance, emit audit/telemetry. |
| Expired/revoked session | Return `401`, clear client auth state, and never serve protected data. |
| Missing/invalid CSRF | Return `403`; do not mutate data. |
| CSRF rotation/multi-tab | Keep the newest token in memory, retry once after fetching `/auth/csrf`, never persist the token, and never retry a non-idempotent mutation automatically without an idempotency key. |
| Duplicate email | Return `409`; preserve existing record. |
| Last administrator action | Reject unsafe deletion/demotion and explain the invariant. |
| Soft-deleted email restore conflict | Require explicit resolution; never silently overwrite. |
| Inactive/deleted user requests | Reject protected access and exclude from active lists. |
| Large or malformed import | Reject or preview row-by-row within configured limits; never partially mutate before commit. |
| Duplicate rows in import | Return deterministic row results and idempotent behavior. |
| Export too large | Queue bounded job or return explicit size/async response; never time out silently. |
| Permission denied | Return `403` without revealing resource existence beyond contract policy. |
| Cross-organization IDOR | Return tenant-safe denial/not-found and emit `permission.check.tenant_denied`. |
| OIDC state/nonce/PKCE replay | Reject callback and invalidate transaction state. |
| MFA replay or clock drift | Reject reused code, document allowed skew/retry limits, consume recovery codes atomically, and emit safe telemetry. |
| Email provider unavailable | Persist retryable outbox state and keep unrelated mutation response deterministic. |
| Redis unavailable | Fail closed for login, password reset, MFA, invitation, API-key, export, and job-admission limits; only explicitly approved low-risk reads may fail open, with dependency telemetry. |
| Database restore/rollback | Stop ingress and workers, reconcile durable jobs/outbox, increment authoritative `security_controls.security_epoch` and `worker_generation`, make every instance revalidate them, revoke/ignore restored sessions, verify migrations, and record restore evidence. |
| Legacy localStorage migration | Show a one-time warning, allow export and explicit deletion, define retention, and never treat localStorage as the active CRUD source after cutover. |
| PostgreSQL unavailable | Readiness fails; API returns dependency error without leaking driver details. |
| Browser reload during mutation | Idempotency prevents duplicate write; UI reconciles server state. |
| Network timeout | Show retry state and preserve unsaved form data where safe. |
| Keyboard-only user | All actions reachable with visible focus and semantic labels. |
| Mobile viewport | Tables, forms, dialogs, filters, and navigation remain usable without horizontal loss of critical actions. |

## Verification Command Matrix

Run commands from the repository root unless stated otherwise:

| Area | Command/evidence |
| --- | --- |
| Nx graph/projects | `npx nx show projects`; `npx nx graph --file=/tmp/user-management-nx-graph.json` |
| Contract | `npm run validate:api`; `npm run generate:api-types`; `npm run check:generated` |
| Frontend type/lint/test/build | `npm run typecheck`; `npm run lint:frontend`; `npm run test:frontend`; `npm run build:frontend` |
| Backend lint/test | `npm run lint:backend`; `npm run test:backend` |
| Database | `npm run infra:up`; `npm run db:migrate`; `npm run db:current`; disposable reset/reapply evidence |
| Fast checks | `npm run test`; `npm run lint`; `npm run validate` (partial: backend check + frontend typecheck/unit tests only) |
| Full validation | `npm run validate:full` after it is implemented; includes contract, generated artifacts, lint, typecheck, build, migrations, integration, security, accessibility, and E2E gates |
| E2E | `npm run test:e2e:ci` with Nx-managed services, migration, seed, readiness, cleanup, and headless Playwright |
| Accessibility | `npm run test:a11y` plus documented manual WCAG 2.2 AA keyboard/screen-reader evidence |
| Security | `npm run audit:dependencies`; `npm run scan:secrets`; auth/permission/tenant/CSRF/rate-limit/redaction tests |
| Operations | Health/readiness, logs, metrics, provider-neutral backup/restore procedure, migration, rollback/session-epoch, and restart evidence |

### Root command-to-Nx mapping

| Root command | Nx target | Required behavior |
| --- | --- | --- |
| `npm run infra:up` | `nx run workspace:infra-up` | Start local disposable PostgreSQL/Redis and wait for health. |
| `npm run infra:down` | `nx run workspace:infra-down` | Idempotent teardown. |
| `npm run db:migrate` | `nx run backend:migrate` | Apply Alembic migrations. |
| `npm run test:e2e:ci` | `nx run workspace:e2e-ci` | Shell-supervised services, migration, seed, readiness, Playwright, redaction, teardown. |
| `npm run test:a11y` | `nx run workspace:a11y` | Shell-supervised API/frontend, axe matrix, teardown, manual-evidence checklist. |
| `npm run validate:full` | `nx run workspace:validate-full` | Required contract, generated, build, test, security, and E2E gate. |
| `npm run security:gates` | `nx run workspace:security-gates` | Required audit, secret-scan, auth/tenant/redaction tests. |

No command is considered proof by itself; the result must be linked to the phase, feature, environment, and commit that produced it.

## Commit and Change Management

Use one focused commit per phase or cohesive phase package:

```text
feat(contract): expand user management API contracts
feat(auth): add password recovery and session lifecycle
feat(users): add lifecycle and bulk management
feat(tenancy): add organizations and teams
feat(frontend): complete administrator workflows
test(platform): add security and full browser verification
docs(ops): add deployment and recovery evidence
```

Each commit must pass the relevant phase tests and must not include `.env`, credentials, runtime directories, build output, screenshots with private data, or generated artifacts that were not produced from the contract.

## Blocked Protocol

If a phase fails:

1. Stop before starting the next phase.
2. Record the exact command, environment, failure, affected feature, and whether data changed.
3. Reproduce with the smallest focused test or diagnostic command.
4. Fix only within the declared phase scope unless the user explicitly expands scope.
5. Re-run RED → GREEN → REFACTOR and the phase review.
6. If the same external blocker repeats three consecutive goal turns and no meaningful progress is possible, mark the work blocked and request the specific missing decision/access.

Never bypass a failing migration, security test, contract check, reviewer gate, or browser flow by marking the phase complete.

## Adversarial Review Findings

### Iteration 1

**Reviewers:** Peirce (architecture/schema/API), Lorentz (security/auth/tenant/operations), and Kepler (frontend/product flow/accessibility/E2E/Nx/docs).
**Result:** `CHANGES_REQUIRED`; no source files were changed by reviewers. The reports identified three CRITICAL findings, numerous overlapping HIGH/MEDIUM findings, and provider-specific scope-expansion findings.

**Applied corrections in this revision:**

- Canonical `users.status` now separates inactive/deactivated users from soft-deleted users; `deleted_at` is only set for `deleted`, and the backfill/partial-email-index strategy is explicit.
- Tenant migration now creates a deterministic default organization, assigns existing users/bootstrap admin, carries organization context through sessions/jobs/audit/notifications/API keys, and makes `organization_memberships.role_id` canonical.
- The contract now includes initial-password, OIDC start/callback/link, MFA recovery, bulk delete/restore/role, job status/cancel, avatar, role-assignment, invitation list/resend, and explicit API-key transport/policy routes.
- `arq` worker topology, durable job semantics, Nx targets, Docker service wiring, dependency/lockfile changes, router/model registration, and CI service/seed/readiness/teardown are explicit.
- CSRF is now intentionally response-plus-memory with `no-store`/`Vary: Cookie`; session cookie configuration has one source of truth; security-sensitive rate limits and Redis failure behavior are defined.
- Invitation tokens use a request body instead of a token-bearing URL; telemetry uses route templates and a centralized scrubber; audit writes are transactional and database append-only.
- The frontend now has route/guard/navigation and workflow-state matrices, WCAG 2.2 AA/axe/manual verification, deterministic E2E setup, exact component ownership, and no duplicate organization switcher/confirmation-dialog path.
- Documentation corrections, `validate` versus `validate:full`, provider-neutral operations, mandatory restore `SESSION_EPOCH` rotation, and the explicit provider decision blocker are recorded.

Reviewer findings that would add a hosting vendor, external KMS/SIEM, or provider-specific production deployment were classified as `REJECTED: scope expansion` and converted into the Scope Cuts blocker rather than silently assumed.

### Iteration 2+

**Iteration 2:** `CHANGES_REQUIRED`. The reviewers found remaining tenant-route, MFA-before-session, OIDC binding, job-dispatch, CI/E2E, accessibility, documentation, and exact-manifest gaps. These were applied in the next revision.

**Iteration 3:** `CHANGES_REQUIRED`. The reviewers found remaining rate-limit identity/budget, restore-fencing, API-key cryptography, OIDC/provider policy, route-matrix, and Nx lifecycle gaps. These were applied in the next revision.

**Iteration 4:** `CHANGES_REQUIRED`. The reviewers found one remaining Nx shell-supervisor ownership contradiction and command/manifest wording gaps. These were applied in the next revision.

**Iteration 5:** `CHANGES_REQUIRED`. The reviewers found that the hard-exit dependency wording still contradicted the selected shell-supervisor topology. It was corrected, and `validate-full`, `security-gates`, and the full accessibility fixture chain were made explicit.

**Iteration 6:** `PASS`. Independent architecture/schema/API, security/auth/tenant/operations, and frontend/product-flow/accessibility/E2E/Nx/docs reviewers reported zero remaining CRITICAL or HIGH findings. No reviewer edited source files. Provider-specific deployment, secret-manager/KMS, backup-provider, external monitoring, and real provider restore-drill work remain explicitly blocked scope expansion.

## Reviewer Concerns — Not Applied (Scope-Expansion Rejections)

- `REJECTED: scope expansion` — selecting a hosting provider, secret manager/KMS vendor, backup provider, external monitoring/SIEM, and provider-specific deployment/rollback automation. The plan includes provider-neutral readiness and a decision record, but actual integration requires an explicit human decision.
- Any later suggestion that expands beyond the user-management feature set must be recorded here and rejected rather than silently added to scope.

## Next Steps After Plan Approval

1. Execute Phase 0 and produce the redacted schema reference and complete gap matrix.
2. Run the contract phase before changing database models or API/frontend code.
3. Execute each phase in order, checking off work and review tasks immediately after evidence is recorded.
4. Keep the current working system available until the final cutover and legacy-import verification pass.
5. Do not claim completion until Phase 14 and the real-user browser walkthrough pass.
