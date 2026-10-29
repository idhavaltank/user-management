# FlowSync Mobile Readiness Notes

Status: future-scope architecture guidance; no mobile application built

Date: 2026-10-23

Scope: Later mobile readiness checklist from the local-first CRM roadmap

## Goal

The web implementation should make a future offline/online mobile client a
drop-in consumer of the same product protocol without forcing the mobile app to
reuse browser APIs. The mobile client is future scope and is not part of the
current local web release.

## Current readiness assessment

| Boundary | Current state | Mobile implication |
| --- | --- | --- |
| API | FastAPI with organization-scoped routes | Reusable over HTTPS from React Native or native clients |
| Authentication | Browser-oriented HttpOnly session cookie and CSRF flow | Mobile token/session transport needs an explicit client contract |
| Local storage | IndexedDB and memory adapter | Good abstraction direction; mobile needs native SQLite adapter |
| Repository | TypeScript CRM repository behind adapter | Reuse domain behavior only after removing browser assumptions |
| Sync metadata | Python HLC helpers and PostgreSQL sync foundation | Protocol must be frozen and represented in shared test vectors |
| Shared schema | Generated frontend/backend artifacts, no shared sync-core package yet | Add versioned, platform-neutral contracts before mobile build |
| UI | React/MUI web components | Do not reuse presentation components directly in React Native |
| Background execution | Browser online/offline events only | Mobile background limits require a separate lifecycle design |

The current architecture is **directionally mobile-ready at the storage
adapter boundary, but not protocol-complete for mobile**.

## Target layering

Keep the future client split into these layers:

```text
Presentation (web MUI / React Native)
        |
Application use-cases and view models
        |
Platform-neutral repository + sync core
        |
Storage adapter (IndexedDB / SQLite WASM / native SQLite)
        |
HTTP client + authenticated sync transport
```

The sync core must not import `window`, `document`, IndexedDB, React, MUI,
React Native, or a platform-specific SQLite package. It should accept clocks,
storage, transport, and logging through interfaces.

## Storage adapter contract

The existing web adapter direction should evolve toward operations such as:

```text
open / close
list(entity, organization, query)
get(entity, organization, id)
writeLocal(record, operation)
applyRemote(operation)
pendingOutbox(organization)
acknowledge(operation)
reject(operation, reason)
readCursor(scope)
writeCursor(scope, cursor)
clearOrganization(organization)
exportPendingOperations(organization)
```

IndexedDB, SQLite WASM/OPFS, and native SQLite must expose the same behavior,
including transaction boundaries and tombstone handling. A platform adapter
may optimize indexes, batching, or encryption, but it must not change the
operation semantics.

## Protocol requirements before mobile work

Before starting a mobile app, freeze and version:

- operation ID format and client-generated record ID policy;
- organization scope and device registration policy;
- HLC encoding, clock-skew handling, and deterministic tie-breaking;
- upsert/delete/tombstone semantics;
- cursor and snapshot recovery behavior;
- per-operation acknowledgement and rejection reasons;
- schema-version negotiation;
- conflict classification and resolution operations;
- authentication/session transport for a non-browser client;
- payload size limits and retry/backoff rules.

The Python HLC and sync contract helpers are useful server evidence, but they
do not replace shared cross-language test vectors. Every supported client must
pass the same vectors for ordering, idempotency, tombstones, and conflict
resolution.

## Mobile lifecycle plan

The future mobile client must handle:

1. app launch with no network;
2. foreground reconnect and health check;
3. background task termination during a push;
4. process restart with a partially acknowledged batch;
5. device clock changes;
6. storage pressure and native database migration;
7. account logout and organization switch;
8. device revocation and credential expiry;
9. low-bandwidth and metered-network policies;
10. OS backup/restore and whether local CRM data is included.

Do not assume that a browser's `online` event, service worker, or periodic
timer maps to mobile background execution.

## Mobile security decisions to make later

- Use platform secure storage for tokens/keys, never SQLite/AsyncStorage alone.
- Decide whether local CRM fields are encrypted at rest and how keys are
  invalidated on logout or device revocation.
- Use certificate/network policy appropriate for the deployment environment.
- Avoid storing full server credentials in logs or crash reports.
- Bind device registration and sync scopes to the authenticated organization.
- Define remote wipe behavior separately from ordinary local logout.

These decisions need a mobile threat model and deployment owner; they are not
silently inherited from the browser implementation.

## Local readiness checks before mobile implementation

- [ ] Protocol contract and versioning document exists.
- [ ] Sync core has no DOM/browser imports.
- [ ] Node test vectors cover HLC, merge, idempotency, and tombstones.
- [ ] IndexedDB and a second adapter pass the same repository contract tests.
- [ ] API supports device identity and cursor recovery.
- [ ] Rejected operations and conflicts are durable and explainable.
- [ ] Logout/account-switch tests prove organization isolation.
- [ ] Background/restart simulation covers partial batches.
- [ ] Mobile authentication and encryption decisions are approved.
- [ ] Native SQLite implementation is designed before choosing a framework.

## Explicit deferral

No React Native/Expo project, native SQLite dependency, mobile signing setup,
push notification service, background sync service, app-store account, or
device test has been created in this phase. The correct current status is
**mobile architecture documented; mobile implementation deferred until the web
sync protocol and security decisions are complete**.

