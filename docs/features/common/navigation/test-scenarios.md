# Navigation — Test Scenarios (Frontend)

**Part of:** Common → navigation
**Last verified:** 2026-06-23

What to verify for the frontend navigation surfaces. These are **manual / future-test** scenarios — no
automated frontend test for navigation was found this pass (⚠️ UNVERIFIED: no `useNavigation`/`Sidebar`
test file located). The backend resolution is covered by `NavigationServiceTest` (see the API twin).

## Tree render per product

| Scenario | Expect |
|---|---|
| F tenant (admin) | Sidebar shows the full F groups; top nav shows Banking / Payment / Add-on + Settings; Daily Financial group shows the **standard** report (not `-hs`). |
| M tenant (admin) | Same structure as F; labels follow the M VI/KO translation rows where they diverge (server-resolved, then frontend re-labels via `labelKey`). |
| H tenant (admin) | Sidebar reduced — **no Add-on top menu**; Reports shows **Daily Financial (HS)** only (no Daily Cash / standard Daily Financial / Cash Flow). |
| Non-admin, partial grants | Only granted leaves appear; a module whose leaves are all ungranted is absent from both sidebar and top nav (server-collapsed). |
| No grants (non-admin) | Empty rail; top nav shows only Settings if `settings-*` is granted, else nothing extra. |

## Active highlighting

| Scenario | Expect |
|---|---|
| Land on a leaf route | That `SidebarMenuItem` paints `bg-wb-bg-active` + `text-brand`; the top-nav module paints the white tab. |
| Land on a detail sub-route (`/payment/.../[id]`) | The leaf stays active (prefix match `startsWith(href + "/")`); the module stays active. |
| Branch with a selected child | Parent group auto-expands and reads on-branch; the matched child is highlighted. |

## Nested expand (Transaction History)

| Scenario | Expect |
|---|---|
| Expand a TX-History parent | Chevron rotates to open; live account children render from `/banking/accounts`; parent row does **not** navigate. |
| Deep-link to `/banking/transaction-history/{acctSeqNo}` | Group auto-expands; the matching account child highlights once the account list resolves. |
| User collapses an auto-opened branch | User toggle overrides the auto-open set; stays collapsed until toggled again. |

## Permission-filtered items / module switcher

| Scenario | Expect |
|---|---|
| Top-nav module link | Lands on the user's **first granted** leaf route (`firstRouteInSubtree`), not the static module home — a user without the default leaf isn't bounced by the route guard. |
| Mobile MENU switcher | Shows the same modules as the desktop top nav (both via `useTopMenuItems`) — lockstep. Settings opens the modal and closes the drawer. |
| Route guard on a disallowed direct URL | `isRouteAllowed(pathname, user)` false → redirect to `firstAllowedRoute(user)` (admins bypass). |

## States / degrade

| Scenario | Expect |
|---|---|
| Loading | Sidebar empty rail; top nav shows static modules filtered by section grant until the tree lands. |
| Fetch error | Empty rail; no crash; no hardcoded per-product fallback rail. |
| `?preview=1` / no session | Top nav shows the full static module list (chrome preview). |
| Logout → login as a different tenant (same tab) | Tree refetches (cache key = `bizKey` changed); new product's tree renders. |
| Language toggle | Labels re-render via `labelKey` → `locales/{en,ko,vi}.json` without refetching the tree (presentation registry, not the API `label`). |
