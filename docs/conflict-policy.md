# FlowSync Conflict Policy

This document is the source of truth for how the current sync implementation
handles concurrent CRM edits. The policy is deliberately conservative: an
automatic merge must not silently replace a business decision.

## Field classes

| Field class | Current fields | Resolution |
| --- | --- | --- |
| Auto-merge | Names, descriptions, contact details, activity text, timestamps | Last-write-wins using the hybrid logical clock (HLC); the operation log remains available for audit. |
| Review-required | `deals.stage`, `deals.amount`, `deals.ownerId` | The server records a conflict when the incoming HLC loses and leaves the current value unchanged until a user chooses a value. |
| Delete | Any CRM entity | Deletes are tombstones. A delete wins against an older edit; the server retains the tombstone for sync convergence. |

## HLC ordering

An HLC is represented as `physicalMilliseconds.logicalCounter`. Values are
compared by physical time, then logical counter, then device ID. A device that
receives a future timestamp advances its local clock before producing another
operation. This makes ordering deterministic without trusting wall-clock time
alone.

## Conflict lifecycle

1. A client writes to its local adapter and appends one outbox operation.
2. The API validates tenant, entity, schema version, and allowed fields.
3. The server applies each field independently. Review-required fields that
   lose against an existing field clock create an `open` conflict record.
4. The client continues syncing unrelated operations; one conflict does not
   roll back a successful batch.
5. An administrator opens **Conflicts**, selects **Keep mine** or **Use
   incoming**, and the API creates a new resolution operation.
6. The resolution operation is idempotent and appears in entity history.

## Current safety boundaries

- The operation log and conflict records are organization-scoped.
- Conflict values are returned only to an authenticated organization member.
- The frontend export contains operation metadata and error text, not CRM
  field values.
- Notes collaborative editing, tag set semantics, and a custom side-by-side
  editor are planned extensions; they are not silently represented as
  implemented by this v1 policy.

## Test cases

The current proof set covers HLC ordering, operation validation, idempotent
push, cursor pull, a review-required deal-stage conflict, resolution, and
history retrieval. Before production rollout, add property-based convergence
tests for edit/edit, edit/delete, tags, notes, and clock-skew schedules.
