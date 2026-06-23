# Common → navigation (Frontend)

**Part of:** Common → navigation
**Last verified:** 2026-06-23

The frontend half of the **product-aware menu tree**. The backend resolves the tree
(`GET /api/v1/navigation` — `Product Tree ∩ grants`, full tree for admins); the frontend **renders it
directly**. The permission intersection is the backend's job — `lib/menuAuth.ts` stays the source of truth
for client route guards and the top-nav module switcher, unchanged.

`useNavigation` fetches the tree **once at shell mount** and caches it by `bizKey`; every nav surface —
Sidebar, Header top nav, mobile MENU switcher, Menu Entitlement — consumes that one tree. The previously
hardcoded menu arrays were removed; only node-id-keyed presentation registries (label key / icon / badge)
remain in the frontend so the client-side language toggle and the existing icon assets still work.

## Documents index

| Doc | Purpose |
|---|---|
| [screen-flow.md](screen-flow.md) | Shell mount → `useNavigation` → Sidebar/Header render; nested expand; active state via `usePathname`. |
| [ui-specification.md](ui-specification.md) | Sidebar groups, `SidebarMenuItem`, Header top nav, mobile drawer, active tokens. |
| [component-index.md](component-index.md) | `Sidebar` / `Header` / `SidebarMenuItem` / `ProfileMenu` / `AppShell` + `useNavigation` / `useTopMenuItems` + `lib/api/navigation` + `lib/menuAuth` + `sidebarNav.buildSidebarGroupsFromTree`. |
| [api-consumption.md](api-consumption.md) | `GET /navigation` once at mount; tree → render-model mapping; preview-mode fallback. |
| [test-scenarios.md](test-scenarios.md) | Tree render per product, active highlighting, nested expand, permission-filtered items. |

## Related links

- API twin — [../../../../../wecms-api/docs/features/common/navigation/README.md](../../../../../wecms-api/docs/features/common/navigation/README.md)
- Design ref (backend resolution) — [../../../../../docs/jex/features/menu-product-type-management/backend-navigation-implementation-design.md](../../../../../docs/jex/features/menu-product-type-management/backend-navigation-implementation-design.md)
- Design ref (endpoint gate) — [../../../../../docs/jex/features/menu-product-type-management/endpoint-authorization-matrix.md](../../../../../docs/jex/features/menu-product-type-management/endpoint-authorization-matrix.md)
- Common module hub — [../README.md](../README.md)

## At a glance (verified)

| Aspect | Value |
|---|---|
| Endpoint | `GET /api/v1/navigation` via `fetchNavigation()` (`lib/api/navigation.ts`) |
| Fetch hook | `useNavigation()` — once per session, cached by `bizKey`, shared in-flight promise (`hooks/useNavigation.ts`) |
| In-memory shape | `NavigationTree { productType, menuGroupId, topMenus: MenuNode[] }` (camelCase, mapped at the boundary) |
| Sidebar source | `buildSidebarGroupsFromTree(tree, pathname, accounts)` → `NavGroup[]` (`components/layout/sidebarNav.ts`) |
| Top nav source | `useTopMenuItems(user)` — tree depth-0 nodes → modules + appended Settings (`hooks/useTopMenuItems.ts`) |
| Active state | derived from `usePathname()` in `Sidebar` / `Header` (no server flag) |
| Degrade | failure / loading → empty rail (no hardcoded per-product fallback); `?preview=1` / no session → static module list |
| Presentation registry | `GROUP_PRESENTATION` / `LEAF_PRESENTATION` (label key + icon + badge), keyed by menu-item id |
| Route guards | `lib/menuAuth.ts` (`isRouteAllowed` / `isSectionAllowed` / `firstAllowedRoute`) — unchanged by the tree wiring |
