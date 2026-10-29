# FlowSync Offline Foundation

## Scope

This phase adds the local persistence boundary for the CRM entities:

- accounts
- contacts
- deals
- activities

Authentication, users, permissions, and session state remain server-owned.
CRM pages use the online API as the source of truth when connected, hydrate
the local cache, and use the repository for cached reads and optimistic
offline mutations when disconnected.

## Storage design

`OfflineStorageAdapter` is the application port. `IndexedDbStorageAdapter` is
the browser implementation and stores one object store per CRM entity plus an
`outbox` store. `MemoryStorageAdapter` is used for tests and as a fallback when
IndexedDB is unavailable.

Every local write is one IndexedDB transaction containing:

1. the entity row;
2. an outbox operation with device ID, organization ID, entity ID, operation
   kind, schema version, and retry metadata.

Deletes are represented locally as tombstones. Active list and get operations
hide tombstones while retaining the delete operation for the future sync
engine.

## What was intentionally deferred from this storage slice

- SQLite WASM/OPFS benchmarking and migration;
- large-data FTS/virtualization benchmarks;
- cursor-expiry snapshot recovery and device revocation.

The API sync contract, push/pull engine, retries, conflict queue, and
resolution history are now implemented in the later sync phases. This file
remains focused on the storage adapter and its transaction boundary.

## Current UI behavior

- Online list responses are cached by organization and entity.
- Offline lists use the cached records and local search.
- Offline create, update, and delete operations update the UI immediately and
  append an outbox operation.
- The shell and CRM pages show online/offline state and pending operation count.
- Queued operations are sent by the sync engine when online. The shell shows
  pending/syncing/error state and the diagnostics dialog exposes local cursor,
  storage, and failed-operation metadata.

