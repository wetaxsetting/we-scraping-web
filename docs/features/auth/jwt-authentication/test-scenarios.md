# JWT Authentication — Test Scenarios (Frontend)

Manual / future-automated scenarios for token **storage + transport**. Because the module is
non-visual, every scenario is observed via `localStorage`, the cookie jar, and the request/response
`Authorization` header — not via on-screen UI. Backend scenarios:
[wecms-api/docs/features/auth/jwt-authentication/test-scenarios.md](../../../../../wecms-api/docs/features/auth/jwt-authentication/test-scenarios.md).

---

## Automated FE tests — MISSING

There are **no** frontend unit / integration tests for `lib/auth/storage.ts` or the `lib/axios.ts`
request interceptor today. [**MISSING.**] The scenarios below are the manual checks; if/when a test
harness lands, `tokenStorage` set/get/clear and the interceptor's header-attach are the obvious first
units to cover.

---

## Store (on login)

| # | Scenario | Expected |
|---|---|---|
| ST1 | Log in successfully | `localStorage["wecms_token"]` holds the raw `access_token`; a `wecms_token` cookie exists with `Path=/`, `Max-Age=3600`, `SameSite=Lax` |
| ST2 | Log in over HTTPS | the cookie additionally carries `Secure` |
| ST3 | Log in over `http://localhost` | the cookie omits `Secure` (so it still sets in local dev) |
| ST4 | Token value | stored verbatim (not JSON-wrapped, not re-encoded) |

## Attach (transport)

| # | Scenario | Expected |
|---|---|---|
| AT1 | Any authenticated fetch after login (e.g. `GET /api/v1/banking/accounts`) | the request carries `Authorization: Bearer <wecms_token>` |
| AT2 | Token present, value matches `localStorage` | the Bearer value equals the current `wecms_token` (interceptor re-reads on every call) |
| AT3 | SSR / build-time evaluation of a module importing `api` | no `Authorization` header attached (the `typeof window` guard short-circuits) |
| AT4 | baseURL | requests go to `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080`), never a `*.wecms.vn` host |

## Missing token

| # | Scenario | Expected |
|---|---|---|
| MT1 | No token in `localStorage` (pre-login / after logout) | outbound calls carry **no** `Authorization` header |
| MT2 | Auth-required endpoint hit with no token | backend answers 401 (`WBE1401`); the response interceptor (session-management) takes over |
| MT3 | `permit-all` endpoint hit with no token (`/auth/login`, `/auth/logout`, `/actuator/health`) | call succeeds without a header |

## Expired-token handoff (to session-management)

| # | Scenario | Expected |
|---|---|---|
| EX1 | Token expired/invalid, authenticated call returns 401 | the axios **response** interceptor fires `requestReAuth()` → `<SessionExpiredDialog>` (this is session-management; verified here only as the handoff point) |
| EX2 | Re-auth succeeds | the original request is retried once with the fresh `wecms_token` (the request interceptor re-reads `localStorage`) |
| EX3 | 401 on `/auth/login` or `/auth/logout` | the re-auth dialog does **not** open (those paths are excluded so a bad-password 401 doesn't loop) |
| EX4 | No silent refresh | there is **no** refresh-token call before expiry — the token lives until a 401 (MISSING by design; backend stateless) |

## Clear (on logout)

| # | Scenario | Expected |
|---|---|---|
| CL1 | Log out | `localStorage["wecms_token"]` removed; `wecms_token` cookie expired (`Max-Age=0`) |
| CL2 | Logout preserves preferences | `wecms_locale` and `wecms_saved_user_id` survive (never `localStorage.clear()`) |
| CL3 | Post-logout call | carries no `Authorization` header (per MT1) |

## Security

| # | Scenario | Expected |
|---|---|---|
| SE1 | Inspect the cookie | non-HttpOnly **by design** — JS-readable (APPROVED DEVIATION for R&D); flag for HttpOnly hardening before any non-local deploy |
| SE2 | Search app code for claim decoding | none — `StoredUser` fields come from the login/`me` response body, never from parsing the JWT |
| SE3 | Search app code for token logging | none — the token must never be `console.log`-ed |

---

## Cross-cutting

- This module renders nothing — there is **no loading / empty / error visual state** to test, and **no
  i18n strings** to verify in EN / KO / VI.
- The visible consequences of token state (login form, session-expired dialog, logout) are tested in
  their own feature folders: [../login/test-scenarios.md](../login/test-scenarios.md),
  [../session-management/test-scenarios.md](../session-management/test-scenarios.md),
  [../logout/test-scenarios.md](../logout/test-scenarios.md).
