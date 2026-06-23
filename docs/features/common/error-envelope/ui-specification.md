# UI Specification — Error Dialog & Trace-id Display

**Part of:** Common → error-envelope
**Last verified:** 2026-06-23

The error envelope has no page UI. Its only visible surface is the **system error dialog** rendered via
`useDialog()` → [`<SystemDialog>`](../../../../components/shared/dialog/SystemDialog.tsx).

## 1. Dialog variant — always `"error"` for failures

Per `wecms-web/CLAUDE.md` §"Dialogs & modals", an API/network/server failure or a validation rejection
**must** use `type: "error"` (red icon) — **never** `type: "warning"`. Warning chrome on a failure is the
canonical regression that rule exists to prevent.

| `type` | Icon | Title key | Use for here |
|---|---|---|---|
| `"error"` | **Red** | `t("dialog.error")` | API failure · network error · server exception · validation failure |

Title rule: the title is the **variant** (`t("dialog.error")` → "Error" / "오류" / "Lỗi"), never the module
name. Per-feature `<feature>.error.title` keys that resolve to a module name are forbidden.

## 2. Button + chrome

`"error"` renders a **single primary** OK button (blue `bg-brand` + white text), per the project-wide
button rule. No `destructive` flag, no custom colour, no second button.

- Rendered via `createPortal()` at `z-[100]` — above every feature-dialog `stackLevel` so an error opened
  from inside a stacked Settings chain appears on top.
- **Explicit-dismiss only** — OK / X. Overlay click and ESC do **not** dismiss (matches §"Dialogs & modals").
- Max width 500 px (system-dialog cap — distinct from feature dialogs).

## 3. Trace-id / diagnostic trailer

`<SystemDialog>` renders a diagnostic trailer beneath the description when the caller supplies the
optional props (`SystemDialog.tsx:56-57, 232-233`):

| Prop | Rendered as | i18n key |
|---|---|---|
| `errorCode` | "Error code: `WBExxxx`" trailer | `t("dialog.error_code", { code })` |
| `uuid` | a `break-all` line carrying the diagnostic id | `t("dialog.uuid", { uuid })` |

The server-supplied **`trace_id`** (from the error envelope body, also in the `X-Trace-Id` header) is the
value a user quotes back to support; surface it through the `uuid` slot (or alongside `errorCode`) so it
renders verbatim and ops can grep server logs by it.

> The `localTraceId()` fallback (id ending `LOCL`) only fires on a pure network failure where there is no
> response body — that id is browser-local and won't grep against server logs (`wecms-web/CLAUDE.md`
> §"Error handling (frontend side)").

## 4. Typography & tokens

The dialog inherits the shared system-dialog typography (no per-call overrides). Body text + trailer use
the standard `text-wb-*` tokens; arbitrary `text-[Npx]` / inline `style` is forbidden. Pages must not pass
custom button class names or restyle the dialog — the variant + `destructive` flag are the only knobs.

## 5. What NOT to build

- No bespoke red-icon "looks like an error" component outside `useDialog()`.
- No per-page error banner.
- No "UNKNOWN" / "Unexpected error" without a code — always pass `errorCode` (real backend code, or
  `WBE_NETWORK` / `WBE_CLIENT_PARSE` from the funnel).

## Cross-links

- Flow that opens this dialog: [screen-flow.md](screen-flow.md)
- Components: [component-index.md](component-index.md)
