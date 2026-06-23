# Dialog & Popup — API Consumption

**Part of:** Common → dialog-popup
**Last verified:** 2026-06-23

## NONE — dialogs are pure UI

`dialog-popup` consumes **no API endpoint**. Neither the system dialog (`useDialog()` →
`<SystemDialog>`) nor the stacked feature-dialog primitive (`<DialogContent stackLevel>`) makes,
unwraps, or depends on any HTTP call. There is **no backend surface** for this module — see the
[backend stub](../../../../../wecms-api/docs/features/common/dialog-popup/README.md).

Verified against the source:

- [`DialogProvider.tsx`](../../../../components/shared/dialog/DialogProvider.tsx) — only React
  state (`useState`/`useCallback`/`useMemo`); no `axios`, no `lib/api/*` import.
- [`SystemDialog.tsx`](../../../../components/shared/dialog/SystemDialog.tsx) — `createPortal`,
  `useTranslation`, `modalStack`, `DialogIcon`; no network.
- [`components/ui/dialog.tsx`](../../../../components/ui/dialog.tsx) — Radix + `modalStack`; no network.
- [`lib/modalStack.ts`](../../../../lib/modalStack.ts) — a module-level array; no network.

## The one indirect touch-point: system *error* dialogs render an `ApiCallError`

A dialog never *calls* an API, but a **caller** that just made an API call commonly opens a system
**error** dialog to surface a failure. The data shown comes entirely from the **error-envelope**
module, not from dialog-popup:

```tsx
// A page / hook — NOT the dialog component — owns the API call and the dialog open.
try {
  await fetchAccounts(currency, sort);
} catch (e) {
  if (e instanceof ApiCallError) {
    dialog.open({
      type: "error",
      title: t("dialog.error"),
      description: e.message,
      errorCode: e.code,   // e.g. "WBE1009"
      uuid: e.traceId,     // server trace_id, rendered verbatim for support
    });
  }
}
```

- `ApiCallError { code, message, traceId }` is produced by the per-domain API wrappers when they
  unwrap the `{ status, data, … }` envelope (`status.error === true`). See the error-envelope docs.
- The system dialog only **displays** `errorCode` (via the `dialog.error_code` key) and `uuid` (via
  `dialog.uuid`) — it has no knowledge of where they came from (`SystemDialog.tsx:232-233`).
- 401s are handled separately by the global session-expired interceptor in `lib/axios.ts`, which may
  open its own `<SessionExpiredDialog>` (a feature dialog at `stackLevel={5}`) — also documented under
  error-envelope, not here.

## Cross-link

- **Error-envelope (frontend):** [`../error-envelope/README.md`](../error-envelope/README.md) +
  [`../error-envelope/api-consumption.md`](../error-envelope/api-consumption.md) — envelope parsing,
  `ApiCallError`, `trace_id` rendering, 401 re-auth.
- **Error-envelope (backend twin):**
  [`../../../../../wecms-api/docs/features/common/error-envelope/README.md`](../../../../../wecms-api/docs/features/common/error-envelope/README.md).
- **Shared error-code registry:**
  [`../../../../../docs/_shared/error-code-registry.md`](../../../../../docs/_shared/error-code-registry.md).
