# Auth > JWT Authentication — Frontend Feature (Refactor)

**Status:** ✅ Working — token storage + Bearer transport are fully wired; every authenticated API
call carries `Authorization: Bearer <wecms_token>` and the token is persisted to `localStorage` + a
mirror cookie on login (verified against `lib/auth/storage.ts` + `lib/axios.ts`).
**Slug:** `jwt-authentication` (matches the JEX-traceability + backend counterparts)
**Scope (frontend):** JWT **token storage + transport only**. The frontend never issues, signs, or
decodes a token for security — it stores the server-issued token and attaches it to outbound calls.

> This is a **non-visual** module — it has no dedicated screen, no route, and no UI component. It is
> the storage + transport plumbing that sits under every authenticated page. The matching backend
> docs (token issuance, claims, HS256/HS512 signing, the 401 entry point) are at
> [wecms-api/docs/features/auth/jwt-authentication/README.md](../../../../../wecms-api/docs/features/auth/jwt-authentication/README.md).

---

## What this module is

The frontend half of JWT authentication is two concerns, both shared infrastructure:

1. **Storage** — [`lib/auth/storage.ts`](../../../../lib/auth/storage.ts) persists the access token
   under the `wecms_token` key in `localStorage` **and** mirrors it into a non-HttpOnly cookie
   (`Path=/`, `Max-Age=3600`, `SameSite=Lax`) so the Next.js edge middleware can gate protected
   routes without `localStorage` access.
2. **Transport** — [`lib/axios.ts`](../../../../lib/axios.ts) request interceptor reads `wecms_token`
   from `localStorage` and sets `Authorization: Bearer <token>` on every outbound call to the
   `wecms-api` backend.

What the frontend does **NOT** do:

- It does **not** issue or sign tokens — that is the backend `JwtTokenProvider` (HS256/HS512).
- It does **not** decode claims for any security decision — the `StoredUser` fields it relies on
  (`role`, `productType`, `bizKey`, …) come from the **login / `me` response body**, never from
  parsing the JWT client-side. [APPROVED DEVIATION — by design: stateless, server-trusted claims.]
- It does **not** refresh tokens — there is no refresh-token call (the backend is stateless).
  [MISSING — by design; see [api-consumption.md](api-consumption.md).]

The 401 "session expired" re-auth handling and the `/auth/me` rehydration are owned by
**session-management** (the axios *response* interceptor); this module covers only storage + the
*request* Bearer transport. See the cross-link below.

---

## Documents in this folder

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Token lifecycle (transport, not a UI screen): login stores token → every request attaches Bearer → expiry handed off to session-management's 401 flow → logout clears |
| [ui-specification.md](ui-specification.md) | States plainly there is **no dedicated UI**; documents the `localStorage` + cookie storage contract, the non-HttpOnly security note, and dev/console concerns |
| [component-index.md](component-index.md) | `lib/auth/storage.ts` (tokenStorage / userStorage / savedIdStorage) + `lib/axios.ts` (request interceptor) — paths, roles, storage-key table |
| [api-consumption.md](api-consumption.md) | The `Authorization: Bearer` header contract on every call; `baseURL` config; the absent refresh-token call (MISSING/by-design); cross-link to API jwt-authentication for claim structure |
| [test-scenarios.md](test-scenarios.md) | Token attach / missing-token / expired-token handoff scenarios; FE tests MISSING if none |

---

## Quick facts

| Aspect | Value |
|---|---|
| Storage helper | [`tokenStorage`](../../../../lib/auth/storage.ts) (`wecms_token`) — `localStorage` + mirror cookie |
| Transport | [`lib/axios.ts`](../../../../lib/axios.ts) request interceptor — `Authorization: Bearer <wecms_token>` |
| Storage key | `wecms_token` (cleared on logout) |
| Cookie | `wecms_token`; `Path=/`; `Max-Age=3600` (1h); `SameSite=Lax`; `Secure` only on HTTPS; **non-HttpOnly by design** |
| Token TTL | 1h — cookie `Max-Age` matches the backend `wecms.jwt.expires-in-seconds` default (3600) |
| baseURL | `NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:8080` |
| Refresh token | **MISSING — by design** (backend stateless, no refresh call) |
| Claim decode on FE | **none** — `StoredUser` fields come from the login/`me` response, not from parsing the JWT |
| Route | none (non-visual infrastructure module) |
| View Setting / export | not applicable |

---

## Related docs

- **Backend counterpart:** [wecms-api/docs/features/auth/jwt-authentication/README.md](../../../../../wecms-api/docs/features/auth/jwt-authentication/README.md) — token issuance, claims, signing, `JwtAuthenticationFilter`, `JwtAuthenticationEntryPoint` (401 / `WBE1401`).
- **Sibling — session-management:** [../session-management/README.md](../session-management/README.md) — the axios **response** interceptor (401 → `<SessionExpiredDialog>` → retry), `/auth/me` rehydration, edge-middleware route guard. The expiry handoff this module describes lands there.
- **Sibling — login:** [../login/README.md](../login/README.md) — where the token is first stored (`tokenStorage.set` after `POST /api/v1/auth/login`).
- **Sibling — logout:** [../logout/README.md](../logout/README.md) — where `tokenStorage.clear()` removes the token + cookie.
- **Auth feature index:** [../README.md](../README.md)
