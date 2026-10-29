# Local-first CRM: web implementation plan

Scope: web app only (mobile comes later, but every decision below keeps the door open). Goal: a portfolio-grade CRM that is instant, works fully offline, syncs safely across devices and tabs, and stays fast with millions of records on the server.

## 1. Honest scope and timeline

- Realistic effort: 10-12 weeks part-time (about 10-12 hours a week). Do not promise less to yourself.
- MVP cut line (shippable, already impressive): Phases 0-6 plus the core tests from Phase 9. Everything after is polish and depth.
- Rule: finish each phase's exit criteria before starting the next. If a phase runs over by 50 percent, cut scope from the list, never skip the tests.
- Non-goals for now: mobile app, billing, email integration, custom CRDT implementation, multi-region deployment, AI features.

## 2. Target architecture

```text
Browser (each tab)                         Server
+--------------------------------+         +--------------------------------------+
| React UI (TanStack Virtual)    |         | API (REST + SSE/WebSocket)           |
|   |  reactive queries          |         |   auth, RBAC, rate limit             |
| Data layer (repositories)      |  push   |   sync endpoints: push / pull        |
|   |                            | ------> |   op validation + HLC merge          |
| Web Worker                     |         | PostgreSQL                           |
|   SQLite WASM on OPFS          | <------ |   ops log (append-only, seq no.)     |
|   outbox + sync engine         |  pull   |   current-state tables + indexes     |
|   FTS5 local search            |         | Redis (cache, rate limits, pub/sub)  |
| Tab coordination (Web Locks)   |         | Worker queue (compaction, imports)   |
+--------------------------------+         +--------------------------------------+
```

### Key decisions (record each as an ADR in Phase 0)

- Monorepo with Nx: `apps/web`, `apps/api`, `packages/sync-core`, `packages/schema`, `packages/ui`, `packages/test-utils`.
- Language: TypeScript end to end. Reason: the merge logic (hybrid logical clock, field-level merge, operation validation) must behave identically on client and server. Sharing one `sync-core` package removes a whole class of bugs. If you prefer a Python API, you must add shared test vectors that both implementations pass.
- Local database: SQLite compiled to WASM, running in a dedicated Web Worker, persisted on OPFS. Fall back to IndexedDB only if OPFS is unavailable. Reason: real SQL, indexes, FTS5 full-text search, and fast queries over 100k+ rows without blocking the UI thread.
- Server database: PostgreSQL as the system of record. Redis for cache, rate limiting, and fan-out between API instances.
- Sync model: operation log plus field-level last-writer-wins using a hybrid logical clock (HLC). Server assigns a global sequence number to every accepted operation. Clients pull by sequence cursor.
- Special data types: notes use Yjs (text CRDT); tags use add/remove set semantics; deletes use tombstones.
- Conflict policy by field class: low-risk fields auto-merge; high-risk fields (deal stage, owner, amount) raise a conflict for the user to review.
- Partial replication: each device syncs only a scoped subset (owned accounts, recent activity, open deals), never the full database.
- Mobile readiness rule: `sync-core` has no DOM or browser dependency, and storage sits behind an adapter interface.

### Data model (v1)

- `workspace`, `user`, `membership(role)`
- `account` (company), `contact`, `deal(stage, amount, owner, account_id)`, `activity` (call, meeting, task), `note`, `tag`, `entity_tag`
- Every synced row has: `id` (UUIDv7 generated on the client), `workspace_id`, `created_at`, `updated_at`, `deleted_at` (tombstone), `schema_version`, and per-field HLC metadata (`field_clocks`).
- Server only: `ops` table (seq, op\_id, device\_id, workspace\_id, entity, entity\_id, field, value, hlc, applied\_at) and a `sync_cursor` per device.

### Operation format

```text
{ opId, deviceId, workspaceId, entity, entityId, changes: { field: value }, hlc, schemaVersion, kind: upsert | delete }
```

Operations are idempotent (same opId applied twice has no effect) and independent of device wall-clock time.

## 3. Performance and scale budgets (the numbers you will prove)

