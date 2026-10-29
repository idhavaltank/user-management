# FlowSync Phase 9 Testing and Proof Matrix

Status: local verification guide

Date: 2026-10-23

Scope: test evidence for Phases 7–11

## Evidence rule

Every roadmap requirement must end as one of:

- `pass` — the required behavior was observed with a relevant test;
- `not_run` — the behavior is defined but was not executed;
- `fail` — the test ran and found a defect;
- `blocked` — the test could not run because a named dependency or authority
  was unavailable.

`not_run` and `blocked` are not release passes. A helper or mock test is not
enough when the requirement is about a browser, API, database, sync, or
multi-device behavior.

## Current local test layers

| Layer | Command | Proves | Does not prove |
| --- | --- | --- | --- |
| API contract | `npm run validate:api` | OpenAPI document is structurally valid | Runtime response compatibility |
| Generated artifacts | `npm run check:generated` | Generated types/schemas are aligned | Sync convergence |
| Frontend lint/typecheck | `npm run lint:frontend` and `npm run typecheck` | Static frontend correctness gates | Browser rendering/accessibility |
| Backend tests | `npm run test:backend` | Python unit/integration tests configured locally | Production PostgreSQL/Redis topology |
| Frontend tests | `npm run test:frontend` | React/offline unit tests | Multi-tab or multi-browser behavior |
| Build | `npm run build` | Production bundle can be built | Bundle budget pass unless measured |
| Browser E2E | `npm run test:e2e` | Configured headed/browser flows | Production deployment |
| Full local gate | `npm run validate:full` | Current static/unit/build baseline | Production-scale and explicitly deferred capabilities |

## Required test matrix

### Phase 7 performance

- local read/search at 1k, 10k, 100k rows;
- optimistic write-to-paint timing;
- virtualized scroll and long-task count;
- server query plan and p95 latency;
- sync batch sizes 1, 100, and 500;
- repeat-visit LCP and route bundle size.

The result must include the benchmark environment and a measured value, not
only a green command exit code.

### Phase 8 resilience

- backend unavailable while local CRUD continues;
- reconnect after pending local operations;
- mixed accepted/rejected batch;
- expired cursor/snapshot recovery;
- schema-version mismatch;
- future and past device clocks;
- storage quota warning;
- local corruption recovery with pending-operation export;
- logout/account-switch isolation;
- revoked-device operation rejection.

The current repository has browser proof for offline IndexedDB/outbox behavior,
an API smoke for push/pull/idempotency/conflicts/history, and unit proof for
retry/partial acknowledgement handling. Cursor expiry, corruption recovery,
revoked-device, and quota-eviction scenarios remain `not_run`.

### Phase 9 correctness

- HLC parsing, monotonic update, and deterministic tie-breaking;
- operation validation and entity/field allowlist;
- duplicate operation ID idempotency;
- cursor ordering and replay safety;
- tombstone behavior;
- same-field and different-field edits;
- edit-versus-delete;
- concurrent tags and notes when those entities exist;
- property tests for merge idempotency/commutativity where the merge model
  permits it;
- deterministic multi-device simulation with a printed seed;
- OpenAPI response contract tests;
- accessibility checks for routes and dialogs.

Local evidence already collected includes the backend integration contract
against a freshly migrated disposable PostgreSQL database, plus a live sync
smoke for push, duplicate replay, pull, conflict resolution, and history.

### Phase 10 operational/security proof

- request ID propagation;
- safe error envelopes;
- no credentials or CRM payloads in logs;
- CSRF enforcement;
- tenant isolation;
- rate-limit behavior with local and Redis-backed modes;
- client diagnostics redaction;
- migration from empty local PostgreSQL;
- backup/restore drill only in an explicitly approved disposable environment.

### Phase 11 documentation/demo proof

- clean local bootstrap from README instructions;
- architecture diagram matches source;
- demo script names only supported behavior;
- every claimed benchmark links to its evidence;
- open cuts and next steps are visible;
- no secret, customer data, or production URL is committed.

## Multi-context browser procedure

For the next sync acceptance slice, use two isolated Playwright browser contexts:

1. sign in both contexts with authorized local users;
2. create or edit a record offline in context A;
3. edit the same and a different field in context B;
4. reconnect A and allow push/pull;
5. verify acknowledgement, cursor movement, conflict visibility, and final
   values in both contexts;
6. repeat with duplicated, reordered, and partially rejected operations;
7. save the random seed and browser trace for failures.

Two tabs in one context are useful for multi-tab coordination, but they do not
replace two independent device/session simulations.

## Test evidence record

```text
requirement:
test file or manual scenario:
command:
environment:
seed/dataset:
observed result:
status: pass | not_run | fail | blocked
artifact/trace:
residual risk:
```

## Local closure gate

The local documentation/operations slice is complete when the files listed in
this matrix exist and the existing static/unit/browser baseline is rerun. The
product roadmap is not complete until each unimplemented capability above has
its own implementation and real-behavior evidence.

