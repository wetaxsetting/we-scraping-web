# Users

> ⚠️ **SUPERSEDED (2026-06-05).** This early summary is stale — it describes a 5-user plan cap,
> "disabled placeholder" Menu Entitlement, an inert avatar, and a no-op Save, none of which match
> the shipped panel. The authoritative frontend documentation is the folder
> **[user-management/](user-management/README.md)** (screen-flow, ui-specification incl. verified
> read-only viewer behaviour, component-index, api-consumption, test-scenarios). Kept for history.

> Canonical Settings-menu entry for **Settings → Users** (frontend). Detailed plan lives in the
> linked doc below.

## Overview
The Users panel manages the tenant's user accounts: list, add, edit, admin-role toggle, and (later)
menu entitlement. A hard 5-user plan cap applies. Slug: `user-management`.

- Implementation plan (full-stack) + API side: in the separate `wecms-api` backend repo — not included in this clone.

## Page Location
Settings modal panel — mounted inside `<SettingsModal>` via `<SettingsNav>` ("Users").
**No standalone route.** Component folder `components/settings/users/`. Static UI complete; forms
currently uncontrolled and Save is a no-op until wiring lands. Figma 142:22998 / 142:23223 / 142:17631.

## UI Components
- Users panel: empty state + selected state + add-user state
- User list/table + detail/edit form (React Hook Form once wired)
- Admin-role toggle
- Menu Entitlement tab (checkboxes — **disabled placeholders** for now)
- `UserAvatarUpload` (inert until the upload route lands)

## User Actions
- **Add** a user (id, name, e-mail, create-time password, admin role) — blocked at the 5-user cap.
- **Edit** a user; toggle admin role.
- **Enable/disable** a user.
- Menu entitlement: view-only/disabled this MR.

## Table Columns
| Column | Source |
|---|---|
| User id | `USER_INFM` |
| Name | user name |
| E-mail | e-mail |
| Admin | `BUSI_ADMN_INFM` flag |
| (actions) | edit · enable/disable |

## Dialogs / Popups
- Add/Edit user form (panel-embedded).
- Delete/disable confirmation.

## API Integration
CRUD over `USER_INFM` + `USER_BUSI_CONN_INFM`, admin toggle via `BUSI_ADMN_INFM`. snake_case wire ↔
camelCase mappers. (Menu-entitlement persistence deferred to a follow-up MR.)

## Validation
- User id / name / e-mail required and format-checked; id unique per tenant.
- Create disabled when the tenant is at 5 users.

## Notes
Avatar upload, menu-entitlement persistence, and admin password reset are out of scope for the first
MR. Self-service "Change Password" is a separate ProfileMenu flow.
