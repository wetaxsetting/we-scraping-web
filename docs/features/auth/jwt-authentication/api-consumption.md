# JWT Authentication — API Consumption (Frontend)

This module issues **no HTTP calls of its own**. Its contract is a **header on every other call**:
`Authorization: Bearer <wecms_token>`. Backend contract (issuance, claims, validation, 401):
[wecms-api/docs/features/auth/jwt-authentication/interface-specification.md](../../../../../wecms-api/docs/features/auth/jwt-authentication/interface-specification.md).

---

## The header contract — every authenticated call

The shared `api` Axios instance ([`lib/axios.ts`](../../../../lib/axios.ts)) attaches the token via its
request interceptor, so **every** fetcher built on `api` (banking, addon, auth/`me`, login-credentials,
…) automatically carries:

```
Authorization: Bearer <wecms_token>
Content-Type: application/json
```

- The token comes from `localStorage["wecms_token"]` (set at login by `tokenStorage.set`).
- When there is no token (anonymous / pre-login), no `Authorization` header is sent — the call goes
  out unauthenticated and the backend answers 401 (`WBE1401`) if the endpoint requires auth.
- The backend `permit-all` endpoints (`/api/v1/auth/login`, `/api/v1/auth/logout`,
  `/actuator/health`, callback whitelist) accept the call with or without the header.

This module does **not** add the header to a specific endpoint — it is a blanket request interceptor.
The token-bearing calls themselves are documented under their own feature folders (login,
session-management, banking, …).

---

## baseURL configuration

```ts
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
export const api = axios.create({ baseURL, headers: { "Content-Type": "application/json" } });
```

- `NEXT_PUBLIC_API_BASE_URL` — the Spring Boot `wecms-api` origin. `http://localhost:8080` locally;
  `https://test2-api.wecms.vn` on UAT ([`.env.uat.example`](../../../../.env.uat.example)). See
  [docs/README.md § Environments](../../../README.md#environments) for the full evidenced matrix.
- **Never** point this at `dev.wecms.vn`, `test.wecms.vn`, or `www.wecms.vn` — those are the **live
  JEX system**, a different application that does not serve the `wecms-api` REST contract. (The
  prohibition stands; its old justification — "the refactor is local-only" — was withdrawn
  2026-08-17, since `wecms-web` does deploy to SIT and UAT. The refactor's own UAT backend is the
  separate host `test2-api.wecms.vn`.)

---

## No refresh-token call — MISSING (by design)

There is **no** refresh-token endpoint consumed and **no** refresh logic in `lib/axios.ts`:

- The backend is **stateless** (`SessionCreationPolicy.STATELESS`, no server-side session, no
  blacklist/revocation). There is no `POST /auth/refresh` to call.
- An expired/invalid token surfaces as **HTTP 401 (`WBE1401`)** and is handled by the axios **response**
  interceptor — `requestReAuth()` → `<SessionExpiredDialog>` → the user re-authenticates and the
  original request is retried once with the fresh token. That flow is **session-management**, not this
  module — see [../session-management/api-consumption.md](../session-management/api-consumption.md).
- A future `REFRESH_TOKEN` table + endpoint is **deferred** on the backend.

[**MISSING — by design.**] A "silent refresh before expiry" path does not exist on either side; the
token simply lives until a 401, then re-auth replaces it. Do not add a frontend refresh call without a
matching backend endpoint (full-stack ownership rule).

---

## Token claims are NOT decoded on the frontend

The frontend never parses the JWT to read its claims:

- The fields the UI gates on — `StoredUser.role` (ADMIN/USER), `productType`, `bizKey`, `langCode`,
  `companyName`, `taxId`, `allMenus`, `allowedMenuCds` — come from the **login response** and the
  **`/api/v1/auth/me`** response body, mapped to camelCase in `lib/auth/client.ts`. They are
  **server-resolved**, not extracted from the token client-side.
- The token is an **opaque string** to the frontend. [APPROVED DEVIATION — server-trusted claims, by
  design; the backend re-derives authority/product from the signed JWT on every request via
  `JwtAuthenticationFilter` + `TenantContext`.]

For the actual claim structure (`sub`, `userNm`, `bizKey`, `langCd`, `authGrCd`, `prdtType`), the
HS256/HS512 signing rule, and the `WBE1401` entry point, see the **backend** doc:
[wecms-api/docs/features/auth/jwt-authentication/interface-specification.md](../../../../../wecms-api/docs/features/auth/jwt-authentication/interface-specification.md).

---

## Error handling

This module surfaces no errors of its own (it sends no calls). The 401 path it feeds into is owned by
session-management; the global Axios response interceptor in `lib/axios.ts` excludes `/auth/login` and
`/auth/logout` from the re-auth trigger so a bad-credentials 401 inside the login popup does not loop.

---

## Notes

- **Response envelope** is the standard `{ status: { error, code, message }, data, trace_id? }` for the
  *calls that carry* the Bearer header — the envelope itself is unrelated to this module; it is the
  shared API contract (see `wecms-web/CLAUDE.md` §"Response envelope").
- **No mock fallback** applies — there is no data to mock; the token is real-or-absent.
