# User Management — Frontend Feature (wecms-web)

**Slug:** `user-management`
**Domain:** `settings`
**System:** Refactor — Next.js 16 frontend
**Surface:** Settings modal panel (`panel === "user"`) — **no standalone route**
**Panel component:** `components/settings/users/UsersPanel.tsx`
**Status:** ✅ **Implemented — wired to live endpoints, read-only viewer behaviour verified (2026-06-05)**

---

## 1. What this is

The **Settings → Users** panel inside the Settings modal. It lists the company's users,
opens a user's detail (Information + Menu Entitlement tabs), creates / edits / deletes
users, toggles the admin flag, manages per-user menu entitlement, and uploads / removes a
user avatar. Permission-aware: admins get full CRUD; non-admins holding the
`settings-core-users` grant get a **read-only** view; users without it can't open the panel.

This folder is the authoritative frontend home for the feature, superseding the stale flat
plan [`../users.md`](../users.md) (which still describes a 5-user cap, disabled placeholders,
and a no-op Save — none of which match the shipped panel).

## 2. Document map

| Doc | Purpose |
|---|---|
| [screen-flow.md](screen-flow.md) | Panel state machine + every UI flow (list → view/edit/add, entitlement, avatar) |
| [ui-specification.md](ui-specification.md) | Components, fields, table, dialogs, validation — **incl. verified read-only viewer behaviour** |
| [component-index.md](component-index.md) | Every component / hook / type / API-client file with paths |
| [api-consumption.md](api-consumption.md) | Each backend endpoint the panel calls, request/response shapes |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT — CRUD, read-only, validation, security |

## 3. Related docs

- **Backend feature folder (authoritative API contract):** [`wecms-api/docs/features/settings/user-management/`](../../../../../wecms-api/docs/features/settings/user-management/README.md)
- **Cross-system functional bundle:** [`docs/features/user-management/`](../../../../../docs/features/user-management/README.md)
- **Menu Authorization (how granted slugs gate the menu):** [`docs/features/menu-authorization/`](../../../../../docs/features/menu-authorization/README.md)
- **Permission model (shared):** [`docs/_shared/permission-roles.md`](../../../../../docs/_shared/permission-roles.md)
- **Settings index:** [`../README.md`](../README.md)
- **Superseded plan (kept for history):** [`../users.md`](../users.md)

## 4. Implementation at a glance

| Concern | Where |
|---|---|
| Mount | `components/settings/SettingsModal.tsx` (`panel === "user"`, `canManage={isAdmin(u)}`) |
| Container / state machine | `components/settings/users/UsersPanel.tsx` |
| List | `UsersListPanel.tsx`, `UserListItem.tsx` |
| Detail (read-only) | `UserDetailView.tsx` |
| Add / Edit forms | `AddUserInfoForm.tsx`, `EditUserInfoForm.tsx` |
| Menu Entitlement tab | `UserMenuEntitlementPanel.tsx`, `entitlementTree.ts` (tree shape) |
| Avatar | `UserAvatarUpload.tsx`, `UserAvatar.tsx` |
| API client | `lib/api/userManagement.ts` |
| Wire types | `lib/types/api.ts` (`ApiUserMgmt*`) |
| In-memory types | `components/settings/users/types.ts` (`SettingsUser`, mappers) |

## 5. Permission model (frontend)

| Capability | Admin | Viewer (`settings-core-users`, non-admin) |
|---|:---:|:---:|
| Open panel | ✅ | ✅ |
| List + open detail | ✅ | ✅ (read-only) |
| Add / Edit / Delete | ✅ | ❌ (controls not rendered) |
| Toggle admin / manage entitlement | ✅ | ❌ (tab hidden) |
| Manage avatar | ✅ | ❌ (`readOnly` disc) |

`canManage = isAdmin(user)`; `canViewUsers = allMenus || allowedMenuCds.includes("settings-core-users")`.
The viewer's disabled / hidden controls are detailed in
[ui-specification.md §Read-only viewer behaviour](ui-specification.md#read-only-viewer-behaviour).
The backend is the authoritative enforcement layer (writes → 403); the frontend mirrors it for UX.
