# Auth > Logout — Frontend Feature (Refactor)

**Status:** ✅ Working — the profile dropdown logout row is wired to a confirmation
dialog → best-effort `POST /api/v1/auth/logout` → local auth-state cleanup →
`router.replace("/login")`. Verified against the live frontend code (2026-06-23).
**Menu:** Header → **ProfileMenu** (avatar dropdown) → **Logout** row (no standalone route)
**Slug:** `logout` (matches the JEX-traceability + backend counterparts)
**Backend endpoint:** `POST /api/v1/auth/logout` (public / permit-all, stateless stub)

> This folder is the frontend documentation home for **Auth > Logout**. The matching
> backend docs are at
> [wecms-api/docs/features/auth/logout/](../../../../../wecms-api/docs/features/auth/logout/README.md).

---

## What this is

The thin client-side logout flow. There is no logout page or route — logout is a row
inside [`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx). Clicking it opens a
shared `useDialog()` **confirmation** dialog (`logout.confirm_description`). On confirm,
[`lib/auth/client.logout()`](../../../../lib/auth/client.ts) makes a **best-effort**
`POST /api/v1/auth/logout` (any error is swallowed), then **unconditionally** clears the
auth-scoped storage keys and redirects to `/login`.

The defining invariant of this module: logout clears **only** `wecms_token` + `wecms_user`.
It **preserves** `wecms_locale` and `wecms_saved_user_id` (user preferences, not auth state)
and **never** calls `localStorage.clear()` — so the login page renders in the language the
user last chose and pre-fills the saved ID.

Server-side token revocation is **MISSING** (stateless JWT, no blacklist) — see
[api-consumption.md](api-consumption.md). The client cleanup is the effective logout.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Trigger → confirm dialog → cleanup → redirect; what survives logout |
| [ui-specification.md](ui-specification.md) | ProfileMenu logout row, confirmation dialog variant, signing-out transition state, i18n keys |
| [component-index.md](component-index.md) | ProfileMenu, `lib/auth/client.logout`, storage helpers (paths + roles) |
| [api-consumption.md](api-consumption.md) | `POST /api/v1/auth/logout` (best-effort, no body, swallow errors); gap classification |
| [test-scenarios.md](test-scenarios.md) | confirm-yes / confirm-no / swallowed-error / preserved-keys scenarios |

---

## Quick facts

| Aspect | Value |
|---|---|
| Trigger | [`<ProfileMenu>`](../../../../components/layout/ProfileMenu.tsx) Logout rail (`handleLogout`) |
| Confirmation | `useDialog()` `type: "confirmation"` · `logout.confirm_description` · Yes / No |
| Client fn | [`logout()`](../../../../lib/auth/client.ts) — best-effort POST then `finally` cleanup |
| Cleared keys | `wecms_token` (`tokenStorage.clear()`), `wecms_user` (`userStorage.clear()`) |
| **Preserved** keys | `wecms_locale` (LocaleProvider), `wecms_saved_user_id` (savedIdStorage) |
| Redirect | `router.replace("/login")` |
| Transition state | `useTransition()` — row label flips `profile.logout` → `profile.signing_out`, row `disabled` |
| Server revocation | **MISSING** (stateless JWT, no blacklist) |
| Client cleanup vs legacy | **MATCH** (legacy clears the session client-side) — server session invalidation = **DEAD LEGACY** |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/auth/logout/](../../../../../wecms-api/docs/features/auth/logout/README.md)
- **Sibling — session management:** [../session-management/README.md](../session-management/README.md)
- **Sibling — login:** [../login/README.md](../login/README.md)
- **Auth feature index:** [../README.md](../README.md)
