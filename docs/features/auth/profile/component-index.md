# Auth > Profile — Component Index (Frontend)

Component / provider / storage file map for the ProfileMenu profile surface. Backend mirror (tenant
directory):
[wecms-api/docs/features/auth/profile/source-code-index.md](../../../../../wecms-api/docs/features/auth/profile/source-code-index.md).

---

## Components (`components/layout/`)

| File | Role |
|---|---|
| [ProfileMenu.tsx](../../../../components/layout/ProfileMenu.tsx) | The profile surface — header avatar trigger + dropdown card. Owns: user-identity block (reads `userStorage`), avatar-edit pencil (UI-only placeholder, **MISSING**), language submenu (EN/KO/VI radio → confirmation → `setLocale`), Change Password row (opens `<ChangePasswordDialog>`), Logout rail (confirmation → `logout()`). Bespoke header popover — open/close, outside-click, ESC, and submenu state are all local `useState`. |
| [Header.tsx](../../../../components/layout/Header.tsx) | Top-nav shell that mounts `<ProfileMenu>` in its action group (reuse, do not rebuild). |
| [ChangePasswordDialog.tsx](../../../../components/layout/ChangePasswordDialog.tsx) | Feature dialog opened from the Change Password row. Documented in the sibling [change-password](../change-password/component-index.md) module — not owned by profile. |

## Provider / hook (`lib/i18n/`)

| File | Role |
|---|---|
| [LocaleProvider.tsx](../../../../lib/i18n/LocaleProvider.tsx) | In-house i18n provider. Exports `useTranslation()` → `{ locale, setLocale, t }`, the `Locale` type (`"EN" \| "KO" \| "VI"`), the `LOCALES` array, and `DEFAULT_LOCALE`. The language submenu consumes `locale` + `setLocale`; `setLocale` persists `wecms_locale` and syncs `<html lang>`. |
| [index.ts](../../../../lib/i18n/index.ts) | Re-exports `LOCALES`, `useTranslation`, `Locale` consumed by `ProfileMenu`. |

## Storage / types (`lib/auth/`)

| File | Role |
|---|---|
| [storage.ts](../../../../lib/auth/storage.ts) | `userStorage` (`get` / `set` / `clear` over `wecms_user`) and the `StoredUser` type. `ProfileMenu` calls `userStorage.get()` on first render to populate the identity block. `StoredUser` is camelCase (`userId`, `userName`, `bizKey`, `langCode`, `companyName`, `role`, `productType`, `taxId`, `allMenus`, `allowedMenuCds`). The profile surface reads only `userName` + `userId`. |
| [client.ts](../../../../lib/auth/client.ts) | `logout()` (consumed by the Logout rail). `login()` / `fetchMe()` are what populate `userStorage` — documented in [login](../login/README.md) / [session-management](../session-management/README.md). |

## Shared hooks consumed

- [`useTranslation()`](../../../../lib/i18n/LocaleProvider.tsx) — `t(...)` + `locale` + `setLocale`.
- [`useDialog()`](../../../../components/shared/dialog/) — the two confirmation dialogs (language switch,
  logout). Shared system dialog at `z-[100]`.
- React `useState` / `useEffect` / `useRef` / `useCallback` / `useTransition` — all dropdown/submenu/
  logout-pending state is component-local.

## i18n

`locales/{en,ko,vi}.json` — namespaces `profile.*`, `language.*`, `logout.*`, `nav.account_menu`, and
shared `dialog.*`. Full key list: [ui-specification.md § i18n keys](ui-specification.md#i18n-keys).

## Not used / not present

- **No route** — there is no `app/(dashboard)/profile/` directory; the profile surface is a header
  dropdown only.
- **No profile API client** — identity comes from `userStorage`; no `lib/api/profile.ts` exists, and the
  surface never calls `/api/v1/users` (the backend `profile` directory endpoint).
- **No avatar upload handler / endpoint** — the pencil button is inert (**MISSING**). Self-avatar CRUD
  is backend **Settings > Users** (`USER_BUSI_CONN_INFM.USER_IMG`), out of the auth-profile scope.
- **No automated tests** — no `ProfileMenu.test.*` (**MISSING**); see [test-scenarios.md](test-scenarios.md).
- **No View Setting / pagination / export** — not a list page.
