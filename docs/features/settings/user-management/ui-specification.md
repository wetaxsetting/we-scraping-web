# User Management — UI Specification (frontend)

Back to [README](README.md) · [screen-flow](screen-flow.md) · [component-index](component-index.md)

---

## 1. Surface & layout

- Renders inside the Settings modal shell (`<SettingsModal>` 1300 × 760) as the `panel === "user"` panel.
- Panel composition per the Settings shell contract: header (title + action buttons) → toolbar
  (search) → list/detail two-pane body → no pagination.
- Left = user list (`UsersListPanel`); right = empty-state | detail view | edit form | add form.

## 2. User list page

| Aspect | Behaviour |
|---|---|
| Search | Single input; filters in-memory on **name / loginId / email** (case-insensitive `includes`) |
| Filters | None beyond search |
| Sort | Admins first, then regular users; server order preserved within each group |
| Columns (per row) | 42 px avatar (image or initials) · user name (+ "(You)" if current user) · role badge ("Admin"/"User") · email (muted secondary line) |
| Pagination | None — all active users loaded; subtitle shows active count from `total_count` |
| Status display | Only active users are returned by the backend; no inactive/locked badge. Current user marked "(You)" |
| Add affordance | Pinned "+ Add a user" row at the bottom — **rendered only when `canAddUser` (= `canManage`)** |

## 3. User detail (Information tab — `UserDetailView`)

All fields display-only in VIEW mode (`ReadOnlyTextField`, gray bg, `disabled` + `readOnly`):

| Field | Source | Notes |
|---|---|---|
| Full Name | `user.name` | |
| Position | `user.position` | |
| Department | `user.department` | |
| Telephone | country-code chip (disabled in VIEW) + `user.phoneNumber` | VIEW renders the country code read-only; the inbound `mapUserRow` stamps it `"84"` (the wire `clph_no` carries no separate country code) |
| Email | `user.email` | |
| ID (Login) | `user.loginId` | immutable key field |
| Password | `"************"` masked | never the real hash |
| Confirm Password | `"************"` masked | |
| Set as Admin | checkbox `checked={isAdmin}` **disabled** | shows status, not editable in VIEW |
| Avatar | `UserAvatarUpload readOnly` | inert disc |

Tabs (`UserTabs`): **Information** always; **Menu Entitlement** present only when
`!(isAdminSelected || !canManage)` — i.e. hidden for admin targets and for viewers.

## 4. User creation (`AddUserInfoForm`)

Required fields: Full Name, Position, Department, Telephone (interactive `PhoneCountryPicker` —
default `"84"`, choices sourced from `GET /api/v1/common/countries` filtered to KH / KR / VN, with a
static fallback when the API is unreachable — + number), Email, Login ID, Password, Confirm Password.
Optional: **Set as Admin** (default unchecked).

| Rule | Behaviour |
|---|---|
| Password required | empty → error dialog `settings.users.error.password_required` |
| Password match | password ≠ confirm → error dialog `settings.users.error.confirm_mismatch` |
| Check availability | button → `checkLoginId(loginId)` → success ("available") / error ("taken") dialog |
| Server validation | duplicate id / weak password / invalid email → backend `WBE_*` → error dialog |

Form is **uncontrolled**; values are read on Save via an imperative `collect()` handle, not RHF/Zod.

## 5. User update (`EditUserInfoForm`)

| Field | Editable? |
|---|---|
| Full Name, Position, Department, Phone, Email | ✅ editable (`defaultValue` seeded) |
| Set as Admin | ✅ editable checkbox |
| Avatar | ✅ interactive `UserAvatarUpload` |
| Login ID | ❌ rendered disabled, not in FormData (immutable PK) |
| Password / Confirm | optional — blank = keep existing; if non-empty must match |

Mounted with `key={user.id}` so switching the selected user reseeds the form.

## 6. Menu Entitlement tab (`UserMenuEntitlementPanel`)

- Visible only for a **non-admin** selected user when `canManage` (admin viewer).
- Tree shape from `entitlementTree.ts` (`buildEntitlementSections(tree)`, derived from the resolved
  `GET /api/v1/navigation` tree); granted state from `fetchMenuEntitlement(userId)`.
- Each checkbox toggle PUTs the full set immediately (`saveMenuEntitlement`) — optimistic, serialized,
  rollback on error. No separate Save button.
- Add mode (no user yet) renders the checkboxes inert.

## 7. Dialogs

| Trigger | `useDialog` type |
|---|---|
| Validation / backend error / network | `error` |
| Delete confirmation | `confirmation` |
| check-id available | `success` |
| check-id taken | `error` |

## 8. Validation summary (client)

- Add: password non-empty + matches confirm (rest enforced server-side via bean-validation).
- Edit: password optional; if provided must match confirm.
- All other field/format rules (`@Email`, `@Size`, password `@Pattern`) are enforced by the backend
  and surfaced as `WBE_VALIDATION` error dialogs.

---

## Read-only viewer behaviour

**Verified 2026-06-05.** A non-admin user holding the `settings-core-users` grant opens the panel
with `canManage = false`. Every write affordance is removed; the backend independently returns **403**
on any write, so this is defence-in-depth, not the only gate.

| Requirement | Implementation evidence |
|---|---|
| **"Set as Admin" displayed but disabled** | `UserDetailView` renders `<Checkbox checked={isAdmin} disabled />` — the user's admin status shows, but the control is non-interactive. (Editable, non-disabled only in `EditUserInfoForm`, which viewers never reach.) |
| **Password fields masked and read-only** | `UserDetailView` renders `<ReadOnlyTextField type="password" value="************" />` for both password + confirm; `ReadOnlyTextField` sets `disabled` + `readOnly`. Never the real hash. |
| **Edit inaccessible** | Edit button rendered only when `canManage && selectedUser && effectiveTab === "info"`; `handleStartEditing` early-returns when `!canManage`. Viewer never sees the button and never enters EDIT. |
| **Add User inaccessible** | `UsersListPanel` renders the "+ Add a user" row only `{canAddUser && (...)}`; `UsersPanel` passes `canAddUser={canManage}`; `handleStartAddUser` early-returns when `!canManage`. |
| **Menu Entitlement tab hidden** | `hideMenuEntitlement = isAdminSelected || !canManage` → `UserTabs` filters out the `menu_entitlement` tab; `effectiveTab` forced to `"info"`. |
| **Information tab locked to view-only** | With `canManage=false`, the right pane always renders `<UserDetailView>` (read-only); `<EditUserInfoForm>` never mounts because `isEditing` can't be set. |
| **Avatar management inaccessible** | `UserDetailView` passes `readOnly` to `UserAvatarUpload` → `role="img"`, `tabIndex=-1`, click/drag handlers `undefined`, hover overlay + Remove button hidden, `aria-disabled`. |

A user with **neither** ADMIN nor the grant never reaches the panel — `<SettingsModal>` renders
`<PanelPlaceholder>` instead, and the backend read endpoints return 403.

> The full backend enforcement (split `@PreAuthorize`, service `requireAdmin()` guards) is documented
> in [wecms-api functional-specification §Permission model](../../../../../wecms-api/docs/features/settings/user-management/functional-specification.md#5-permission-model).
