# Menu Authorization — Screen Flow (Frontend)

How the navigation shell resolves and renders the menu tree, derives active state, gates Settings, and
generates the Menu Entitlement editor. Backend resolve algorithm:
[wecms-api/docs/features/auth/menu-authorization/business-flow.md](../../../../../wecms-api/docs/features/auth/menu-authorization/business-flow.md).

```
App load → (dashboard)/layout.tsx auth guard → fetchMe() rehydrates userStorage
      │
      ▼
<AppShell> mounts → <Header> + <Sidebar>
      │
      ▼  useNavigation()  (cached per bizKey)
GET /api/v1/navigation
      │  backend resolves: Product Tree (from JWT prdt_type) ∩ grants
      │  → admin = full product tree; user = filtered, empty parents collapsed
      ▼  toNavigationTree(...) maps snake_case → camelCase
NavigationTree { productType, menuGroupId, topMenus: MenuNode[] }
      │
      ├─ <Header>  → useTopMenuItems(user)  → depth-0 nodes (seq order) → top-nav modules
      │                                       + Settings appended (isSectionAllowed)
      ├─ <Sidebar> → buildSidebarGroupsFromTree(tree, pathname, accounts)
      │                                       → groups + leaves for the ACTIVE module
      │                                       (Banking Transaction History injects live accounts)
      └─ Settings > Users → buildEntitlementSections(tree) → Menu Entitlement editor universe
```

---

## App-load → render path

| Step | What happens |
|---|---|
| **1. Auth guard** | `app/(dashboard)/layout.tsx` confirms the token + `fetchMe()` rehydrates `userStorage` (incl. `bizKey`, `allMenus`, `allowedMenuCds`) before `<AppShell>` mounts. |
| **2. Navigation fetch** | `useNavigation()` reads `bizKey` from `userStorage`, checks the module-memory cache, and on a miss calls `fetchNavigation()` (`GET /api/v1/navigation`). Concurrent consumers (`<Header>` + `<Sidebar>`) share one in-flight promise. |
| **3. Cache by `bizKey`** | The resolved tree is cached keyed by `bizKey`. Route changes reuse the cache (the sidebar stays mounted in `<AppShell>`). A logout→login as a different tenant in the same tab refetches because `cacheKey !== bizKey`. |
| **4. Top-nav render** | `useTopMenuItems(user)` maps the tree's depth-0 nodes (`banking` / `payment` / `addon-service`) in `seq` order to presentation entries, lands each module link on its **first granted leaf route** (`firstRouteInSubtree`), then appends Settings when `isSectionAllowed("settings", user)`. |
| **5. Sidebar render** | `buildSidebarGroupsFromTree(tree, pathname, accounts)` picks the module root for the current URL prefix, maps its depth-1 group nodes → `NavGroup[]` and depth-2 leaves → `NavItem[]`, then filters out empty groups. Banking Transaction History leaves get live account children injected. |
| **6. Active state** | `usePathname()` drives it: top nav matches `activePrefix` (`pathname === prefix || startsWith(prefix + "/")`); sidebar uses `isBranchActive` (exact, sub-route, or any descendant child match) to highlight leaves and auto-expand parents. |

The tree is **pre-filtered server-side (product ∩ grants)** — the frontend renders it as-is. **MATCH**
with the legacy behavior where the LNB was emitted from the same product-and-grant resolution.

---

## States

| State | Trigger | UI |
|---|---|---|
| **Loading** | `useNavigation` fetch in flight, no cache | `nav.tree = null`; `<Sidebar>` renders an empty rail (chrome + company header still paint); `useTopMenuItems` falls back to the static module list filtered by section grant so the top nav is never blank |
| **Resolved** | `GET /navigation` succeeds | sidebar groups + top-nav modules render from the tree; active state from `usePathname()` |
| **Error** | `GET /navigation` fails (`ApiCallError`) | `nav.tree` stays `null`; same degraded render as loading (empty rail + static top-nav fallback) — no crash, no hardcoded per-product fallback rail by design |
| **Preview / no session** | `?preview=1` or `user == null` | `useTopMenuItems` returns the **full static `topMenuItems`** (designer preview of chrome without a backend); sidebar renders empty until a session exists |
| **Module with no menu for product** | e.g. Add-on under product type `H` | the module simply never appears (its depth-0 node is absent from the tree); `buildSidebarGroupsFromTree` returns `[]` and the rail is empty for that module |

