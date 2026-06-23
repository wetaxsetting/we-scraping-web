# JWT Authentication — Component Index (Frontend)

There are **no React components** in this module — it is storage + transport plumbing only. The map
below is the file / role / storage-key inventory. Backend mirror:
[wecms-api/docs/features/auth/jwt-authentication/source-code-index.md](../../../../../wecms-api/docs/features/auth/jwt-authentication/source-code-index.md).

---

## Source files

| File | Role |
|---|---|
| [`lib/auth/storage.ts`](../../../../lib/auth/storage.ts) | The three storage helpers. **`tokenStorage`** is this module's core — `set` / `get` / `clear` for the `wecms_token` JWT (`localStorage` + mirror cookie). Also exports `userStorage` (the `StoredUser` JSON) and `savedIdStorage` (the remembered login id), used by login / session-management — listed here because they share the file. Also defines `StoredUser`, `UserRole`, `KNOWN_PRODUCT_TYPES`. |
| [`lib/axios.ts`](../../../../lib/axios.ts) | The shared `api` Axios instance + its **request interceptor** (this module's transport half). The interceptor reads `wecms_token` from `localStorage` and sets `Authorization: Bearer <token>`. The **response** interceptor in the same file (401 → re-auth) belongs to **session-management**, not this module. |

---

## `lib/auth/storage.ts` — the three helpers

| Export | Key | Scope | Notes |
|---|---|---|---|
| **`tokenStorage`** | `wecms_token` | `localStorage` + cookie | `set(token)` writes both; `get()` reads `localStorage`; `clear()` removes both. **This module owns it.** Cookie: `Path=/`, `Max-Age=3600`, `SameSite=Lax`, `Secure`-on-HTTPS, non-HttpOnly. |
| `userStorage` | `wecms_user` | `localStorage` (JSON) | Holds the `StoredUser` (camelCase semantic profile). Set at login, read on rehydrate. Owned by login / session-management — shares this file. |
| `savedIdStorage` | `wecms_saved_user_id` | `localStorage` | The "Save ID" remembered login id. **Not** cleared on logout. Owned by login. |

Internal helpers in the file: `hasWindow()` (SSR guard), `TOKEN_COOKIE_MAX_AGE = 60 * 60`,
`writeTokenCookie(token)`, `clearTokenCookie()`.

---

## `lib/axios.ts` — request interceptor (transport)

```ts
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("wecms_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
```

- Reads `wecms_token` directly from `localStorage` (not via `tokenStorage.get()` — it inlines the read
  to stay free of the storage-helper import at the HTTP layer).
- Browser-only (`typeof window` guard); attaches no header when there is no token.
- `baseURL` = `process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"`.

The **response** interceptor in the same file (401 → `requestReAuth()` → `<SessionExpiredDialog>` →
retry) is **session-management** — documented at [../session-management/](../session-management/), not
here.

---

## Storage-key table (owned by this module vs. shared)

| Key | This module? | Cleared on logout? |
|---|---|---|
| `wecms_token` | ✅ owned (`tokenStorage`) | Yes |
| `wecms_user` | shared (login / session-management) | Yes |
| `wecms_saved_user_id` | shared (login) | **No** |
| `wecms_locale` | other (`LocaleProvider`) | **No** |

---

## Not used

- **No React component, hook, route, or Figma frame** — non-visual infrastructure.
- **No API client wrapper** — the interceptor is the only consumer of the token; the module issues no
  HTTP calls of its own (no refresh endpoint — see [api-consumption.md](api-consumption.md)).
- **No mappers / wire types of its own** — the token is an opaque string; the login/`me` response
  shapes that *carry* it live in `lib/types/api.ts` (documented under login / session-management).
- **No i18n keys, no View Setting, no export.**
