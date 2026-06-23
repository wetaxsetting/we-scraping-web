# Menu Authorization — Component Index (Frontend)

Hook / component / API-client / registry file map for the navigation-tree consumption layer. Backend
mirror:
[wecms-api/docs/features/auth/menu-authorization/source-code-index.md](../../../../../wecms-api/docs/features/auth/menu-authorization/source-code-index.md).

---

## Hooks (`hooks/`)

| File | Role |
|---|---|
| [useNavigation.ts](../../../../hooks/useNavigation.ts) | Fetches the resolved tree from `GET /api/v1/navigation`, **caches it per `bizKey`** in module memory (shared in-flight promise across concurrent consumers). Returns `{ tree, loading, error }`. Degrades to `tree = null` (empty rail) on loading / error — no hardcoded fallback rail. Exports `clearNavigationCache()` (test / login-flow seam). |
| [useTopMenuItems.ts](../../../../hooks/useTopMenuItems.ts) | Builds the ordered top-menu items for the session from the tree's depth-0 nodes (`seq` order), lands each module link on its first granted leaf route (`firstRouteInSubtree`), appends Settings gated by `isSectionAllowed("settings", user)`. Falls back to the static `topMenuItems` (no session) or the section-filtered static list (loading / error). Shared by `<Header>` (desktop top nav) + `<Sidebar>` (mobile drawer MENU). |

## Layout components (`components/layout/`)

| File | Role |
|---|---|
| [Sidebar.tsx](../../../../components/layout/Sidebar.tsx) | Left rail / mobile drawer. Calls `useNavigation()` + `buildSidebarGroupsFromTree(tree, pathname, accounts)`; injects live Banking Transaction History account children (`useTransactionHistoryAccounts`); active state + auto-expand via `isBranchActive` / `usePathname()`; mobile MENU group via `useTopMenuItems`. Renders rows through `<SidebarMenuItem>`. |
| [sidebarNav.ts](../../../../components/layout/sidebarNav.ts) | `buildSidebarGroupsFromTree(...)` — maps the resolved tree → `NavGroup[]` for the active module; `GROUP_PRESENTATION` / `LEAF_PRESENTATION` registries (i18n key + icon + VND/FCY badge); `accountsToChildren` for the live Transaction History account list. Exports `NavItem` / `NavGroup` types. |
| [Header.tsx](../../../../components/layout/Header.tsx) | Top bar. Reads `userStorage.get()` once, calls `useTopMenuItems(user)`, renders module links (`<Link>`) + the Settings button (`useSettingsModal().open()`) + disabled placeholders; active style from `usePathname()` matching `activePrefix`. |
| [topMenu.ts](../../../../components/layout/topMenu.ts) | `topMenuItems` (static module list — Banking / Payment / Add-on / Settings) + `TOP_MENU_BY_KEY` lookup. `TopMenuKey` / `TopMenuItem` types; `Icon` / `ActiveIcon` from `HeaderIcons`. Source for the preview / fallback nav. |
| [SidebarMenuItem.tsx](../../../../components/layout/SidebarMenuItem.tsx) | Shared nav row (icon, label, optional chevron, expand toggle, indent, active state) — reused by every rail. |
| [HeaderIcons.tsx](../../../../components/layout/HeaderIcons.tsx) | Active / inactive Figma SVG icon components for the top-nav modules. |

## Entitlement universe (`components/settings/users/`)

| File | Role |
|---|---|
| [entitlementTree.ts](../../../../components/settings/users/entitlementTree.ts) | `buildEntitlementSections(tree)` — generates the Menu Entitlement editor universe from the resolved tree leaves (id = `permissionCd`) + the product-invariant `SETTINGS_SECTION` registry. `SECTION_PRESENTATION` / `GROUP_LABEL_KEY` / `ITEM_LABEL_KEY` presentation maps. Exports `EntitlementSection` / `EntitlementGroup` / `EntitlementItem`. Replaced the removed `mockMenuEntitlements.ts`. |
| [MenuEntitlementSection.tsx](../../../../components/settings/users/MenuEntitlementSection.tsx) · [UserMenuEntitlementPanel.tsx](../../../../components/settings/users/UserMenuEntitlementPanel.tsx) | Render the universe as a checkbox grid (granted set + Save). Documented under [Settings > Users](../../settings/user-management/component-index.md); listed here only as the universe consumer. |

## API client + types (`lib/`)

| File | Role |
|---|---|
| [lib/api/navigation.ts](../../../../lib/api/navigation.ts) | `fetchNavigation()` → `GET /api/v1/navigation` (unwraps the `ApiResponse` envelope, throws `ApiCallError`). `toNavigationTree` / `toMenuNode` snake_case → camelCase boundary mappers. `firstRouteInSubtree(node)` (first `seq`-ordered route in a subtree). Exports `MenuNode` / `NavigationTree`. |
| [lib/menuAuth.ts](../../../../lib/menuAuth.ts) | Route-gating helpers (`isSectionAllowed`, `isRouteAllowed`, `firstAllowedRoute`, …) — the **authorization** module, cross-linked. `isSectionAllowed` is consumed here by `useTopMenuItems` for Settings gating + the static fallback filter. |
| [lib/types/api.ts](../../../../lib/types/api.ts) | `ApiMenuNode` · `ApiNavigationResponse` wire types (snake_case). |

## Active-state source

`usePathname()` (Next.js) — the single source of active/expanded state for both nav surfaces. No active
flag is stored or fetched.

## Not used

- **No route** for the navigation tree itself — it is shell chrome, not a page.
- **No mock fallback** for the resolved tree — preview / loading / error use the static `topMenuItems`
  (top nav) + an empty rail (sidebar), not a mock tree. `mockMenuEntitlements.ts` was **removed**.
- **No client-side permission filtering** of the resolved tree — the `Product Tree ∩ grants` happens
  backend-side; the frontend renders as-is.