| Area | Target |
| --- | --- |
| Local read (indexed query, 100k rows) | under 20 ms p95 |
| Local write (optimistic, UI updated) | under 50 ms from click to paint |
| Full-text search, 100k local contacts | under 100 ms p95 |
| List scroll, 100k rows virtualized | steady 60 fps, no long tasks over 50 ms |
| Initial sync of a scoped dataset (50k rows) | under 15 s on a normal connection, UI usable during sync |
| Incremental sync (100 ops) | under 1 s end to end |
| Server search over 3M contacts | under 150 ms p95 |
| Server push endpoint, batch of 500 ops | under 300 ms p95 |
| Largest Contentful Paint (cached, repeat visit) | under 1.5 s |
| JS bundle (initial route, gzipped) | under 200 KB; SQLite WASM lazy-loaded |
| Convergence | 100 percent: all devices identical after any offline/online sequence in the fuzz test |

Scale targets: 3-5 million contacts and 10M+ operations on the server; 100-300k rows replicated locally per device; 5+ simulated devices editing concurrently.

## 4. Phased plan

### Phase 0: Foundations and decisions (week 1)

Outcome: a clean repo where lint, types, tests, and CI run before any feature exists.

- [ ] Create the Nx monorepo with `apps/web`, `apps/api`, and the shared packages listed above
- [ ] TypeScript strict mode, ESLint, Prettier, import boundaries enforced by Nx tags (apps may depend on packages, never the reverse)
- [ ] Vitest for unit tests, Playwright for E2E, a shared `test-utils` package
- [ ] GitHub Actions: lint, typecheck, test, build on every push; Nx affected-only runs for speed
- [ ] Docker Compose for Postgres and Redis; one command (`npm run dev`) starts everything
- [ ] Write ADRs for: TypeScript backend, SQLite WASM, op-log sync, field-level LWW, partial replication, conflict policy
- [ ] Write the performance budget table above into `docs/performance-budgets.md`
- [ ] Decide the product scope in one page: personas, top 5 user stories, explicit non-goals
- [ ] Conventional commits and a PR template with a checklist (tests, budgets, ADR updated)

Exit criteria: CI green on an empty app; ADRs merged; one command boots the full stack.

### Phase 1: Domain model, schema, and contracts (week 1-2)

Outcome: one source of truth for data shapes and the sync protocol.

- [ ] Define entities with Zod (or similar) in `packages/schema`; derive TypeScript types and validation from it
- [ ] Postgres schema and migrations (Drizzle or Kysely); indexes on workspace\_id plus every filter and sort column you plan to expose
- [ ] Local SQLite schema mirroring the synced tables, with a migration runner and schema version table
- [ ] Define the operation format, HLC format, and sync API contract (OpenAPI) before writing endpoints
- [ ] UUIDv7 IDs generated client-side so offline creation never needs the server
- [ ] Seed script: generate realistic fake data at 3-5M contacts for the server using batched `COPY`
- [ ] Document which fields are low-risk (auto-merge) and which are high-risk (review) in `docs/conflict-policy.md`

Exit criteria: contract reviewed and frozen for v1; seed script loads 3M contacts in a few minutes; migrations run clean from empty.

### Phase 2: Local data layer (week 2-3)

Outcome: the app can store and query data entirely in the browser, with no server.

- [ ] Run SQLite WASM in a dedicated Web Worker; expose a typed RPC interface (Comlink or hand-rolled) to the main thread
- [ ] Persist on OPFS; implement the IndexedDB fallback behind the same storage adapter interface
- [ ] Request persistent storage (`navigator.storage.persist()`) and show a warning if denied
- [ ] Repository layer per entity (create, update, delete, list with filters, pagination) using keyset pagination
- [ ] FTS5 virtual tables for contact, account, and note search; triggers keep them in sync
- [ ] Reactive queries: UI subscribes to a query and re-renders when relevant tables change (change notifications from the worker)
- [ ] Every write goes through one function that updates the row and appends to the outbox in a single transaction
- [ ] Benchmark script: insert 100k, 300k rows; record read, write, and search timings against the budgets
- [ ] Index review: run `EXPLAIN QUERY PLAN` on every list and search query; no full table scans on hot paths

