# User-Management Feature Gap Matrix

## Post-implementation execution note — 2026-10-23

The table below is the original Phase 0 baseline and remains useful for
traceability; its `Current` column is intentionally historical. The current
implementation and verification state is recorded in
[`evidence/implementation-evidence-20261023.md`](evidence/implementation-evidence-20261023.md).
That evidence distinguishes locally verified API/UI behavior from provider,
worker, production-security, accessibility, and release work that is still
open.

This matrix maps every row in the plan's Feature Coverage Matrix to the
current repository evidence, the owning implementation phase, and the proof
required before that phase can pass. `Current` describes the verified baseline;
it is not a claim that the full feature is complete.

| Feature | Current implementation evidence | Gap | Owner phase | Required proof |
| --- | --- | --- | --- | --- |
| Admin login/logout/session restore | `app/api/auth.py`, `app/core/auth.py`, `LoginPage.tsx`, `App.tsx` | Harden failure, expiry, and browser evidence | 3 | API and browser auth tests |
| HttpOnly sessions and CSRF | `UserSession`, auth dependencies, `httpClient.ts` | Rotation, no-store headers, revocation and recovery coverage | 3 | Cookie, CSRF, expiry, revocation tests |
| Password change/reset | No password mutation/reset route | Add one-time tokens, rate limits, email adapter, UI | 3 | Contract, service, email, E2E |
| Email verification | No verification token model or route | Add token lifecycle and verified-state policy | 3 | Expiry/replay and browser flow |
| Account lockout/login history | No counters/history model | Add bounded failure tracking and security events | 3 | Failure counter and audit tests |
| MFA/TOTP/recovery codes | No MFA model, route, or UI | Add encrypted secret, challenge, and recovery-code lifecycle | 9 | Enrollment, challenge, replay, recovery tests |
| SSO/OIDC | No external identity or transaction model | Add provider-neutral OIDC adapter and callback state | 9 | Adapter contract and provider-failure tests |
| User CRUD | `app/api/users.py`, `app/services/users.py`, `UserPage.tsx` | Move to organization context, canonical status, permission policy | 5/8 | CRUD, conflict, authorization, browser flow |
| User profile/detail | List payload includes profile fields; no detail screen | Add detail/profile view and privacy rules | 5/11 | Detail, edit, privacy, UI tests |
| Activate/deactivate | `is_active` currently couples activity to deletion | Introduce canonical status without conflating deletion | 5 | Lifecycle and access-denial tests |
| Soft delete/restore | Delete endpoint sets `is_active=false/deleted_at` | Add explicit restore and uniqueness/audit semantics | 5 | Restore, uniqueness, audit tests |
| Search/filter/sort/pagination | Basic list query supports page/search/sort/order | Add filters, stable contract, indexes, limit handling | 6 | Query, index, UI, limit tests |
| Bulk actions | No bulk route or UI | Add bounded authorized jobs, partial results, audit | 6 | Partial-failure, authorization, audit tests |
| CSV import/export | No import/export route or UI | Add preview/commit, escaping, size limits, job status | 6 | Limits, escaping, contract, E2E |
| Roles and permissions | `UserRole.ADMIN/USER` plus `require_admin` | Add organization role/permission policy and denial paths | 4 | Policy matrix and denial tests |
| Audit logs | Structured request telemetry only | Add append-only transaction audit records and UI | 7 | Immutable records and admin UI |
| In-app/email notifications | No notification model or delivery adapter | Add preferences, outbox, local sink, retry/failure state | 7 | Delivery, retry, preference, failure tests |
| Sessions page/revocation | Session records and logout exist; no session list UI | Add session list, current/other revoke routes and UI | 10 | Revoke current/other session tests |
| Admin dashboard | No dashboard route or screen | Add authorized aggregates and loading/error states | 10 | Aggregate accuracy and permissions |
| System/user settings | No settings route or screen | Add validated org/user settings boundaries | 10/11 | Configuration and validation tests |
| Organizations/teams | No organization or membership models | Add tenant model and explicit organization context | 8 | Tenant isolation and membership tests |
| Invitations | No invitation model or route | Add hashed body-token lifecycle, expiry, resend/revoke | 8 | Token, expiry, accept/revoke tests |
| API keys | No API-key model or route | Add hashed one-time display, scopes, org binding, revocation | 9 | Hashing, scope, revocation, exposure tests |
| Responsive/accessibility UI | Existing MUI screens and basic Playwright flow | Add complete workflows, keyboard/focus/semantics/responsive proof | 11 | Automated and manual browser evidence |
| Observability/metrics | Structured logs, request IDs, basic telemetry, rate-limit events | Add event coverage, safe metrics, scrubber, job/email/audit visibility | 13 | Event/metric assertions and dashboards/adapters |
| Backups/recovery/deployment | Local Docker/runbook only | Add provider-neutral gates, backup/restore templates, CI, rollback rules | 13/14 | Restore rehearsal and release evidence; provider-specific deployment remains blocked |

## Cross-cutting proof obligations

- Every new route must be contract-first, rate-limit reviewed, and covered for
  the applicable error envelope, including `429` where the phase budget applies.
- Every backend behavior change and frontend hook/function behavior change must
  have RED → GREEN → REFACTOR evidence and structured telemetry assertions.
- Every database mutation must be represented by an Alembic migration and
  tested against both a clean local database and the current baseline schema.
- Every organization-scoped read/write must prove membership authorization and
  denial of a different organization.
- No proof artifact may contain raw passwords, session cookies, CSRF values,
  reset/invitation/MFA/API-key tokens, or private customer data.
