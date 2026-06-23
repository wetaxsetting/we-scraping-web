# Change Password — API Consumption (Frontend)

The single endpoint the dialog calls, its request/response wire shape, and the error code → message
mapping. Backend contract:
[wecms-api/docs/features/auth/change-password/interface-specification.md](../../../../../wecms-api/docs/features/auth/change-password/interface-specification.md).
The call goes through [`changePassword(...)`](../../../../lib/auth/client.ts) → the Axios `api` instance
([lib/axios.ts](../../../../lib/axios.ts)) with the JWT interceptor; wire is lowercase snake_case.

---

## Endpoint

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| Change password | `changePassword(current, new, confirm)` | `POST /api/v1/auth/change-password` | `ChangePasswordRequestRec` | `ApiResponse<null>` (no `data` payload) |

The endpoint is **authenticated** — the request carries `Authorization: Bearer <wecms_token>` via the
shared Axios request interceptor. There is no `{type}`/`{seqNo}` path param; the user is resolved
server-side from the JWT (`TenantContext`).

---

## Request wire shape (snake_case) — `lib/types/api.ts`

```ts
interface ChangePasswordRequestRec {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
```

`changePassword(currentPassword, newPassword, confirmPassword)` maps the camelCase args to this body
inline:

```ts
const body: ChangePasswordRequestRec = {
  current_password: currentPassword,
  new_password:     newPassword,
  confirm_password: confirmPassword,
};
await api.post<ApiResponse<null>>("/api/v1/auth/change-password", body);
```

`confirm_password` is sent to the server even though the frontend Zod schema already enforces
`new === confirm` — the backend re-checks it (`WBE_CHANGE_PASSWORD_MISMATCH`), so the field travels as a
server-side backstop. Wire is lowercase snake_case per the CTO directive (no UPPER_SNAKE).

---

## Response envelope

The response is the standard `{ status: { error, code, message }, data, timestamp?, path?, trace_id? }`.
Success carries **no `data` payload** (`ApiResponse<null>`) — the client only checks `env.status.error`:

```ts
if (env.status.error) {
  throw new LoginError(env.status.code, env.status.message, env.trace_id);
}
// else resolve void
```

A missing/malformed `status` envelope throws `LoginError("WBE_CLIENT_PARSE", …)`. Any thrown error is
funnelled through `toLoginError(...)`, which yields:

- backend `status.code` + `status.message` + `trace_id` when the server responded,
- `WBE_NETWORK` when Axios threw with no response,
- `WBE_CLIENT_PARSE` when the response shape was malformed.

---

## Error code → message mapping

`<ChangePasswordDialog>` surfaces every failure through `useDialog()` `type: "error"`, titled with the
shared `dialog.error` key. The dialog renders the backend `status.message` verbatim as the description,
with `errorCode` = `status.code` and `uuid` = `trace_id`:

| Wire code | Meaning | Where it comes from |
|---|---|---|
| `WBE2091` | Current (stored) password is wrong — "Password confirmation failed." | backend (legacy `WBE1053`) |
| `WBE_CHANGE_PASSWORD_MISMATCH` | New ≠ confirm | backend (legacy `WBE1052`) — frontend Zod catches this first (`change_password.mismatch`), so the API code only fires if a client bypasses the form |
| `WBE_CHANGE_PASSWORD_REUSED` | New password matches one of the last 3 history rows | backend (legacy `WBE1017`) — **no** client backstop |
| `WBE_VALIDATION` | A required field was blank (bean-validation) | backend — frontend Zod `min(1)` catches this first |
| `WBE1401` | Unauthenticated / session expired | backend; handled globally by the Axios response interceptor (re-auth dialog), not by this dialog |
| `WBE_NETWORK` | Axios threw with no response | `toLoginError` |
| `WBE_CLIENT_PARSE` | Malformed response shape | `toLoginError` |

On success the dialog uses `type: "success"` titled with `dialog.success` and the
`change_password.success` description, then closes via `onConfirm` / `onClose` → `onOpenChange(false)`.

---

## Notes

- **No mock fallback** — the dialog has no static seed; it always calls the live endpoint.
- **No password ciphertext on the wire from the client** — the request carries the three plaintext
  passwords over HTTPS; nothing is echoed back. The backend hashes with the legacy SHA-256
  `WecmsPasswordEncoder` (coexistence — verify-only on login, SHA-256 on write; see the backend
  [refactor-gap-analysis.md](../../../../../wecms-api/docs/features/auth/change-password/refactor-gap-analysis.md)).
  Stale "upgrade SHA-256 → BCrypt" claims are **DEAD** — the write path is SHA-256.
- **401 handling is global**, not per call — `lib/axios.ts`'s response interceptor routes a 401 (except
  `/auth/login` and `/auth/logout`) to the session-expired re-auth dialog.
