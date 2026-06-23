# Dialog & Popup — Screen Flow

**Part of:** Common → dialog-popup
**Last verified:** 2026-06-23

Two independent runtime surfaces: the **system dialog** (one at a time, `z-[100]`) and the
**stacked feature-dialog ladder** (`stackLevel` 1–5). They coexist — the system dialog always floats
above any open feature-dialog chain.

## 1. System dialog — open / close lifecycle

Source: [`DialogProvider.tsx`](../../../../components/shared/dialog/DialogProvider.tsx) +
[`SystemDialog.tsx`](../../../../components/shared/dialog/SystemDialog.tsx).

| Step | What happens | Code |
|---|---|---|
| Mount | `<DialogProvider>` is mounted **once** near the app root; holds a single `useState<DialogOptions \| null>` | `DialogProvider.tsx:38-39` |
| Open | Any client component calls `useDialog().open({ type, … })`; `setDialog(options)` replaces whatever was shown — **only one dialog at a time** | `DialogProvider.tsx:41-43` |
| Render | When `dialog` is non-null, `<SystemDialog open {...dialog} onDismiss={close} />` renders via `createPortal(..., document.body)` at `z-[100]` | `DialogProvider.tsx:54-60`, `SystemDialog.tsx:171,188` |
| Focus + lock | On open: capture `document.activeElement`, set `document.body.style.overflow = "hidden"`, focus the primary button | `SystemDialog.tsx:80-90` |
| Stack register | `modalStack.push()` returns a stack id used to gate ESC | `SystemDialog.tsx:99` |
| Close | Explicit only — primary OK/Confirm (`handleConfirm`), Cancel (`handleCancel`, confirmation only), X (`handleClose`), or ESC (gated). Each calls `onDismiss()` → `setDialog(null)` | `SystemDialog.tsx:156-169` |
| Unmount | Restore previous `overflow`, return focus to the previously-focused element, `modalStack.pop(stackId)` | `SystemDialog.tsx:86-89,124-127` |

**Close affordances (explicit only):**

| Trigger | Closes? | Notes |
|---|---|---|
| Primary button (OK / Continue) | ✅ | `handleConfirm` → `onConfirm?.()` then `onDismiss()` |
| Secondary button (Cancel) | ✅ | confirmation type only — `handleCancel` → `onCancel?.()` then `onDismiss()` |
| X close button | ✅ | `handleClose` → `onClose?.()` then `onDismiss()`; hidden when `dismissible=false` (`SystemDialog.tsx:208-212`) |
| ESC key | ✅ *gated* | only when `dismissible` **and** `modalStack.isTop(stackId)` (`SystemDialog.tsx:101-105`) |
| Outside / backdrop click | ❌ | by policy — no backdrop `onMouseDown` / `pointerdown` listener exists (`SystemDialog.tsx:131-152`) |

> **Why no outside-click dismiss.** A system dialog conveys a committed result (a save just
> succeeded, an error just occurred, a destructive action needs explicit confirmation). A stray
> backdrop click during a stacked chain would silently miss the user's acknowledgement. Closing
> stays an explicit, intentional action. The wrapper's `pointer-events-auto` makes this layer absorb
> every click aimed at the chain below — so the background is non-interactive while the dialog is up.

## 2. Stacked feature-dialog chain — open / close lifecycle

Source: [`components/ui/dialog.tsx`](../../../../components/ui/dialog.tsx) (Radix-backed) +
[`lib/modalStack.ts`](../../../../lib/modalStack.ts).

Canonical 5-level chain currently in production:

```
L1  Settings modal                       (SettingsModal — paints its own bg-black/45)
 └ L2  Registered Login Credentials       (<DialogContent stackLevel={2}>)
     └ L3  Select Bank                     (stackLevel={3})
         └ L4  Login ID / PW               (stackLevel={4})
             └ L5  Select Bank Accounts    (stackLevel={5})
─────────────────────────────────────────────────────────
System feedback layer (useDialog → z-[100]) floats above ALL of L1–L5
```

| Step | What happens | Code |
|---|---|---|
| Open | A child dialog mounts with its `stackLevel` (e.g. `<SelectBankDialog>` defaults to `stackLevel={3}`); `DialogContent` resolves overlay/content z + backdrop bg from the level tables | `dialog.tsx:206-208` |
| Stack register | On mount, `modalStack.push()` inside a `useEffect`; id kept in a ref (push lives in the effect so StrictMode double-invoke balances) | `dialog.tsx:218-226` |
| Body scroll lock | The **L1** mount locks `document.body` overflow; children do **not** each re-lock — the L1 lock covers the whole stack | (SettingsModal / SystemDialog own the lock) |
| Top-most only | Only the top-most modal is interactive; lower overlays keep `pointer-events: auto` and block clicks / scroll / keyboard from reaching parents | `dialog.tsx` overlay + §"Modal stack — interaction & close behaviour" |
| Close (ESC) | `onEscapeKeyDown` → if `!modalStack.isTop(thisId)` `preventDefault()` (consume nothing); else honour `closeOnEscape` (default `true`) | `dialog.tsx:251-267` |
| Close (outside) | `onPointerDownOutside` / `onInteractOutside` → honoured only when `dismissOnOutside` (= `closeOnOutsideClick ?? stackLevel === 1`) | `dialog.tsx:212,239-250` |
| Unmount | `modalStack.pop(id)` in the effect cleanup | `dialog.tsx:222-225` |

## 3. ESC — top-most-only gating

`lib/modalStack.ts` is a single window-level stack mirroring the visible modal chain. Each open modal
(`SystemDialog`, every Radix `<DialogContent>`, `SettingsModal`) calls `push()` on mount and `pop(id)`
on unmount. Every ESC handler checks `isTop(id)` **before** dismissing.

```
Settings (L1) → Registered (L2) → Select Bank (L3) open.
ESC #1 → only L3's handler passes isTop → L3 closes.
ESC #2 → only L2's handler passes isTop → L2 closes.
ESC #3 → only L1 (Settings) passes isTop → Settings closes.
```

- Never two layers per keypress; never the whole chain at once (`modalStack.ts:25-41`).
- The system dialog, when opened above a chain, consumes **its own** Escape only — because it is the
  top of the stack while visible (`SystemDialog.tsx:101-105`).

## Default close behaviour by layer

| Layer | Outside-click default | ESC default | Source |
|---|---|---|---|
| System dialog (`z-[100]`) | never (no listener) | on, gated by `dismissible` + `isTop` | `SystemDialog.tsx` |
| `stackLevel={1}` (standalone) | **true** (`closeOnOutsideClick ?? stackLevel===1`) | true, gated by `isTop` | `dialog.tsx:212` |
| `stackLevel={2..5}` (stacked) | **false** | true, gated by `isTop` | `dialog.tsx:212` |

Both feature-dialog defaults are overridable per call via `closeOnOutsideClick` / `closeOnEscape`.
