# Session Management — Screen Flow (Frontend)

Interaction flow for the frontend session lifecycle. Backend flow:
[wecms-api/docs/features/auth/session-management/business-flow.md](../../../../../wecms-api/docs/features/auth/session-management/business-flow.md).

---

## App load → edge guard → mount rehydrate → route-allowed check

```
Browser navigates to any URL
      │
      ▼
proxy.ts  (Next.js 16 edge middleware — SINGLE source of truth for auth gating)
      │  pathname === "/login" or "/login/..."   → NextResponse.next()  (public)
      │  else: request.cookies.has("wecms_token")
      │           ├─ yes → NextResponse.next()
      │           └─ no  → redirect /login?next=<pathname><search>   (target "/" not appended)
      ▼
(dashboard) route renders → app/(dashboard)/layout.tsx mounts  ["use client"]
      │  useEffect on mount:
      │      fetchMe()  →  GET /api/v1/auth/me   (Bearer wecms_token via axios request interceptor)
      │           ├─ success → userStorage.set(meResp); setMe(meResp); setReady(true)
      │           └─ failure → tokenStorage.clear(); userStorage.clear(); router.replace("/login")
      ▼
Route-allowed check  (authorization helpers — lib/menuAuth.ts)
      │  allowed = !me || isRouteAllowed(pathname, me)
      │  landing = me ? firstAllowedRoute(me) : null
      │      ├─ ready && allowed              → <AppShell>{children}</AppShell>
      │      ├─ ready && !allowed && landing  → router.replace(landing)         (redirect)
      │      └─ ready && !allowed && !landing → "no menus" notice  t("nav.no_menus")
      ▼
<SessionExpiredDialog /> mounted UNCONDITIONALLY (always present, idle until a 401 fires)
```

- The layout's **only** job is rehydration + the route-allowed gate. Auth gating already happened at
  the edge — by the time the layout renders, the request passed the `wecms_token` cookie check.
- `fetchMe()` is the source of truth for the in-memory `StoredUser`: it refreshes the sidebar / profile
  / menu chrome even after a cookie refresh, and detects a server-revoked / rotated token (failed `/me`
  → clear + bounce).
- The route-allowed check is owned by the **authorization** module (`isRouteAllowed` /
  `firstAllowedRoute` in `lib/menuAuth.ts`); session-management consumes it. Admins (`allMenus`) and
  non-module routes (`/`) always pass.

---

## 401 → session-expired dialog → re-auth → retry

```
Any authenticated call returns HTTP 401  (incl. the page-load /me)
      │
      ▼
lib/axios.ts response interceptor (rejection branch)
      │  reject as-is when:  status !== 401  |  no config  |  config._isRetry  |
      │                       isAuthEndpoint(url)   (/auth/login, /auth/logout)
      │  otherwise:
      ▼
requestReAuth()  (sessionExpired.ts bus)  → returns a Promise<"re_authenticated" | "cancelled">
      │  concurrent 401s collapse onto ONE in-flight promise + ONE open dialog
      ▼
onReAuthRequest handler fires → <SessionExpiredDialog> opens (lock screen)
      │  shared <PasswordConfirmationDialog>, stackLevel={5}, no close button
      │  renders companyName + companyId (tax_id) + userEmail from userStorage
      │
      ├─ user types password + submits (Enter)
      │      login(user.userId, password, user.bizKey)   ← re-auths at the SAME company
      │           ├─ success (kind "authenticated") → tokenStorage.set; userStorage.set;
      │           │        resolveReAuth("re_authenticated"); close()
      │           │        ▼
      │           │   interceptor: config._isRetry = true; api.request(config)   ← RETRY ONCE
      │           │        ├─ 200 → original caller resolves normally
      │           │        └─ 2nd 401 → _isRetry guard → reject(error)  (no second dialog)
      │           ├─ wrong password / WBE1009 → useDialog() error dialog (z-[100]); stay open
      │           └─ kind "chooser" (membership changed) → resolveReAuth("cancelled"); close()
      │
      └─ user cancels (ESC)
             tokenStorage.clear(); userStorage.clear(); resolveReAuth("cancelled");
             window.location.assign("/login")
             ▼
        interceptor: outcome !== "re_authenticated" → reject(error)
```

- **`/auth/me` is intentionally NOT excluded** from the interceptor — a token that expired in the
  background while the tab was idle surfaces the re-auth popup at the next page load rather than
  silently bouncing to `/login`. This mirrors the legacy JEX lock-screen trigger
  (`jex.wabooks.custom_v2.js:91-117`, `comm_0300_001`). **MATCH.**
- **`/auth/login` + `/auth/logout` ARE excluded** — a wrong-password attempt inside the popup
  legitimately returns 401 (`WBE1009`) and must not recursively re-open the dialog.
- **`_isRetry`** is set on the retried request so a second 401 falls through to the caller — a
  permanently broken token surfaces the original error instead of an infinite dialog loop.
- The lock screen re-auths at the user's **current company** (`user.bizKey`) — even multi-company
  users skip the chooser here; the dialog refreshes the existing session, it does not switch company.

---

## States

| State | Trigger | UI |
|---|---|---|
| **Edge redirect** | no `wecms_token` cookie on a non-public route | `proxy.ts` → `307` to `/login?next=<pathname>` (server-side, no flash) |
| **Rehydrating** | dashboard layout mounted, `fetchMe()` in flight | nothing rendered yet (`ready === false`) |
| **Ready + allowed** | `/me` resolves, route permitted | `<AppShell>{children}</AppShell>` |
| **Ready + blocked + has landing** | `/me` resolves, route not granted, a granted route exists | `router.replace(firstAllowedRoute(me))` |
| **Ready + blocked + no landing** | `/me` resolves, user has zero granted routes | centered notice `t("nav.no_menus")` (no redirect loop) |
| **`/me` failed** | token revoked / expired / network | clear storage + `router.replace("/login")` |
| **Session expired (401)** | any authenticated call returns 401 | `<SessionExpiredDialog>` lock screen opens |
| **Re-auth submitting** | password submitted | `saveDisabled` while `login()` in flight |
| **Re-auth error** | wrong password / `WBE1009` / other `LoginError` | `useDialog()` error dialog at `z-[100]`; lock screen stays open |
| **Cancelled** | ESC on the lock screen | clear storage + hard redirect `window.location.assign("/login")` |

---

## Edge guard vs. removed client guard

| Mechanism | Status | Notes |
|---|---|---|
| `proxy.ts` edge middleware (cookie check) | **Active — single source of truth** | `/login` public; else require `wecms_token`; missing → `/login?next=<pathname>`. Cannot be defeated by disabling JS. |
| Client `?preview=1` route-guard bypass in the dashboard layout | **DEAD LEGACY — removed** | Defeatable + a query-string security hole. Do not reintroduce. |
| `?preview=session-expired` in `SessionExpiredDialog.tsx` | Active (dev affordance only) | Opens the lock screen for UI rehearsal; **not** a route gate — unrelated to the removed `?preview=1`. |

---

## Token TTL

The `wecms_token` cookie is written with `Max-Age=3600` (1h) by `tokenStorage` (see the
**jwt-authentication** module), matching the backend `wecms.jwt.expires-in-seconds` default. When the
cookie expires the next navigation fails the edge cookie check → `/login`; an in-app call that still
holds a stale Bearer token surfaces the 401 re-auth flow above. **No refresh token** — re-auth is a
full re-login at the same company. **MISSING:** refresh-token rotation (deferred; see backend).
