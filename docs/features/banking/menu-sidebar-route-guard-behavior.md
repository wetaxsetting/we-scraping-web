# Banking — Menu, Sidebar, Route Guard & Active-State Behavior (Frontend)

> **Verified 2026-06-07** against live source + the backend V243 navigation seed (not docs alone).
> Scope: Banking top menu, left sidebar, direct-URL route guards, active-state highlight, and the
> Smart Organizer empty state across the **complete WeCMS product-type set F / M / H** and the
> admin / normal-with-grant / normal-without-grant / person-specific cases.
>
> **Authoritative product-type set:** WeCMS has exactly three product types — `F` (WeCMS Default),
> `M` (WeCMS Lumens), `H` (WeCMS HaengSung Electronics). Treat F/M/H as complete unless source code
> introduces a new one.
> Backend counterpart: [wecms-api/docs/features/banking/menu-authorization-and-product-types.md](../../../../wecms-api/docs/features/banking/menu-authorization-and-product-types.md).

## 1. Source of truth

The visible menu is driven **by the backend** `GET /api/v1/navigation` (consumed via the shared
`useNavigation` hook). The backend resolves `Product Tree (by prdt_type) ∩ grants` and returns only
visible nodes — the frontend never decides product membership itself.

- **Top menu** — [`components/layout/topMenu.ts`](../../../components/layout/topMenu.ts) (static presentation)
  + [`hooks/useTopMenuItems.ts`](../../../hooks/useTopMenuItems.ts) (maps the backend tree's depth-0 nodes;
  Banking lands on the **first granted leaf** via `firstRouteInSubtree`, not a hardcoded home).
- **Sidebar** — [`components/layout/Sidebar.tsx`](../../../components/layout/Sidebar.tsx)
  + [`components/layout/sidebarNav.ts`](../../../components/layout/sidebarNav.ts) `buildSidebarGroupsFromTree()`
  maps backend tree → groups/leaves; presentation (icon/label) keyed by node id in `LEAF_PRESENTATION`.
- **Route guard** — edge cookie check in [`proxy.ts`](../../../proxy.ts) + the client guard in
  [`app/(dashboard)/layout.tsx`](../../../app/(dashboard)/layout.tsx) calling
  [`isRouteAllowed`](../../../lib/menuAuth.ts).
- **Product type** for conditional UI — `StoredUser.productType` (`isProductType(user,"F"|"M"|"H")`),
  display/gating only, never a security boundary.

## 2. Sidebar leaf → route → permission map ([lib/menuAuth.ts](../../../lib/menuAuth.ts) `ROUTE_MENU_MAP`)

| Sidebar item | Route | Mapped `permission_cd` | F | M | H |
|---|---|---|:--:|:--:|:--:|
| Account Inquiry (VND) | `/banking/account-inquiry` | `banking-vnd-account-inquiry` | ✅ | ✅ | ✅ |
| Transaction History (VND) | `/banking/transaction-history` | `banking-vnd-inquire-transactions` | ✅ | ✅ | ✅ |
| Account Inquiry (FCY) | `/banking/account-inquiry-fcy` | `banking-fcy-update-inquire` | ✅ | ✅ | ✅ |
| Transaction History (FCY) | `/banking/transaction-history-fcy` | `banking-fcy-inquire-transactions` | ✅ | ✅ | ✅ |
| Own Account Transfer | `/banking/transfer-own-accounts` | `banking-internal-transfer-own` | ✅ | ✅ | ✅ |
| Transfer History | `/banking/transfer-history` | `banking-internal-transfer-history` | ✅ | ✅ | ✅ |
| Daily Cash | `/banking/reports/daily-cash` | `banking-reports-daily-cash` | ✅ | ✅ | ❌ |
| Daily Financial (CMC) | `/banking/reports/daily-financial` | `banking-reports-daily-financial` | ✅ | ✅ | ❌ |
| Daily Financial (HS) | `/banking/reports/daily-financial-hs` | `banking-reports-daily-financial-hs` | ❌ | ❌ | ✅ |
| Cash Flow | `/banking/reports/cash-flow` | `banking-reports-cash-flow` | ✅ | ✅ | ❌ |
| Smart Organizer (VND/FCY) | `/banking/smart-organizer` | **(not mapped — not a menu node)** | n/a | n/a | n/a |

