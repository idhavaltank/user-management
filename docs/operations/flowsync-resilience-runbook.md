# FlowSync Resilience Runbook

Status: local development and test runbook

Date: 2026-10-23

Scope: Phase 8 resilience scenarios and Phase 9 proof activities

## Safety boundary

This runbook is for the local monorepo checkout and disposable Docker
services. It does not authorize production access, deployment, backup
restoration, credential rotation, or deletion of shared data.

The safe local stack is:

- frontend: Vite development server;
- backend: FastAPI/Uvicorn;
- database: local PostgreSQL container;
- optional shared limiter: local Redis container;
- browser storage: IndexedDB, with memory fallback in unsupported/test
  environments.

## Preflight

Run from the monorepo root:

```bash
npm install
npm run infra:up
npm run db:migrate
npm run db:current
npm run dev:all
```

Verify health before testing a failure path:

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8000/ready
```

Run focused checks after recovery:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

The E2E command must use the local test admin configuration without printing
the password into shell history or logs.

## Scenario matrix

| Scenario | Current local behavior | Verification state | Recovery expectation |
| --- | --- | --- | --- |
| Backend unavailable | Online API calls fail; CRM pages can use cached/local records and pending outbox | Offline E2E plus sync-engine unit coverage | Restore API, reconnect, then replay pending work and verify acknowledgements |
| Browser goes offline | Connectivity state changes; local CRM CRUD writes to IndexedDB/outbox | E2E covered for local CRUD | Reconnect without losing the local record or outbox entry |
| Long offline / expired cursor | Cursor recovery protocol is not yet implemented | Not run | Preserve pending local operations, export if necessary, snapshot-resync, replay |
| Mixed push result | Push returns per-operation acknowledgements; failed operations remain in the local outbox | API smoke covers idempotent push; mixed batch scenario not run | Mark each operation independently; do not retry accepted operations |
| Permission revoked while offline | Rejected operations remain retained and metadata-only export is available from diagnostics | Export UI is browser-covered; permission-specific rejection not run | Keep rejected operation visible with reason and preserve local evidence |
| Future clock / past clock | HLC format and deterministic comparison are present | Unit-level proof passed | Normalize/compare safely without ordering by local wall clock alone |
| Browser quota pressure | Persistent-storage request/fallback exists; eviction UX is not complete | Partial | Warn before writes fail; offer scoped eviction and export |
| Local database corruption | No integrity-check/resync workflow is complete | Not run | Export pending outbox, clear only affected local scope, resync |
| Logout/account switch | Organization clear path exists in the adapter | Focused tests required | Clear prior organization records and outbox before showing the next account |
| Device revocation | Device-management workflow is not implemented | Not run | Revoke device and reject future operations safely |

## Runbook procedures

### A. Backend outage while the browser is open

1. Capture the browser URL, visible connectivity state, pending count, and
   request ID if one is displayed.
2. Do not clear browser storage.
3. Stop or pause only the local backend process; do not kill an unrelated
   process after relying on a port number alone.
4. Create or edit a CRM record and confirm the local record and pending outbox
   entry remain present.
5. Restore the backend and check `/health` and `/ready`.
6. Re-run the focused E2E flow. Once the sync engine is implemented, verify
   per-operation acknowledgement, cursor advancement, and pending-count
   reduction rather than only the HTTP status.

### B. IndexedDB upgrade is blocked

1. Keep the tab showing the error open for evidence.
2. Close other tabs of the same origin that may hold the old database open.
3. Reload once and retry.
4. If the local database is disposable, export any pending-operation evidence
   first, then use the browser's origin storage controls to clear only the
   FlowSync origin.
5. Re-run the IndexedDB adapter tests and the offline E2E test.

Do not use a broad browser-data wipe as a first response.

### C. Migration failure

1. Record `npm run db:current`, `npm run db:history`, and the full migration
   error.
2. Check the configured local database host/user/database without exposing the
   password.
3. Confirm Docker PostgreSQL is healthy with `docker compose ps`.
4. Retry the migration only after fixing the local configuration.
5. If the database contains disposable data, recreate the local volume using
   the explicitly destructive `npm run infra:reset` path and rerun from empty.

Never downgrade a shared database as a quick local fix.

### D. Outbox inspection and recovery

The outbox is local state and can contain CRM changes not yet accepted by a
server. Before clearing it, capture:

- organization ID (redacted if shared in a report);
- operation IDs;
- entity and operation kind;
- attempt count and error;
- created-at ordering;
- whether the corresponding local record is still visible.

Use the **Sync diagnostics** panel to export failed-operation metadata before
clearing local state. The export intentionally excludes CRM field values. Do
not describe manual browser-console extraction as a supported recovery
procedure.

### E. Account switch and logout

1. Confirm the current organization and pending count.
2. Sign out through the UI.
3. Sign in as the second local account/organization.
4. Verify that the previous organization's CRM rows and pending count are not
   visible.
5. Reopen the first account and verify its local scope is either intentionally
   retained or cleared according to the product decision.

The test must assert data isolation, not only that the route changed.

## Evidence template

```text
scenario:
date/time:
branch/commit:
local services:
browser/context:
setup command:
failure injected:
expected recovery:
observed recovery:
request IDs / operation IDs:
commands and results:
status: pass | fail | not_run | blocked
remaining risk:
```

## Local-only cuts and escalation

Not part of this runbook's local proof:

- production failover or incident response;
- managed PostgreSQL backup/restore drills;
- multi-region network partitions;
- Redis cluster failover;
- customer-data recovery;
- mobile background execution or OS-killed process recovery;
- deployment rollback.

Those require a separately approved environment, credentials, data policy, and
rollback owner. Until then, keep the roadmap status as **local sync/recovery
foundation implemented; cursor-expiry, corruption recovery, device revocation,
and production drills open**.