Exit criteria: benchmark meets read, write, and search budgets at 100k rows; works after a hard refresh and a browser restart.

### Phase 3: Core CRM UI, offline-first (week 3-4)

Outcome: a usable CRM that never waits on the network.

- [ ] App shell, routing, layout, design tokens; shared component package
- [ ] Contacts and accounts list: virtualized (TanStack Virtual), column sorting, saved filters, keyboard navigation
- [ ] Contact and account detail pages with activity timeline
- [ ] Deals pipeline board (drag and drop between stages) with optimistic updates
- [ ] Forms with validation shared from `packages/schema`
- [ ] Global search (local FTS) with instant results
- [ ] Notes editor (plain text first; Yjs comes in Phase 6)
- [ ] Empty, loading, error, and offline states for every screen
- [ ] Accessibility: keyboard-only flows, focus management, labels, color contrast; run axe in tests
- [ ] Performance: code-split routes, lazy-load the SQLite WASM bundle, memoize row components, measure with React Profiler
- [ ] Measure scrolling a 100k-row list; fix any frame drops before moving on

Exit criteria: full CRUD for all entities with the network disabled; 60 fps list scrolling at 100k rows; Lighthouse performance 90+ on the main routes.

### Phase 4: Backend, auth, and server data layer (week 4-5)

Outcome: a secure API and database ready to receive operations.

- [ ] API app (Fastify or NestJS) with structured logging, request IDs, and health/readiness endpoints
- [ ] Authentication: email and password with Argon2, short-lived access token plus rotating refresh token in an httpOnly cookie; CSRF protection
- [ ] Workspaces and roles (owner, admin, member, viewer); every query is scoped by workspace\_id
- [ ] RBAC enforced in a central policy layer, not scattered in handlers
- [ ] Rate limiting per user and per IP using Redis
- [ ] Postgres tables for entities, `ops`, and per-device cursors; partition `ops` by time or workspace if growth demands it
- [ ] Server-side list and search endpoints (keyset pagination, trigram or full-text indexes) for data that is not replicated locally
- [ ] Input validation with the shared schemas on every endpoint
- [ ] Integration tests against a real Postgres (Testcontainers)

Exit criteria: authenticated, role-checked API; tenant isolation proven by tests that try to cross workspaces and fail.

### Phase 5: Sync engine v1 (week 5-7)

Outcome: two browsers converge on the same data.

- [ ] Implement HLC in `sync-core` (monotonic, tolerates clock skew, deterministic tie-breaking by device ID)
- [ ] Outbox table: ordered operations with status (pending, sent, acked, rejected) and retry metadata
- [ ] Push: batch operations (for example 200 per request), gzip, per-operation acknowledgements, idempotent on opId
- [ ] Pull: fetch by sequence cursor, paginated, applied in one local transaction per page
- [ ] Field-level LWW merge in `sync-core`; the same function runs on client and server
- [ ] Tombstones for deletes; define and implement delete-versus-edit behavior (delete wins, record goes to a trash view with restore)
- [ ] Connectivity handling: online/offline events plus active health checks; exponential backoff with jitter
- [ ] Live updates: SSE or WebSocket notifies other devices that new operations exist, then they pull
- [ ] Multi-tab safety: one leader tab runs sync (Web Locks API); other tabs read from the same worker/database and get change notifications via BroadcastChannel
- [ ] Sync status in the UI: synced, syncing, offline, pending count, last sync time
- [ ] Two-browser manual test: edit offline in A, edit online in B, reconnect A, verify merge

Exit criteria: scripted two-device scenarios pass; no duplicate or lost operations under retries; tabs never run two syncs at once.

### Phase 6: Conflict handling and history (week 7-8)

Outcome: conflicts are visible, understandable, and never silently destructive.

