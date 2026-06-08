# Add-on Service — Menu / Route / Sidebar Authorization (Frontend)

**System:** Refactor (wecms-web) · **Status:** Verified against source 2026-06-06 · **Scope:** the **Add-on Service** top menu and the left menus **Sales e-Invoices** (`/addon/sales-einvoices`), **Expenses e-Invoices** (`/addon/expenses-einvoices`), **Operation Status Inquiry** (`/addon/operation-status`).

This doc records how the Next.js frontend shows/hides the Add-on Service menu, guards its routes, and highlights the active item, per product type (H / W / M / F) and per user permission. Backend counterpart: `wecms-api/docs/features/addon-service/authorization-and-product-type.md` (the API is the security authority; the frontend is presentation + client routing).

---

## 1. Sources of truth

- **Navigation tree** — `GET /api/v1/navigation` via `useNavigation()`. The backend selects the tree from the session's `prdt_type` (signed JWT) and returns the **already-resolved visible tree** (`Product Tree ∩ grants` for a normal user; full Product Tree for an admin). The frontend never reconstructs visibility — it renders what the tree contains.
- **`StoredUser`** — `allMenus` (admin bypass) + `allowedMenuCds` (granted leaf slugs) from `/auth/me`. `productType` is the raw `BUSI_INFM.PRDT_TYPE` letter, kept for **UI/display only — never a security boundary** (`lib/auth/storage.ts`, `KNOWN_PRODUCT_TYPES = ["F","M","H"]`).
- **`lib/menuAuth.ts`** — route ↔ permission-code map and the client route guard.

Route → permission code (`ROUTE_MENU_MAP`):

| Route | Permission code |
|---|---|
| `/addon/sales-einvoices` | `addon-einvoices-sales` |
| `/addon/expenses-einvoices` | `addon-einvoices-expenses` |
| `/addon/operation-status` | `addon-operation-status-inquiry` |

---

## 2. Top menu visibility (`useTopMenuItems` + `topMenu.ts`)

The Add-on Service top-menu item (`key: "addon"`, `activePrefix: "/addon"`) renders **only when the resolved navigation tree contains the `addon-service` node**. `NODE_ID_TO_TOP_MENU_KEY` maps `"addon-service" → "addon"`; the hook iterates `nav.tree.topMenus` and includes a module only if its node is present. The module link lands on the first granted leaf route in the subtree (`firstRouteInSubtree`).

- The backend omits `addon-service` from the H tree and from any unmodelled-product / empty tree → the top menu **does not render** for those sessions.
- Loading / error / `?preview=1` (no session): the hook falls back to the static module list filtered by `isSectionAllowed("addon", user)` so the nav is never blank — but once the tree resolves it reconciles to the product-scoped set.

## 3. Sidebar (`sidebarNav.ts`)

`buildSidebarGroupsFromTree(tree, pathname, accounts)` renders the Add-on left menu strictly from the tree. For `/addon/*` it finds the `addon-service` root; if absent (H / empty tree) it returns `[]` (empty rail). Group/leaf **presentation** (label key, icon) is keyed by stable menu-item id:
- Groups: `addon-einvoice` → "E-Invoices"; `addon-operation-status` → "Operation Status".
- Leaves: `addon-sales-einvoice`, `addon-expense-einvoice`, `addon-operation-status-inquiry`.

Only nodes present in the tree render — a normal user who lacks a grant never sees that leaf (the backend already filtered it).

## 4. Route guard (`app/(dashboard)/layout.tsx` + `isRouteAllowed`)

On mount the layout calls `/auth/me`, then evaluates `isRouteAllowed(pathname, me)`:

```
admin (allMenus)        → always allowed
no section match        → allowed (non-module routes)
section not allowed     → blocked → redirect to firstAllowedRoute()
section allowed + leaf  → isMenuAllowed(cd) precise check
```

`isSectionAllowed("addon", user)` = admin OR the user holds ≥1 `addon-*` leaf. A blocked route redirects to the user's first allowed route; a user with **no** granted route sees a "no menus" notice instead of looping.

