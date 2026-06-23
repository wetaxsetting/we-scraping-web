# Dialog & Popup — Test Scenarios

**Part of:** Common → dialog-popup
**Last verified:** 2026-06-23

Pure-UI test matrix. No backend stubbing needed — dialogs make no network calls.

## 1. System dialog — variant correctness

| # | Scenario | Expected |
|---|---|---|
| 1.1 | `open({ type: "error" })` | red `#D64545` circle-✕ icon; title `t("dialog.error")`; **single** primary OK button (blue) |
| 1.2 | `open({ type: "warning" })` | amber `#F5A524` triangle-! icon; title `t("dialog.warning")`; single primary OK |
| 1.3 | `open({ type: "success" })` | brand-blue `#0060B9` circle-✓ icon; title `t("dialog.success")`; single primary OK |
| 1.4 | `open({ type: "confirmation" })` | teal `#22A88B` circle-? icon; title `t("dialog.confirmation")`; **two** buttons — Cancel (white/left) + Continue (blue/right) |
| 1.5 | **error vs warning regression** | an API/network/validation failure surfaced as `type: "error"` shows the **red** icon — NOT amber. A `type:"warning"` API error is the canonical bug to catch |
| 1.6 | confirmation icon colour | teal/green — **not** brand blue (brand blue is success only) |
| 1.7 | `errorCode` + `uuid` supplied | trailer lines render below the body via `dialog.error_code` / `dialog.uuid` keys |
| 1.8 | title omitted | falls back to `t(DEFAULT_TITLE_KEY[type])`; never a module name |

## 2. System dialog — buttons

| # | Scenario | Expected |
|---|---|---|
| 2.1 | primary always present | every type renders the primary button; `confirmText:""` does NOT hide it (a UX bug to guard against) |
| 2.2 | secondary only on confirmation | Cancel renders only when `type === "confirmation"` |
| 2.3 | `destructive: true` on confirmation | primary becomes red (`bg-destructive`); Continue/Delete CTA |
| 2.4 | `destructive: true` on error/warning/success | **ignored** — primary stays brand blue |
| 2.5 | confirmation pair order | Cancel LEFT, Continue RIGHT; `gap-[10px]` |
| 2.6 | label overrides | `confirmText` / `cancelText` override defaults; defaults = OK / Continue / Cancel per type |
| 2.7 | colour locking | no page-supplied className changes the button colour — variant + `destructive` are the only knobs |

## 3. System dialog — close behaviour

| # | Scenario | Expected |
|---|---|---|
| 3.1 | click OK (success) | `onConfirm?.()` fires, dialog closes (`onDismiss`) |
| 3.2 | click Cancel (confirmation) | `onCancel?.()` fires, dialog closes |
| 3.3 | click X | `onClose?.()` fires, dialog closes |
| 3.4 | **click backdrop** | **nothing happens** — outside click never dismisses a system dialog |
| 3.5 | press ESC, `dismissible:true`, top-most | dialog closes |
| 3.6 | press ESC, `dismissible:false` | nothing — X is hidden and ESC is suppressed |
| 3.7 | second `open(...)` while one is visible | **replaces** the current dialog — never two backdrops, only one at a time |
| 3.8 | focus on open | primary button focused; on close, focus returns to the previously-focused element |

## 4. System dialog — accessibility

| # | Scenario | Expected |
|---|---|---|
| 4.1 | roles | `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby` wired |
| 4.2 | Tab focus trap | Tab / Shift-Tab cycle inside the card only; never escape to the page behind |
| 4.3 | body scroll lock | `document.body` overflow is `hidden` while open; restored on close |

## 5. Stacked feature-dialog ladder (5 levels)

Canonical chain: Settings (L1) → Registered (L2) → Select Bank (L3) → Login ID/PW (L4) →
Select Bank Accounts (L5).

| # | Scenario | Expected |
|---|---|---|
| 5.1 | z-index layering | each level's content sits above its own overlay AND above every lower level's content (50/50, 60/61, 70/71, 80/81, 90/91) |
| 5.2 | backdrop dim grows gently | L1 ≈45 %, +L2 ≈56 %, +L3 ≈65 %, +L4 ≈72 %, +L5 ≈78 % — never opaque |
| 5.3 | top-most only interactive | only the top layer accepts clicks / scroll / keyboard / form input; lower layers visible but inert |
| 5.4 | focus trap per layer | Tab cycles within the top-most layer; never reaches a parent dialog or the page |
| 5.5 | body scroll lock once | L1 mount locks body; children do NOT re-lock; lock holds until the whole chain unmounts |
| 5.6 | outside-click L1 (standalone) | default dismisses (Radix historical) |
| 5.7 | outside-click L2–L5 | default does **not** dismiss; a near-panel-edge click never closes a nested popup |
| 5.8 | outside-click never cascades | a dismissible child's outside-click closes only that child, never the parent underneath |

## 6. ESC — top-most-only

| # | Scenario | Expected |
|---|---|---|
| 6.1 | ESC in L1→L2→L3 chain | ESC #1 closes L3, ESC #2 closes L2, ESC #3 closes L1 — one layer per keypress |
| 6.2 | never two per keypress | a single ESC never pops two layers or the whole chain |
| 6.3 | system dialog over a chain | ESC closes the system dialog only (it is top-most while visible); the chain underneath is untouched |
| 6.4 | `closeOnEscape={false}` on a level | ESC is suppressed for that level even when it is top-most |

## 7. System dialog floats above the chain

| # | Scenario | Expected |
|---|---|---|
| 7.1 | save-success from inside L5 | the success dialog (`z-[100]`) renders **above** the entire L1–L5 chain, not behind it |
| 7.2 | validation error from inside a stacked form | error dialog appears on top; background chain is inert; closing it returns to the chain unchanged |

## Notes

- No API mocks required — assert only DOM / portal / focus / class-token state.
- Colour assertions target the verified hex/token values in `ui-specification.md`.
- Stack assertions can drive `lib/modalStack` directly (`push` / `pop` / `isTop`) or via mounting the
  real `<DialogContent stackLevel>` chain.
