# Error Envelope — Frontend Error Handling

**Status: CURRENT** — documents shipped frontend behaviour. Per-screen wiring detail is in the tables below. Vocabulary: [../../../README.md § Status vocabulary](../../../README.md#status-vocabulary).

**Part of:** Common → error-envelope
**Last verified:** 2026-06-23

> **Cross-cutting, not a screen.** `error-envelope` has no route and no page. It is the frontend side of
> the shared response contract: how `lib/axios.ts` attaches the JWT, how it handles `401`, how every API
> wrapper unwraps the `{ status, data }` envelope into `ApiCallError`, and how errors surface through the
> global `useDialog()` system dialog. It underpins **every** API call the app makes.

## What this covers (frontend)

| Concern | Source of truth |
|---|---|
| Envelope wire type `ApiResponse<T>` + `CommonHead` | [`lib/types/api.ts`](../../../../lib/types/api.ts) |
| JWT interceptor + 401 → session-expired re-auth | [`lib/axios.ts`](../../../../lib/axios.ts) |
| Envelope unwrap → `ApiCallError { code, message }` | [`lib/api/banking.ts`](../../../../lib/api/banking.ts) (`ApiCallError`, `unwrap`) and per-domain `lib/api/*.ts` |
| Session-expired re-auth bus | [`lib/auth/sessionExpired.ts`](../../../../lib/auth/sessionExpired.ts) (`requestReAuth`) |
| Error dialog surface | [`components/shared/dialog/`](../../../../components/shared/dialog/) (`useDialog`, `SystemDialog`) |
| i18n / `t(...)` | [`lib/i18n/LocaleProvider.tsx`](../../../../lib/i18n/LocaleProvider.tsx) |

## Documents

| Doc | Scope |
|---|---|
| [screen-flow.md](screen-flow.md) | How an error surfaces — axios interceptor → `ApiCallError` → `useDialog` error dialog; 401 → session-expired flow |
| [ui-specification.md](ui-specification.md) | System error dialog variant + tokens; trace-id display |
| [component-index.md](component-index.md) | `useDialog` / `SystemDialog`, `lib/axios.ts`, `ApiCallError`, `LocaleProvider` |
| [api-consumption.md](api-consumption.md) | Envelope parsing — always check `status.error`, not HTTP 200; `trace_id` rendering |
| [test-scenarios.md](test-scenarios.md) | Per-error-path → expected dialog; 401 re-auth; envelope-error-on-200 |

## Related

- Backend twin (the contract this consumes): [`../../../../../wecms-api/docs/features/common/error-envelope/README.md`](../../../../../wecms-api/docs/features/common/error-envelope/README.md)
- Common frontend hub: [`../README.md`](../README.md)
- Shared error-code registry (both systems): [`../../../../../docs/_shared/error-code-registry.md`](../../../../../docs/_shared/error-code-registry.md)
- Frontend rules: `wecms-web/CLAUDE.md` §"API / DB Rules" → "Response envelope" + "Error handling (frontend side)"; §"Dialogs & modals" → dialog variants
