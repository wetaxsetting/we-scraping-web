# OTP dialog is wider than every other WeCMS modal

**Date:** 2026-08-27
**Type:** BUG FIX
**Current Work Classification:** BUG
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web

```
Investigation Status:  COMPLETE
Approval Status:       NOT REQUIRED — class C, "please tell me and fix it"
Implementation Status: COMPLETE
Test Status:           PASS
```

## Problem

The NXiSAS OTP prompt on Own Account Transfer renders noticeably **wider** than the confirmation
dialog that can appear on top of it, so the modal stack looks inconsistent — a wide panel with a
narrow one centred over it.

Reported by Sonny 2026-08-27 with two SIT screenshots taken seconds apart on
`wecms.kosign.dev/banking/transfer-own-accounts` (IBK VN transfer):

1. The OTP dialog ("IBK VN" · OTP graphic · `Enter OTP` field · Cancel / OK).
2. The system Confirmation dialog ("Would you like to quit the inquiry for IBK VN?" · No / Yes)
   stacked above it — visibly narrower.

## Current Behavior

`OtpAuthDialog` renders at a width that does not match the shared modal vocabulary. It capped at **660 px** — see Root Cause.

## Expected Behavior

The OTP dialog matches the width of the standard dialogs it sits alongside — the system
confirmation / success / error dialog and the feature save dialogs.

## Scope

Width of the OTP dialog only.

## Out of Scope

- The OTP flow itself (bridge, submit, retry, cancel semantics) — untouched.
- The confirmation dialog it is compared against — that one is the reference, not the defect.
- Other NXiSAS challenge surfaces (QNA / CAPTCHA) **unless** the investigation shows they share
  the same root cause, in which case they are pulled in and this record says so.

## Initial Investigation

- Component located: [`components/banking/own-account-transfer/OtpAuthDialog.tsx`](../../components/banking/own-account-transfer/OtpAuthDialog.tsx)
- Bridge: [`lib/nxisas/otp-bridge.ts`](../../lib/nxisas/otp-bridge.ts)
- Governing rules — `wecms-web/CLAUDE.md`:
  - §"Dialogs & modals": system dialogs (warning / error / success / confirmation) go through
    `useDialog()` and cap at **500 px**.
  - §3a: **feature** dialogs use the shadcn `<Dialog>` primitive and may vary **only** `max-w-*`.
  - §"Modal stacking convention": a dialog opened over another declares `stackLevel`.
- Not yet established: which of the two families the OTP dialog belongs to, what width it actually
  sets, and whether the sibling challenge dialogs share it.

## Root Cause

`OtpAuthDialog` capped its panel at **`max-w-[660px]`** while every dialog it appears beside caps
lower. It is a **repo-wide one-off** — `grep -rn "max-w-\[660px\]" components/` returns exactly one
hit, this component.

