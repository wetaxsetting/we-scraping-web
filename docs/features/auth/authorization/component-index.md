# Authorization — Component Index (Frontend)

Module / helper / field / guard file map for the frontend authorization framework. Backend mirror:
[wecms-api/docs/features/auth/authorization/source-code-index.md](../../../../../wecms-api/docs/features/auth/authorization/source-code-index.md).

---

## Framework module — [`lib/menuAuth.ts`](../../../../lib/menuAuth.ts)

The whole client-side authorization framework. Pure functions over `StoredUser` + a static route map;
no React, no I/O.

### Constants

| Symbol | Kind | Role |
|---|---|---|
| `ROUTE_MENU_MAP` | `ReadonlyArray<{ prefix; cd: string \| readonly string[]; noLanding? }>` | ~79 entries mapping a route prefix → its granted leaf code(s). Array `cd` = any-of. `noLanding` keeps contextual / cross-section pages (Bank Credentials, Smart Organizer) out of the fallback-home set |
| `SORTED_ROUTE_MAP` | sorted copy | `ROUTE_MENU_MAP` sorted longest-prefix-first so specific routes (`…account-inquiry-fcy`, `…daily-financial-hs`) match before their parents |
| `CD_ROUTE` | `Map<string,string>` | first mapped route per leaf slug (skips `noLanding`); backs `firstAllowedRoute` |

### Exported helpers

| Export | Signature | Behaviour |
|---|---|---|
| `routeSection` | `(pathname) => TopMenuKey \| null` | top-nav module a route belongs to (`/banking`→`banking`, …); `null` for non-module routes |
| `isSectionAllowed` | `(section, user) => boolean` | admin bypass via `allMenus`; else ≥1 granted leaf with `sectionOf(cd) === section`. Drives top-nav + sidebar-group visibility |
| `isMenuAllowed` | `(cd, user) => boolean` | admin bypass; else `allowedMenuCds.includes(cd)` |
| `routeMenuCds` | `(pathname) => readonly string[] \| null` | longest-prefix resolve of a route → its permission code(s) (any-of); `null` for unmapped routes |
| `routeMenuCd` | `(pathname) => string \| null` | back-compat single-slug resolver (first code); prefer `routeMenuCds` for gating |
| `isRouteAllowed` | `(pathname, user) => boolean` | admin → always; non-module route → always; mapped route → any-of leaf check; unmapped module route → `isSectionAllowed` fallback |
| `firstAllowedRoute` | `(user) => string \| null` | first granted leaf that maps to a real route; `null` for an admin (caller uses default home) or a user with no granted route (caller shows "no menus") |

### Internal (not exported)

`cdsOf(cd)` — normalise a route entry's code(s) to an any-of list. `sectionOf(cd)` — top-nav module
from a leaf's first token (`addon-einvoices-sales` → `addon`).

---

## Auth fields — [`StoredUser`](../../../../lib/auth/storage.ts)

The session shape persisted in `wecms_user` localStorage (camelCase, semantic names). Authorization
reads three fields:

| Field | Type | Role |
|---|---|---|
| `allMenus` | `boolean` | admin bypass — `true` ⇒ every menu / route allowed. Populated by `/api/v1/auth/me` (the login response does not carry menus) |
| `allowedMenuCds` | `string[]` | granted leaf permission codes (kebab slugs, e.g. `addon-einvoices-sales`) for a normal user |
| `productType` | `string` | verbatim `BUSI_INFM.PRDT_TYPE` letter for the active company; UX gating only via `isProductType` |

Supporting exports in the same file:

| Symbol | Role |
|---|---|
| `KNOWN_PRODUCT_TYPES` | `["F","M","H"] as const` — the refactor-recognised product types |
| `KnownProductType` | `typeof KNOWN_PRODUCT_TYPES[number]` |
| `UserRole` | `"ADMIN" \| "USER"` — per-session authority within the active company (`role` field) |

> `isProductType(user, "H")` lives in [`lib/auth/client.ts`](../../../../lib/auth/client.ts) (the auth
> boundary), not in `menuAuth.ts`. It validates `user.productType` against `KNOWN_PRODUCT_TYPES`.

---

## Route guard — [`app/(dashboard)/layout.tsx`](<../../../../app/(dashboard)/layout.tsx>)

The single consumer of the framework. `"use client"`.

| Concern | Usage |
|---|---|
| Import | `import { firstAllowedRoute, isRouteAllowed } from "@/lib/menuAuth";` |
| Rehydrate | `fetchMe()` on mount → `StoredUser` (incl. `allMenus`, `allowedMenuCds`, `productType`) — **session-management** |
| Allowed? | `const allowed = !me \|\| isRouteAllowed(pathname, me);` |
| Landing | `const landing = me ? firstAllowedRoute(me) : null;` |
| Enforce | `useEffect` → `if (!allowed && landing) router.replace(landing)` |
| Notice | render `t("nav.no_menus")` when `ready && !allowed && !landing` |

**Roles in the guard:** an `ADMIN` session (`allMenus === true`) passes `isRouteAllowed` for every
route and gets `null` from `firstAllowedRoute` (no redirect). A `USER` session is gated leaf-by-leaf.

---

## Edge guard — [`proxy.ts`](../../../../proxy.ts)

Next.js 16 `proxy` (renamed from `middleware`). Gates **token presence only** — `wecms_token` cookie
present ⇒ pass, missing ⇒ redirect `/login?next=<path>`. It is **not grant-aware** and does not import
`menuAuth.ts`; per-grant enforcement is the client layout guard's job and, authoritatively, the
backend's. The edge guard is documented in full under the sibling **session-management**
([../session-management/component-index.md](../session-management/component-index.md)).

---

## Cross-references

- **Resolved nav tree** (Product Tree ∩ grants) consumed by sidebar / header → sibling
  [../menu-authorization/component-index.md](../menu-authorization/component-index.md).
- **`fetchMe()` + edge guard + 401 re-auth** → sibling
  [../session-management/component-index.md](../session-management/component-index.md).
- **Token storage + Bearer transport** → sibling
  [../jwt-authentication/component-index.md](../jwt-authentication/component-index.md).

## Not used

- **No route of its own** — a framework, not a page.
- **No View Setting, no export, no API client** — `menuAuth.ts` is pure logic over the session shape.
