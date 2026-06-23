# Dialog & Popup — System Dialogs + Modal Stack (Frontend)

**Part of:** Common → dialog-popup
**Last verified:** 2026-06-23

> **WEB-only — no backend surface.** `dialog-popup` has **no route, no page, and no backend
> endpoint**. "Popup" is not a backend concept in the refactor — the API speaks the JSON
> `{ status, data }` envelope and renders no UI. This module documents two pure-UI primitives that
> every screen in the product reuses:
>
> 1. The **global system dialog** — `useDialog()` → `<SystemDialog>` (warning / error / success /
>    confirmation), mounted once in the app layout, rendered to its own portal at `z-[100]`.
> 2. The **stacked feature-dialog ladder** — the shadcn `<DialogContent stackLevel={1..5}>`
>    z-index / backdrop / interaction system plus `lib/modalStack.ts` ESC gating.

## What this covers (frontend)

| Concern | Source of truth |
|---|---|
| Global system dialog API | [`components/shared/dialog/DialogProvider.tsx`](../../../../components/shared/dialog/DialogProvider.tsx) (`useDialog`, `<DialogProvider>`) |
| System dialog render | [`components/shared/dialog/SystemDialog.tsx`](../../../../components/shared/dialog/SystemDialog.tsx) (`createPortal` → `z-[100]`) |
| System dialog icon glyphs + colours | [`components/shared/dialog/DialogIcon.tsx`](../../../../components/shared/dialog/DialogIcon.tsx) |
| Dialog option types | [`components/shared/dialog/types.ts`](../../../../components/shared/dialog/types.ts) (`DialogType`, `DialogOptions`, `DialogApi`) |
| Stacked feature-dialog primitive | [`components/ui/dialog.tsx`](../../../../components/ui/dialog.tsx) (`<DialogContent stackLevel>`, `STACK_Z_OVERLAY/CONTENT/OVERLAY_BG`) |
| Cross-modal ESC stack | [`lib/modalStack.ts`](../../../../lib/modalStack.ts) (`push` / `pop` / `isTop`) |
| Representative feature dialogs | [`components/shared/popups/`](../../../../components/shared/popups/) (SelectBank, PasswordConfirmation, …) |

## Documents

| Doc | Scope |
|---|---|
| [screen-flow.md](screen-flow.md) | System dialog open/close lifecycle + stacked feature-dialog chain open/close + ESC top-most-only gating |
| [ui-specification.md](ui-specification.md) | The 4 system-dialog variants + icon colours + button colour rule + the `stackLevel` z-index/backdrop-dim table + radius tokens |
| [component-index.md](component-index.md) | `useDialog` / `<SystemDialog>` / `<DialogProvider>`, shadcn `<DialogContent stackLevel>`, `lib/modalStack`, representative `components/shared/popups/*` |
| [api-consumption.md](api-consumption.md) | **NONE** — dialogs are pure UI. Notes only that a system *error* dialog renders an `ApiCallError` from the error-envelope module; cross-link there |
| [test-scenarios.md](test-scenarios.md) | Variant correctness (error vs warning), confirmation pair, 5-level stack interaction / close, focus trap, ESC top-most-only, body scroll lock |

## Related

- **Common frontend hub:** [`../README.md`](../README.md)
- **Backend stub (WEB-only, no backend surface):** [`../../../../../wecms-api/docs/features/common/dialog-popup/README.md`](../../../../../wecms-api/docs/features/common/dialog-popup/README.md)
- **Error-envelope sibling (the contract error dialogs consume):** [`../error-envelope/README.md`](../error-envelope/README.md) — `ApiCallError` + `trace_id` rendering
- **Common audit deliverables:** `common-source-index.md`, `common-gap-analysis.md`, `common-docs-audit.md` (backend-side under [`../../../../../wecms-api/docs/audits/`](../../../../../wecms-api/docs/audits/common-source-index.md))
- **Frontend rules:** `wecms-web/CLAUDE.md` §"Dialogs & modals", §"Dialog variant — choose the right `type`", §"Dialog buttons — project-wide colour rule", §"Modal stacking convention", §"Modal stack — interaction & close behaviour"

## Naming traceability

Slug `dialog-popup` matches the backend stub counterpart `dialog-popup/README.md`. The two primitives
were historically two JEX concerns — the `comm_0108`-era message popups (system dialog) and the
`layerPopup` JSP modal stack (feature dialogs) — now unified under one cross-cutting frontend slug.
