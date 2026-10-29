# FlowSync CRM Feature and Module Guide

**Purpose:** Explain what each product area does and how a user operates it.  
**Audience:** Administrators, CRM users, support, QA, and developers learning
the product.  
**Product:** FlowSync CRM

## 1. What FlowSync does

FlowSync keeps customer relationship work in one organization workspace. It
combines CRM records with user administration, security controls, and an
offline queue so users can continue working during short network outages.

The normal user journey is:

~~~text
Sign in → choose workspace context → use CRM modules → review sync state
                                      ↓
                         administer users and security when permitted
~~~

The server remains authoritative. Offline work is stored locally first and is
sent to the server when the connection returns.

## 2. Before using the application locally

An operator should complete this once:

~~~bash
cd /home/dhaval-tank/Project/user-management/user-management
npm install
uv sync --project apps/backend --dev
cp apps/frontend/.env.example apps/frontend/.env
cp apps/backend/.env.example apps/backend/.env
~~~

Set these local backend values in apps/backend/.env:

~~~dotenv
POSTGRES_PASSWORD=<local-password>
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=<long-local-password>
~~~

Start the local services:

~~~bash
npm run infra:up
npm run db:migrate
npm run dev:all
~~~

Open http://127.0.0.1:3001. The administrator password is the value configured
in the local environment file; it is not a universal password and is not
stored in this guide.

## 3. Sign in and sign out

### Sign in

1. Open the login page.
2. Enter the configured email and password.
3. Select **Sign In**.
4. FlowSync creates a secure browser session and opens Dashboard.

The browser receives an HttpOnly session cookie and an in-memory CSRF token.
The application never needs to display or copy either value.

### Sign out

1. Open the account/avatar menu.
2. Select **Log out**.
3. FlowSync revokes the current server session and clears local data for the
   active organization.

If the session expires, the next protected request returns the user to login.

## 4. Understanding the main layout

The protected application contains:

| Area | Use |
| --- | --- |
| Dashboard | Health summary and pipeline snapshot |
| Accounts | Companies and customers |
| Contacts | People connected to accounts |
| Deals | Revenue opportunities in list/detail form |
| Pipeline | Deals grouped by stage |
| Activities | Calls, emails, meetings, tasks, and notes |
| Conflicts | Changes that need a human decision |
| Users | Organization members and user lifecycle |
| Security | Password and active sessions |
| Notifications | Email and in-app preferences |
| Administration | Organization governance and data operations |

The top bar also shows:

- online or offline connectivity;
- sync state and pending work;
- a diagnostics action;
- global search, available with Ctrl+K or Cmd+K;
- notifications and the current user menu.

## 5. Dashboard

### What it shows

Dashboard loads the first available organization and displays:

- total and active accounts;
- total contacts;
- open deal count and pipeline value;
- upcoming activities;
- deal counts and values by pipeline stage;
- won revenue.

### How to use it

Use Dashboard as the starting point for a quick operational check. Select a
record type in the navigation to do detailed work. Dashboard is an aggregate
view; edits are performed in the relevant CRM module.

### If data is unavailable

An authentication or permission error is shown as an application error. A
network interruption may leave previously cached CRM data available while the
top bar reports offline or pending status.

## 6. Accounts

### What an account is

An account represents a company or customer organization.

### Available fields

- name;
- industry;
- website;
- phone;
- address;
- owner;
- status: Prospect, Customer, or Inactive;
- notes.

### Common workflow

1. Open **Accounts**.
2. Select **Add account**.
3. Enter the company name and optional details.
4. Select **Save**.
5. Open the account row to inspect related contacts, deals, and activities.
6. Edit or delete the account from its detail actions when permitted.

In offline mode, the account is saved to the local CRM cache and marked as
pending. A delete is represented as a tombstone and is synchronized later.

## 7. Contacts

### What a contact is

A contact represents a person. A contact can optionally belong to an account
and can be connected to deals or activities.

### Available fields

- first and last name;
- email and phone;
- job title;
- account;
- owner;
- status: Lead, Active, or Inactive;
- notes.

### Common workflow

1. Open **Contacts**.
2. Select **Add contact**.
3. Enter the person’s name and optional account/contact details.
4. Select **Save**.
5. Use the detail page to review related activities and deals.

The API checks that the selected account belongs to the same organization. A
cross-organization reference is rejected rather than silently reassigned.

## 8. Deals

### What a deal is

A deal represents a revenue opportunity. It may link to an account, contact,
and owner.

### Available fields

- name;
- account and contact;
- owner;
- stage: Lead, Qualified, Proposal, Negotiation, Won, or Lost;
- amount;
- three-letter currency code, defaulting to USD;
- expected close date;
- notes.

### List workflow

