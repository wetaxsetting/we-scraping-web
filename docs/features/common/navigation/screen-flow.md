# navigation — Screen Flow (Frontend)

**Part of:** Common → navigation
**Last verified:** 2026-06-23

How the resolved tree reaches the screen and how the user interacts with it.

## Mount → fetch → render

```
AppShell mount
   ├─ <Header>   → useTopMenuItems(user) ─┐
   └─ <Sidebar>  → useNavigation() ───────┴─▶ both read the SAME cached tree
                       │
                       ▼
            fetchNavigation()  (GET /api/v1/navigation, once per session)
                       │
            cache by bizKey ──▶ NavigationTree { productType, menuGroupId, topMenus }
                       │
   Sidebar: buildSidebarGroupsFromTree(tree, pathname, accounts) → NavGroup[]
   Header : tree.topMenus (depth-0) → modules + Settings (appended)
```

- `useNavigation()` fetches once and caches in module memory keyed by `bizKey`
  (`hooks/useNavigation.ts:22-85`). The sidebar lives in `<AppShell>` and only remounts on a full
  logout→login, so route changes reuse the cache — no refetch. A logout→login as a different tenant in the
  same tab refetches (cache key changed).
- Concurrent consumers (`Sidebar` + `Header`) share one in-flight promise.

## Sidebar render (`components/layout/Sidebar.tsx`)

1. `useNavigation()` → `nav.tree`; `buildSidebarGroupsFromTree(nav.tree, pathname, { vnd, fcy })` builds
   the active module's groups (`:101-108`). The active module is derived from the URL prefix
   (`moduleIdForPath` in `sidebarNav.ts`).
2. Each group renders its heading (i18n via `titleKey`, optional VND/FCY badge) and items through the
   shared `SidebarMenuItem`.
3. **Nested expand:** an item with `children` (Transaction History's live account list, injected from
   `/banking/accounts`) renders as an expand toggle. The parent row is a toggle (no navigation); each
   child carries its own `href`.
4. **Active + auto-expand:** `isBranchActive(item, pathname)` keeps a parent visibly on-branch while a
   child is selected and auto-expands the group when the URL matches a descendant (`:61-66`, `:120-130`).
   User toggles override the auto-open set (`:132-141`).
5. **Empty / loading / error tree** → `buildSidebarGroupsFromTree` returns `[]` → the rail renders empty
   (chrome + company header still paint).

## Header top nav (`components/layout/Header.tsx`)

1. `useTopMenuItems(user)` derives the ordered module list from `nav.tree.topMenus` (depth-0 nodes), maps
   each via `NODE_ID_TO_TOP_MENU_KEY`, and appends **Settings** (gated by `isSectionAllowed("settings", …)`).
2. Each module link lands on the first **granted** leaf route in the resolved subtree
   (`firstRouteInSubtree(node)`), not the static module home — so a user without the default leaf isn't
   bounced by the route guard.
3. Active state per item: `pathname === prefix || pathname.startsWith(prefix + "/")`; active item paints the
   white tab + brand text, inactive items the brand-bar styling.
4. **Settings** has no route — clicking opens the shared Settings modal via `useSettingsModal().open()`.

## Mobile drawer MENU switcher

The `< lg` drawer's MENU section mirrors the top nav, driven by the same `useTopMenuItems(storedUser)` so
module visibility stays in lockstep (`Sidebar.tsx:113`, `:210-259`). Each row uses the shared
`SidebarMenuItem` with the Active header icon variant (the inactive header icons are designed for the blue
bar and would be invisible on the white drawer). Selecting a module closes the drawer (`onClose`).

## States

| State | Sidebar | Top nav |
|---|---|---|
| Loading / error (`nav.tree == null`, user present) | empty rail | static modules filtered by section grant (`isSectionAllowed`) |
| Tree resolved | product-scoped, permission-filtered groups | tree depth-0 modules + Settings |
| Preview / no session (`user == null`) | empty rail | full static module list (`topMenuItems`) for `?preview=1` |
