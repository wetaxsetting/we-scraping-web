# Menu Authorization — API Consumption (Frontend)

The navigation endpoint the shell consumes, its wire shape, the render-model mapping, the per-`bizKey`
cache, and a reference to the Menu Entitlement GET / PUT. Backend contract:
[wecms-api/docs/features/auth/menu-authorization/interface-specification.md](../../../../../wecms-api/docs/features/auth/menu-authorization/interface-specification.md).
All resolved-tree calls go through [lib/api/navigation.ts](../../../../lib/api/navigation.ts) (Axios `api`
with the JWT interceptor); wire is lowercase snake_case, mapped to camelCase at the boundary.

---

## Endpoint

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| Resolved navigation tree | `fetchNavigation()` | `GET /api/v1/navigation` | — (product from the JWT `prdt_type`, never a client param) | `ApiNavigationResponse` |

The product type and grant intersection are **server-side**. The frontend sends no query params — the
backend reads `prdt_type` + the user's `USER_MENU_AUTH_INFM` grants from the signed JWT / DB and returns
the already-resolved tree (admin = full product tree, user = `Product Tree ∩ grants` with empty parents
collapsed).

---

## Response — `NavigationResponse` (snake_case) · `lib/types/api.ts`

```ts
interface ApiMenuNode {
  id:             string;        // stable navigation node id (e.g. "banking-account-inquiry-vnd")
  permission_cd:  string | null; // grant key; null = pure parent
  parent_id:      string | null;
  depth:          number;        // 0 = module, 1 = group, 2 = leaf
  seq:            number;        // display order (legacy MNU_SEQ / DISP_ORD)
  label:          string;        // server-resolved label (JWT language)
  route:          string | null; // Next.js route slug; null = no page
  icon:           string | null; // legacy export hint (NOT an asset path)
  legacy_mnu_id:  string | null; // traceability only
  legacy_wsvc_id: string | null; // traceability only
  children:       ApiMenuNode[];
}

interface ApiNavigationResponse {
  product_type:  string;         // verbatim BUSI_INFM.PRDT_TYPE (F / M / H)
  menu_group_id: string | null;  // source tree id (F→WE_CMSVN, M→WE_CMSVN_LUMENS, H→WE_CMSVN_HAENGSUNG)
  top_menus:     ApiMenuNode[];  // depth-0 roots (banking / payment / addon-service)
}
```

Envelope is the standard `{ status: { error, code, message }, data, timestamp?, path?, trace_id? }`.
`fetchNavigation()` checks `status.error` (HTTP 200 ≠ success for business errors) and throws
`ApiCallError(code, message)` carrying the `trace_id`.

---

## Mapping (boundary → render model)

`toNavigationTree` / `toMenuNode` translate snake_case → camelCase (kept local in `navigation.ts` to
avoid a cross-import cycle with `lib/api/mappers.ts`):

```
ApiNavigationResponse → NavigationTree { productType, menuGroupId, topMenus: MenuNode[] }
ApiMenuNode           → MenuNode { id, permissionCd, parentId, depth, seq, label, route, icon,
                                   legacyMnuId, legacyWsvcId, children[] }
```

From `NavigationTree` the two render surfaces are derived:

| Consumer | Derivation | Presentation overlay |
|---|---|---|
| **Top nav** (`useTopMenuItems`) | depth-0 nodes in `seq` order → `NODE_ID_TO_TOP_MENU_KEY` → `TOP_MENU_BY_KEY`; module `href` = `firstRouteInSubtree(node)`; Settings appended (gated) | `topMenu.ts` (icon, labelKey, activePrefix) |
| **Sidebar** (`buildSidebarGroupsFromTree`) | module root for the URL prefix → depth-1 groups + depth-2 leaves → `NavGroup[]`; empty groups filtered | `sidebarNav.ts` (`GROUP_PRESENTATION`, `LEAF_PRESENTATION`) + live Banking accounts |
| **Entitlement universe** (`buildEntitlementSections`) | depth-0 sections → groups → leaves (id = `permissionCd`); + product-invariant `SETTINGS_SECTION` | `entitlementTree.ts` (`SECTION_PRESENTATION`, `GROUP_LABEL_KEY`, `ITEM_LABEL_KEY`) |

**Why a presentation registry instead of the API's `label` / `icon`:** the API `label` is resolved
server-side from the JWT language and would not follow the client-side language toggle, so the frontend
keys to `labelKey` → `locales/{en,ko,vi}.json`; the API `icon` is a legacy export hint, not an asset
path, so the registry maps to `/assets/sidebar/*.svg`. Structure, ordering (`seq`), routes, and
visibility all come from the API.

---

## Per-`bizKey` caching

`useNavigation()` holds a **module-memory cache** keyed by `bizKey`:

- **Cache hit** (`cacheTree && cacheKey === bizKey`) → returned synchronously from the `useState`
  initializer; no refetch on route change (the sidebar stays mounted in `<AppShell>`).
- **Cache miss / tenant change** → one `fetchNavigation()` runs; concurrent consumers
  (`<Header>` + `<Sidebar>`) **share the same in-flight promise** (`inflight`), so the endpoint is hit
  once per `bizKey`.
- **Logout→login as a different tenant** in the same tab refetches because `cacheKey !== bizKey`.
- **`clearNavigationCache()`** drops the cache for tests / the login flow.

This caching is purely a frontend concern — the backend has no per-session state for navigation
(stateless JWT). **MATCH** with the stateless model documented in session-management.

---

## Menu Entitlement GET / PUT (Settings > Users) — reference

The Menu Authorization layer also **generates** the entitlement editor universe (see
[ui-specification.md](ui-specification.md)), but the **grant read/write** is owned by Settings > Users,
not this module's client:

| Action | Method + URL (backend) | Notes |
|---|---|---|
| Load a user's grants | `GET /api/v1/users/{userId}/menu-auth` | granted `permission_cd` set from `USER_MENU_AUTH_INFM` (USE_YN='Y') |
| Save a user's grants | `PUT /api/v1/users/{userId}/menu-auth` | admin-only (`WBE1003` otherwise); backend delete-then-insert, idempotent |

Full contract + wire shapes: [Settings > Users — api-consumption](../../settings/user-management/api-consumption.md)
and the backend
[wecms-api/docs/features/settings/user-management/](../../../../../wecms-api/docs/features/settings/user-management/README.md).
A saved grant change takes effect on the user's **next login** (their resolved tree is re-computed),
matching the stateless / signed-claims model.

---

## Notes

- **No mock fallback** for the resolved tree — loading / error degrade to the static `topMenuItems`
  (top nav) + an empty rail (sidebar). **APPROVED DEVIATION** (Phase 2 removed the hardcoded fallback
  rails).
- 401s are handled globally by the Axios response interceptor (session-expired re-auth) — not per call.
- The frontend never filters the resolved tree by permission — the `∩` is the backend's job; the FE
  renders as-is.
