# FlowSync Roadmap Progress

This is the implementation status for the local monorepo branch
`feature/flowsync-crm-product`. It separates verified local work from
production-scale work that still needs infrastructure, benchmark data, or a
separate deployment decision.

## Completed and verified locally

- [x] Phase 0: Nx monorepo, React/TypeScript frontend, FastAPI backend,
  PostgreSQL/Redis Docker services, environment templates, MUI Hearth/FlowSync
  tokens, API validation, and generated artifacts.
- [x] Phase 1: CRM models, Alembic migrations, OpenAPI sync contracts, UUID
  client IDs, HLC format, soft-delete tombstones, and conflict policy.
- [x] Phase 2: IndexedDB storage adapter, memory fallback, organization
  isolation, transactional local-write plus outbox, cursor persistence, and
  persistent-storage request.
- [x] Phase 3: CRM dashboard, accounts, contacts, deals, activities, detail
  pages, activity timeline, pipeline drag/drop, global search, empty/loading/
  offline states, and keyboard-accessible navigation.
- [x] Phase 4: FastAPI authentication/session/CSRF flow, organization-scoped
  CRM endpoints, RBAC, structured request logs, health/readiness, rate limits,
  and PostgreSQL integration.
- [x] Phase 5: HLC-aware push/pull, per-operation acknowledgement, idempotency,
  retries, partial failure retention, cursor pull, Web Locks, BroadcastChannel,
  reconnect handling, and sync status UI.
- [x] Phase 6: Review-required conflicts, conflict resolution operations,
  server operation history, tombstones, and conflict-review UI.
- [x] Phase 9 local test slice: backend unit tests, frontend unit tests,
  generated-contract validation, build/typecheck/lint, and five Playwright
  scenarios including offline IndexedDB/outbox behavior.
- [x] Phase 10 local slice: security headers, sanitized structured logs,
  dependency/configuration documentation, and a local sync/storage diagnostics
  panel with metadata-only failed-operation export.
- [x] Phase 11 local slice: root setup documentation, backend documentation,
  conflict policy, resilience runbook, test/proof matrix, release checklist,
  mobile-readiness notes, and this progress record.

## Explicitly deferred, not falsely marked complete

- [ ] SQLite WASM/OPFS worker adapter: IndexedDB remains the approved first
  adapter until the documented benchmark justifies a second implementation.
- [ ] 3M-5M server seed, 100k browser benchmark, k6 concurrency benchmark,
  and measured performance budgets: require a disposable benchmark dataset and
  repeatable CI hardware.
- [ ] Partial replication scopes, snapshot/cursor-expiry recovery, operation
  compaction, PgBouncer, Redis fan-out, and SSE/WebSocket live invalidations:
  the current sync API is polling-based and correct for the local foundation.
- [ ] Yjs collaborative notes, tag set semantics, rich conflict editor,
  property-based simulation, mutation testing, and axe automation.
- [ ] OpenTelemetry/Grafana production dashboards, encrypted local storage,
  backup/restore drill, staging deployment, public demo, and release tag.
- [ ] Native mobile application: the protocol and adapter boundaries are
  documented, but mobile implementation remains a later product phase.

## Verification record

The latest local proof includes:

- `uv run pytest -q`: 14 passed, 1 skipped.
- Disposable PostgreSQL integration run after migrating a fresh local database:
  1 passed.
- `uv run ruff check app tests alembic`: passed.
- `npm run typecheck`, `npm run lint:frontend`, frontend unit tests, API
  validation, generated-artifact check, and production build: passed.
- Isolated headed-browser E2E run on local ports: 5 passed.
- Live sync smoke: login, push, idempotent replay, pull, conflict creation,
  resolution, and entity history all returned successful responses.

No production deployment or Git push is part of this progress record.
