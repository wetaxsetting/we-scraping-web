# Auth > Authorization — Frontend Feature (Refactor)

**Status:** ✅ Working — the menu-authorization framework in [`lib/menuAuth.ts`](../../../../lib/menuAuth.ts)
gates top-nav, sidebar, and route access from the session's grants; the route guard in
[`app/(dashboard)/layout.tsx`](<../../../../app/(dashboard)/layout.tsx>) enforces it on every authenticated
route. Edge-level enforcement lives in [`proxy.ts`](../../../../proxy.ts).
**Slug:** `authorization` (matches the JEX-traceability + backend counterparts)
**Scope:** frontend authorization framework — **presentation + client routing only**; the backend is the
authoritative security boundary (`@menuAuthz`, JWT).

> This folder is the frontend documentation home for the **authorization framework** — how a session's
> grants (`allMenus` + `allowedMenuCds[]`) and product type gate which routes a user may view. The
> matching backend docs are at
> [wecms-api/docs/features/auth/authorization/](../../../../../wecms-api/docs/features/auth/authorization/README.md).

---

## What this feature is

The frontend authorization framework — a small pure-logic module
([`lib/menuAuth.ts`](../../../../lib/menuAuth.ts)) plus its consumption in the dashboard route guard. It
answers one question for the UI: **"may this session view this route, and which top-nav / sidebar items
should show?"**

Two inputs drive everything, both populated from `GET /api/v1/auth/me` and persisted in
[`StoredUser`](../../../../lib/auth/storage.ts):

- **`allMenus`** — admin bypass. `true` ⇒ every menu / route is allowed (admins see the full product
  tree, still product-scoped server-side).
- **`allowedMenuCds[]`** — the granted leaf permission codes (kebab slugs, e.g. `addon-einvoices-sales`)
  for a normal user.

A third input, **`productType`** (`StoredUser.productType`, one of `KNOWN_PRODUCT_TYPES = ["F","M","H"]`
or a verbatim legacy letter), gates product-specific UX. **Product-type gating is UX only** — the
backend enforces the real product scope from the JWT claim.

The framework exposes pure helpers — `isMenuAllowed`, `isSectionAllowed`, `isRouteAllowed`,
`routeMenuCds` (longest-prefix, any-of), `firstAllowedRoute` — over a `ROUTE_MENU_MAP` of ~79 routes.
Route-guard enforcement (redirect ungranted routes to `firstAllowedRoute`, or render a "no menus"
notice) is consumed in [`app/(dashboard)/layout.tsx`](<../../../../app/(dashboard)/layout.tsx>).

**Security boundary (read first):** this is **UX gating, not a security control**. A user who edits
`localStorage` or hits an ungranted API directly is still blocked by the backend `@menuAuthz` /
`hasRole('ADMIN')` method security and JWT verification. See
[api-consumption.md](api-consumption.md) for the boundary statement.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | How grants gate route access (route → menu code → allowed? → render or redirect); product-type UX gating |
| [ui-specification.md](ui-specification.md) | The minimal UI surface — "no menus" notice, redirect behaviour, non-rendering of hidden routes (mostly logic) |
| [component-index.md](component-index.md) | `lib/menuAuth.ts` exported helpers, `StoredUser` auth fields, layout-guard usage (paths + roles) |
| [api-consumption.md](api-consumption.md) | Where `allMenus` / `allowedMenuCds` / `productType` come from; the FE-UX-vs-backend-enforcement security boundary |
| [test-scenarios.md](test-scenarios.md) | admin-sees-all, user-leaf-grant, ungranted-redirect, product-type-gate scenarios; FE-test status |

---

## Quick facts

| Aspect | Value |
|---|---|
| Framework module | [`lib/menuAuth.ts`](../../../../lib/menuAuth.ts) |
| Auth fields | [`StoredUser.allMenus` · `allowedMenuCds[]` · `productType`](../../../../lib/auth/storage.ts) |
| Route guard | [`app/(dashboard)/layout.tsx`](<../../../../app/(dashboard)/layout.tsx>) — `isRouteAllowed` → redirect `firstAllowedRoute` / `nav.no_menus` notice |
| Edge guard | [`proxy.ts`](../../../../proxy.ts) — cookie presence only (token vs none); **session-management**, not grant-aware |
| Route map | `ROUTE_MENU_MAP` (~79 routes), `SORTED_ROUTE_MAP` (longest-prefix-first) |
| Helpers | `isMenuAllowed` · `isSectionAllowed` · `isRouteAllowed` · `routeMenuCds` · `routeMenuCd` · `firstAllowedRoute` · `routeSection` |
| Product types | `KNOWN_PRODUCT_TYPES = ["F","M","H"]` · `isProductType` (UX gating only) |
| Security boundary | FE = UX gating; backend `@menuAuthz` + JWT = authoritative |
| View Setting | not applicable (framework, not a screen) |

---

## Related docs

- **Backend counterpart:** [wecms-api/docs/features/auth/authorization/README.md](../../../../../wecms-api/docs/features/auth/authorization/README.md) — `@menuAuthz` / `MenuAuthorizationGuard`, `SecurityConfig`, `PrdtType`
- **Sibling — menu resolution (nav tree):** [../menu-authorization/README.md](../menu-authorization/README.md) — the resolved visible nav tree consumed by the sidebar / header
- **Sibling — session management:** [../session-management/README.md](../session-management/README.md) — `fetchMe()`, the edge guard, 401 re-auth (source of `allMenus` / `allowedMenuCds`)
- **Sibling — JWT transport:** [../jwt-authentication/README.md](../jwt-authentication/README.md) — token storage + Bearer transport
- **Auth feature index:** [../README.md](../README.md)
