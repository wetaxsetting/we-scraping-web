# Dialog & Popup — UI Specification

**Part of:** Common → dialog-popup
**Last verified:** 2026-06-23

## 1. System dialog — the four variants

Source: [`SystemDialog.tsx`](../../../../components/shared/dialog/SystemDialog.tsx) +
[`DialogIcon.tsx`](../../../../components/shared/dialog/DialogIcon.tsx) +
[`types.ts`](../../../../components/shared/dialog/types.ts). One dialog at a time; `createPortal`
to `document.body` at `z-[100]`.

| `type` | Icon glyph | Icon colour | Default title key | Buttons rendered |
|---|---|---|---|---|
| `"error"` | circle + ✕ | **red `#D64545`** | `dialog.error` | single primary (OK) |
| `"warning"` | triangle + ! | **amber `#F5A524`** | `dialog.warning` | single primary (OK) |
| `"success"` | circle + ✓ | **brand blue `#0060B9`** | `dialog.success` | single primary (OK) |
| `"confirmation"` | circle + ? | **teal `#22A88B`** | `dialog.confirmation` | secondary (Cancel) + primary (Continue) |

- Colours are fixed in `DialogIcon.tsx:14-19` (`COLORS` record). Confirmation is teal — **not** brand
  blue (brand blue is reserved for success acks). Glyphs are inline 38×38 SVGs, not exported assets.
- Variant choice drives icon + title + chrome and is **not** interchangeable. API/network/validation
  failures use `"error"` (red), never `"warning"`. See `wecms-web/CLAUDE.md` §"Dialog variant — choose
  the right `type`".
- Title resolves to `title ?? t(DEFAULT_TITLE_KEY[type])` — always one of the shared `dialog.*` keys,
  never a module name (`SystemDialog.tsx:38-43,76`).

### Card / layout spec (identical across all four)

| Region | Spec | Source |
|---|---|---|
| Card | `rounded-[12px] bg-white shadow-[0_2px_30px_0_rgba(0,0,0,0.08)]`, `max-w-[500px]` | `SystemDialog.tsx:200` |
| Overlay | `fixed inset-0 z-[100] … bg-black/45`, `pointer-events-auto` | `SystemDialog.tsx:188` |
| Header | close button, `justify-end px-[14px] pt-[14px]`, 18 px X glyph | `SystemDialog.tsx:203-216` |
| Body | 38 px icon + 18/600 black title + 14/22 500 `#404040`-class body; bottom divider `border-black/15`; `px-6 py-5`, centred | `SystemDialog.tsx:219-235` |
| Footer | right-aligned button row, `p-[14px] gap-[10px]` | `SystemDialog.tsx:263-286` |
| Trailer | optional `errorCode` (`dialog.error_code`) + `uuid` (`dialog.uuid`) lines under the body | `SystemDialog.tsx:232-233` |

A11y: `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` / `aria-describedby` wired to the
title / body ids (`SystemDialog.tsx:196-199`). Tab is trapped inside the card (`SystemDialog.tsx:107-121`).

## 2. Button colour rule (project-wide)

Enforced inside the primitive — pages MUST NOT pass custom button classes. The variant + the
`destructive` flag are the only knobs.

| Role | Used for | Colour | Token (verified in `SystemDialog.tsx`) |
|---|---|---|---|
| **Primary** | OK · Continue · Confirm · Save · Done | brand blue bg + white text | `bg-brand hover:bg-brand-hover text-white font-semibold` (`:281`) |
| **Secondary** | Cancel · Close · Back | white bg + grey border + black text | `bg-white border-wb-border-sidebar text-black hover:bg-black/5 font-medium` (`:268`) |
| **Destructive primary** | single-row Delete (rare) | red bg + white text | `bg-destructive hover:bg-destructive/90` (`:280`) |

- Primary button shape: `rounded-md px-[14px] py-[8px] text-wb-13 font-semibold tracking-wb-tight`
  (`SystemDialog.tsx:277-278`).
- **`destructive: true` is meaningful only on `type: "confirmation"`** — ignored on error / warning /
  success (`types.ts:27-34`). The primary button is **always** rendered for every type; only the Cancel
  secondary is gated by `isConfirmation` (`SystemDialog.tsx:264-272`).
