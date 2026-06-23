# Authorization — API Consumption (Frontend)

The authorization framework ([`lib/menuAuth.ts`](../../../../lib/menuAuth.ts)) makes **no HTTP calls of
its own** — it is pure logic over the session shape. Its inputs are supplied by other auth features.
This doc records where those inputs come from and states the **security boundary**: frontend gating is
UX only; the backend is authoritative. Backend contract:
[wecms-api/docs/features/auth/authorization/interface-specification.md](../../../../../wecms-api/docs/features/auth/authorization/interface-specification.md).

---

## Where the inputs come from (no direct calls)

| Input | Source | Cross-link |
|---|---|---|
| `allMenus` | `GET /api/v1/auth/me` response (`all_menus`) | sibling **session-management** |
| `allowedMenuCds[]` | `GET /api/v1/auth/me` response (`allowed_menu_cds`) | sibling **session-management** |
| `productType` | `StoredUser.productType` — set from the login + `/me` response (`prdt_type`), echoed from the signed JWT claim | sibling **session-management** / **jwt-authentication** |

```
GET /api/v1/auth/me                                    (session-management — fetchMe)
   → ApiResponse<MeResponseRec> {
        … user_id, user_nm, biz_key, lang_cd, cmpn_nm, auth_gr_cd, prdt_type, tax_id,
        all_menus,            // → StoredUser.allMenus
        allowed_menu_cds[]    // → StoredUser.allowedMenuCds[]
     }
   → toStoredUser / fetchMe maps snake_case → camelCase  (lib/auth/client.ts)
   → userStorage.set(StoredUser)   (wecms_user localStorage)
        │
        ▼
lib/menuAuth.ts reads StoredUser.{allMenus, allowedMenuCds, productType}  — no network
```

- **Admin** session: `all_menus = true` + empty `allowed_menu_cds` — every helper returns `true`.
- **User** session: `all_menus = false` + the granted kebab slugs.
- `auth_gr_cd` / `prdt_type` are echoed from the **signed JWT** (issued at login), never trusted from a
  client-sent value.

Wire format is lowercase snake_case (`all_menus`, `allowed_menu_cds`, `prdt_type`); the translation to
the camelCase `StoredUser` (`allMenus`, `allowedMenuCds`, `productType`) happens once at the auth
boundary in [`lib/auth/client.ts`](../../../../lib/auth/client.ts). The full `MeResponseRec` wire shape
+ envelope is documented in the sibling
[../session-management/api-consumption.md](../session-management/api-consumption.md).

---

## Security boundary — FE gating is UX only

> **The frontend authorization framework is a UX convenience, not a security control.** Every gate it
> applies is also — and authoritatively — applied by the backend. A user who edits `localStorage`
> (`wecms_user.allMenus = true`), disables JavaScript, or calls an API directly is still blocked
> server-side.

| Layer | Mechanism | Authoritative? |
|---|---|---|
| **Frontend** (`lib/menuAuth.ts` + layout guard) | `isRouteAllowed` / `isSectionAllowed` / `isMenuAllowed` over `StoredUser`; redirect / hide ungranted UI | ❌ UX only — defeatable client-side |
| **Edge** (`proxy.ts`) | `wecms_token` cookie presence → `/login` redirect | partial — token presence, not grants |
| **Backend** (`@menuAuthz` / `hasRole`) | `@PreAuthorize("@menuAuthz.canAccess('…')")` on 30 of 43 controllers; `hasRole('ADMIN')` + `@userMgmtAccess` stacked; deny-or-declared coverage test | ✅ **authoritative** |
| **Backend** (JWT) | `JwtAuthenticationFilter` verifies the signed token; `authGrCd` / `prdtType` read from claims, never client | ✅ authoritative |

**Product type:** `StoredUser.productType` drives UI display + variant gating only. The backend reads
the product type from `TenantContext.currentPrdtType()` (signed JWT claim) and enforces the product-tree
membership gate (`PRODUCT_MENU` for the current product) in `MenuAuthorizationGuard.canAccess(...)` — it
**never** trusts a frontend-sent product type outside the login response. See
[wecms-api/docs/features/auth/authorization/](../../../../../wecms-api/docs/features/auth/authorization/README.md)
(`@menuAuthz`, `PrdtType`, `SecurityConfig`).

---

## Permission-code contract

- The leaf codes in `allowedMenuCds[]` are **kebab-case slugs** (`addon-einvoices-sales`,
  `banking-vnd-account-inquiry`, `settings-core-login-credentials`) — the same ids the Menu Entitlement
  screen writes (`USER_MENU_AUTH_INFM.WEB_SVC_ID`) and the backend `@menuAuthz.canAccess('…')` checks.
- They are **never** legacy JEX WSVC ids (`comm_0220_001`, `fnsh_0001_001`). Legacy ids appear only as
  `file:line` citations or migration-traceability prose.
- `ROUTE_MENU_MAP` in `menuAuth.ts` is the frontend's route-prefix → code(s) binding; the codes must
  match the backend seed (e.g. `banking-reports-daily-financial-hs` matches the V243 product-menu seed)
  so a user's grant + the route guard resolve to the same code. A drift between the FE map and the
  backend seed is a paired-change bug (full-stack ownership rule).

---

## Error handling

This framework surfaces **no API errors of its own** (it makes no calls). The relevant failure paths are
owned by siblings:

- **401 / session expired** on any authenticated call → global Axios response interceptor → re-auth
  dialog (sibling **session-management**, [../session-management/api-consumption.md](../session-management/api-consumption.md)).
- **403 access denied** (`WBE1003`) from a backend `@menuAuthz` rejection → the standard error envelope;
  the FE normally prevents reaching an ungranted endpoint via route + nav gating, so a 403 here means FE
  and backend grant sets have drifted.
- **`/me` failure** at mount → the layout clears storage and bounces to `/login` (session-management).

---

## Notes

- **No mock fallback** — there is nothing to mock; the framework is deterministic over the session shape.
- **No export, no View Setting, no data fetch** in this scope.
- Keep the FE `ROUTE_MENU_MAP` codes and the backend permission-code seed in lockstep — change both in
  the same MR per the cross-tree paired-change rule.
