# Authorization — Screen Flow (Frontend)

How a session's grants gate route access. This is a logic flow, not a screen flow — there is no
dedicated authorization page. Backend flow:
[wecms-api/docs/features/auth/authorization/business-flow.md](../../../../../wecms-api/docs/features/auth/authorization/business-flow.md).

```
Edge:  proxy.ts — wecms_token cookie present?  ──no──▶ redirect /login?next=<path>   (session-management)
          │ yes
          ▼
Mount: app/(dashboard)/layout.tsx
          │  fetchMe()  →  StoredUser { allMenus, allowedMenuCds[], productType, role, … }
          ▼
Guard:  isRouteAllowed(pathname, me)
          │
          ├─ me.allMenus === true ───────────────────────────────▶ ALLOW (admin bypass)
          │
          ├─ routeSection(pathname) === null (e.g. "/") ─────────▶ ALLOW (non-module route)
          │
          ├─ routeMenuCds(pathname) resolves (mapped route) ─────▶ ALLOW iff some(cd ∈ allowedMenuCds)
          │
          └─ unmapped module route ─────────────────────────────▶ ALLOW iff isSectionAllowed(section, me)
          │
          ▼
   allowed ?  ──yes──▶ render <AppShell>{page}</AppShell>
              └─no───▶ firstAllowedRoute(me)
                          ├─ a granted route exists ──▶ router.replace(landing)
                          └─ none (no granted route) ──▶ render nav.no_menus notice (no redirect loop)
```

---

## Resolution steps (route → menu code → allowed?)

1. **Admin bypass.** `me.allMenus === true` short-circuits every helper — `isMenuAllowed`,
   `isSectionAllowed`, `isRouteAllowed`, all return `true`. `firstAllowedRoute` returns `null` for an
   admin (the caller uses the default home, not a granted-leaf landing).
2. **Section of the route.** `routeSection(pathname)` maps a URL prefix to a top-nav module
   (`/banking` → `banking`, `/payment` → `payment`, `/addon` → `addon`, `/settings` → `settings`).
   A route with no section (e.g. `/`, profile shell) is **never gated** — `isRouteAllowed` returns `true`.
3. **Route → permission code(s).** `routeMenuCds(pathname)` walks `SORTED_ROUTE_MAP`
   (longest-prefix-first) and returns the matched entry's leaf code(s). Longest-prefix-first is what lets
   `…account-inquiry-fcy` win over the shorter `…account-inquiry`, and `…daily-financial-hs` win over
   `…daily-financial`.
4. **Any-of leaf check.** A mapped route is allowed iff the user holds **at least one** of its codes
   (`cds.some(cd => isMenuAllowed(cd, user))`). This is authoritative **across sections**: a `/banking`
   URL gated by a `settings-*` code (Bank Credentials) or admitted by either VND **or** FCY
   inquire-transactions (Smart Organizer) resolves by leaf code, not by the URL prefix.
5. **Unmapped-route fallback.** A module route not in `ROUTE_MENU_MAP` falls back to the coarse
   section gate — allowed iff the user holds any leaf in that module (`isSectionAllowed`). This never
   false-blocks a page that was simply not mapped.

---

## Top-nav + sidebar visibility (consumes the same helpers)

| Surface | Helper | Behaviour |
|---|---|---|
| Top-nav module | `isSectionAllowed(section, user)` | module shows iff `allMenus` **or** ≥1 granted leaf belongs to the module (`sectionOf(cd) === section`) |
| Sidebar item | `isMenuAllowed(cd, user)` (via the resolved nav tree) | a leaf shows iff its code is granted |
| Direct URL hit on an ungranted page | `isRouteAllowed` in the layout guard | redirect to `firstAllowedRoute` (or "no menus") |

> The **resolved nav tree** (Product Tree ∩ grants, parents collapsing when all children are filtered)
> is server-side work documented under the sibling **menu-authorization** —
> [../menu-authorization/screen-flow.md](../menu-authorization/screen-flow.md). `lib/menuAuth.ts` is the
> client-side **route + section** half; it maps slugs → routes/modules so a direct URL hit can be gated.

---

## Product-type UX gating

`StoredUser.productType` is the verbatim `BUSI_INFM.PRDT_TYPE` letter for the active company, echoed
from the JWT claim by `/api/v1/auth/me`. `KNOWN_PRODUCT_TYPES = ["F","M","H"]`; other legacy letters
round-trip verbatim but are not in the union. Pages gate product-specific UX via `isProductType(user, "H")`
(from `lib/auth/client.ts`) — the canonical example is the Login Credentials Select-Bank-Accounts popup,
which hides the VAS Code / VAS Account Name columns for product type `H`
(`showVas = !isProductType(userStorage.get(), "H")`).

```
productType gate:  isProductType(user, "H") ?  ──true──▶ render H-specific UX (or hide F/M-only UI)
                                                └─false──▶ render F/M UX
```

- **UX only.** Product-type branching changes what the UI shows; it does **not** authorize data access.
  The backend reads the product type from `TenantContext.currentPrdtType()` (signed JWT), never from a
  client-sent value, and enforces the product-tree gate server-side (see
  [api-consumption.md](api-consumption.md) and the backend `PrdtType` / `MenuAuthorizationGuard`).
- Distinct from the menu-code gate: the menu-code gate decides whether a route renders at all; the
  product-type gate decides which **variant** of a rendered page's UI shows.

---

## Security notes (frontend)

- The layout guard runs in a `"use client"` component, so it is **defeatable** (disable JS, edit
  `localStorage`). It is a UX convenience, not a control. The authoritative gates are `proxy.ts` at the
  edge (token presence) and the backend `@menuAuthz` / `hasRole('ADMIN')` + JWT verification on every
  endpoint.
- A blocked route renders **nothing** while the guard redirects — the page component never mounts, so
  no ungranted data is fetched client-side.
- `firstAllowedRoute` returning `null` for a user with zero granted routes is deliberate: the layout
  renders the `nav.no_menus` notice instead of redirecting, avoiding a redirect loop.
