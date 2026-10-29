# FlowSync Observability and Security Decisions

Status: local architecture decision notes

Date: 2026-10-23

Scope: Phase 10, with security constraints for Phases 4–9

## Decision summary

FlowSync remains a modular monorepo with a FastAPI API, PostgreSQL as the
server system of record, optional Redis for shared rate limiting, and a browser
storage adapter for local CRM state. The local-first boundary is treated as a
security boundary: IndexedDB is convenient and durable, but it is not a secure
secret store.

No production observability or deployment system is selected by this document.

## Current local evidence

The backend already provides:

- structured application logging;
- request correlation IDs;
- normalized HTTP error envelopes;
- trusted-host and credentialed-CORS configuration;
- HttpOnly session-cookie authentication;
- CSRF validation for state-changing browser requests;
- Argon2 password hashing;
- local in-process rate limiting, with Redis as an optional shared adapter;
- health and readiness endpoints.

The current repository does not yet provide verified production metrics,
OpenTelemetry traces, a Grafana dashboard, client diagnostics export, a CSP
policy with browser evidence, a backup/restore drill, or a secret-scanning
release gate. These are gaps, not implied capabilities.

## Logging decisions

### Allowed structured fields

Use stable operational identifiers and bounded values:

```text
timestamp
level
event
requestId
method
route template
statusCode
durationMs
userId (opaque identifier only)
organizationId (opaque identifier only)
deviceId (opaque identifier only)
operationId (opaque identifier only)
cursor/sequence metadata
error code
```

### Prohibited fields

Never log:

- passwords, session IDs, CSRF tokens, refresh tokens, API keys, or cookies;
- full request bodies or CRM notes by default;
- contact email, phone, address, or other unnecessary personal data;
- database URLs containing credentials;
- browser local-storage/IndexedDB dumps.

If a local debugging session temporarily needs a payload, use a redacted,
short-lived local artifact and delete it after the investigation. Do not commit
it or paste it into a shared issue.

## Metrics decision

The first metrics vocabulary should be stable even before a provider is chosen:

| Metric | Dimensions | Reason |
| --- | --- | --- |
| `flowsync_http_requests_total` | route, method, status | API health and error rate |
| `flowsync_http_request_duration_ms` | route, status | latency percentiles |
| `flowsync_sync_push_operations_total` | entity, result | accepted/rejected operations |
| `flowsync_sync_push_duration_ms` | batch size | sync latency |
| `flowsync_sync_pull_duration_ms` | page size | cursor/pull latency |
| `flowsync_sync_conflicts_total` | entity, field class | conflict rate |
| `flowsync_sync_queue_depth` | organization scope type | backlog visibility |
| `flowsync_db_query_duration_ms` | query name | hot-query detection |
| `flowsync_local_storage_bytes` | browser/device scope | quota warning |
| `flowsync_local_outbox_count` | organization scope | pending work |

Do not add raw organization IDs, user emails, or record values as metric
labels. High-cardinality labels can become a cost and availability problem.

## Client diagnostics decision

The local diagnostics panel shows:

- app/version and schema version;
- storage backend (`indexeddb`, future `sqlite`, or `memory`);
- estimated storage usage and quota when available;
- pending and failed outbox counts;
- last sync timestamp and cursor;
- last sanitized error code;
- connectivity state;
- device identifier only inside an explicitly requested failed-operation export.

The copy/export action must produce a redacted JSON report. It must never copy
cookies, credentials, full CRM records, or raw request payloads.

## Security decisions

### Authentication and sessions

- Keep browser authentication in HttpOnly cookies rather than localStorage.
- Keep `Secure` enabled for staging/production and use an explicit SameSite
  policy.
- Keep CSRF protection on state-changing browser requests.
- Keep local bootstrap credentials in environment configuration only; never put
  them in docs, fixtures, screenshots, or test output.
- Production and staging must use a shared Redis-backed rate-limit store when
  rate limiting is enabled; local in-process state is acceptable only for local
  development/tests.

### Tenant isolation

Every CRM read, write, sync operation, cursor, and conflict must be scoped to
the authenticated organization. A client-supplied organization ID is not an
authorization decision. Cross-organization tests are required before a sync
feature is considered safe.

### Local data at rest

IndexedDB data is treated as unencrypted application data on the user's device.
It may contain CRM information and pending mutations. The current local
implementation does not claim browser-level encryption. The product must either
accept this threat model for the web MVP or add a documented encryption/key
management design before storing higher-sensitivity data.

### Dependency and supply-chain controls

The release process should run dependency audit, secret scanning, generated
contract checks, lint, typecheck, unit tests, and E2E tests. An audit warning
must be triaged by dependency path; blindly running a force-upgrade is not a
security fix when it replaces a framework with an invalid version.

## Threat model snapshot

| Asset | Threat | Current mitigation | Remaining decision |
| --- | --- | --- | --- |
| Session cookie | XSS/theft | HttpOnly, SameSite, secure outside local | CSP and deployment headers |
| CSRF token | Cross-site state change | Server validation and explicit header | Browser E2E coverage for every mutation |
| CRM local data | Device/profile access | Organization scoping and logout clear path | Encryption-at-rest stance |
| Sync operation | Replay/duplication | Operation ID and server operation log with idempotent push | Cursor expiry and long-offline recovery |
| Tenant data | Broken authorization | Central organization permission checks | Two-organization sync tests |
| Password | Database disclosure | Argon2 hash | Secret rotation and managed provisioning |
| Logs | Privacy leakage | Structured bounded fields | Automated redaction test |

## Local security verification

```bash
npm run validate:api
npm run check:generated
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Also verify manually in a headed browser:

1. login succeeds only with the configured local admin;
2. the session cookie is not readable through `document.cookie`;
3. unauthenticated API calls return the normalized 401 envelope;
4. a mutation without the CSRF header is rejected;
5. a second organization cannot read the first organization's CRM data;
6. browser offline mode does not expose another organization's local rows.

## Production-only cuts

Not claimed by this local note:

- live dashboards or alerts;
- OpenTelemetry collector deployment;
- managed secret storage;
- WAF/CDN/CSP deployment proof;
- production backup/restore evidence;
- incident paging and on-call ownership;
- penetration testing or third-party compliance certification.

The status is **local diagnostics and security controls implemented; production
instrumentation and operational proof remain open**.