- Default labels: primary = `confirmText ?? t(isConfirmation ? "dialog.continue" : "dialog.ok")`;
  secondary = `cancelText ?? t("dialog.cancel")` (`SystemDialog.tsx:74-75`).
- The `bg-destructive` token is the shadcn-default destructive token (registered in `@theme inline`,
  exercised everywhere `<Button variant="destructive">` is used) — **not** the WB365 `wb-red-07` token,
  which resolved transparent in some build environments (note `SystemDialog.tsx:247-262`).

## 3. Stacked feature-dialog ladder — z-index + backdrop dim

Source: [`components/ui/dialog.tsx`](../../../../components/ui/dialog.tsx)
(`STACK_Z_OVERLAY` `:109-115`, `STACK_Z_CONTENT` `:117-126`, `STACK_OVERLAY_BG` `:128-134`).

| `stackLevel` | Overlay z | Content z | Overlay backdrop | Default outside-click |
|---|---|---|---|---|
| `1` (root / standalone) | `z-50` | `z-50` | `bg-black/45` (DialogOverlay default) | **true** |
| `2` | `z-[60]` | `z-[61]` | `bg-black/20` | false |
| `3` | `z-[70]` | `z-[71]` | `bg-black/20` | false |
| `4` | `z-[80]` | `z-[81]` | `bg-black/20` | false |
| `5` | `z-[90]` | `z-[91]` | `bg-black/20` | false |
| — system dialog — | `z-[100]` | `z-[100]` | `bg-black/45` | never (explicit only) |

- **Two z-indexes per level, overlay one notch below content** — so the panel is unambiguously above
  its own backdrop regardless of portal mount order / stacking-context resolution (`dialog.tsx:78-93`).
  L1 keeps content == overlay (`z-50`) for parity with the historical Radix default (`dialog.tsx:118-119`).
- **Per-level backdrop alpha:** L1 = `bg-black/45`; L2–5 = `bg-black/20` (lighter) so cumulative dim
  stays readable as the stack grows (`dialog.tsx:96-107`):

  | Open chain | Cumulative dim |
  |---|---|
  | L1 alone | ≈ 45 % |
  | L1+L2 | ≈ 56 % |
  | L1+L2+L3 | ≈ 65 % |
  | L1+L2+L3+L4 | ≈ 72 % |
  | L1+L2+L3+L4+L5 | ≈ 78 % |

- The system dialog (`z-[100]`) is **independent of `stackLevel`** — it renders to its own portal above
  every feature level (current max L5 → `z-[91]`) so a save-success / validation-error opened from inside
  a stacked chain appears above the chain, not behind it (`SystemDialog.tsx:28-36`). If a future
  `stackLevel` exceeds `z-[91]`, the system dialog's `z-[100]` must move past it too — never lowered.
- Per-call backdrop override via `overlayClassName`; outside-click / ESC override via
  `closeOnOutsideClick` / `closeOnEscape` (`dialog.tsx:170-188`).

## 4. Radius tokens

| Surface | Radius | Source |
|---|---|---|
| System dialog card | `rounded-[12px]` | `SystemDialog.tsx:200` |
| System dialog buttons | `rounded-md` | `SystemDialog.tsx:268,277` |
| Feature `<DialogContent>` | `rounded-lg` | `dialog.tsx:235` |
| Settings shell (`<SettingsModal>`) | `rounded-[12px]` (legacy `.layerPopupWrap`) | per `wecms-web/CLAUDE.md` §3b/F |
| Settings dialogs | `rounded-2xl` (16 px) | per `wecms-web/CLAUDE.md` §3b/C |

## 5. Feature `<DialogContent>` rhythm (for reference)

The shadcn feature-dialog shell (distinct from the system dialog) fixes the rhythm — only `max-w-*`
varies per feature (`dialog.tsx:9-55,285-320`): `DialogHeader` `px-6 pt-6 pr-14 gap-1`, `DialogBody`
`px-6 py-4`, `DialogFooter` `border-t px-6 py-3 gap-2 justify-end`, title `text-wb-18 font-semibold`,
description `text-wb-13 font-normal text-wb-muted`, default `max-w-[500px]`.
