# Session Management — API Consumption (Frontend)

The endpoint the session lifecycle calls, its wire shape, and the 401 re-auth retry contract. Backend
contract:
[wecms-api/docs/features/auth/session-management/interface-specification.md](../../../../../wecms-api/docs/features/auth/session-management/interface-specification.md).
All calls go through the shared `api` Axios instance ([lib/axios.ts](../../../../lib/axios.ts)) with
the JWT request interceptor; wire is lowercase snake_case, mapped to camelCase `StoredUser` at the
auth boundary in [lib/auth/client.ts](../../../../lib/auth/client.ts).

---

## Endpoint

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| Rehydrate session | [`fetchMe()`](../../../../lib/auth/client.ts) | `GET /api/v1/auth/me` | — (Bearer `wecms_token`) | `ApiResponse<MeResponseRec>` |

`fetchMe()` is called once per dashboard mount by `app/(dashboard)/layout.tsx`. The re-auth flow also
calls `login()` (`POST /api/v1/auth/login`) — documented in the [login](../login/README.md) module;
here it is consumed only as the lock-screen submit action.

---

## `GET /api/v1/auth/me` — response (`MeResponseRec`)

Wire shape ([lib/types/api.ts](../../../../lib/types/api.ts)) — lowercase snake_case:

```ts
interface MeResponseRec {
  user_id:     string;
  user_nm:     string;
  biz_key:     string;
  lang_cd:     string;
  cmpn_nm:     string;
  auth_gr_cd:  "ADMIN" | "USER";
  prdt_type?:  string | null;   // echoed from the JWT claim (verbatim BUSI_INFM.PRDT_TYPE letter)
  tax_id?:     string | null;   // re-queried on EVERY /me call (NOT signed into the JWT)
  all_menus:        boolean;    // Menu Authorization — true ⇒ admin bypass (allowed_menu_cds then empty/ignored)
  allowed_menu_cds: string[];   // granted leaf slugs for a normal user (e.g. "addon-einvoices-sales")
}
```

Boundary mapping — `toStoredUser()` in `lib/auth/client.ts` (snake_case → camelCase semantic):

| Wire field | `StoredUser` field | Notes |
|---|---|---|
| `user_id` | `userId` | |
| `user_nm` | `userName` | |
| `biz_key` | `bizKey` | `?? ""` |
| `lang_cd` | `langCode` | `?? "EN"` |
| `cmpn_nm` | `companyName` | `?? ""` |
| `auth_gr_cd` | `role` | `normaliseRole` → `"ADMIN"` else `"USER"` |
| `prdt_type` | `productType` | trimmed; unknown letters preserved verbatim |
| `tax_id` | `taxId` | `?? ""`; rendered in the lock-screen header |
| `all_menus` | `allMenus` | `?? (role === "ADMIN")` — login response lacks menus, so admins default `true` until `/me` fills the real value |
| `allowed_menu_cds` | `allowedMenuCds` | `?? []` |

- **`all_menus` / `allowed_menu_cds`** drive the **authorization** + **menu-authorization** modules
  (sidebar / top-nav visibility, route gating). `tax_id` feeds the lock-screen header. **MATCH** with
  backend `AuthService.me()`.
- The frontend **never decodes the JWT** for these values — they come from the `/me` response body.

---

## 401 envelope (WBE1401) handling

Every API response is the standard envelope:

```ts
interface ApiResponse<T> {
  status: { error: boolean; code: string; message: string };
  data?: T;
  timestamp?: string;
  path?: string;
  trace_id?: string;   // present on errors — grepable in server logs
}
```

A session-expired call returns **HTTP 401** with `status.code === "WBE1401"` (backend
`JwtAuthenticationEntryPoint`, parity legacy `SES001`). Handling is **global**, not per call:

1. The [lib/axios.ts](../../../../lib/axios.ts) **response interceptor** intercepts the 401 before any
   caller's `.catch` sees it.
2. It rejects immediately (no re-auth) when: `status !== 401`, no `config`, `config._isRetry` already
   set, or `isAuthEndpoint(url)` is `/auth/login` / `/auth/logout`.
3. Otherwise it `await requestReAuth()` (the bus), which opens the global `<SessionExpiredDialog>`.

`fetchMe()` itself surfaces a non-401 `/me` failure as a `LoginError` carrying `status.code` +
`trace_id`; the dashboard layout's catch then clears storage and redirects to `/login`. A **401 on
`/me` is NOT excluded** — it routes into the re-auth flow like any other authenticated call (so a
background-expired token at page load shows the lock screen instead of silently bouncing).

---

## The re-auth retry flow

```
401 (not auth endpoint, not already retried)
   → requestReAuth()  ──────────────►  <SessionExpiredDialog> opens
                                          │
   ┌──────────────────────────────────────┤
   │ outcome "re_authenticated"            │ outcome "cancelled"
   ▼                                       ▼
config._isRetry = true                  reject(original 401 error)
api.request(config)  ── retry once ──►     │
   ├─ 200 → caller resolves                │
   └─ 2nd 401 → _isRetry guard → reject ───┘
```

- On `"re_authenticated"` the dialog has already written the fresh token (`tokenStorage.set`); the
  request interceptor re-reads `wecms_token` from `localStorage` on every call, so the retry just needs
  the `_isRetry` flag + resend.
- **`_isRetry` guards recursion** — a second 401 on the retried request falls through to the caller
  (a permanently broken token surfaces the original error rather than re-opening the dialog forever).
- On **cancel** or a **second 401**, the interceptor rejects with the original error so callers can
  render their own fallback (typically the layout's redirect to `/login`).
- Re-auth errors (wrong password / `WBE1009`) inside the dialog go through `useDialog()` (`z-[100]`);
  the lock screen stays open for another attempt.

---

## Notes

- **Stateless model** — no refresh token, no server-side blacklist; re-auth is a full re-login at the
  same company. Refresh-token rotation is **MISSING** (deferred — see backend).
- **Token TTL 1h** — `wecms_token` cookie `Max-Age=3600` matches backend
  `wecms.jwt.expires-in-seconds` default. See the **jwt-authentication** module for cookie storage.
- No mock fallback — `fetchMe()` always hits the live `/me` endpoint.
