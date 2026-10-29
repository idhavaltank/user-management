# FlowSync Performance Budgets

The budgets below are the acceptance targets for production-scale work. The
current local foundation is functional, but the rows marked **unmeasured**
must not be presented as benchmark results.

| Area | Target | Current local evidence |
| --- | --- | --- |
| First meaningful dashboard | under 2 seconds on a warm local API | Not measured with a controlled production-like dataset |
| Local list read | under 100 ms for a 10k-record scope | IndexedDB adapter works; benchmark not yet recorded |
| Local write plus outbox | under 50 ms | Transactional behavior is tested; timing not yet recorded |
| Sync push batch | p95 under 500 ms for 200 operations | Live small-batch smoke passed; p95 benchmark not recorded |
| Virtualized 100k-row scroll | stable 60 fps and no task over 50 ms | Virtualization and 100k-row proof are deferred |
| Conflict convergence | 100% for seeded schedules | HLC/conflict smoke is covered; simulation is deferred |

## Measurement rules

Run the procedure in
[`docs/architecture/flowsync-phase-7-performance-notes.md`](architecture/flowsync-phase-7-performance-notes.md)
with a disposable database, fixed browser, dataset size, seed, and commit
recorded. A result is valid only when the command, hardware, dataset, and
sample count are saved with it. A regression over 20 percent blocks a release
candidate until explained.

## Current decision

IndexedDB remains the first browser adapter. SQLite WASM/OPFS, FTS5, worker
offloading, large-data virtualization, and server load testing should be
implemented only after this baseline is measured and the result shows that the
current adapter cannot meet the target.
