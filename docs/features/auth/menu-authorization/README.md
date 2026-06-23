# Auth > Menu Authorization — Frontend Feature (Refactor)

**Status:** ✅ Working — the navigation shell consumes the live resolved tree from
`GET /api/v1/navigation` (cached per `bizKey`) and renders the sidebar + top nav from it; the Menu
Entitlement editor universe is generated from the same tree. No mock fallback for the resolved tree;
preview / loading / no-session degrade to a static full fallback nav.
**Slug:** `menu-authorization` (matches the JEX-traceability + backend counterparts)
**Backend base path:** `GET /api/v1/navigation` (resolved tree) · `GET / PUT /api/v1/users/{userId}/menu-auth` (entitlement editor, Settings > Users)
**Cross-cutting:** not a WeCMS top-menu group — this is the **menu/permission rendering** layer every
authenticated page depends on (see [../README.md](../README.md)).

> This folder documents the **frontend consumption of the resolved navigation tree** — how the sidebar,
> top nav, mobile drawer, and Menu Entitlement editor render from the server-resolved menu set. The
> matching backend docs (resolve algorithm, `NavigationResponse`, `USER_MENU_AUTH_INFM` storage,
> permission-code catalogue) are at
> [wecms-api/docs/features/auth/menu-authorization/](../../../../../wecms-api/docs/features/auth/menu-authorization/README.md).

---

## What this is

The frontend renders **the menu tree the backend has already resolved** for the session. The backend
selects the product tree from the session's `prdt_type` (read from the signed JWT, never a client
param) and returns it **already intersected with the user's grants** (`Product Tree ∩ USER_MENU_AUTH_INFM`;
admins get the full product tree). The frontend therefore renders the response **as-is** — the
permission `∩` lives entirely on the backend. There is no client-side filtering of the resolved tree.

The frontend owns only:

- **Fetch + cache** the resolved tree once per `bizKey` ([`useNavigation`](../../../../hooks/useNavigation.ts)).
- **Map tree → render model** keeping presentation (i18n `labelKey`, icon asset, VND/FCY badge) on the
  client so the language toggle keeps working ([`sidebarNav.ts`](../../../../components/layout/sidebarNav.ts),
  [`useTopMenuItems`](../../../../hooks/useTopMenuItems.ts)).
- **Active state** from `usePathname()` (sidebar branch + top-nav prefix match).
- **Generate the Menu Entitlement editor universe** from the same tree
  ([`entitlementTree.ts`](../../../../components/settings/users/entitlementTree.ts) — the old
  `mockMenuEntitlements.ts` was removed).

**Settings is not a tree node** — it is a modal trigger appended separately and gated by
`isSectionAllowed("settings", user)`. **Banking sub-items** (Transaction History) expand to **live
account lists** fetched from `/api/v1/banking/accounts`, not from the tree.

The route-gating helpers ([`lib/menuAuth.ts`](../../../../lib/menuAuth.ts)) that decide which routes a
user may *open* are the **authorization** module — cross-linked below, documented separately.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | App load → `useNavigation` fetch → sidebar / top-nav render from tree → active state; Settings modal gating; Menu Entitlement editor flow; preview / fallback |
| [ui-specification.md](ui-specification.md) | Sidebar groups / items, top-nav modules, nested children, mobile drawer, fallback nav, Menu Entitlement universe rendering, i18n keys |
| [component-index.md](component-index.md) | `useNavigation`, `useTopMenuItems`, `Sidebar`, `sidebarNav`, `Header`, `topMenu`, `entitlementTree` (paths + roles) |
| [api-consumption.md](api-consumption.md) | `GET /api/v1/navigation` response (`NavigationResponse` tree, snake_case) + render-model mapping; per-`bizKey` caching; Menu Entitlement GET / PUT reference |
| [test-scenarios.md](test-scenarios.md) | admin-full-tree, user-filtered-tree, parent-collapse, fallback-on-error, settings-gating scenarios (FE tests **MISSING**) |

---

## Quick facts

| Aspect | Value |
|---|---|
| Resolved tree fetch | [`useNavigation`](../../../../hooks/useNavigation.ts) — `GET /api/v1/navigation`, **cached per `bizKey`** (module-memory cache, shared in-flight promise) |
| Top-nav source | [`useTopMenuItems`](../../../../hooks/useTopMenuItems.ts) — depth-0 nodes in `seq` order; Settings appended + gated |
| Sidebar source | [`Sidebar`](../../../../components/layout/Sidebar.tsx) + [`buildSidebarGroupsFromTree`](../../../../components/layout/sidebarNav.ts) |
| Header source | [`Header`](../../../../components/layout/Header.tsx) + [`topMenu.ts`](../../../../components/layout/topMenu.ts) |
| Entitlement universe | [`buildEntitlementSections`](../../../../components/settings/users/entitlementTree.ts) — tree leaves + product-invariant Settings registry |
| Active state | `usePathname()` — sidebar `isBranchActive`, top-nav `activePrefix` |
| Settings | modal trigger gated by `isSectionAllowed("settings", user)` — **not** a tree node |
| Banking sub-items | live account lists from `/api/v1/banking/accounts` (injected as children) |
| Fallback (preview / loading / no-session) | static full nav (`topMenuItems`); resolved tree wins once it lands |
| Wire convention | lowercase snake_case → camelCase mapping at the navigation boundary |

---

## Related docs

- **Backend feature folder:** [wecms-api/docs/features/auth/menu-authorization/](../../../../../wecms-api/docs/features/auth/menu-authorization/README.md)
- **Sibling — authorization** (route-gating helpers `lib/menuAuth.ts`, `isRouteAllowed`, `firstAllowedRoute`): `../authorization/README.md`
- **Sibling — session-management** (mount guard, `/me` rehydrate, 401 re-auth): `../session-management/README.md`
- **Settings > Users** (the editor that writes grants): [../../settings/user-management/README.md](../../settings/user-management/README.md)
- **Auth feature group index:** [../README.md](../README.md)
