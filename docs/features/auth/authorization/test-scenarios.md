# Authorization — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the frontend authorization framework ([`lib/menuAuth.ts`](../../../../lib/menuAuth.ts)
+ the dashboard route guard). Backend scenarios:
[wecms-api/docs/features/auth/authorization/test-scenarios.md](../../../../../wecms-api/docs/features/auth/authorization/test-scenarios.md).

> **Automated FE tests: MISSING.** There is no test runner (no Jest / Vitest config), no `__tests__`
> directory, and no `*.test.ts` / `*.spec.ts` covering `menuAuth.ts` or the layout guard in
> `wecms-web` as of 2026-06-23. The pure helpers (`isMenuAllowed`, `isSectionAllowed`, `isRouteAllowed`,
> `routeMenuCds`, `firstAllowedRoute`) are highly unit-testable and SHOULD get a Vitest suite once a
> runner lands — they take a plain `StoredUser` and a pathname, no React. Until then the scenarios
> below are **manual**. The authoritative authorization tests are backend
> (`MenuAuthorizationGuardTest`, `EndpointAuthorizationCoverageTest`, `UserManagementAuthorizationTest`).

---

## Admin — sees all

| # | Scenario | Expected |
|---|---|---|
| AD1 | Log in as an admin (`all_menus = true`) | every top-nav module + sidebar item visible; `isRouteAllowed` true for every route |
| AD2 | Direct-URL any module route as admin | route renders; no redirect (`firstAllowedRoute` returns `null`, guard uses default home) |
| AD3 | Admin `allowed_menu_cds` is empty | bypass still applies — `allMenus` short-circuits before the leaf list is consulted |

## User — leaf grant

| # | Scenario | Expected |
|---|---|---|
| UG1 | User granted `banking-vnd-account-inquiry` | Banking module visible; Account Inquiry (VND) reachable; `isRouteAllowed("/banking/account-inquiry", user)` true |
| UG2 | User NOT granted a sibling leaf (e.g. no `banking-vnd-inquire-transactions`) | that sidebar item hidden; direct URL hit redirects (see UR1) |
| UG3 | Longest-prefix wins | granting only `banking-fcy-update-inquire` allows `/banking/account-inquiry-fcy` but NOT the VND base `/banking/account-inquiry` |
| UG4 | Any-of (Smart Organizer) | holding **either** `banking-vnd-inquire-transactions` **or** `banking-fcy-inquire-transactions` allows `/banking/smart-organizer` |
| UG5 | Cross-section (Bank Credentials) | a `/banking/credentials` URL is allowed by the `settings-core-login-credentials` leaf, not by a `/banking` grant — leaf code is authoritative, not the URL prefix |
| UG6 | Unmapped module route | a `/banking/<unmapped>` route falls back to `isSectionAllowed("banking", user)` — allowed iff the user holds any banking leaf (never false-blocks an unmapped page) |
| UG7 | Section visibility | top-nav module shows iff ≥1 of its leaves is granted (`isSectionAllowed`) |

## Ungranted — redirect

| # | Scenario | Expected |
|---|---|---|
| UR1 | User direct-URLs a route they lack the leaf for, but holds another grant | guard redirects to `firstAllowedRoute(user)`; blocked page never paints / fetches |
| UR2 | User with **zero** granted routes | `firstAllowedRoute` returns `null`; `nav.no_menus` centered notice renders; **no redirect loop**; `<AppShell>` does not mount |
| UR3 | `noLanding` route is never a landing | Bank Credentials / Smart Organizer (flagged `noLanding`) never become the `firstAllowedRoute` even when their code is granted |
| UR4 | Non-module route (`/`, profile shell) | always allowed — `routeSection` returns `null`, guard does not gate it |

## Product-type gate (UX)

| # | Scenario | Expected |
|---|---|---|
| PT1 | Product type `H` on Select Bank Accounts popup | VAS Code / VAS Account Name columns hidden (`isProductType(user, "H")` true → `showVas = false`) |
| PT2 | Product type `F` / `M` | VAS columns shown |
| PT3 | Unknown legacy letter (not F/M/H) | `isProductType(user, "H")` false; F/M UX variant renders; the letter still round-trips verbatim in `StoredUser.productType` |
| PT4 | Tamper check | product-type UX gating only changes which variant renders — it does NOT authorize data; the backend enforces the product-tree gate from the signed JWT |

## Security boundary

| # | Scenario | Expected |
|---|---|---|
| SB1 | Edit `localStorage` `wecms_user.allMenus = true` | FE may show extra menus, but every backend `@menuAuthz` endpoint still 403s (`WBE1003`) — FE gating is UX only |
| SB2 | Disable JavaScript / hit a route directly | `proxy.ts` still requires the `wecms_token` cookie (→ `/login`); backend still enforces grants per request |
| SB3 | Call an ungranted API directly with a valid token | backend `@menuAuthz.canAccess('…')` rejects (403) regardless of FE state |

## Cross-cutting

- Verify `nav.no_menus` resolves via `t(...)` in EN / KO / VI.
- Verify the FE `ROUTE_MENU_MAP` codes match the backend permission-code seed (a drift is a paired-change
  bug — see [api-consumption.md § Permission-code contract](api-consumption.md#permission-code-contract)).
- Confirm a blocked route renders **nothing** before redirecting (no chrome flash, no data fetch).
- 401 / session-expired during navigation is a sibling **session-management** path (global Axios
  interceptor → re-auth dialog), not an authorization-framework scenario.