1. Open **Deals**.
2. Search or filter the list.
3. Select a deal to open its detail page.
4. Edit the amount, stage, owner, or other fields.
5. Save and confirm the updated list/dashboard state.

### Pipeline workflow

1. Open **Pipeline**.
2. Review the columns by stage.
3. Select a deal card to inspect or edit it.
4. Move the deal through the organization’s sales process using the available
   stage action.

Deal changes are important synchronization events. If two devices edit a
review-required field at the same time, FlowSync creates a conflict instead of
silently choosing a value.

## 9. Activities and timelines

### What an activity is

An activity records planned or completed work: call, email, meeting, task, or
note. It may relate to an account, contact, deal, and owner.

### Available fields

- kind;
- subject;
- description;
- status: Planned, Completed, or Cancelled;
- due date/time;
- completion date/time;
- related account, contact, or deal;
- owner.

### Common workflow

1. Open **Activities** or a record detail page.
2. Select **Add activity**.
3. Choose the activity kind and enter a subject.
4. Link the relevant CRM records.
5. Set due time and save.
6. Mark the activity completed or cancelled when the work changes state.

Record detail pages use the activity timeline to make customer history easier
to understand without searching separate tables.

## 10. Global search

1. Press Ctrl+K on Windows/Linux or Cmd+K on macOS, or select search in the
   top bar.
2. Type part of an account, contact, or deal name.
3. Select a result to open its detail page.

When online, search uses organization-scoped API results. When offline, it
searches the local CRM repository. The dialog limits result counts to keep the
interaction quick; use the module list for full pagination.

## 11. Offline work and synchronization

### What offline mode means

Offline mode means that CRM record reads and local mutations can continue from
the browser cache when the API cannot be reached. Authentication, permissions,
organization membership, and final server acceptance remain server-owned.

### How to work offline safely

1. Open the required CRM areas while connected so records are cached.
2. Confirm the top bar shows the current connection state.
3. Continue creating or editing supported CRM records if the app reports
   offline capability.
4. Watch for pending sync work.
5. Reconnect and allow the sync engine to finish before closing the browser if
   the operation is important.

### Sync states

| State | Meaning | User action |
| --- | --- | --- |
| Online | Network appears available | Continue normal work |
| Offline | API is unavailable or browser is disconnected | Continue supported cached CRM work; reconnect later |
| Syncing | Outbox or remote cursor work is being processed | Wait for completion or inspect diagnostics |
| Synced | No known pending operations | Normal state |
| Error | A sync attempt failed | Inspect diagnostics and retry after correcting the cause |
| Conflict | A change needs human choice | Open Conflicts and resolve it |

### Sync diagnostics

Select **Open sync diagnostics** from the top bar. Diagnostics can show:

- backend availability;
- persistent-storage capability;
- current sync status;
- pending and failed operation counts;
- cursor position;
- storage usage/quota;
- last sync error.

Failed-operation export is metadata-only and does not include CRM payload
values. Use it for troubleshooting without exporting customer content.

## 12. Conflicts and record history

### Review a conflict

1. Open **Conflicts**.
2. Select an open conflict.
3. Compare the local and remote values and inspect history.
4. Choose **Mine**, **Theirs**, or **Custom**.
5. Add a note when the decision needs explanation.
6. Submit the resolution.

The resolution becomes a new normal synchronization operation. It is not a
local-only edit, so other authorized devices can converge on the decision.

### Understand history

Record history shows ordered accepted operations for an entity. It helps users
understand which device changed a field and why a conflict appeared.

## 13. Users

### What the Users module manages

Users is the organization member administration area. It supports server-side
pagination, search, sorting, create/edit/delete, lifecycle actions, and the
legacy localStorage migration flow.

### Common workflow

1. Open **Users**.
2. Search or sort the member list.
3. Select **New user** to create a member, or open a row to edit it.
4. Review required identity fields and organization role.
5. Save the user.
6. Use the row action for delete or lifecycle changes when permitted.

### Legacy localStorage migration

If the old frontend finds user records in browser localStorage, it shows a
migration banner. The administrator can:

1. create a backup/export if offered;
2. preview the one-time import;
3. commit accepted records;
4. review imported, duplicate, and failed counts.

The new canonical storage is the backend database; localStorage is retained
only as a compatibility migration source.

## 14. Organization Administration

Open **Administration** to use the following tabs.

### Settings

Configure default role, email-verification requirement, and whether people may
self-join the organization. Save changes only after confirming the target
organization in the page context.

### Roles and permissions

Create or edit custom roles, select permission keys, and remove non-system
roles. System roles are protected because other access checks depend on them.

### Teams

Create, edit, and delete organization teams. Use teams to group members for
future ownership and operational workflows.

### Invitations

Invite a person by email, review pending invitations, revoke one, or resend it.
In local/test mode, delivery uses the configured local adapter. A real
environment needs an approved email provider.

