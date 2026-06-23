# API Consumption — Error Envelope (Frontend)

**Part of:** Common → error-envelope
**Last verified:** 2026-06-23

This module *is* the API-consumption contract — it governs how **every** `lib/api/*.ts` wrapper reads the
shared `{ status, data }` envelope. No endpoints of its own.

## The envelope contract

```ts
interface ApiResponse<T> {
  status: { error: boolean; code: string; message: string };
  data?:  T;
  timestamp?: string;   // present on errors (ISO-8601 UTC)
  path?:      string;   // present on errors (request URI)
  trace_id?:  string;   // present on errors (JEX-style id; grepable in server logs)
}
```

## Rules (non-negotiable)

| Rule | Why |
|---|---|
| **Always check `status.error`, never HTTP 200 alone.** | The backend returns **HTTP 200** for known business errors (e.g. `WBE1009`). `unwrap()` treats `status.error === true` (or missing `data`) as a failure and throws `ApiCallError`. |
| **Translate at the boundary, once.** | Wire is lowercase `snake_case`; components consume camelCase. Mapping lives in `lib/api/mappers.ts` / `lib/auth/client.ts`. A component reading `response.data.user_id` means a mapper is missing. |
| **Errors are `ApiCallError { code, message, traceId }`** | Never surface a raw Axios error or `"UNKNOWN"`. The wrapper funnels three meaningful codes: real backend code, `NETWORK` (no response body), or a parse code when the shape is malformed. |
| **`trace_id` renders verbatim** | The server `trace_id` (or browser-local `…LOCL` fallback on pure network failure) is shown in the error dialog trailer so the user can quote it to support. |
| **`401` is interceptor-owned** | The `lib/axios.ts` response interceptor runs `requestReAuth()` + one-shot retry before any per-call catch. Components must not catch `401` to re-login. |

## Consumption shape (every domain wrapper)

```ts
// lib/api/<domain>.ts
export async function fetchX(params): Promise<XRow[]> {
  const res = await api.get<ApiResponse<ApiXListResponse>>("/api/v1/...", { params });
  const body = res.data;
  if (body.status.error || !body.data) {
    throw new ApiCallError(body.status.code, body.status.message, body.trace_id);
  }
  return body.data.rows.map(mapXRow);   // snake_case wire → camelCase in-memory
}
```

- **GET binary / XLSX** (export, file download) uses the same envelope semantics but sniffs a JSON error
  body out of the `Blob` before treating it as a file — see Common → `excel-export` / `file-management`
  (`lib/excel.ts`, `lib/file.ts`).
- **Success** is `status.error === false` + `code === "WBI0000"` + a populated `data`.

## Error-code surface

Codes are stable identifiers (UPPERCASE values) — the wrapper passes `status.code` straight to the dialog
as `errorCode`. The canonical list (shared with the backend) is the registry, not a per-page constant:

- Shared registry: [`../../../../../docs/_shared/error-code-registry.md`](../../../../../docs/_shared/error-code-registry.md)
- Common frontend codes (`wecms-web/CLAUDE.md` §"Error codes"): `WBI0000`, `WBE1009/1010/1011/1128`, `WBE_VALIDATION`, `WBE9999`, plus `WBE_NETWORK` / `WBE_CLIENT_PARSE` (frontend-only sentinels).

## Related

- Backend envelope contract: [`../../../../../wecms-api/docs/features/common/error-envelope/interface-specification.md`](../../../../../wecms-api/docs/features/common/error-envelope/interface-specification.md)
- [screen-flow.md](screen-flow.md) (the full surface path) · [component-index.md](component-index.md)
