# Own Account Transfer — Transfer Confirmation Modal Was 300px Narrower Than Legacy

**Date:** 2026-08-19
**Type:** PARITY FIX
**Current Work Classification:** BUG
**Finding Classification:** BUG — modal width diverged from the legacy `.layerCont.middle` size class
**Investigation Status:** COMPLETE (see the audit, Finding 3a)
**Approval Status:** APPROVED — Sonny, 2026-08-19: "please update the width to 860px please."
**Implementation Status:** COMPLETE
**Test Status:** PASS
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Paired backend record:** none — presentation-only.

**Evidence / investigation:**
[Transfer Confirmation Modal UI + Displayed-Value Parity Audit](../audits/own-account-transfer-transfer-confirmation-modal-parity-audit-2026-08-19.md)
§ Finding 3a — measured legacy dimensions. Not duplicated here.

> **Separate record by design.** The sibling record
> [own-account-transfer-confirmation-display-fields-2026-08-19.md](own-account-transfer-confirmation-display-fields-2026-08-19.md)
> explicitly scoped the modal chrome **out** and is already `READY FOR MANUAL COMMIT`. Width was a
> distinct finding (3a), separately approved, so it gets its own record per CLAUDE.md §12c / §16i
> rather than being appended to a completed one.

## Problem

The Transfer Confirmation modal rendered at `max-w-[560px]` against legacy's `860px` — 300px
narrower, which is the difference the reporter saw when comparing the two screenshots side by side.

## Current Behavior (before the fix)

`TransferConfirmationDialog.tsx` passed `className="max-w-[560px] …"` to `<DialogContent>`.

## Expected Behavior

`860px`, matching the legacy `.layerCont.middle` size class the popup wrapper uses
(`nxisas_v2.js:621` → `_common.css:1874`) — at every breakpoint, since no legacy `@media` rule
narrows it.

## Scope

The `max-w-*` cap on this one dialog, plus a viewport guard so the wider cap does not break narrow
breakpoints (see Root Cause / Implementation).

## Out of Scope

- **Height** — legacy caps the *content box* at `580px` / `710px` responsively
  (audit Finding 3a); the refactor is content-driven with a `custom-scrollbar-y` region and behaves
  equivalently. Reporter confirmed the height is already correct. **No change.**
- The rest of Finding 3 — card tint (legacy `rgba(0,105,185,0.03)` vs refactor
  `bg-wb-bg-sidebar`), button layout, title size, padding. These are locked by CLAUDE.md §3a/§3b and
  still need a PO decision. **Open question unchanged.**
- `components/ui/dialog.tsx` — the shared primitive is NOT modified; the guard is scoped to this
  dialog so no other dialog's behaviour changes (`feedback_preserve_existing_code`).

## Root Cause

The refactor picked its own cap instead of legacy's `.layerCont.middle` width. Full measurement
table in the audit.

**Second-order issue found while implementing** — and the reason this is not a pure one-token edit:
the shared primitive's base classes are

```
fixed left-1/2 top-1/2 … max-h-[calc(100vh-32px)] w-full max-w-[500px] …
```

Height is viewport-guarded (`max-h-[calc(100vh-32px)]`); **width is not.** Because the element is
`position: fixed`, `w-full` resolves against the viewport, so the rendered width is
`min(100vw, max-w)`. At `max-w-[860px]` the dialog would therefore sit **edge-to-edge with zero
margin on any viewport below 860px** — including the 768px breakpoint CLAUDE.md §9 requires to
render correctly. (The pre-existing `560px` had the same latent flaw, but only below 560px; raising
the cap widens the exposure to 768px, which is a supported breakpoint.)

## Implementation

`max-w-[560px]` → `max-w-[min(860px,calc(100vw-32px))]`:

- **860px on desktop** — exact legacy parity at 1024 / 1440 and above.
- **`calc(100vw-32px)` below that** — preserves a 16px gutter each side, mirroring the primitive's
  own `max-h-[calc(100vh-32px)]` convention so the horizontal and vertical guards match.

