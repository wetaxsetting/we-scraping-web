# Auth > Session Management — Frontend Feature (Refactor)

**Status:** ✅ Working — the dashboard rehydrates the session from `GET /api/v1/auth/me`
on mount; route protection runs at the edge (`proxy.ts`); a global 401 response interceptor
surfaces the `<SessionExpiredDialog>` lock screen and retries the original request once after
re-authentication.
**Slug:** `session-management` (matches the JEX-traceability + backend counterparts)
**Scope:** frontend session lifecycle only — rehydrate, route guard, 401 → re-auth → retry, token TTL.
**Token storage / transport** lives in the sibling **jwt-authentication** module; **route gating
helpers** (`isRouteAllowed`, `firstAllowedRoute`) live in the sibling **authorization** module — this
module consumes both, it does not own them.

> This folder is the **frontend documentation home** for the session lifecycle. The matching backend
> docs are at
> [wecms-api/docs/features/auth/session-management/](../../../../../wecms-api/docs/features/auth/session-management/README.md)
> (`GET /api/v1/auth/me` = `AuthService.me()`, stateless model, MISSING refresh tokens / server-side
> revocation).

---

## What this covers

The frontend half of "keep a logged-in user logged in, and recover gracefully when the token expires":

- **Rehydrate on dashboard mount** — `app/(dashboard)/layout.tsx` calls `fetchMe()`
  (`GET /api/v1/auth/me`) so the in-memory `StoredUser` (sidebar / profile / menu chrome) reflects the
  live server state instead of whatever sat in `localStorage`. A failed `/me` clears storage and
  bounces to `/login`.
- **Route protection at the edge** — `proxy.ts` (Next.js 16 middleware) is the **single source of truth**
  for auth gating: `/login` is public; every other route requires the `wecms_token` cookie; missing →
  redirect to `/login?next=<pathname>`.
- **401 re-auth flow** — `lib/axios.ts` response interceptor catches any HTTP 401 (except
  `/auth/login` + `/auth/logout`), opens the global `<SessionExpiredDialog>` (lock screen) via the
  `requestReAuth()` bus, and on success retries the original request once with the fresh token
  (`_isRetry` guards recursion); cancel or a second 401 rejects.
- **Token TTL = 1h** — the `wecms_token` cookie `Max-Age` matches the backend
  `wecms.jwt.expires-in-seconds` default of 3600s.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | App load → edge guard (cookie) → dashboard mount `fetchMe()` rehydrate → route-allowed check; 401 → session-expired dialog → re-auth → retry |
| [ui-specification.md](ui-specification.md) | `<SessionExpiredDialog>` lock-screen spec, the "no menus" notice, redirect behavior, i18n keys |
| [component-index.md](component-index.md) | `fetchMe`, dashboard layout guard, `proxy.ts`, axios response interceptor, `<SessionExpiredDialog>` (paths + roles) |
| [api-consumption.md](api-consumption.md) | `GET /api/v1/auth/me` (`MeResponseRec` incl. `all_menus` / `allowed_menu_cds` / `tax_id`), 401 envelope (WBE1401), the re-auth retry flow |
| [test-scenarios.md](test-scenarios.md) | Valid-session rehydrate, missing-cookie redirect, 401 re-auth retry, cancel-reauth, route-not-allowed |

---

## Quick facts

| Aspect | Value |
|---|---|
| Rehydrate call | [`fetchMe()`](../../../../lib/auth/client.ts) → `GET /api/v1/auth/me` |
| Mount guard | [`app/(dashboard)/layout.tsx`](../../../../app/(dashboard)/layout.tsx) |
| Edge route guard | [`proxy.ts`](../../../../proxy.ts) — `/login` public, else require `wecms_token` cookie, missing → `/login?next=<pathname>` |
| 401 interceptor | [`lib/axios.ts`](../../../../lib/axios.ts) response interceptor |
| Re-auth bus | [`lib/auth/sessionExpired.ts`](../../../../lib/auth/sessionExpired.ts) — `requestReAuth()` / `onReAuthRequest()` / `resolveReAuth()` |
| Lock screen | [`<SessionExpiredDialog>`](../../../../components/auth/SessionExpiredDialog.tsx) (renders `<PasswordConfirmationDialog>` at `stackLevel={5}`) |
| Wire type | [`MeResponseRec`](../../../../lib/types/api.ts) — `+ all_menus`, `+ allowed_menu_cds`, `tax_id` re-queried each call |
| Token TTL | 1h — `wecms_token` cookie `Max-Age=3600` matches backend `wecms.jwt.expires-in-seconds` |
| Refresh token | **MISSING** (stateless model; deferred — see backend) |

---

## Stale-fact correction (DEAD LEGACY)

The old root docs (and the older `Auth Rules` notes) described a **client-side route guard with a
`?preview=1` bypass** inside `app/(dashboard)/layout.tsx`. That guard was **REMOVED** — the
query-string bypass was defeatable (disable JS) and a security hole. The **edge middleware
`proxy.ts` is now the single source of truth** for route protection. Classify the `?preview=1`
client guard as **DEAD LEGACY** — do not reintroduce it.

> Not to be confused with the dialog's own dev affordance `?preview=session-expired` (in
> `SessionExpiredDialog.tsx`), which opens the lock screen for UI rehearsal and is unrelated to route
> gating — see [ui-specification.md](ui-specification.md).

---

## Related docs

- **Backend counterpart:** [wecms-api/docs/features/auth/session-management/README.md](../../../../../wecms-api/docs/features/auth/session-management/README.md)
- **Sibling — JWT storage / transport:** [../jwt-authentication/](../jwt-authentication/) _(token cookie, Bearer interceptor)_
- **Sibling — Login:** [../login/README.md](../login/README.md)
- **Sibling — Logout:** [../logout/README.md](../logout/README.md)
- **Sibling — Authorization (route gating helpers):** [../authorization/](../authorization/) _(`isRouteAllowed`, `firstAllowedRoute`, `menuAuth.ts`)_
- **Auth feature index:** [../README.md](../README.md)
