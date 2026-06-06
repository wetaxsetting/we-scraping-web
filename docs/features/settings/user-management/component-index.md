# User Management — Component Index (frontend)

Back to [README](README.md) · [ui-specification](ui-specification.md) · backend [source-code-index](../../../../../wecms-api/docs/features/settings/user-management/source-code-index.md)

All paths are repo-relative to `wecms-web/`.

---

## 1. Mount / shell

| File | Role |
|---|---|
| `components/settings/SettingsModal.tsx` | Hosts the panel at `panel === "user"`; computes `canViewUsers` + `canManageUsers (= isAdmin)`; renders `<UsersPanel canManage={…} />` or `<PanelPlaceholder>` |
| `components/settings/SettingsNav.tsx` | Left nav entry that selects the Users panel |

## 2. Panel & list

| File | Role |
|---|---|
| `components/settings/users/UsersPanel.tsx` | Container + state machine (list/view/edit/add, tab, search). Owns list load + imperative form handles. Prop `canManage` gates all writes |
| `components/settings/users/UsersListPanel.tsx` | Left column: scrollable rows + "+ Add a user" (gated by `canAddUser`) |
| `components/settings/users/UserListItem.tsx` | Single list row: avatar + name (+"(You)") + role badge + email |
| `components/settings/users/UsersEmptyState.tsx` | Right-pane placeholder when nothing selected |
| `components/settings/users/UserTabs.tsx` | Information / Menu Entitlement tab strip; filters out entitlement tab when `hideMenuEntitlement` |

## 3. Detail / forms

| File | Role |
|---|---|
| `components/settings/users/UserDetailView.tsx` | Read-only Information view (masked password, disabled admin checkbox, inert avatar) |
| `components/settings/users/AddUserInfoForm.tsx` | Create form (uncontrolled + `collect()`); "Check availability"; set-as-admin |
| `components/settings/users/EditUserInfoForm.tsx` | Edit form; immutable login id; optional password; interactive avatar |
| `components/settings/users/UserFormField.tsx` | Field label wrapper |
| `components/settings/users/EditableTextField.tsx` | Shared input chip (gray when `disabled`) |
| `components/settings/users/useUserFormHandle.ts` | Type for the imperative `collect()` handle |

## 4. Menu entitlement

| File | Role |
|---|---|
| `components/settings/users/UserMenuEntitlementPanel.tsx` | Entitlement tab; loads grants, immediate PUT per toggle, optimistic + rollback |
| `components/settings/users/MenuEntitlementSection.tsx` / `MenuEntitlementRow.tsx` | Grid section + row rendering |
| `components/settings/users/mockMenuEntitlements.ts` | `ENTITLEMENT_SECTIONS` static tree shape (slug catalogue) |

## 5. Avatar

| File | Role |
|---|---|
| `components/settings/users/UserAvatarUpload.tsx` | Upload/remove disc; `readOnly` mode for VIEW; client-side type + 2 MB validation; optimistic preview |
| `components/settings/users/UserAvatar.tsx` | Initials/image avatar used in list rows |
| `components/settings/users/UserBadge.tsx` | Admin/User role pill |

## 6. API client & types

| File | Role |
|---|---|
| `lib/api/userManagement.ts` | All endpoint wrappers (list, detail, check-id, create, update, delete, menu-entitlement get/save, image upload/delete/blob). See [api-consumption.md](api-consumption.md) |
| `lib/types/api.ts` | Wire types: `ApiUserMgmtRow`, `ApiUserMgmtListResponse`, `ApiUserMgmtCreateRequest`, `ApiUserMgmtUpdateRequest`, `ApiCheckLoginIdResponse`, `ApiMenuEntitlementResponse`, `ApiMenuEntitlementUpdateRequest` |
| `components/settings/users/types.ts` | In-memory `SettingsUser`, `UserRole`, `UserDetailTabKey`, `UserListMeta`, `UserFormDraft` + mappers `mapUserRow` / `toCreateRequest` / `toUpdateRequest` |

## 7. Hooks

There is **no dedicated `useUsers` hook** — `UsersPanel` owns list state directly and uses imperative
`collect()` handles on the Add/Edit forms and `MenuEntitlementPanelHandle` on the entitlement tab.
Shared infra used: `useDialog()` (dialogs), `useTranslation()` (i18n), `userStorage` / `isAdmin`
(permission context from `lib/auth`).

## 8. Naming note (matches, not a bug)

The API-client file is `lib/api/userManagement.ts` (not `lib/api/users.ts`), and the wire types are
prefixed `ApiUserMgmt*`. The earlier plan referenced `lib/api/users.ts` + `ApiUserRow`; the shipped
names are the ones above. Backend source map: [source-code-index](../../../../../wecms-api/docs/features/settings/user-management/source-code-index.md).
