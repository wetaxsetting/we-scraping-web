# Menu Authorization — Test Scenarios (Frontend)

Manual SIT/UAT scenarios for the navigation-tree consumption layer (sidebar, top nav, mobile drawer,
fallback, Settings gating, Menu Entitlement universe). Backend scenarios:
[wecms-api/docs/features/auth/menu-authorization/test-scenarios.md](../../../../../wecms-api/docs/features/auth/menu-authorization/test-scenarios.md).

> **Automated FE tests: MISSING.** There are no Jest / Testing-Library / Playwright tests covering
> `useNavigation`, `useTopMenuItems`, `buildSidebarGroupsFromTree`, or `buildEntitlementSections` today.
> The backend has unit coverage (`NavigationServiceTest`, `MenuAuthorizationServiceTest`, etc.); the
> frontend consumption is **manual-only** for now. Add hook + builder unit tests in a follow-up.

---

## Resolved-tree render

| # | Scenario | Expected |
|---|---|---|
| MA1 (admin-full-tree) | Log in as an admin (`all_menus = true`) | sidebar + top nav show the **full product tree** for the tenant's product type; every group / leaf present; no leaf hidden |
| MA2 (user-filtered-tree) | Log in as a non-admin with a subset of grants | only granted leaves appear; ungranted leaves absent; groups with no granted leaves do not render (collapsed server-side) |
| MA3 (parent-collapse) | A user holds no leaf in a whole group / module | that group / module **does not appear** (empty parent collapsed by the backend; `buildSidebarGroupsFromTree` filters `items.length > 0`) |
| MA4 (product scoping) | Log in as a product-type `H` tenant | **no Add-on module**, no Daily Cash / Cash Flow / e-Invoice leaves anywhere (sidebar, top nav, entitlement editor) |
| MA5 (seq order) | Inspect module + leaf order | top-nav modules and sidebar leaves render in `seq` order from the tree, not a hardcoded order |
| MA6 (Daily Financial split) | F/M tenant vs H tenant | F/M shows `banking-reports-daily-financial`; H shows `banking-reports-daily-financial-hs` (distinct leaves, same label) |

## Active state

| # | Scenario | Expected |
|---|---|---|
| AS1 | Navigate to a leaf route | the sidebar leaf highlights (`bg-wb-bg-active` + `text-brand`); top-nav module highlights via `activePrefix` |
| AS2 | Navigate to a Payment detail page (`…/scheduled-payment/{id}`) | the parent list leaf stays highlighted (`startsWith(href + "/")`); top-nav Payment stays active |
| AS3 | Land on a deep-linked `/banking/transaction-history/{acctSeqNo}` | the matching Transaction History parent auto-expands and the matching account child highlights once the live account list loads |
| AS4 | Expand / collapse a Transaction History parent manually | the user override toggles open state and takes precedence over the auto-open default |

## Caching

| # | Scenario | Expected |
|---|---|---|
| CA1 | Change routes within the session | navigation tree is **not** refetched (per-`bizKey` cache hit); sidebar + top nav stay populated |
| CA2 | Two consumers mount together (`<Header>` + `<Sidebar>`) | `GET /api/v1/navigation` is hit **once** (shared in-flight promise) |
| CA3 | Logout → login as a different tenant in the same tab | tree **refetches** (`cacheKey !== bizKey`); the previous tenant's tree is not shown |

## Settings gating

| # | Scenario | Expected |
|---|---|---|
| SG1 | Admin or user with a `settings-*` grant | the **Settings** top-nav item (and mobile drawer Settings row) appears; clicking opens `<SettingsModal>` (no route change) |
| SG2 | User with no Settings grant and not admin | the Settings item is **absent** from the top nav + drawer |
| SG3 | Settings active style | Settings shows active styling on `activePrefix: "/settings"` even though no `/settings` URL is navigated to |

## Fallback (preview / loading / error)

| # | Scenario | Expected |
|---|---|---|
| FB1 (fallback-on-error) | `GET /api/v1/navigation` fails | no crash; sidebar renders an empty rail (chrome + company header still paint); top nav falls back to the static modules filtered by `isSectionAllowed` |
| FB2 | Tree still loading | same degraded render as FB1; reconciles to the resolved set once the cached tree lands |
| FB3 (preview) | Open a dashboard page with `?preview=1` / no session (`user == null`) | `useTopMenuItems` returns the **full static `topMenuItems`** so chrome paints for a designer without a backend |

## Menu Entitlement universe (Settings > Users)

| # | Scenario | Expected |
|---|---|---|
| ME1 | Open the Menu Entitlement editor as an admin | universe = the **full product tree** leaves + the product-invariant Settings registry; an H admin has no Add-on / Daily Cash / Cash Flow / e-Invoice rows |
| ME2 | Tree unavailable when the editor opens | `buildEntitlementSections(null)` renders **only the Settings section** (no empty chrome) |
| ME3 | Save grants then re-login as the target user | the user's resolved tree (and sidebar / top nav) reflects the new grants on next login |
| ME4 | Confirm mock removal | no `mockMenuEntitlements.ts` import remains; the universe is data-driven from the live tree |

## Cross-cutting

- Verify every visible label resolves via `t(...)` in EN / KO / VI (`nav.*`, `sidebar.*`,
  `settings.users.menu.*`). The client-side language toggle must re-label the nav (presentation keys,
  not the API `label`).
- Verify the frontend never filters the resolved tree by permission — the `∩` is server-side
  (cross-check with the **authorization** module `lib/menuAuth.ts`, which gates route *access*, not nav
  *rendering*).
- No data export and no popover (View Setting) on the navigation shell.