CLAUDE.md §3a permits exactly this change: "**only `max-w-*` is allowed to vary** between feature
dialogs". Padding, typography, and button heights are untouched.

## Files Changed

| File | Change |
|---|---|
| [components/banking/own-account-transfer/TransferConfirmationDialog.tsx](../../components/banking/own-account-transfer/TransferConfirmationDialog.tsx) | `max-w-[560px]` → `max-w-[min(860px,calc(100vw-32px))]` + comment citing the legacy source |

## API Impact

None.

## UI Impact

The Transfer Confirmation modal is 300px wider on desktop, matching legacy. Its single-column layout
(120px label column + value column) simply gives the value column more room; no row wraps
differently and no other dialog is affected.

## Database Impact

NONE (frontend) — no dependency.

## Integration Impact

None — presentation only. The NXiSAS bridge and engine payload are untouched.

## Verification

### Tailwind Utility Generation — the check that mattered

The arbitrary value had to be proven to compile: `<DialogContent>` falls back to the primitive base
`max-w-[500px]` if the class is never generated, which would have left the modal **narrower than
before the fix**. Verified by compiling a probe with this project's own Tailwind (v4.3.3):

```
npx @tailwindcss/cli -i <probe>.css -o out.css
→ .max-w-\[min\(860px\,calc\(100vw-32px\)\)\] {
      max-width: min(860px, calc(100vw - 32px));
  }
```

- Result: **PASS** — the utility is emitted with the expected declaration.

### Automated Tests

- Command: `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 9 files, 111 tests passed, 0 failed. No regression from the width change.

### Type Check

- Command: `npx tsc --noEmit`
- Result: **PASS for this change** — the only 2 errors are the pre-existing missing locale key in
  `OwnAccountTransferComposerDialog.locales.test.ts` (**category B**, unrelated, untouched).

### Regression Test

**NO automated regression test — justified (CLAUDE.md §14d).** The change is a single presentational
cap. A unit test asserting the `className` string would pin implementation detail rather than
observable behaviour (§14c) and — critically — would **not** have caught the real risk here, a
Tailwind generation failure, because jsdom applies no stylesheet. The meaningful guard is the
utility-generation check above, which was executed. This repo has no visual-regression tooling
(`docs/testing/testing-strategy.md`).

### Manual Verification

- Environment: —
- Result: **NOT RUN** — the modal was not rendered; opening it needs the licensed NXiSAS engine and
  live bank credentials. **Breakpoint behaviour at 375 / 768 / 1024 / 1440 (CLAUDE.md §9) is
  therefore unverified in-app** — it is reasoned from the emitted CSS, not observed.

## Result

The modal now caps at **860px**, matching legacy `.layerCont.middle`, with a 16px gutter preserved
below that width. **Visual confirmation in the running app is outstanding** (see Manual
Verification).

## Known Limitations / Follow-up

1. **Not visually verified.** The reporter should confirm at a wide viewport (≥1024px) that the modal
   matches legacy's width, and at 768px that it keeps a margin instead of touching both edges.
2. **The shared primitive still has no horizontal viewport guard.** `components/ui/dialog.tsx` sets
   `w-full max-w-[500px]` with `max-h-[calc(100vh-32px)]` but no width equivalent, so **any** dialog
   whose cap exceeds the viewport sits edge-to-edge — e.g. `EditBankAccountDialog` at
   `max-w-[1024px]` below 1024px. Note the `SettingsModal` shell already carries its own
   `max-w-[calc(100vw-32px)]`, i.e. the pattern the primitive lacks. Fixing it centrally would be the
   root-cause change per CLAUDE.md §"Root-cause guidance — apply at the common layer", but it affects
   every dialog in the app and is **out of this record's approved scope**. Raised as a follow-up,
   not silently fixed.
3. **The rest of audit Finding 3 is unchanged** — card tint (legacy `rgba(0,105,185,0.03)` vs
   `bg-wb-bg-sidebar`), button layout, title size, padding. Still pending a PO decision.
