# Auth > Profile — Frontend Feature (Refactor)

**Status:** ✅ Working — the profile surface is the **ProfileMenu dropdown** in the top nav
([`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx)). The user-identity block, the
language submenu (client-only locale switch), the Change Password entry, and the Logout entry are all
wired. The **avatar edit pencil is a UI-only placeholder** (no handler, no endpoint) — classified
**MISSING** below.
**Menu:** top-nav avatar button → dropdown (no menu permission; visible to every authenticated session)
**Slug:** `profile` (matches the backend + sibling auth-module slugs for traceability)
**Route:** **none** — there is no `/profile` page or route; the profile surface is a header dropdown
only.

> This folder is the **frontend documentation home** for the Auth Profile surface. The matching backend
> docs are at [wecms-api/docs/features/auth/profile/](../../../../../wecms-api/docs/features/auth/profile/README.md).
> Note the backend `profile` feature documents the **tenant user directory** (`GET /api/v1/users`,
> a port of legacy `comm_0192_001_r001`) — it is NOT a self-profile endpoint. The frontend profile
> surface reads the **current** user's identity from `userStorage`, not from that directory endpoint.

---

## What this surface is

The **ProfileMenu dropdown** is the frontend "profile" surface. It exposes the signed-in user's
identity and the small set of per-user actions WeCMS attaches to the avatar:

- **User identity block** — default avatar (`/assets/header/avatar.svg`), `userName`, and `userId`,
  read from [`userStorage`](../../../../lib/auth/storage.ts) (`StoredUser`, populated by login +
  `/api/v1/auth/me`). Falls back to `profile.guest` when no user is stored.
- **Avatar edit pencil** — a UI-only button (Figma node 65:21424) with no click handler and no upload
  endpoint. **MISSING** in the auth scope — self-avatar CRUD lives under backend **Settings > Users**.
- **Language submenu** — EN / KO / VI radio list → confirmation dialog → `setLocale(...)` via
  [`LocaleProvider`](../../../../lib/i18n/LocaleProvider.tsx); persists `wecms_locale`. **Client-only
  MATCH** (no backend call).
- **Change Password** — opens `<ChangePasswordDialog>`; see the sibling
  [change-password](../change-password/README.md) module.
- **Logout** — confirmation dialog → `logout()`; see the sibling [logout](../logout/README.md) module.

There is **no dedicated profile page**. The dropdown is the whole surface.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Open dropdown → user block → language switch (confirm) → Change Password / Logout entries; submenu + dialog interaction |
| [ui-specification.md](ui-specification.md) | ProfileMenu layout, user-block typography, avatar, language radio submenu, button styling, i18n keys |
| [component-index.md](component-index.md) | `ProfileMenu`, `LocaleProvider`, `userStorage` / `StoredUser` file map + roles |
| [api-consumption.md](api-consumption.md) | Identity is read from `userStorage` (login / `/me`), NOT a profile endpoint; avatar + self-edit gaps; language switch client-only |
| [test-scenarios.md](test-scenarios.md) | Language confirm / cancel, guest fallback, avatar display, gap scenarios; FE automated tests MISSING |

---

## Quick facts

| Aspect | Value |
|---|---|
| Surface | [`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx) (header dropdown) |
| Mount | [`Header.tsx`](../../../../components/layout/Header.tsx) (top-nav action group) |
| Identity source | [`userStorage.get()`](../../../../lib/auth/storage.ts) → `StoredUser` (`userName`, `userId`) |
| Identity origin | login response + `/api/v1/auth/me` (see [session-management](../session-management/README.md)) |
| Language switch | [`useTranslation().setLocale`](../../../../lib/i18n/LocaleProvider.tsx) → persists `wecms_locale` |
| Avatar (default) | `/assets/header/avatar.svg` (overridable via `avatarSrc` prop) |
| Avatar edit | pencil button — **UI-only placeholder, MISSING** (no handler / endpoint) |
| Route | **none** (header dropdown only) |
| Profile endpoint | **none consumed** — identity is local; self-profile-edit is backend Settings > Users (out of scope) |

---

## Gap summary (vocabulary per the shared brief)

| Item | Classification |
|---|---|
| Language switch (client-only locale persistence) | **MATCH** (client-only; legacy parity is the locale dropdown) |
| Self-profile-edit (name / email / details from the profile surface) | **MISSING** in auth scope — lives under backend Settings > Users |
| Avatar edit (pencil) | **MISSING** — UI-only placeholder, no handler / endpoint |
| Frontend automated tests | **MISSING** — no `*.test.*` for ProfileMenu |

---

## Related docs

- **Backend feature folder (tenant user directory):** [wecms-api/docs/features/auth/profile/](../../../../../wecms-api/docs/features/auth/profile/README.md)
- **Sibling auth modules:** [change-password](../change-password/README.md) · [logout](../logout/README.md) · [session-management](../session-management/README.md) · [login](../login/README.md)
- **Auth feature index:** [../README.md](../README.md)