Longest-prefix-first resolution means `…/daily-financial-hs` and `…/account-inquiry-fcy` win over their
shorter siblings. **H sidebar shows Daily Financial (HS) only** under Reports; Daily Cash / CMC / Cash Flow
never render for H because the backend tree excludes them.

## 3. Behavior by case

| Case | Banking top menu | Banking sidebar | Direct-URL route guard |
|---|---|---|---|
| **F** | Visible | All pages except Daily Financial (HS) | Default WeCMS tree |
| **M** | Visible | Same as F | Same as F |
| **H** | Visible | Account Inquiry (VND/FCY), Tx History (VND/FCY), Own Transfer, Transfer History, **Daily Financial (HS)** | Allowed for the H pages; see §6 for the daily-cash/CMC/cash-flow direct-URL note |
| **Admin** | Visible (full product tree) | Every node in the tenant's product tree | `allMenus=true` → `isRouteAllowed` always true |
| **Normal + permission** | Visible if ≥1 banking grant | Only granted leaves (backend already intersected) | `isSectionAllowed` + `isMenuAllowed(routeMenuCd)` |
| **Normal, no permission** | Banking hidden; "no menus" notice if zero grants total | Empty | Blocked → redirect to `firstAllowedRoute()`, or "no menus" notice if none |
| **Person-specific** | Per the user's grants (`allowedMenuCds` from `/auth/me`) | Per-grant | Leaf-code presence check; source of grant is irrelevant |

## 4. Active-state highlight

- **Top menu** ([Header.tsx](../../../components/layout/Header.tsx)): `pathname === activePrefix` or
  `pathname.startsWith(activePrefix + "/")`; Banking prefix `/banking`. ✅ correct for all banking routes
  incl. `/banking/reports/*`.
- **Sidebar** ([Sidebar.tsx](../../../components/layout/Sidebar.tsx) `isBranchActive`): exact or
  `href + "/"` prefix match; expandable parents (Transaction History account children) auto-expand and
  highlight. ✅ `…/daily-financial-hs` correctly highlights the HS item (longest-prefix), and
  `…/transaction-history/{accountId}` keeps the parent highlighted.

## 5. Smart Organizer empty state & CTA

- Page: [`components/banking/smart-organizer/SmartOrganizerPage.tsx`](../../../components/banking/smart-organizer/SmartOrganizerPage.tsx).
  **No sidebar entry** — reached from Transaction History (`?account=…`).
- Empty state (`EmptyState`) renders when there are no eligible rows, with a **"Go to Organizer Settings"**
  CTA that **opens the `OrganizerSettingsDialog` modal** (`setShowSettings(true)`) — it is **not** a route.
- Authorization: the modal's rule CRUD inherits the page context (no separate route guard); backend rule
  CRUD is JWT-auth-only + tenant-scoped (see backend doc §4). So the CTA is reachable/authorized for any
  user who can open the page.

## 6. Gaps / observations

1. **Frontend route guard does not enforce product type** — `isRouteAllowed` checks section + menu-grant,
   not the product tree. An **H admin** (or an H user holding a stale `banking-reports-daily-cash` grant)
   who hand-types `/banking/reports/daily-cash` passes the frontend guard and the page mounts, but the
   backend data call returns **403** (correct). Sidebar/top-menu never surface these for H, so normal
   navigation never reaches them. **Low severity** — backend enforces; defense-in-depth intact. Recommend
   (post-SIT hardening) having the route guard also reject routes absent from the resolved navigation tree.
2. **`/banking/smart-organizer[-fcy]` not in `ROUTE_MENU_MAP`** — falls to conservative section-level allow.
   Consistent with backend (smart-organizer is outside the menu universe); eligible/confirm still 403 if the
   user lacks transaction permission. **Acceptable.**

## 7. Verdict (frontend)

**OK for SIT.** Top menu, sidebar, active-state, and the unauthorized-menu / authorized-blocking behaviors
are correct and consistent with the backend tree for the complete WeCMS product-type set (F / M / H) and
all four permission cases. The two items
in §6 are low-severity hardening recommendations (backend already enforces), not SIT blockers.
