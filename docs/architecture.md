# FlowSync Architecture Guide

FlowSync is a modular-monolith FastAPI service and a React/TypeScript web
client in one Nx monorepo. PostgreSQL is the durable source of server truth;
Redis is an optional shared rate-limit store. The browser owns an
organization-scoped IndexedDB cache and an outbox for CRM records.

## Data path

```text
MUI React UI
  -> typed CRM repository
  -> IndexedDB record + outbox transaction
  -> HLC sync engine (push/pull, retries, cursor)
  -> FastAPI sync router
  -> SQLAlchemy service transaction
  -> PostgreSQL records, operation log, conflicts, tombstones
```

Authentication and authorization remain server-owned. The browser stores only
the cache/outbox for the active organization and clears it on logout. Review-
required deal fields create durable conflicts instead of silent overwrites;
the policy is documented in [`conflict-policy.md`](conflict-policy.md).

## Boundary decisions

- FastAPI and PostgreSQL are retained rather than introducing a second backend
  runtime.
- IndexedDB is the first adapter; SQLite WASM/OPFS is a replaceable future
  adapter after benchmark validation.
- HLC ordering and operation IDs make replay idempotent and deterministic.
- MUI remains the presentation system; FlowSync/Hearth tokens are centralized
  in the theme.
- Mobile is a future client of the versioned sync contract, not a second web
  implementation hidden in this branch.

See [`architecture-decisions.md`](architecture-decisions.md),
[`operations/flowsync-resilience-runbook.md`](operations/flowsync-resilience-runbook.md),
and [`plans/user-management-full/flowsync-roadmap-progress.md`](plans/user-management-full/flowsync-roadmap-progress.md)
for detailed decisions, failure handling, and current scope.
