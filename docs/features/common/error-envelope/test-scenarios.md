# Test Scenarios — Error Envelope (Frontend)

**Part of:** Common → error-envelope
**Last verified:** 2026-06-23

Cross-cutting — these scenarios are exercised through any feature page that makes an API call. There is no
dedicated route to test in isolation; pick a representative list page (e.g. Account Inquiry) as the harness.

## SIT / behavioural scenarios

| # | Scenario | Expected |
|---|---|---|
| 1 | Successful call (`status.error=false`, `data` present) | Rows render; no dialog. |
| 2 | **Business error on HTTP 200** (`status.error=true`, e.g. `WBE1009`) | `unwrap()` throws `ApiCallError`; `useDialog({type:"error"})` opens with red icon, `status.message`, and the `Error code: WBE1009` trailer. No silent success. |
| 3 | 4xx/5xx with an envelope body (e.g. 500 `WBE9999`) | `ApiCallError(code,message,trace_id)`; error dialog shows the server `trace_id` verbatim. |
| 4 | Network failure (no response body) | `ApiCallError("NETWORK", …)`; dialog shows a browser-local `…LOCL` trace id (clearly not server-grepable). |
| 5 | Malformed response shape | `ApiCallError("WBE_CLIENT_PARSE", …)`; logged to `console.error` with the original error. |
| 6 | **401 on an authenticated call** | Response interceptor runs `requestReAuth()` → global re-auth dialog. On `re_authenticated` the original request retries once with the fresh token; success returns transparently to the caller. |
| 7 | **Second 401 on the retried request** (`_isRetry=true`) | No re-auth loop — error falls through to the caller's catch. |
| 8 | 401 on `/auth/login` or `/auth/logout` | Interceptor does **not** trigger re-auth (AUTH_PATHS excluded) — a wrong-password popup must not recursively open the re-auth dialog. |
| 9 | 401 on `/auth/me` at page-load rehydration | Re-auth popup surfaces (intentionally NOT excluded) rather than a silent bounce to `/login`. |
| 10 | Dialog variant correctness | API/network/validation failures use `type:"error"` (red), never `type:"warning"`. Title is the shared `dialog.error` key, not a module name. |
| 11 | Locale | Dialog title/copy resolve through `t(...)` for EN/KO/VI; missing key falls back to the key (visible, not blank). |

## Error-path matrix (what each path produces)

| Path | Thrown | Dialog `type` | trace id shown |
|---|---|---|---|
| 200 + `status.error` | `ApiCallError(code,msg)` | error | server `trace_id` |
| non-2xx + envelope | `ApiCallError(code,msg)` | error | server `trace_id` |
| non-2xx, no body | `ApiCallError("NETWORK")` | error | local `…LOCL` |
| bad shape | `ApiCallError("WBE_CLIENT_PARSE")` | error | local `…LOCL` |
| 401 (first) | (interceptor) re-auth + retry | — (re-auth dialog) | n/a |

## Accessibility / UX checks

- Error dialog traps focus, defaults focus to OK, restores focus on close; ESC/overlay do **not** dismiss
  (explicit OK only) per `wecms-web/CLAUDE.md` §"Modal stack — interaction & close behaviour".
- `<SystemDialog>` renders at `z-[100]`, above any stacked feature dialog, so an error raised mid-chain is visible.

## Coverage gaps (gap-vocab)

- **MISSING:** no automated frontend test harness in the repo yet (no Jest/RTL/Playwright config) — these are
  manual SIT scenarios. ⚠️ If a test runner lands, codify scenarios 2 / 6 / 7 first (the envelope + re-auth core).
- **PARTIAL:** KM (Khmer) dialog copy not present in `wecms-web` (EN/KO/VI only) — scenario 11 is EN/KO/VI scope.

## Related

- [screen-flow.md](screen-flow.md) · [api-consumption.md](api-consumption.md)
- Backend test scenarios (exception→envelope mapping): [`../../../../../wecms-api/docs/features/common/error-envelope/test-scenarios.md`](../../../../../wecms-api/docs/features/common/error-envelope/test-scenarios.md)
