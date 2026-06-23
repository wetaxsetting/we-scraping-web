# JWT Authentication — Token Lifecycle (Frontend)

This module is **non-visual** — there is no screen, no route, and no rendered component. So this
"flow" documents the **token transport lifecycle**, not a UI interaction. Backend issuance/validation
flow: [wecms-api/docs/features/auth/jwt-authentication/business-flow.md](../../../../../wecms-api/docs/features/auth/jwt-authentication/business-flow.md).

```
                       ┌──────────────────────── 1. STORE (on login) ───────────────────────┐
LoginForm → lib/auth/client.login(...)
   → POST /api/v1/auth/login  →  { data: { access_token, token_type, expires_in, ... } }
   → tokenStorage.set(access_token)
        ├─ localStorage["wecms_token"] = <token>
        └─ document.cookie = "wecms_token=<token>; Path=/; Max-Age=3600; SameSite=Lax[; Secure]"
                       └─────────────────────────────────────────────────────────────────────┘

                       ┌──────────────── 2. ATTACH (every authenticated call) ───────────────┐
api.request(config)  (lib/axios.ts request interceptor)
   → token = localStorage["wecms_token"]
   → if token: config.headers.Authorization = `Bearer ${token}`
   → call leaves with the Bearer header
                       └─────────────────────────────────────────────────────────────────────┘

                       ┌──────────────────── 3. EXPIRE (handed off) ─────────────────────────┐
backend returns HTTP 401 (token expired / invalid)  →  WBE1401
   → handled by the lib/axios.ts RESPONSE interceptor — owned by **session-management**
   → requestReAuth() → <SessionExpiredDialog> → on re-auth, retry the original request
     with the fresh token (request interceptor re-reads localStorage on the retry)
                       └─────────────────────────────────────────────────────────────────────┘

                       ┌──────────────────────── 4. CLEAR (on logout) ──────────────────────┐
ProfileMenu → lib/auth/client.logout()
   → tokenStorage.clear()
        ├─ localStorage.removeItem("wecms_token")
        └─ document.cookie = "wecms_token=; Path=/; Max-Age=0; SameSite=Lax"
                       └─────────────────────────────────────────────────────────────────────┘
```

---

## Phases

| # | Phase | Owner | What happens |
|---|---|---|---|
| 1 | **Store** | this module (`tokenStorage.set`) | After a successful login, the server-issued `access_token` is written to `localStorage["wecms_token"]` **and** mirrored to the `wecms_token` cookie (`Path=/`, `Max-Age=3600`, `SameSite=Lax`, `Secure` on HTTPS only). The cookie exists so the edge middleware can see authentication; the `localStorage` copy is what the request interceptor reads. |
| 2 | **Attach** | this module (`lib/axios.ts` **request** interceptor) | Every call through the shared `api` Axios instance reads `wecms_token` from `localStorage` (browser only — guarded by `typeof window !== "undefined"`) and sets `Authorization: Bearer <token>`. No token ⇒ no header (anonymous call). |
| 3 | **Expire** | **session-management** (cross-link) | A 401 from the backend (`WBE1401`) is caught by the axios **response** interceptor, which surfaces `<SessionExpiredDialog>` and retries the original request once after re-auth. This handoff is documented here for completeness but lives in [../session-management/screen-flow.md](../session-management/screen-flow.md). |
| 4 | **Clear** | **logout** (cross-link) | `tokenStorage.clear()` removes both the `localStorage` entry and the cookie (`Max-Age=0`). `wecms_locale` and `wecms_saved_user_id` are **not** cleared — never `localStorage.clear()`. See [../logout/README.md](../logout/README.md). |

---

## Where this module's responsibility ends

- The frontend **stores and transports** the token. It does **not** validate the token's signature or
  expiry — that is the backend `JwtAuthenticationFilter`. The client only learns a token is dead when
  the backend answers 401.
- The cookie `Max-Age=3600` is a **client-side hint** matching the backend's default TTL; it does not
  enforce expiry. A token can be rejected by the server before the cookie's `Max-Age` elapses (e.g.
  if the backend secret rotates), and the 401 path still fires.
- Claim contents (`sub`, `bizKey`, `authGrCd`, `prdtType`, …) are **never decoded on the frontend**.
  The fields the UI gates on come from the login/`me` **response body**, mapped to `StoredUser` in
  `lib/auth/client.ts`. [APPROVED DEVIATION — server-trusted claims, by design.]

---

## Security notes (frontend)

- **Non-HttpOnly cookie by design.** Axios reads the token from `localStorage` for the `Authorization`
  header, and the edge middleware only needs to see *whether* a token is present — so the cookie is
  intentionally readable by JS. Sprint-0 is R&D-local; before any non-local deploy this should move to
  an HttpOnly, cookie-bound token. [APPROVED DEVIATION for R&D — flagged in `wecms-web/CLAUDE.md` §"Notes for future implementation".]
- **`SameSite=Lax` + `Secure`-on-HTTPS** limit cross-site leakage; on `http://localhost` the `Secure`
  flag is omitted so the cookie works in local dev.
- **No token in transit beyond the Bearer header** — the token is never placed in a query string or
  request body.
