# Logout — API Consumption (Frontend)

The single endpoint logout consumes, its (empty) wire shape, and the gap classification.
Backend contract:
[wecms-api/docs/features/auth/logout/interface-specification.md](../../../../../wecms-api/docs/features/auth/logout/interface-specification.md).
The call goes through the Axios `api` instance ([lib/axios.ts](../../../../lib/axios.ts)) with
the JWT request interceptor (the token is still present at call time).

---

## Endpoint

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| Logout | [`logout()`](../../../../lib/auth/client.ts) | `POST /api/v1/auth/logout` | — (no body) | `ApiResponse<null>` — **ignored** |

```ts
// lib/auth/client.ts
export async function logout(): Promise<void> {
  try {
    await api.post<ApiResponse<null>>("/api/v1/auth/logout");
  } catch {
    // Swallow — client-side cleanup still runs below.
  } finally {
    tokenStorage.clear();
    userStorage.clear();
  }
}
```

- **No request body.** The backend reads no payload; the JWT (attached by the interceptor) is
  the only thing on the wire, and the endpoint is **permit-all**, so even a stale / missing
  token succeeds.
- **Response is never read.** `logout()` does not inspect `status.error`, `data`, or
  `trace_id`. The backend returns `ApiResponse<Void>` ("Logout successful", `WBI0000`), but the
  frontend discards it.
- **Best-effort.** Any thrown error — network, 4xx, 5xx, malformed shape — is swallowed; the
  `finally` block clears storage regardless. There is **no** `useDialog()` error surface for a
  failed logout (unlike login / change-password).
- **401 interception.** `lib/axios.ts`'s response interceptor explicitly excludes
  `/auth/logout` from the global 401 → re-auth flow, so a 401 on logout does not trigger the
  session-expired dialog — it just falls into the swallow path.

---

## Wire envelope

The backend wraps the response in the standard envelope; the frontend does not consume it:

```ts
// Returned by the backend, ignored by lib/auth/client.logout()
interface ApiResponse<null> {
  status: { error: boolean; code: string; message: string };  // e.g. { false, "WBI0000", "Logout successful" }
  data?: null;
  trace_id?: string;
}
```

No mappers, no in-memory type — logout has no payload to translate.

---

## Gap classification

Per the shared gap vocabulary:

| Concern | Classification | Detail |
|---|---|---|
| **Server-side token revocation / blacklist** | **MISSING** | The backend `AuthController.logout()` is a stateless stub — it returns "Logout successful" but performs **no** token invalidation, no blacklist, no server session teardown (stateless JWT, `SessionCreationPolicy.STATELESS`). The issued JWT remains technically valid until its TTL (default 3600s) expires. Deferred — a future `REFRESH_TOKEN` / blacklist table would be required. |
| **Client-side cleanup** | **MATCH** | The legacy JEX system tears down the client session on logout; the refactor reproduces that by clearing `wecms_token` + `wecms_user` and redirecting to `/login`. The effective logout (token no longer sent on subsequent requests) matches legacy behaviour. |
| **Server session invalidation (legacy server-side session)** | **DEAD LEGACY** | Legacy JEX maintained a server-side session that logout invalidated. The refactor is stateless by design, so there is no server session to invalidate — that legacy behaviour is intentionally not ported. |
| **Best-effort POST (audit/symmetry)** | **APPROVED DEVIATION** | The POST exists only for audit/symmetry; its result is swallowed so a backend outage never strands the user logged-in client-side. Intentional per the `logout()` doc comment. |

> Because revocation is **MISSING**, the security boundary on logout is the client clearing
> its token (it stops being sent) plus the cookie clear (the edge middleware then redirects
> protected routes to `/login`). A stolen token would still validate until TTL expiry — a
> known stateless-JWT limitation tracked in
> [../session-management/README.md](../session-management/README.md).

---

## Notes

- **No refresh-token logic** on the frontend ([lib/axios.ts](../../../../lib/axios.ts) has
  none) — consistent with the stateless backend.
- The token cookie cleared by `tokenStorage.clear()` is what lets the Next.js edge middleware
  (`proxy.ts`) treat protected routes as unauthenticated after logout — see
  [../session-management/README.md](../session-management/README.md).
