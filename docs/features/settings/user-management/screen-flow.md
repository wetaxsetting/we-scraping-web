# User Management — Screen Flow (frontend)

Back to [README](README.md) · [ui-specification](ui-specification.md) · backend [business-flow](../../../../../wecms-api/docs/features/settings/user-management/business-flow.md)

---

## 1. Entry & mount

Settings opens from the top-nav **Settings** item → `<SettingsModal>` (`components/settings/SettingsModal.tsx`).
The Users panel mounts when the left nav selects `panel === "user"`:

```
canViewUsers ? <UsersPanel canManage={menuCtx.canManageUsers} /> : <PanelPlaceholder />
```

- `canViewUsers = menuCtx.allMenus || allowedMenuCds.includes("settings-core-users")` — gates whether
  the panel renders at all.
- `canManage = isAdmin(user)` — passed into the panel; drives every write affordance.

A non-admin without the `settings-core-users` grant sees the placeholder, not the panel.

## 2. Panel state machine (`UsersPanel`)

The panel is a single component with four mutually-exclusive right-pane states:

```
                 ┌───────────────────────────── empty (no selection) ─────────────────────────────┐
 list loads ─────┤                                                                                  │
                 │  select user ──► VIEW  ── (canManage) Edit ──► EDIT ── Save/Cancel ──► VIEW       │
                 │                    │                                                              │
                 │                    └── (canManage) Delete ──► confirm ──► list refresh            │
                 │                                                                                   │
                 └── (canManage) "+ Add a user" ──► ADD ── Save/Cancel ──► list refresh / VIEW ──────┘
```

State held in `UsersPanel`: `users`, `selectedUserId`, `isAddingUser`, `isEditing`,
`activeTab` (`"info" | "menu_entitlement"`), `keyword`. There is **no `useUsers` hook** — the panel
loads the list itself and uses imperative form handles (`collect()`) on the Add/Edit/Entitlement
children.

`handleStartEditing` and `handleStartAddUser` both early-return when `!canManage`, so a viewer can
never enter EDIT or ADD even if a control were somehow reachable.

## 3. Flow: list & search

1. Panel mounts → `fetchUserMgmtList()` → `GET /api/v1/settings/users` → `{ users, total_count }`.
2. Rows map to `SettingsUser` (`mapUserRow`).
3. Search box filters in-memory on name / loginId / email (case-insensitive).
4. Sort: admins first, then users; server order preserved within each group.
5. Subtitle shows the active-user count from `total_count`. No pagination (small per-tenant sets).

## 4. Flow: view a user

1. Click a list row → `selectedUserId` set, right pane → VIEW (`UserDetailView`).
2. Tabs: **Information** always; **Menu Entitlement** hidden when `isAdminSelected || !canManage`
   (`effectiveTab` forced to `"info"`).
3. VIEW renders all fields read-only (disabled inputs, masked password, disabled admin checkbox,
   inert avatar). See [ui-specification §read-only viewer behaviour](ui-specification.md#read-only-viewer-behaviour).

## 5. Flow: create a user (admin only)

1. "+ Add a user" → ADD state (`AddUserInfoForm`).
2. Fill required fields; "Check availability" → `checkLoginId(loginId)` → success/error dialog.
3. Optional "Set as Admin".
4. Save → `collect()` validates (password non-empty, password === confirm) → `createUserMgmt(body)` →
   `POST /api/v1/settings/users`.
5. On success: list refreshes, panel returns to VIEW/empty. Backend errors
   (`WBE_USERS_DUPLICATE_LOGIN_ID`, `WBE_VALIDATION`) surface via `useDialog({ type: "error" })`.

## 6. Flow: edit a user (admin only)

1. VIEW → "Edit" → EDIT state (`EditUserInfoForm`), mounted with `key={user.id}` so drafts reset per row.
2. Login ID rendered disabled (immutable); password optional (blank = keep existing).
3. Admin checkbox interactive.
4. Save → `collect()` (password match only if non-empty) → `updateUserMgmt(userId, body)` →
   `PUT /api/v1/settings/users/{user_id}`.
5. Cancel discards the draft (form unmounts), returns to VIEW.

## 7. Flow: delete a user (admin only)

1. EDIT state → "Delete" → confirmation dialog (`type: "confirmation"`).
2. Confirm → `deleteUserMgmt(userId)` → `DELETE /api/v1/settings/users/{user_id}` (per-tenant unlink).
3. Backend guards surface as error dialogs: `WBE_USERS_CANNOT_DELETE_SELF`,
   `WBE_USERS_CANNOT_DEMOTE_LAST_ADMIN`.
4. List refreshes.

## 8. Flow: menu entitlement (admin only, non-admin target)

1. Select a **non-admin** user → Menu Entitlement tab visible.
2. Tab loads `fetchMenuEntitlement(userId)` → granted slugs into a `Set` draft.
3. Each checkbox toggle fires an immediate `saveMenuEntitlement(userId, { menu_auth_cds })`
   (`PUT .../menu-entitlement`) — optimistic UI, rollback on error, serialized to avoid races.
4. The tab is hidden for admin targets (admins implicitly have all menus) and for viewers.

## 9. Flow: avatar (admin only)

1. EDIT state → `UserAvatarUpload` (interactive).
2. Pick/drop a file → client validates type + ≤ 2 MB → optimistic preview →
   `uploadUserImage(userId, file)` → `POST .../{user_id}/image` → refreshed row.
3. "Remove" → `deleteUserImage(userId)` → `DELETE .../{user_id}/image`.
4. In VIEW the disc is `readOnly` (no click/drag, no remove). Image bytes hydrate via
   `fetchUserImageBlob(userId)` (`GET .../{user_id}/image`; `WBE2113` → null → placeholder).

## 10. Dialog variants used

| Trigger | Variant |
|---|---|
| Validation fail / backend WBE / network error | `error` |
| Delete user | `confirmation` |
| Save success (where surfaced) | `success` |
| check-id available/taken | `success` / `error` |

All via the shared `useDialog()` per the §3 dialog rules.