### Audit

Review organization actions and security-relevant events. Audit information is
for accountability and troubleshooting; it is not a CRM activity substitute.

### API keys

Create a scoped key for an approved integration and copy the secret immediately.
The secret is shown once. Revoke keys that are no longer needed. Do not paste
keys into source files, screenshots, tickets, or committed environment files.

### Data operations

Use CSV preview before committing an import. Inspect accepted and rejected
rows, commit only when the preview is understood, and track the resulting job
status. Use export when an authorized backup or data handoff is required.

## 15. Security

Open **Security** to:

- change the current password;
- list active sessions;
- revoke one session;
- revoke all other sessions.

Changing a password preserves the active session and invalidates other sessions.
Use “revoke other sessions” after a suspected shared-device or credential
exposure event.

### Account recovery and MFA

The backend also supports these security flows:

- request password reset without revealing whether an email exists;
- consume a reset token and set a new password;
- issue and consume email-verification tokens;
- begin TOTP enrollment;
- verify TOTP enrollment;
- disable TOTP;
- rotate recovery codes.

These capabilities are protected by the same session, CSRF, delivery, and
organization-security rules. They are available through the authenticated API
contract; a dedicated navigation page can be added when the product requires a
full self-service MFA experience.

## 16. Notifications

Open **Notifications** and choose the desired preferences:

- security email;
- product email;
- security in-app messages;
- product in-app messages.

These preferences control notification categories, not the delivery provider
itself. Delivery infrastructure is an environment concern.

## 17. Common messages and what to do

| Message/status | Meaning | What to do |
| --- | --- | --- |
| 401 Unauthorized | No valid session or API key | Sign in again; verify the backend is running |
| 403 Forbidden | Missing permission, bad origin, or CSRF token | Confirm role/organization and reload the page |
| 404 Not Found | Record or route does not exist | Refresh; verify the record was not deleted |
| 409 Conflict | Server detected a state/uniqueness conflict | Review the message or open Conflicts |
| 422 Validation Error | Field or relationship data is invalid | Correct required fields and organization references |
| 429 Too Many Requests | Rate limit reached | Wait for the window to reset; avoid repeated login retries |
| Failed to fetch | Browser could not reach the API | Check API port, CORS origin, and backend logs |
| Sync error | One or more sync operations failed | Open diagnostics; keep the failed operation available for review |
| Sync conflict | Human decision required | Open Conflicts and resolve explicitly |

## 18. Troubleshooting checklist

### Login fails

- confirm PostgreSQL and backend are running;
- verify BOOTSTRAP_ADMIN_EMAIL and password in the local backend environment;
- remember startup does not reset an existing admin password;
- check GET /health and backend logs;
- wait if the login rate limit has been reached.

### Frontend says “Failed to fetch”

- confirm API is on http://127.0.0.1:8000;
- confirm VITE_API_URL in apps/frontend/.env;
- confirm frontend origin is in backend FRONTEND_ORIGINS;
- restart the backend after editing its environment;
- inspect browser network errors and request IDs in API logs.

### Migration fails

- start PostgreSQL with npm run infra:up;
- confirm POSTGRES_USER, POSTGRES_PASSWORD, database, and DATABASE_URL agree;
- run npm run db:current and npm run db:migrate from the monorepo root;
- do not use a literal POSTGRES_USER template as a database username.

### Offline work does not remain after reload

- inspect Sync Diagnostics for persistent-storage status;
- confirm the browser permits IndexedDB and persistent storage;
- verify that the record was written before closing the tab;
- use a supported browser and check for quota/storage errors;
- remember the memory adapter is for tests and is not durable.

## 19. Glossary

| Term | Meaning |
| --- | --- |
| Organization | Tenant boundary containing members and CRM records |
| Outbox | Local queue of mutations waiting for server acknowledgement |
| HLC | Hybrid logical clock used to order distributed changes |
| Cursor | Position in the server’s accepted sync-operation stream |
| Tombstone | Soft-delete marker retained so old changes do not resurrect data |
| Conflict | A change that requires a human decision |
| CSRF | Protection for unsafe browser requests using a session cookie |
| API key | Scoped integration credential shown once at creation |
| Bootstrap admin | Local administrator provisioned from environment settings |

## 20. Related documentation

- [Product documentation](../product/flowsync-product-documentation.md)
- [Root setup README](../../README.md)
- [Backend README](../../apps/backend/README.md)
- [Architecture guide](../architecture.md)
- [Offline foundation](../architecture/flowsync-offline-foundation.md)
- [Conflict policy](../conflict-policy.md)
- [Resilience runbook](../operations/flowsync-resilience-runbook.md)
- [Testing and proof matrix](../operations/flowsync-testing-and-proof-matrix.md)
- [Release checklist](../operations/flowsync-release-checklist.md)