- [ ] Classify fields as auto-merge or review-required (config-driven, from `conflict-policy.md`)
- [ ] Conflict detection: concurrent edits to a review-required field create a conflict record instead of overwriting
- [ ] Conflict review UI: side-by-side versions, who changed what and when, choose mine / theirs / edit; resolution itself is an operation that syncs
- [ ] Notes: integrate Yjs for collaborative text; persist updates compactly; sync through the same pipeline
- [ ] Tags: add/remove set semantics so concurrent additions never clobber each other
- [ ] Per-record change history (audit trail) built from the ops log; show it in the UI
- [ ] Undo for the last local change and restore of losing values from history
- [ ] Tests for each conflict type: same field, different fields, edit versus delete, concurrent tag changes, concurrent note edits

Exit criteria: every conflict class has a passing test and a visible UI path; no data is lost without a recoverable history entry.

### Phase 7: Scale and performance hardening (week 8-9)

Outcome: the budgets in section 3 are met and measured.

- [ ] Partial replication: define sync scopes (owned accounts, recent activity, open deals); client subscribes to scopes; server filters the change feed per scope
- [ ] Snapshot sync for first load and cursor-expiry recovery: server produces compressed snapshots; client bulk-loads inside one transaction with deferred index creation
- [ ] Batch and chunk everything: bulk insert with prepared statements, large pulls in pages, UI stays responsive via yielding to the event loop
- [ ] Server: composite indexes, `EXPLAIN ANALYZE` on every hot query, connection pooling (PgBouncer), Redis caching for hot reads
- [ ] Ops log compaction job: collapse old operations into snapshots, keep recent history for audit
- [ ] Server fan-out: Redis pub/sub so multiple API instances notify all connected devices
- [ ] Load tests with k6: 500-1000 concurrent syncing clients, sustained push and pull; record p50, p95, p99 and error rates
- [ ] Frontend: bundle analysis, lazy loading, worker offloading for heavy transforms, memoization audit, avoid layout thrash in lists
- [ ] Performance regression guard in CI: fail the build if a benchmark regresses by more than 20 percent
- [ ] Publish benchmark results in `docs/benchmarks.md` with hardware and method

Exit criteria: every row of the budget table has a measured result, with the table in the README.

### Phase 8: Resilience and edge cases (week 9-10)

Outcome: the unhappy paths are handled on purpose.

- [ ] Long offline: detect expired cursor, fall back to snapshot resync without losing pending local operations
- [ ] Schema evolution: versioned operations, server accepts older versions, client migrates local DB and handles ops from newer versions gracefully (prompt to refresh)
- [ ] Permission changes: operations rejected for revoked access go to a visible rejected queue with explanation and an export option
- [ ] Clock skew: verify HLC behavior with a device clock set far in the past and the future
- [ ] Partial failures: a push batch with mixed results handled per operation; no batch-wide rollback of good operations
- [ ] Storage quota and eviction: monitor usage, warn early, offer to evict unneeded scopes, never fail silently
- [ ] Local database corruption: integrity check on startup; recovery by resync, with pending outbox exported first
- [ ] Data portability: export all of a workspace's data (CSV and JSON), import with validation and per-row error report
- [ ] Logout and account switch: wipe or encrypt local data correctly; never leak one user's data to the next
- [ ] Multiple devices for one user: device registration, revoke a device from settings

Exit criteria: each scenario above has an automated test or a documented manual test with recorded result.

### Phase 9: Testing strategy (runs alongside Phases 2-8, finalize in week 10)

Outcome: you can prove correctness, not just claim it.

- [ ] Unit tests for `sync-core`: HLC, merge, tombstones, operation validation; aim for very high coverage here, it is the heart of the product
- [ ] Property-based tests (fast-check): merge is commutative, associative, and idempotent for any operation order
- [ ] Deterministic simulation (the showpiece): N simulated devices with a seeded random schedule of edit, go offline, reconnect, drop packets, duplicate packets, reorder packets; assert every device converges to identical state; seed printed on failure for replay
- [ ] Run the simulation for thousands of seeds in CI nightly
- [ ] API integration tests with real Postgres and Redis
- [ ] Playwright E2E using offline mode and multiple browser contexts: create offline, reconnect, verify on another context
- [ ] Accessibility checks (axe) in E2E
- [ ] Contract tests: OpenAPI schema versus actual responses
- [ ] Coverage and mutation testing (Stryker) on `sync-core`

