# FlowSync Phase 7: Performance Budgets and Local Benchmark Procedure

Status: local implementation notes, not a production performance sign-off

Date: 2026-10-23

Scope: Phases 7 and 9 of the local-first CRM roadmap

## Purpose

This document turns the roadmap's performance targets into a repeatable local
procedure. A target is not considered achieved because the UI feels fast: the
measurement must record the dataset size, browser, machine, commit, command,
sample count, and p50/p95/p99 result.

The procedure is intentionally local-only. It does not authorize a load test
against a shared, staging, or production system.

## Current baseline

The repository currently has:

- A FastAPI/PostgreSQL backend and Docker Compose services for local PostgreSQL
  and Redis.
- A browser `OfflineStorageAdapter` with IndexedDB and memory implementations.
- An IndexedDB outbox that writes a local CRM record and its pending operation
  in one transaction.
- Sync migrations through `20261023_0011` with operation-log, per-record clock,
  and conflict tables.
- A live local smoke has verified login, push, idempotent replay, pull,
  conflict creation/resolution, and history retrieval.
- No verified benchmark artifact, SQLite WASM/OPFS worker benchmark, virtualized
  100k-row table benchmark, k6 result, or performance CI gate.

The IndexedDB list path currently reads a store and filters/searches in
JavaScript. That is a useful correctness baseline, but it is not evidence for
the roadmap's 100k-row search or scrolling budgets.

## Budget table

| Measurement | Roadmap target | Local proof status | Required evidence |
| --- | ---: | --- | --- |
| Indexed local read at 100k rows | p95 < 20 ms | Not measured | Timed query result with dataset and browser recorded |
| Optimistic local write | < 50 ms click-to-paint | Not measured | Browser performance mark from user action to committed render |
| Full-text search over 100k contacts | p95 < 100 ms | Not measured | Search harness with indexed/local query path identified |
| Virtualized 100k-row scroll | Stable 60 fps; no task > 50 ms | Not implemented/verified | Performance trace with long-task count and frame data |
| Initial scoped sync of 50k rows | < 15 s; UI usable | Not measured | End-to-end sync trace and row-count verification |
| Incremental sync of 100 operations | < 1 s | Endpoint correctness smoke passed; timing not measured | Push/pull trace with operation acknowledgements and p95 timing |
| Server search over 3M contacts | p95 < 150 ms | Not measured | Disposable PostgreSQL dataset plus `EXPLAIN ANALYZE` and timings |
| Push batch of 500 operations | p95 < 300 ms | API safety cap is implemented; p95 not measured | API benchmark against disposable local services |
| Cached repeat-visit LCP | < 1.5 s | Not measured | Browser trace with cache state documented |
| Initial route bundle | < 200 KB gzipped | Build exists; budget not enforced | Build report with route/chunk sizes |
| Convergence | 100% in seeded simulations | Not implemented/verified | Seeded multi-device simulation output |

## Measurement protocol

### 1. Freeze the test identity

Record the following before each run:

```text
date/time and timezone:
git branch and commit:
OS and CPU/RAM:
Node version:
Python/uv version:
browser and version:
database container image:
dataset generator version/seed:
warm or cold browser/database state:
```

Do not compare a warm IndexedDB run with a cold run. Do not compare a laptop
run with a CI run without labelling the environments separately.

### 2. Start only disposable local infrastructure

From the monorepo root:

```bash
npm install
npm run infra:up
npm run db:migrate
npm run dev:all
```

If the local database must be recreated, use the destructive local reset only
after confirming that no needed local data is stored in the named Docker
volume:

```bash
npm run infra:reset
npm run infra:up
npm run db:migrate
```

Never point this procedure at a production `DATABASE_URL`.

### 3. Generate a controlled dataset

Use at least these dataset sizes for browser work:

| Dataset | Purpose |
| ---: | --- |
| 1,000 rows | Fast developer feedback and correctness checks |
| 10,000 rows | Normal local smoke benchmark |
| 100,000 rows | Roadmap acceptance threshold |
| 300,000 rows | Stress check for memory and pagination behavior |

Keep relationships valid: contacts reference accounts, deals reference
accounts/contacts, and activities reference the related CRM records. Generate
deterministic values so a failed run can be replayed from the same seed.

### 4. Measure local reads, writes, and search

For each operation, discard the first five warm-up samples, then collect at
least 100 timed samples. Report p50, p95, p99, minimum, maximum, and error
count.

Measure separately:

1. list without search;
2. list with the most common search term;
3. list with a rare search term;
4. create/update/delete through the repository;
5. reload and re-open persistence;
6. pending outbox read;
7. remote-record application.

The timer should surround the repository operation and its observable UI
commit. A unit-test timer around a mocked adapter is not enough for the local
read/search budgets.

### 5. Measure rendering and scrolling

Use a real headed browser run. Capture:

- total rendered row count;
- visible row count;
- dropped-frame or frame-time evidence;
- long tasks over 50 ms;
- heap growth before and after scrolling;
- time to first usable interaction.

The result must state whether the table is virtualized. Rendering 100k rows
with `Array.map` and reporting a successful test is not a virtualization pass.

### 6. Measure server queries safely

Populate only a disposable local PostgreSQL database. For each hot query:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
<query with representative parameters>;
```

Record planning time, execution time, rows removed by filter, index usage,
buffer hits/reads, and connection pool conditions. Run a small cold-cache and
warm-cache sample, and label both.

The 3M-contact target is a scale experiment, not a requirement to create a
large dataset on a developer laptop by default. If the machine cannot run it,
record `not_run` with the limiting resource instead of extrapolating from
10k rows.

### 7. Measure sync when the sync API is available

For every batch size in `1, 100, 500`, record:

- request duration;
- acknowledgement duration;
- number accepted/rejected;
- retry count;
- bytes sent/received;
- cursor before/after;
- duplicate-operation behavior;
- UI responsiveness while a pull is applied.

The server sequence cursor must be checked for monotonicity and the client
must be checked for duplicate-free application. A successful HTTP response
alone is not a sync benchmark.

## Performance regression rule

Once a baseline exists, a local result is a regression when the same workload
and environment is more than 20% slower at p95, or when an error/long-task/
bundle-budget gate fails. The comparison must identify whether the change is:

- algorithmic;
- dataset/index related;
- browser/runtime noise;
- infrastructure contention;
- an intentionally accepted trade-off.

No CI performance gate is claimed until the benchmark command and baseline
artifact are checked into the repository by a separately approved source
change.

## Phase 7 local exit record

Phase 7 is locally complete only when the following are attached to a review:

- benchmark result table with all budget rows marked `pass`, `not_run`, or
  `fail`;
- dataset seed and generator information;
- browser and machine information;
- query plans for hot server paths;
- bundle-size report;
- explanation for every `not_run` or `fail` row;
- a follow-up issue for each deferred production-scale capability.

At the current repository state, the honest status is **performance foundation
documented; budget measurements and production-scale hardening remain open**.

## Local-only cuts

The following are intentionally not presented as completed in this local run:

- 500–1,000 concurrent-client k6 testing;
- PgBouncer, managed Redis, Redis pub/sub fan-out, and production cache tuning;
- operations compaction scheduling;
- CDN/Lighthouse production measurements;
- any benchmark against shared or production data;
- a CI failure gate for performance regressions.

