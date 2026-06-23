# Session Management — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the frontend session lifecycle. Backend scenarios:
[wecms-api/docs/features/auth/session-management/test-scenarios.md](../../../../../wecms-api/docs/features/auth/session-management/test-scenarios.md).

> **Automated FE tests: MISSING.** There are no unit / integration / e2e tests for `fetchMe()`, the
> dashboard mount guard, `proxy.ts`, the axios 401 interceptor, or `<SessionExpiredDialog>` in
> `wecms-web` today. The scenarios below are manual until a test harness lands.

---

## Valid-session rehydrate

| # | Scenario | Expected |
|---|---|---|
| SM1 | Log in, land on the dashboard | `proxy.ts` lets the request through (cookie present); layout calls `fetchMe()`; `<AppShell>` mounts; sidebar / profile reflect the `/me` payload |
| SM2 | Hard-refresh an authenticated page | edge guard passes (cookie still valid); `fetchMe()` re-runs and re-hydrates `userStorage`; no flash of `/login` |
| SM3 | `/me` returns `all_menus: true` (admin) | every route allowed; no "no menus" notice; sidebar shows the full tree |
| SM4 | `/me` returns `all_menus: false` + `allowed_menu_cds` | only granted sections/items visible; `tax_id` available for the lock-screen header |

## Missing-cookie redirect (edge guard)

| # | Scenario | Expected |
|---|---|---|
| MC1 | Navigate to `/banking/account-inquiry` with no `wecms_token` cookie | `proxy.ts` `307` → `/login?next=/banking/account-inquiry` (server-side, no page flash) |
| MC2 | Navigate to `/login` with no cookie | allowed (public prefix) — no redirect |
| MC3 | Navigate to `/` with no cookie | redirect to `/login` with **no** `?next=` (bare `/` target is not appended) |
| MC4 | Static asset (`/assets/...`, `/templates/...`, `*.svg`) | not matched by `proxy.ts` `matcher`; served ungated |
| MC5 | Disable JavaScript, hit a protected route with no cookie | still redirected — gating is at the edge, not client-side (the removed `?preview=1` client guard is DEAD LEGACY) |

## 401 re-auth retry

| # | Scenario | Expected |
|---|---|---|
| RA1 | Token expires mid-session; trigger any authenticated call | interceptor catches 401 → `<SessionExpiredDialog>` (lock screen) opens at `stackLevel={5}` |
| RA2 | Enter the correct password in the lock screen | `login(userId, pw, bizKey)` succeeds → token/user refreshed → original request retried once → resolves with `200` data; dialog closes |
| RA3 | Background-expired token at page load (`/me` 401) | `/me` is NOT excluded → lock screen opens (not a silent `/login` bounce) |
| RA4 | Two authenticated calls 401 simultaneously | only ONE lock screen opens; both requests retry/settle together (bus collapses concurrent 401s) |
| RA5 | Wrong password in the lock screen (`WBE1009`) | `useDialog()` error dialog at `z-[100]`; lock screen stays open for another attempt; `trace_id` shown |
| RA6 | Retried request 401s again (still-bad token) | `_isRetry` guard → reject with the original error; the dialog does NOT re-open (no loop) |
| RA7 | 401 from `/auth/login` (wrong-password attempt inside the popup) | NOT intercepted as session-expired — no recursive dialog |

## Cancel re-auth

| # | Scenario | Expected |
|---|---|---|
| CX1 | Press ESC on the lock screen | `tokenStorage.clear()` + `userStorage.clear()` + `resolveReAuth("cancelled")` + hard `window.location.assign("/login")` |
| CX2 | After cancel, the original request | interceptor sees `outcome !== "re_authenticated"` → rejects with the original 401 |
| CX3 | Company membership changed mid-session (`login` returns `kind: "chooser"`) | dialog defensively `resolveReAuth("cancelled")` + closes → user lands on a full re-login |
| CX4 | Lock screen has no `userStorage` user | falls through to the cancel path → `/login` |

## Route-not-allowed

| # | Scenario | Expected |
|---|---|---|
| RN1 | Non-admin deep-links to an ungranted route they have other grants for | layout redirects via `router.replace(firstAllowedRoute(me))` |
| RN2 | User with ZERO granted routes | centered `t("nav.no_menus")` notice — NOT a redirect (avoids a loop) |
| RN3 | Admin (`allMenus`) on any route | always allowed; `<AppShell>` renders |
| RN4 | Authenticated user on a non-module route (`/`) | not gated by `isRouteAllowed` (returns true for no-section routes) |

## i18n

| # | Scenario | Expected |
|---|---|---|
| LN1 | Switch locale EN / KO / VI | `session.title`, `session.password_placeholder`, `session.error_generic`, `nav.no_menus`, `dialog.error` all resolve via `t(...)` in each locale |

## Token TTL

| # | Scenario | Expected |
|---|---|---|
| TT1 | Wait > 1h idle, then navigate | `wecms_token` cookie expired (`Max-Age=3600`) → edge guard redirects to `/login?next=...` |
| TT2 | Wait > 1h idle, then trigger an in-app call before navigating | stale Bearer token → 401 → re-auth lock screen (RA1 path) |

---

## Cross-cutting

- The `<SessionExpiredDialog>` is mounted unconditionally — verify it never appears until a 401 fires,
  and always appears above any open Settings / popup chain (`stackLevel={5}`; error toasts at `z-[100]`
  still sit on top).
- Verify the lock screen shows `companyName` + `tax_id` + `userEmail` and never the internal `bizKey`.
- Dev affordance: `?preview=session-expired` opens the lock screen for UI rehearsal (no real
  `login()`, no token clear, no redirect) — confirm it is unrelated to route gating.