Exit criteria: simulation passes at scale; CI runs the whole pyramid; flaky tests are fixed, not retried.

### Phase 10: Observability, security, and operations (week 10-11)

Outcome: it runs like a real product.

- [ ] Structured logs with request, user, device, and workspace IDs (no personal data in logs)
- [ ] Metrics: sync latency, ops per second, conflict rate, rejected ops, queue depth, DB query times; dashboard in Grafana
- [ ] Tracing with OpenTelemetry across client sync, API, and database
- [ ] Client diagnostics panel: outbox size, last error, cursor, storage used, version; copy-to-clipboard report
- [ ] Security: CSP, secure and httpOnly cookies, dependency audit in CI, secret scanning, validated uploads, rate limits on auth and sync endpoints
- [ ] Threat-model note: what is stored unencrypted on the device and why; document the decision on at-rest encryption
- [ ] Backups and restore drill for Postgres; documented and tested once
- [ ] Deployment: containerized API, managed Postgres and Redis, static hosting with a CDN for the web app, health checks, zero-downtime migrations
- [ ] Environment configs, feature flags for risky changes, staging environment
- [ ] Cost note: monthly estimate for the demo deployment

Exit criteria: a live URL, dashboards showing real sync traffic, and a restore drill recorded.

### Phase 11: Documentation, demo, and portfolio packaging (week 11-12)

Outcome: someone can understand and be impressed in five minutes.

- [ ] README: problem, 60-second GIF of offline edit then merge, architecture diagram, how to run, results table
- [ ] `docs/architecture.md`, ADRs, conflict policy, sync protocol, benchmarks, threat model
- [ ] Seeded public demo workspace with a read-only guest login
- [ ] A recorded demo (3 minutes): two windows, go offline, edit both, reconnect, conflict review screen
- [ ] A short write-up (blog or LinkedIn): why local-first, the three hardest bugs, the numbers
- [ ] Clean git history, tagged v1.0 release, issue tracker with a visible roadmap including the mobile app
- [ ] Practice a 5-minute interview walkthrough: architecture, one conflict scenario, one performance win, one thing you would change

Exit criteria: you can explain every core design decision without notes.

### Later: mobile readiness checklist (do not build yet)

- [ ] `sync-core` has zero DOM dependencies and runs in Node
- [ ] Storage adapter interface has at least two implementations (SQLite WASM, IndexedDB); a third (native SQLite) should be a drop-in
- [ ] UI logic separated from presentation so hooks can be reused in React Native
- [ ] Sync protocol versioned so mobile clients can ship on a different cadence

## 5. Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Sync bugs eat the schedule | High | Build the simulation test early (start in Phase 5); keep merge logic in one pure package |
| Scope creep into CRM features | High | Freeze the feature list in Phase 0; extras go to a later backlog |
| OPFS or SQLite WASM browser quirks | Medium | Storage adapter with IndexedDB fallback; test on Chrome, Firefox, Safari early |
| Performance only measured at the end | Medium | Benchmarks from Phase 2 onward, regression guard in CI |
| Over-engineering the server | Medium | Modular monolith first; no microservices; add Redis and workers only when a phase needs them |
| Losing motivation mid-project | Medium | Weekly demoable milestone; MVP cut line after Phase 6 |

## 6. Definition of done

- [ ] Works fully offline in the browser: create, edit, delete, search, pipeline moves
- [ ] Two devices and multiple tabs converge, proven by the simulation test across thousands of seeds
- [ ] High-risk conflicts are surfaced and resolvable; nothing is lost without history
- [ ] Every performance budget has a measured result in the README
- [ ] Tenant isolation, auth, and rate limits verified by tests
- [ ] Live deployment with monitoring, backups, and a restore drill
- [ ] Documentation, ADRs, demo video, and a 5-minute walkthrough you can deliver from memory

## 7. Weekly rhythm

- Start of week: pick the exact checklist items; write the test first for anything in `sync-core`.
- Mid week: run benchmarks; compare with the budget table.
- End of week: demo to yourself (or a friend), update ADRs, tick the checklist, and note what you cut.