---

## 5. Expected behaviour per product type

### F (WeCMS Default) / M (WeCMS Lumens) — Add-on **VISIBLE**

Tree carries `addon-service` + leaves (subject to grants). Top menu, sidebar, and routes behave normally.

### H (HAENGSUNG) — Add-on **NOT SHOWN**

Backend tree omits Add-on → top menu hidden, sidebar empty for `/addon/*`. A normal H user typing `/addon/sales-einvoices` directly is blocked by the guard (`isSectionAllowed("addon")` false → redirect).

### W (WABOOKS Default) / unmodelled letters

`KNOWN_PRODUCT_TYPES` is `["F","M","H"]` — `W` is unknown. Backend returns an empty tree → no top menus render (only Settings if granted). `isProductType(user,"W")` would warn and return false. See the backend doc §1/§5 — a `W` tenant effectively has no app. **Confirm with PO whether "W" means the WeCMS default (`F`) or the literal WABOOKS product.**

---

## 6. Permission behaviour (admin / normal-with / normal-without) on F/M

| Caller | Top menu | Sidebar leaf | Direct route hit |
|---|---|---|---|
| **Admin** | Add-on shown (full tree) | all 3 leaves | allowed (frontend) — but see §7 |
| **Normal WITH grant** (e.g. `addon-einvoices-sales`) | Add-on shown | only granted leaves | granted route allowed; ungranted Add-on route → redirect |
| **Normal WITHOUT any Add-on grant** | Add-on hidden | empty | redirect to first allowed route |

## 7. Gap found — frontend route guard is **not product-type-aware** (low severity)

`isRouteAllowed` returns `true` for any route when `user.allMenus` is set (admin). It is purely grant/section based and **does not consult `productType`**. Consequence: an **H admin** who manually types `/addon/sales-einvoices` passes the client guard and the page **shell renders**, then the page's data fetch hits the backend and gets **403 / `WBE1003`** (the backend product-tree gate is authoritative).

- **No data is exposed** — the backend denies the API call; the user sees an error dialog, not e-Invoice data.
- It is a cosmetic inconsistency (blank page shell + error) reachable only by an H **admin** manually typing an Add-on URL, since the menu/sidebar never link there.

**Fix plan (optional, not SIT-blocking):** make the dashboard guard product-aware for non-tree routes by checking the resolved `nav.tree` (or a `productType`-derived allow-set) before rendering `/addon/*` for admins — redirect to `firstAllowedRoute()` / home when the active product tree has no `addon-service`. Because the menu never surfaces the link and the backend already returns 403, this is a polish item; track it but it does not block SIT.

No blocked-valid-route issue was found: authorized F/M users (admin or granted normal) reach all three Add-on routes, and active-menu highlighting (`activePrefix: "/addon"` for the top nav, `usePathname()` match for the sidebar) is correct.

---

## 8. Verdict

- **Frontend menu / route / sidebar authorization for Add-on Service is correct and SIT-ready for F, M, H** and for the admin / normal-with / normal-without cases — visibility is driven entirely by the backend-resolved navigation tree, with no unauthorized exposure and no blocked valid route for authorized users.
- **Two follow-ups, neither SIT-blocking:** (1) the §7 admin-only client route-guard polish (no data leak), and (2) the **"W" naming clarification** shared with the backend doc — confirm whether `W` means the WeCMS default (`F`, already correct) or the WABOOKS product (unmodelled).

## 9. Source files checked

- `lib/menuAuth.ts`
- `hooks/useTopMenuItems.ts` · `components/layout/topMenu.ts`
- `components/layout/sidebarNav.ts`
- `app/(dashboard)/layout.tsx`
- `lib/auth/storage.ts` · `lib/auth/client.ts` · `lib/api/navigation.ts`
- `app/(dashboard)/addon/{sales-einvoices,expenses-einvoices,operation-status}/page.tsx`

Backend counterpart: `wecms-api/docs/features/addon-service/authorization-and-product-type.md`.
