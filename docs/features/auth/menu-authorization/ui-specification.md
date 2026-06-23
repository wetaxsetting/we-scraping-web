# Menu Authorization — UI Specification (Frontend)

How the resolved navigation tree renders into the sidebar, top nav, mobile drawer, and the Menu
Entitlement editor universe. Follows the shared Sidebar / Header / Settings rules in `wecms-web/CLAUDE.md`
(§"Shared UI Component Architecture", §2 Left Sidebar, §1 Top Navigation, §3 Settings popup). Backend
reference:
[wecms-api/docs/features/auth/menu-authorization/functional-specification.md](../../../../../wecms-api/docs/features/auth/menu-authorization/functional-specification.md).

---

## Render model

The wire tree (`NavigationTree { productType, menuGroupId, topMenus: MenuNode[] }`) is **structure +
order + routes + visibility**, all from the backend. The frontend overlays **presentation only** —
i18n label keys, icon assets, VND/FCY badges — keyed by the stable navigation node id / `permissionCd`,
so the look matches the previous hardcoded rails and the client-side language toggle still works (the
API `label` is JWT-language-resolved and would not follow the toggle; the API `icon` is a legacy export
hint, not an asset path).

| Tree depth | Maps to | Presentation registry |
|---|---|---|
| **depth 0** (`banking` / `payment` / `addon-service`) | top-nav module + sidebar module root | `NODE_ID_TO_TOP_MENU_KEY` (useTopMenuItems) · `TOP_MENU_BY_KEY` (topMenu.ts) |
| **depth 1** (group nodes, e.g. `banking-current-savings-vnd`) | sidebar group heading + VND/FCY badge | `GROUP_PRESENTATION` (sidebarNav.ts) |
| **depth 2** (leaf nodes, e.g. `banking-account-inquiry-vnd`) | sidebar leaf row (icon + label + `href`) | `LEAF_PRESENTATION` (sidebarNav.ts) |

---

## Top navigation ([`Header`](../../../../components/layout/Header.tsx) + [`topMenu.ts`](../../../../components/layout/topMenu.ts))

- **Modules** Banking / Payment / Add-on come from the tree's depth-0 nodes in `seq` order, via
  `useTopMenuItems`. Each item carries `Icon` / `ActiveIcon` (Figma SVGs from `HeaderIcons`), `labelKey`,
  `href`, `activePrefix`.
- **Module link target** = the module's **first granted leaf route** (`firstRouteInSubtree(node)`), not
  the static module home — a user who holds `payment-internal-transfer-scheduled` but not
  `payment-approval-box` lands on the scheduled-transfer page, not bounced back to Banking. The static
  `href` is the fallback only when the subtree carries no route (backend collapses empty parents).
- **Settings** is appended last, gated by `isSectionAllowed("settings", user)`. It has **no `href`**;
  clicking it opens `<SettingsModal>` via `useSettingsModal()`. Active state matches `activePrefix:
  "/settings"`.
- **Active style** — active item: `bg-white text-brand-active` + `ActiveIcon`; inactive: `text-white
  hover:bg-white/10` + `Icon`; placeholder (no `href`, not Settings): `cursor-default text-white/70`,
  disabled. Tablet (`md`) collapses inactive labels to icon-only; active label stays on a white tab.
- An **H tenant's tree omits Add-on**, so the module never appears. A module whose children are all
  ungranted collapses out server-side.

---

## Left sidebar ([`Sidebar`](../../../../components/layout/Sidebar.tsx) + [`sidebarNav.ts`](../../../../components/layout/sidebarNav.ts))

- `buildSidebarGroupsFromTree(tree, pathname, accounts)` picks the **module root for the current URL
  prefix** (`moduleIdForPath`), maps its depth-1 group nodes → `NavGroup[]` and depth-2 leaves →
  `NavItem[]`, and **filters out empty groups** (`items.length > 0`).
- **Group heading** — `text-wb-11 font-medium uppercase text-black/70`; optional VND / FCY badge from
  `GROUP_PRESENTATION` (`badge` + `badgeHidden` to reserve alignment space).
- **Leaf row** — rendered through the shared [`<SidebarMenuItem>`](../../../../components/layout/SidebarMenuItem.tsx)
  (icon + label + optional chevron), so every rail uses identical icon size, typography, spacing, and
  state styling. Active background `bg-wb-bg-active` + `text-brand`.
- **Active state** — `isBranchActive(item, pathname)`: exact match, sub-route prefix
  (`startsWith(href + "/")` — keeps Payment detail-page rows highlighted per the Payment Detail Page
  Rules), or any descendant child match (auto-highlights + auto-expands the parent).

### Nested children — Banking Transaction History (live account lists)

