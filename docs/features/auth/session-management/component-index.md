# Session Management — Component Index (Frontend)

File map for the frontend session lifecycle. Backend mirror:
[wecms-api/docs/features/auth/session-management/source-code-index.md](../../../../../wecms-api/docs/features/auth/session-management/source-code-index.md).

---

## Core files

| File | Role |
|---|---|
| [`lib/auth/client.ts` → `fetchMe()`](../../../../lib/auth/client.ts) | `GET /api/v1/auth/me`; unwraps the `ApiResponse<MeResponseRec>` envelope, throws `LoginError` on `status.error` / malformed shape, and maps the snake_case wire → camelCase `StoredUser` via `toStoredUser()` (includes `allMenus` / `allowedMenuCds` / `taxId`). |
| [`app/(dashboard)/layout.tsx`](../../../../app/(dashboard)/layout.tsx) | `"use client"` dashboard shell. On mount: `fetchMe()` rehydrate → `userStorage.set` + `setReady(true)`, or clear storage + `router.replace("/login")` on failure. Route-allowed gate (`isRouteAllowed` / `firstAllowedRoute`) → `<AppShell>` / redirect / "no menus" notice. Mounts `<SessionExpiredDialog>` unconditionally. **Auth gating itself is delegated to `proxy.ts`** — the layout does not re-gate. |
| [`proxy.ts`](../../../../proxy.ts) | Next.js 16 edge middleware (renamed from `middleware`). **Single source of truth for route protection.** `/login` (+ `/login/*`) public; every other matched route requires the `wecms_token` cookie; missing → `307` `/login?next=<pathname><search>`. `matcher` excludes `_next/*`, `favicon.ico`, `assets/`, `images/`, `templates/`, and static asset extensions. |
| [`lib/axios.ts` → response interceptor](../../../../lib/axios.ts) | Catches HTTP 401 on the shared `api` instance. Rejects as-is when `status !== 401` / no `config` / `config._isRetry` / `isAuthEndpoint(url)` (`/auth/login`, `/auth/logout`). Otherwise `await requestReAuth()` → on `"re_authenticated"` set `config._isRetry = true` and `api.request(config)` (retry once); else reject. The request interceptor (same file) attaches `Authorization: Bearer <wecms_token>` — owned by **jwt-authentication**. |
| [`components/auth/SessionExpiredDialog.tsx`](../../../../components/auth/SessionExpiredDialog.tsx) | Global re-auth controller. Subscribes via `onReAuthRequest`; renders the shared `<PasswordConfirmationDialog>` (lock screen) at `stackLevel={5}`, `showClose={false}`. Submit → `login(userId, password, bizKey)` → set token/user + `resolveReAuth("re_authenticated")`; cancel (ESC) → clear storage + `resolveReAuth("cancelled")` + hard redirect to `/login`. Errors routed through `useDialog()`. Includes the `?preview=session-expired` dev rehearsal mode. |
| [`lib/auth/sessionExpired.ts`](../../../../lib/auth/sessionExpired.ts) | The re-auth event bus. `requestReAuth(): Promise<ReAuthOutcome>` (called by the interceptor), `onReAuthRequest(fn)` (subscribed by the dialog), `resolveReAuth(outcome)` (called by the dialog), `isReAuthPending()`. Concurrent 401s collapse to one in-flight promise + one open dialog. |

---

## Types & helpers consumed (owned elsewhere)

| Symbol | Home | Role here |
|---|---|---|
| [`MeResponseRec`](../../../../lib/types/api.ts) | `lib/types/api.ts` | `/me` wire shape — auth fields `+ all_menus + allowed_menu_cds`, `tax_id` re-queried each call. See [api-consumption.md](api-consumption.md). |
| [`StoredUser`](../../../../lib/auth/storage.ts) | `lib/auth/storage.ts` | In-memory camelCase user; `fetchMe()` writes it via `userStorage.set`. |
| [`tokenStorage` / `userStorage`](../../../../lib/auth/storage.ts) | `lib/auth/storage.ts` | Token cookie (`wecms_token`, `Max-Age=3600`) + user JSON. **Token storage / transport = jwt-authentication module.** |
| [`isRouteAllowed` / `firstAllowedRoute`](../../../../lib/menuAuth.ts) | `lib/menuAuth.ts` | Route-allowed gate consumed by the dashboard layout. **Route gating helpers = authorization module.** |
| [`useDialog()`](../../../../components/shared/dialog) | `components/shared/dialog` | Re-auth error toasts (`type: "error"`, `z-[100]`). |
| [`useTranslation()`](../../../../lib/i18n) | `lib/i18n` | `session.*` + `nav.no_menus` + `dialog.error` keys. |

---

## Cross-links

- **Token cookie + Bearer transport:** [../jwt-authentication/](../jwt-authentication/)
- **Route gating helpers (`menuAuth.ts`):** [../authorization/](../authorization/)
- **Login (`login()` reused by the lock screen):** [../login/README.md](../login/README.md)
- **Logout:** [../logout/README.md](../logout/README.md)

---

## Not used

- **No route** — session management has no page of its own; it is layout + middleware + interceptor.
- **No View Setting / export / pagination.**
- **No refresh-token logic** — the backend is stateless; re-auth is a full re-login (MISSING refresh
  tokens, deferred — see backend).
