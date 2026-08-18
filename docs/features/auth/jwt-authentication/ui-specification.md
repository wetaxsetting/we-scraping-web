# JWT Authentication — UI Specification (Frontend)

## There is no dedicated UI

JWT authentication on the frontend is **token storage + Bearer transport only**. It has:

- **no route** (no `app/(dashboard)/...` or `app/(auth)/...` page),
- **no rendered component** (no panel, dialog, popover, button, or icon),
- **no Figma frame**, **no View Setting**, **no export**, **no i18n keys of its own**.

It is shared infrastructure consumed silently by every authenticated page. The only user-visible
surfaces *related* to JWT live in **other** modules and are documented there:

- The login form that *produces* the token → [../login/ui-specification.md](../login/ui-specification.md).
- The session-expired lock-screen dialog that fires on a 401 (expired token) →
  [../session-management/](../session-management/) (`<SessionExpiredDialog>`).
- The logout confirmation that *clears* the token → [../logout/ui-specification.md](../logout/ui-specification.md).

This document therefore specifies the **storage contract** and **security posture** instead of a
layout.

---

## Storage contract

### `localStorage` key

| Key | Owner | Value | Cleared on logout? |
|---|---|---|---|
| `wecms_token` | [`tokenStorage`](../../../../lib/auth/storage.ts) | the raw server-issued JWT access token (a string) | **Yes** |

The token value is stored verbatim — it is **not** parsed, re-encoded, or wrapped in JSON. (By
contrast `wecms_user` holds a JSON `StoredUser`; see [../session-management/](../session-management/).)

### Cookie contract

`tokenStorage.set(token)` also writes a mirror cookie via `document.cookie`:

| Attribute | Value | Why |
|---|---|---|
| name / value | `wecms_token=<url-encoded token>` | mirrors the `localStorage` token so the Next.js edge middleware (which can't read `localStorage`) can detect authentication |
| `Path` | `/` | available to every route |
| `Max-Age` | `3600` (1 hour) | matches the backend default JWT TTL (`wecms.jwt.expires-in-seconds`); a client-side hint, not server-enforced |
| `SameSite` | `Lax` | limits cross-site sending |
| `Secure` | present **only** when `window.location.protocol === "https:"` | omitted on `http://localhost` so local dev works |
| `HttpOnly` | **absent (non-HttpOnly) — by design** | Axios reads the token from `localStorage`, and the middleware only needs a presence check |

`tokenStorage.clear()` removes the `localStorage` entry **and** expires the cookie
(`wecms_token=; Path=/; Max-Age=0; SameSite=Lax`).

> The `Max-Age=3600` constant lives in `lib/auth/storage.ts` as `TOKEN_COOKIE_MAX_AGE = 60 * 60`. If
> the backend TTL changes, this constant must be updated to keep the cookie hint aligned —
> [PARTIAL] there is no automatic sync; it is a hard-coded mirror of the backend default.

---

## Security note — non-HttpOnly is intentional

The cookie is deliberately **not** `HttpOnly`:

- The `Authorization: Bearer` header is built from the `localStorage` token (the request interceptor),
  so the token must be JS-readable there regardless.
- The edge middleware (`proxy.ts`, documented under session-management) only checks the cookie's
  **presence** to gate `/login` vs. protected routes — it never reads the token's contents.

This was accepted as an **[APPROVED DEVIATION]** on the premise of a local-only phase. **That premise
no longer holds (corrected 2026-08-17):** `wecms-web` deploys to SIT and UAT
(see [docs/README.md § Environments](../../../README.md#environments)), so the deviation is now
live on a real deployed surface, not a sandbox.

`wecms-web/CLAUDE.md` §"Notes for future implementation → Server-side auth guard" records that
before any non-local deploy the design should move to a middleware + HttpOnly cookie-bound token so
the token is never JS-readable and protected routes never flash — **that condition has already been
crossed**. Treat the token as exposed to any same-origin script, and treat closing this deviation as
an open pre-production security item rather than a deferred nice-to-have.

---

## Dev / console concerns

- **`typeof window` guard.** Both `storage.ts` and the `lib/axios.ts` request interceptor guard on
  `typeof window !== "undefined"` so SSR / build-time evaluation never touches `localStorage` or
  `document.cookie`. A server component that imports `api` will simply send no `Authorization` header.
- **No console logging of the token.** The token is never logged. Do not add a `console.log(token)` for
  debugging — it would leak the credential into the browser console / any log shipper.
- **Inspecting the token in dev.** To verify transport, read `localStorage.getItem("wecms_token")` in
  the browser console or inspect the `Authorization` header on the Network tab — do not decode claims
  in app code (claims are server-trusted; see [api-consumption.md](api-consumption.md)).
- **No visual state to test.** Because the module renders nothing, there is no loading / empty / error
  visual state. The only observable behaviour is "the header is present on the request" — see
  [test-scenarios.md](test-scenarios.md).