---

## Settings gating (modal trigger, not a tree node)

```
Top nav "Settings" (or mobile drawer Settings row)
      │  rendered only when isSectionAllowed("settings", user)
      ▼  onClick
settingsModal.open()   → <SettingsModal> (no route change, no tree node)
```

- Settings is **intentionally absent** from `NODE_ID_TO_TOP_MENU_KEY` in `useTopMenuItems` — it is
  appended last and gated by `isSectionAllowed("settings", user)` (admin bypass, or any `settings-*`
  grant). It is **APPROVED DEVIATION** from being a tree leaf: Settings is product-invariant and lives
  in the GNB/modal layer, so it is not part of the product navigation tree.
- The Settings entry has **no `href`** (`topMenu.ts`); clicking it opens `<SettingsModal>` via
  `useSettingsModal()`. Active state matches `activePrefix: "/settings"` for visual parity even though
  no `/settings` URL is navigated to.

---

## Menu Entitlement editor flow (Settings > Users)

```
Settings modal → Users panel → select a user → Menu Entitlement section
      │  buildEntitlementSections(nav.tree)
      ▼
Editor universe = tree leaves (per section/group) + product-invariant Settings registry
      │  each leaf id = its permission_cd (the grant key)
      ▼
Checkbox grid (granted set from the user's USER_MENU_AUTH_INFM)
      │  Save  → PUT grants (admin-only)
      ▼
Backend delete-then-insert; on next login the user's resolved tree reflects the new grants
```

- The grantable universe is **generated from the same resolved tree** the sidebar uses. Because an
  admin loads the **full product tree**, its leaves are exactly the menus a user in that tenant may be
  granted — an H admin can neither see nor grant Add-on / Daily Cash / Cash Flow / e-Invoice leaves
  because they are absent from the H product tree. **MATCH** with the backend product-scoping rule.
- **Settings entitlements are a frontend registry** (`SETTINGS_SECTION` in `entitlementTree.ts`) appended
  after the tree-derived sections — Settings is product-invariant and not in the navigation tree, the
  same Phase-4 decision used for `<SettingsNav>`. **APPROVED DEVIATION**.
- The old `mockMenuEntitlements.ts` (a static entitlement list) was **removed** — the universe is now
  data-driven from the live tree. **DEAD LEGACY** (mock retired).
- Item ids are the kebab `permission_cd` values written to / read from `USER_MENU_AUTH_INFM`; label keys
  / icons are presentation only.

---

## Refresh / cache model

- The tree is fetched **once per `bizKey`** and held in module memory; `clearNavigationCache()` is the
  test / login-flow seam that drops it so the next mount refetches.
- The sidebar lives in `<AppShell>` and only remounts on a full logout→login, so `bizKey` does not
  change in place — the `useState` initializer reflecting the cache is the source of truth on every
  mount.
- Banking account children are fetched **independently** from `/api/v1/banking/accounts?currency=…`
  (VND + FCY scopes) by `useTransactionHistoryAccounts`; while in flight the children list renders empty
  and the parent row still toggles.

---

## Authorization & visibility (boundary)

The resolved tree decides what **appears** in the nav; [`lib/menuAuth.ts`](../../../../lib/menuAuth.ts)
(the **authorization** module) decides which routes a user may **open** (`isRouteAllowed`,
`firstAllowedRoute`) and drives the static top-nav fallback's section filter. The frontend gates are UX;
the backend `@menuAuthz.canAccess(...)` on every endpoint is the security boundary — cross-link
`../authorization/README.md`.
