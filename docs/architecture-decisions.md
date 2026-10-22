# User Management Architecture Decisions

Status: implemented locally; deployment/provider decisions remain open.

## Scope

The existing React application manages profile records entirely in browser `localStorage`. The first backend slice will make PostgreSQL the source of truth while preserving the current user-management UI and field behavior.

## Decisions

| Decision              | Selected approach                                                                     | Reason                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend location      | `/backend`                                                                            | Keeps the existing frontend and the new API in one repository without changing the current CRA layout.                                                     |
| Authentication        | Local email/password for application administrators                                   | The current application has no identity-provider integration. This keeps the first backend slice self-contained.                                           |
| Session transport     | PostgreSQL-backed opaque session cookie                                               | HttpOnly cookies avoid putting access tokens in `localStorage`; the browser is the primary client.                                                         |
| Password hashing      | Argon2id                                                                              | Modern password hashing with a deliberate memory and time cost.                                                                                            |
| Initial roles         | `admin` and `user`                                                                    | Covers the current management use case without introducing advanced RBAC. CRUD endpoints are admin-protected initially.                                    |
| Profile role changes  | Not exposed through profile CRUD                                                      | Prevents a normal profile create/update from granting administrator access; a dedicated privileged role-management operation can be added later.           |
| Deletion              | Soft deletion with `deleted_at` and `is_active`                                       | Preserves auditability and makes accidental deletion recoverable.                                                                                          |
| Hobbies               | PostgreSQL-backed string arrays for `hobbies` and `custom_hobbies`                    | Matches the current form and avoids introducing a join table before there is a need for hobby-level querying.                                              |
| Birth-date validation | Preserve the current UI bounds: `1960-01-01` through `2000-01-01`                     | Prevents a silent behavior change during migration. The exact inclusive/exclusive product rule can be refined before backend validation is finalized.      |
| User credentials      | Profile CRUD does not expose `password_hash` or accept a password in the current form | The current UI manages profile fields only. An administrator bootstrap/account-provisioning flow will be added before ordinary users need to authenticate. |
| Legacy data           | Defer browser-local migration to Phase 8                                              | Browser `localStorage` is per-browser and cannot be migrated centrally without an explicit import flow and backup.                                         |
| Deployment            | Local development first; deployment target later                                      | Avoids coupling schema and session behavior to an unselected hosting provider.                                                                             |

## Non-goals for this implementation

- No CRA-to-Vite migration.
- No MUI replacement or visual redesign.
- No microservices.
- No advanced RBAC, SSO, or 2FA in the first slice.
- The migration utility retains a read-only backup and retryable failed records; local-storage CRUD writes are removed from the active frontend.

## Current frontend evidence

- `frontend/src/utils/localStorageMigration.ts` owns one-time legacy import and backup behavior.
- `frontend/src/redux/reducers/userReducer.ts` stores API response state only; network/storage side effects live in actions and migration services.
- `frontend/src/modals/AddEditUserModal.js` preserves the current Yup/MUI form behavior and sends generated API payloads; IDs are assigned by PostgreSQL.
- `frontend/src/pages/UserPage.js` delegates filtering, sorting, and pagination to the FastAPI list endpoint.
- `isCustomHobby` is presentation/form state; the API contract stores the actual custom hobby values in `customHobbies`.
