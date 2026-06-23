# Component Index — Error Envelope (Frontend)

**Part of:** Common → error-envelope
**Last verified:** 2026-06-23

`error-envelope` ships no page and no feature component — it is the set of shared transport + error-surface
primitives every other feature composes. Reuse these; never fork a per-page envelope parser, error banner, or
second axios instance.

## Transport & envelope primitives

| Piece | File | Responsibility |
|---|---|---|
| `api` (Axios instance) | [`lib/axios.ts`](../../../../lib/axios.ts) | Single HTTP client. Request interceptor attaches `Authorization: Bearer <wecms_token>`; response interceptor handles `401` → session-expired re-auth + one-shot retry. `baseURL` from `NEXT_PUBLIC_API_BASE_URL`. |
| `ApiResponse<T>` / `CommonHead` | [`lib/types/api.ts`](../../../../lib/types/api.ts) | Wire envelope type — `{ status: { error, code, message }, data?, timestamp?, path?, trace_id? }`. Property names are lowercase `snake_case` matching the backend wire. |
| `ApiCallError` + `unwrap(...)` | [`lib/api/banking.ts`](../../../../lib/api/banking.ts) (re-used by every `lib/api/*.ts`) | Reads `status.error`; throws `ApiCallError { code, message, traceId }` on `status.error === true` **or** a non-2xx body. The single boundary that converts wire failure → typed JS error. |
| `requestReAuth()` | [`lib/auth/sessionExpired.ts`](../../../../lib/auth/sessionExpired.ts) | Session-expired bus the `401` interceptor awaits; surfaces the global re-auth dialog and resolves `"re_authenticated"` / other. |

## Error-surface primitives

| Piece | File | Responsibility |
|---|---|---|
| `useDialog()` | [`components/shared/dialog/DialogProvider.tsx`](../../../../components/shared/dialog/DialogProvider.tsx) | The only sanctioned way to raise a system message. `open({ type, title, description, errorCode })`. |
| `<SystemDialog>` | [`components/shared/dialog/SystemDialog.tsx`](../../../../components/shared/dialog/SystemDialog.tsx) | Renders the four variants (`error` / `warning` / `success` / `confirmation`) at `z-[100]`. Error = red icon, single OK, explicit-dismiss only. Renders the `Error code: <code>` trailer when `errorCode` is set. |
| `useTranslation()` / `t(...)` | [`lib/i18n/LocaleProvider.tsx`](../../../../lib/i18n/LocaleProvider.tsx) | Resolves dialog titles + copy (`dialog.error`, etc.) per locale (EN/KO/VI). |

## Composition rule

```tsx
try {
  const rows = await fetchSomething();      // lib/api/<domain>.ts → unwrap() throws ApiCallError
} catch (e) {
  const err = e as ApiCallError;            // { code, message, traceId? }
  dialog.open({
    type: "error",                          // never "warning" for an API/network failure
    title: t("dialog.error"),
    description: err.message,
    errorCode: err.code,
  });
}
```

- **Never** read `response.data.status` / `response.data.user_id` directly in a component — go through a
  `lib/api/*.ts` wrapper + `unwrap()`. (See `wecms-web/CLAUDE.md` §"Translation happens at the boundary".)
- **Never** create a second Axios instance or a bespoke error banner. One `api`, one `useDialog()`.
- `401` is handled centrally in the interceptor — components do **not** catch `401` to re-login.

## Related

- Backend twin: [`../../../../../wecms-api/docs/features/common/error-envelope/README.md`](../../../../../wecms-api/docs/features/common/error-envelope/README.md)
- Dialog variant rules: `wecms-web/CLAUDE.md` §"Dialogs & modals" → "Dialog variant — choose the right `type`"
- [api-consumption.md](api-consumption.md) · [screen-flow.md](screen-flow.md)
