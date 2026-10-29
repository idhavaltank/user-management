# FlowSync Local Release and Handoff Checklist

Status: local branch handoff checklist; not a deployment approval

Date: 2026-10-23

Branch: `feature/flowsync-crm-product`

## Purpose

This checklist defines what can be safely handed to a reviewer from the local
monorepo. It intentionally stops before production deployment, publishing,
merging, tagging, or pushing.

## 1. Scope and source safety

- [ ] Confirm the intended branch and commit.
- [ ] Review `git status --short` and preserve unrelated user work.
- [ ] Confirm no production URL, credential, token, customer export, browser
      dump, or generated secret is included.
- [ ] Confirm only approved files are changed.
- [ ] Confirm new Phase 7–11 docs do not overwrite an existing document.

## 2. Local environment

- [ ] Copy local environment examples to local, ignored `.env` files.
- [ ] Use local PostgreSQL and Redis only.
- [ ] Confirm frontend API origin points to `127.0.0.1` or `localhost`.
- [ ] Confirm production-only safety validation is not accidentally disabled in
      a staging/production environment.

Bootstrap commands:

```bash
npm install
npm run infra:up
npm run db:migrate
npm run db:current
npm run dev:all
```

## 3. Contract and migration gates

- [ ] `npm run validate:api`
- [ ] `npm run check:generated`
- [ ] `npm run db:history`
- [ ] `npm run db:current`
- [ ] Apply migrations from an empty disposable local database.
- [ ] Confirm the current migration head matches the checked-in migration set.
- [ ] Verify sync foundation tables only contain local test data.

The sync foundation migration is a schema prerequisite; it is not evidence
that push, pull, conflict resolution, or cursor recovery is complete.

## 4. Static, unit, and build gates

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Review warnings and skipped tests; do not hide them with broad flags.

## 5. Browser verification

- [ ] Start the frontend and backend locally.
- [ ] Verify login with the configured local bootstrap account without writing
      its password into a report.
- [ ] Verify dashboard and CRM collection routes.
- [ ] Verify create, edit, delete, search, and organization scoping.
- [ ] Verify browser offline mode shows the offline state.
- [ ] Verify local offline create/edit/delete persists after reload where the
      browser supports IndexedDB.
- [ ] Verify pending operations remain visible and are not silently discarded.
- [ ] Verify logout/account switch does not leak the prior organization.
- [ ] Run `npm run test:e2e` and preserve the HTML report location.

When sync is implemented, add:

- [ ] reconnect push and per-operation acknowledgement;
- [ ] cursor pull and duplicate replay;
- [ ] two-browser convergence;
- [ ] conflict review and resolution;
- [ ] multi-tab single-leader behavior;
- [ ] rejected-operation export.

## 6. Performance and resilience evidence

- [ ] Attach the benchmark table from
      `flowsync-phase-7-performance-notes.md`.
- [ ] Attach the resilience scenario results from
      `flowsync-resilience-runbook.md`.
- [ ] Mark every unmeasured or unimplemented budget explicitly.
- [ ] Attach traces/screenshots only after redacting credentials and customer
      data.
- [ ] Record the machine, browser, dataset, seed, and commit.

## 7. Security and operations review

- [ ] Review the observability/security decision document.
- [ ] Confirm logs contain request IDs and no secrets or CRM payloads.
- [ ] Confirm CORS and trusted-host settings are local-specific.
- [ ] Confirm cookies are HttpOnly and CSRF behavior is tested.
- [ ] Confirm tenant isolation is tested with more than one organization.
- [ ] Confirm dependency audit findings are triaged and no unsafe force-upgrade
      was applied without compatibility review.

## 8. Handoff packet

The reviewer packet should include:

```text
branch:
commit:
scope:
files changed:
local services used:
migration head:
validation commands/results:
browser flows/results:
performance evidence:
resilience evidence:
known gaps:
production-only cuts:
reviewer:
date:
```

## Explicit local-only cuts

This checklist does not authorize or claim:

- Git push, merge, tag, or release publication;
- production/staging deployment;
- managed database or Redis provisioning;
- production backup/restore;
- live monitoring, alerting, or incident response;
- public demo workspace or guest credentials;
- customer-data migration;
- mobile app release.

Those activities require separate approval, environment ownership, secret
management, rollback planning, and a deployment-specific verification pass.

