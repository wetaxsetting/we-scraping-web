# navigation — API Consumption (Frontend)

**Part of:** Common → navigation
**Last verified:** 2026-06-23

## Endpoint

`GET /api/v1/navigation` — JWT auto-attached by the Axios interceptor. **No request params** — the product
type comes from the signed JWT server-side, never a client argument.

Client: `fetchNavigation()` (`lib/api/navigation.ts:97-112`). Unwraps `ApiResponse<ApiNavigationResponse>`,
throws `ApiCallError(code, message)` on `status.error` / network failure so `useNavigation` can degrade.

## Fetch-once-at-mount

`useNavigation()` (`hooks/useNavigation.ts`):

- Fetches **once per session**, caches the tree in module memory keyed by `bizKey` (`:22-31`).
- The sidebar lives in `<AppShell>` and only remounts on a full logout→login, so route changes reuse the
  cache — no refetch.
- A logout→login as a **different tenant** in the same tab refetches (cache key changed).
- Concurrent consumers (`Sidebar` + `Header` + mobile MENU) share one in-flight promise (`:61-65`).
- `clearNavigationCache()` is the test / login-flow seam to drop the cache.

```ts
const { tree, loading, error } = useNavigation();
// tree: NavigationTree | null
```

## Wire → in-memory mapping

snake_case wire → camelCase in-memory at the boundary (`navigation.ts:46-90`):

| Wire (`ApiNavigationResponse` / `ApiMenuNode`) | In-memory (`NavigationTree` / `MenuNode`) |
|---|---|
| `product_type` | `productType` |
| `menu_group_id` | `menuGroupId` |
| `top_menus[]` | `topMenus[]` |
| `id` | `id` |
| `permission_cd` | `permissionCd` |
| `parent_id` | `parentId` |
| `depth` / `seq` | `depth` / `seq` |
| `label` | `label` |
| `route` / `icon` | `route` / `icon` |
| `legacy_mnu_id` / `legacy_wsvc_id` | `legacyMnuId` / `legacyWsvcId` |
| `children[]` (recursive) | `children[]` |

## Tree → render-model mapping

- **Sidebar** — `buildSidebarGroupsFromTree(tree, pathname, { vnd, fcy })` (`sidebarNav.ts:153-175`):
  picks the active module root by URL prefix, maps its depth-1 children to `NavGroup`s and depth-2 leaves
  to `NavItem`s, applying the presentation registry (label key / icon / badge). Live Transaction History
  account children are injected from `/banking/accounts` (the API leaf carries none). Empty / no-module →
  `[]`.
- **Top nav** — `useTopMenuItems(user)` walks `tree.topMenus`, maps each via `NODE_ID_TO_TOP_MENU_KEY`,
  lands each module link on `firstRouteInSubtree(node) ?? item.href`, then appends Settings.

> The frontend deliberately does **not** render the API's `label` (resolved from the JWT language — would
> not follow the client toggle) or `icon` (legacy export hint, not an asset path). It keeps `labelKey` →
> `locales/{en,ko,vi}.json` + the `/assets/sidebar/*.svg` registry. Structure, ordering, routes, and
> visibility all come from the API.

## Degrade / fallback

| Condition | Behaviour |
|---|---|
| Loading / error (`tree == null`, user present) | Sidebar → empty rail (chrome still paints); top nav → static modules filtered by `isSectionAllowed` until the cached tree lands. **No hardcoded per-product fallback.** |
| `?preview=1` / no session (`user == null`) | top nav → full static module list (`topMenuItems`) so designers can preview chrome without the backend. |
| `WBE1401` (unauthenticated) | surfaces as `ApiCallError`; the global 401 interceptor handles session expiry. |

## Related endpoints (separate concerns)

- `/auth/me` supplies `StoredUser.allMenus` / `allowedMenuCds` consumed by `lib/menuAuth.ts` route guards
  — **not** the navigation tree.
- Server-side per-menu enforcement (`@menuAuthz`) is backend-only; the frontend guards are a UX
  convenience over the authoritative server gate.