| Dialog | Cap | Note |
|---|---|---|
| `<SystemDialog>` — the Confirmation in the screenshot | **500 px** | [SystemDialog.tsx:200](../../components/shared/dialog/SystemDialog.tsx#L200) |
| shadcn `<DialogContent>` default | **500 px** | [dialog.tsx:235](../../components/ui/dialog.tsx#L235) |
| `<EngineNotInstalledDialog>` — same folder | 500 px | |
| `<EngineUnsupportedOsDialog>` — same folder | 540 px | |
| `<TransactionSyncDialog>` — the **sync flow's own OTP/QNA/CAPTCHA** prompt | 540 px | separate implementation, does not reuse `OtpAuthDialog` |
| **`<OwnAccountTransferComposerDialog>`** — the multi-field form the OTP interrupts | **480 px** | |
| **`<OtpAuthDialog>`** — one graphic, one input | **660 px** ← | the outlier |

The sharpest expression of the defect: **the OTP prompt was 180 px wider than the transfer form it
interrupts**, and 120 px wider than the app's other OTP prompt.

### The 660 px was deliberate, and that matters

The code carried a justification: *"Figma 274:7783 caps the modal at ~660 px (580 px image panel +
20 px each side + ~20 px X-icon gutter)."* So this was a considered value, not a slip — the Figma
frame sizes an image **panel** at 580 px, but the rendered image is `h-[68px] w-auto` centred in a
`h-[108px]` grey box, so the panel never needs that width in practice.

Under CLAUDE.md §3a a feature dialog may vary `max-w-*`, choosing "the smallest cap that fits the
Figma column template" — 660 px fails that test for a single-input body regardless of the frame.

**Decision:** Sonny, 2026-08-27 — match the standard. Recorded because a future contributor reading
Figma 274:7783 would otherwise have grounds to revert; the code comment says the same, and points
here.

## Implementation

One-line width change plus the comment that prevents an uninformed revert.

`max-w-[660px]` → `max-w-[500px]`. `rounded-2xl`, `p-0`, `stackLevel={2}`, the close semantics, and
the entire OTP flow (bridge, submit, cancel, retry) are untouched.

**Layout check at 500 px:** body is `px-6` (48 px total), leaving 452 px. The input row is a
`w-[180px]` label + `flex-1` field → ~260 px of input for a 6–8 digit code. The OTP graphic is
`h-[68px] w-auto` inside a `w-full` container, so it re-centres. Nothing is clipped.

## Files Changed

| File | Change |
|---|---|
| `components/banking/own-account-transfer/OtpAuthDialog.tsx` | `max-w-[660px]` → `max-w-[500px]`; comment records the decision + the superseded Figma citation |
| `components/banking/own-account-transfer/OtpAuthDialog.width.test.tsx` | **new** — 3 tests pinning the width |

## Verification

### Automated Tests

- Test:   `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 14 files, 185 tests, 0 failed
- Test:   `npx eslint` on both changed files
- Result: **PASS** — clean
- Test:   `npx tsc --noEmit`
- Result: **PASS for this change** — only the 2 pre-existing `engine_80002411` errors remain
  (missing from `ko.json`/`vi.json` on `origin/sit` already; unrelated)

### Regression Test

Test file:          `components/banking/own-account-transfer/OtpAuthDialog.width.test.tsx`
Test cases:         *caps at the shared 500px modal width, matching SystemDialog* ·
                    *is not the 660px one-off it shipped with* ·
                    *still renders the OTP input, so the width change did not gut the dialog*
Behavior protected: the OTP prompt keeps the shared modal width, and a revert to 660 px trips a
                    test instead of reaching SIT.

**Fail-before-fix verified:** 660 px was temporarily reinstated and the suite re-run — **2 of the 3
failed**; restoring 500 px returned 3/3. The third case asserts the input still renders and passes
either way by design, guarding against a width fix that breaks the body.

### Manual Verification

- Environment: LOCAL (tests only)
- Result: **NOT RUN** in a browser. The width is asserted from the rendered class, not observed —
  the visual match against the Confirmation dialog should be eyeballed once on SIT.

## Result

Implemented and verified locally.

## Known Limitations / Follow-up

1. **Not visually confirmed on SIT.** Reaching the OTP prompt needs a live bank challenge. Check it
   the next time a transfer triggers one.
2. **The sync flow's OTP prompt is still 540 px** (`TransactionSyncDialog`), a separate
   implementation. Left alone — it was not what was reported, it is within the sanctioned
   per-feature variation, and touching it is scope creep. Worth deciding deliberately if a single
   OTP width across the app is wanted.
3. **Two OTP implementations exist.** `OtpAuthDialog` (transfer) and the challenge UI inside
   `TransactionSyncDialog` (sync) render the same concept twice. Under the two-call rule that is an
   extraction candidate — a separate, larger piece of work.
4. **The Figma frame still says 660 px.** If 274:7783 is the reference for anything else here, it
   and the code now disagree on width by design.
