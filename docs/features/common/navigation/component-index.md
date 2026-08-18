# Navigation — Component Index (Frontend)

**Part of:** Common → navigation
**Last verified:** 2026-06-23

All paths under `wecms-web/`.

## Layout components (`components/layout/`)

| File | Role |
|---|---|
| `AppShell.tsx` | `h-screen` shell — `<Header>` + `<Sidebar>` + `<main>`; body scroll lock for the mobile drawer; wraps `SettingsModalProvider`. |
| `Header.tsx` | Top nav. `useTopMenuItems(user)` → modules + Settings; active via `usePathname()`; Settings opens the modal. |
| `Sidebar.tsx` | Left rail / mobile drawer. `useNavigation()` → `buildSidebarGroupsFromTree(tree, pathname, accounts)`; nested expand state; MENU switcher via `useTopMenuItems`. |
| `SidebarMenuItem.tsx` | Shared nav row — link / expandable-parent / button / disabled modes; icon slot, label, chevron, active tokens. |
| `ProfileMenu.tsx` | Avatar dropdown — user block, Languages submenu, Change Password, Logout. Independent of the nav tree (reads `userStorage`). |
| `sidebarNav.ts` | `buildSidebarGroupsFromTree(tree, pathname, accounts) → NavGroup[]` + `NavGroup` / `NavItem` types + `GROUP_PRESENTATION` / `LEAF_PRESENTATION` registries + `accountsToChildren` (live TX-History account injection). |

## Hooks (`hooks/`)

| File | Role |
|---|---|
| `useNavigation.ts` | `useNavigation(): { tree, loading, error }` — fetches the tree once per session, caches by `bizKey`, shared in-flight promise; `clearNavigationCache()` test/login seam. |
| `useTopMenuItems.ts` | `useTopMenuItems(user): TopMenuItem[]` — tree depth-0 nodes → modules (lands each on `firstRouteInSubtree`), appends Settings (gated by `isSectionAllowed`); static fallback while loading / preview. |

## API client (`lib/api/`)

| File | Exports |
|---|---|
| `navigation.ts` | `fetchNavigation(): Promise<NavigationTree>`; `MenuNode` / `NavigationTree` types; `firstRouteInSubtree(node)`; boundary mappers `toMenuNode` / `toNavigationTree` (snake→camel). Throws `ApiCallError` on business/network error. |

### `NavigationTree` / `MenuNode` (in-memory, camelCase)

```ts
interface NavigationTree { productType: string; menuGroupId: string | null; topMenus: MenuNode[]; }
interface MenuNode {
  id: string; permissionCd: string | null; parentId: string | null;
  depth: number; seq: number; label: string;
  route: string | null; icon: string | null;
  legacyMnuId: string | null; legacyWsvcId: string | null;
  children: MenuNode[];
}
```

## Route-guard / permission helpers (`lib/menuAuth.ts`) — unchanged by the tree wiring

| Export | Role |
|---|---|
| `isRouteAllowed(pathname, user)` | Route guard — admins always; mapped route gated by leaf cd(s) (any-of, cross-section); unmapped → section gate. |
| `isSectionAllowed(section, user)` | True when the user holds ≥1 leaf in the module (admins bypass). Drives top-nav + sidebar-group visibility + the `useTopMenuItems` fallback + Settings gate. |
| `isMenuAllowed(cd, user)` | True when the specific leaf slug is granted (admins bypass). |
| `routeMenuCds(pathname)` / `routeMenuCd(pathname)` | Resolve a route to its permission code(s) (longest-prefix, any-of). |
| `routeSection(pathname)` | Top-nav module a route belongs to. |
| `firstAllowedRoute(user)` | Safe landing route for a user whose current route is disallowed. |

> `menuAuth.ts` is presentation + client routing only — the **server** is the source of truth (`/navigation`
> already returns `Product Tree ∩ grants`). These helpers consume `StoredUser.allMenus` /
> `allowedMenuCds` from `/auth/me`, not the navigation tree.

## Consumer wiring (verified)

| Surface | Consumes |
|---|---|
| Desktop sidebar | `useNavigation` → `buildSidebarGroupsFromTree` |
| Desktop top nav | `useTopMenuItems` (→ `useNavigation`) |
| Mobile MENU switcher | `useTopMenuItems` (same hook as the top nav — lockstep) |
| Menu Entitlement screen | generated from the navigation tree (`entitlementTree.ts`; the former `mockMenuEntitlements.ts` was removed) — per the backend feature notes; ⚠️ `entitlementTree.ts` not read this pass |