- The Transaction History leaves (`banking-transaction-history-vnd` / `-fcy`) carry **no children in the
  API leaf** — their children are **injected from `/api/v1/banking/accounts`** via
  `useTransactionHistoryAccounts(scope)` (`accountsToChildren`).
- A leaf with `children` renders as an **expand/collapse toggle**; the parent row never navigates. Each
  child carries its own `href` (`accountHref(scope, a.id)` where `id = BANK_CD_ACCT_NO`) and is the real
  link. Child rows use `<SidebarMenuItem indent>`; the React key is `child.href` (nicknames can repeat).
- Parents whose branch matches the URL **auto-expand** (`autoOpenKeys`); a user override (`userOverrides`)
  takes precedence over the auto-open default.
- The nested account list scrolls inside `custom-scrollbar-y` per §6c.

### Mobile drawer (`< lg`)

- A **MENU group** (drawer-only, `lg:hidden`) mirrors the top-nav module list — `useTopMenuItems(user)`
  — so a narrow viewport can switch modules without a top-nav bar. It always renders the **Active icon
  variant** (the Header's inactive icons use `fill="white"` and would be invisible on the white drawer);
  selection is conveyed by `bg-wb-bg-active` + `text-brand`. The Settings row opens the modal + closes
  the drawer.

---

## Fallback nav (preview / loading / error)

- When `user == null` (preview `?preview=1` / no session), `useTopMenuItems` returns the **full static
  `topMenuItems`** so the chrome paints for a designer with no backend.
- When the tree is **loading / errored** but a user exists, `useTopMenuItems` falls back to the static
  modules **filtered by `isSectionAllowed`** (so the top nav isn't blank), then reconciles to the
  product-scoped set once the cached tree lands.
- The **sidebar has no hardcoded per-product fallback** by design — it renders an empty rail (chrome +
  company header still paint) while the tree is null. **APPROVED DEVIATION** from a static fallback rail
  (Phase 2 removed the hardcoded sidebar arrays).

---

## Menu Entitlement universe ([`entitlementTree.ts`](../../../../components/settings/users/entitlementTree.ts))

Rendered inside Settings > Users (see [../../settings/user-management/ui-specification.md](../../settings/user-management/ui-specification.md));
this section documents only the **universe generation** that is Menu Authorization's contribution.

- `buildEntitlementSections(tree)` walks the resolved tree's depth-0 sections (`banking` / `payment` /
  `addon-service`), maps each group node → an `EntitlementGroup` and each leaf with a `permissionCd` →
  an `EntitlementItem` (id = `permissionCd`, the grant key). Pure parents (no `permissionCd`) are
  skipped.
- **Section presentation** (`SECTION_PRESENTATION`) maps node id → label key + lucide icon
  (`Landmark` / `CircleDollarSign` / `Scissors`); **group labels** via `GROUP_LABEL_KEY`; **item labels**
  via `ITEM_LABEL_KEY` (falls back to the tree `label`).
- The **Settings section is appended from a frontend registry** (`SETTINGS_SECTION`) — product-invariant,
  not in the tree; item ids are the `settings-*` grant codes. **APPROVED DEVIATION** (Phase-4 parity
  with `<SettingsNav>`).
- When the tree is unavailable, `buildEntitlementSections(null)` returns **just the Settings section**
  so the panel never renders empty chrome.
- Because the universe is the **admin's full product tree**, an H admin's editor has no Add-on / Daily
  Cash / Cash Flow / e-Invoice rows automatically — product scoping is inherited, not re-implemented.
- The Daily Financial split shows two distinct leaves: F/M `banking-reports-daily-financial`, H
  `banking-reports-daily-financial-hs` (both reuse the Daily Financial label).

---

## i18n keys

| Namespace | Used by | Notes |
|---|---|---|
| `nav.banking` · `nav.payment` · `nav.addon` · `nav.settings` | top-nav + drawer module labels | `topMenu.ts` `labelKey` |
| `nav.menu` · `nav.open_menu` · `nav.close_menu` · `nav.home` | drawer MENU heading + hamburger / logo a11y | `Header` / `Sidebar` |
| `sidebar.banking.*` · `sidebar.payment.*` · `sidebar.addon.*` | sidebar group + leaf labels | `GROUP_PRESENTATION` / `LEAF_PRESENTATION` |
| `settings.users.menu.section.*` · `settings.users.menu.{banking,payment,addon,settings}.*` · `settings.users.menu.shared.*` | Menu Entitlement section / group / item labels | `entitlementTree.ts` |

All present in `locales/{en,ko,vi}.json` (no `km.json` — Khmer not yet in the web). EN is the fallback.
