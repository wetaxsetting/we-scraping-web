# Own Account Transfer — Transfer Confirmation Row Text Was 14px Instead of 13px

**Date:** 2026-08-19
**Type:** PARITY FIX
**Current Work Classification:** BUG
**Finding Classification:** BUG — row label/value text diverged from both the section heading and the WeCMS 13px body standard
**Investigation Status:** COMPLETE (see the audit, Finding 3b)
**Approval Status:** APPROVED — Sonny, 2026-08-19: section heading *"(kept this font size)"*, rows *"please chage it: i think should be the same this font size on this: • Sender Account Information"*, and *"All font size location."*
**Implementation Status:** COMPLETE
**Test Status:** PASS
**Status:** READY FOR MANUAL COMMIT
**Repository:** wecms-web
**Issue:** —
**Paired backend record:** none — presentation-only.

**Evidence / investigation:**
[Transfer Confirmation Modal UI + Displayed-Value Parity Audit](../audits/own-account-transfer-transfer-confirmation-modal-parity-audit-2026-08-19.md)
§ Finding 3b — measured row typography. Not duplicated here.

> **Separate record.** Finding 3b deliberately split the modal's row **indent** (fixed in
> [own-account-transfer-confirmation-modal-width-2026-08-19.md](own-account-transfer-confirmation-modal-width-2026-08-19.md)
> Amendment 1, since committed) from its row **typography**, which was held pending a decision. That
> decision has now been made, so the typography work gets its own record rather than an amendment to a
> committed one (CLAUDE.md §12c).

## Problem

The label/value rows rendered at **14px** while their own section heading rendered at **13px**, so
each block read as heading-smaller-than-content:

```
• Sender Account Information       ← 13px
    Sender Account   VIETIN …      ← 14px  ✗
    Transfer Amount  10.000 VND    ← 14px  ✗
```

## Current Behavior (before the fix)

`ConfirmRow`'s `<dt>` / `<dd>`, the OTP Password label, and `FieldLabel` all used `text-wb-14`,
inherited from the common modal style's `ModalField` shape. `ConfirmSection`'s heading used
`text-wb-13`.

## Expected Behavior

Rows at **13px**, the same size as the section heading. Heading unchanged.

## Scope

Every row-text size in this dialog — `ConfirmRow` label + value, the OTP Password label, and
`FieldLabel` (Transfer Password row) — per *"All font size location."*

## Out of Scope

- **The section heading** — explicitly *"kept this font size"* (`text-wb-13 font-semibold`). Unchanged.
- **The dialog title** (`text-wb-16`) — not mentioned; a different element from the section heading.
  Unchanged.
- **Footer buttons** (`h-8 … text-wb-14-tight`) — CLAUDE.md §3b's canonical button standard, not row
  text. Unchanged.
- **Font weights and colours** — only sizes were requested. Labels stay `font-medium` +
  `text-wb-ntrl-8`; values stay `font-medium` + `text-wb-ink`.
- The remaining Finding 3b divergences: label column width (190px legacy / 180px here), row gap
  (20px / 12px), section-title size (legacy 14px), bullet geometry, title→rows gap. Not requested.

## Root Cause

The dialog took its label/value typography from the common modal style's `ModalField` (14px) rather
than from the WeCMS body-text standard.

**A note on my earlier framing, since it was overcautious.** In the audit I classified this as a
§3b-governed change needing a PO decision, warning it would make the dialog "the only feature dialog
with its own type scale". Re-checked against the governance, 13px is the better-supported value:

- Workspace CLAUDE.md § Global Typography — **body text is 13px**, and the type scale is anchored
  there; 14px is listed for filters/inputs/buttons, not label/value body copy.
- CLAUDE.md §3b's own typography table gives **`text-wb-13 font-medium text-wb-ntrl-8`** for a
  form-row label and **`text-wb-13 font-medium text-wb-ink`** for a body cell — exactly what this
  change produces. (§3b's stated scope is Settings surfaces, so it does not bind this Banking dialog,
  but it documents the house convention for this row shape.)
- Legacy agrees: `.ip-cont .name` and `.inputCont > p.val` are both `font-size: 13px`
  (`assets_v2/css/_common.css:4566,4568`).

So this moves the dialog **towards** the shared convention and towards legacy, not away from either.
The concern was raised twice and the requester confirmed twice; it is recorded here as resolved rather
than left implied.

## Implementation

`text-wb-14` → `text-wb-13` in four places, with the reasoning captured on `ConfirmRow`'s doc comment
so the next reader does not "restore" 14px from the `ModalField` precedent:

| Element | Before | After |
|---|---|---|
| `ConfirmRow` `<dt>` (label) | `text-wb-14 font-medium text-wb-ntrl-8` | `text-wb-13 font-medium text-wb-ntrl-8` |
| `ConfirmRow` `<dd>` (value) | `text-wb-14 font-medium text-wb-ink` | `text-wb-13 font-medium text-wb-ink` |
| OTP Password label | `text-wb-14 font-medium text-wb-ntrl-8` | `text-wb-13 font-medium text-wb-ntrl-8` |
| `FieldLabel` (Transfer Password) | `text-wb-14 font-medium text-wb-ntrl-8` | `text-wb-13 font-medium text-wb-ntrl-8` |

Both are existing `@theme inline` tokens — no arbitrary `text-[Npx]` was introduced (§5).

## Files Changed

| File | Change |
|---|---|
| [components/banking/own-account-transfer/TransferConfirmationDialog.tsx](../../components/banking/own-account-transfer/TransferConfirmationDialog.tsx) | 4 × `text-wb-14` → `text-wb-13`; `ConfirmRow` doc comment records why |

## API Impact

None.

## UI Impact

All label/value rows in the Transfer Confirmation modal render at 13px, matching their section
heading. Row heights tighten slightly; nothing reflows, since the label column is fixed-width and
values already wrapped.

## Database Impact

NONE (frontend) — no dependency.

## Integration Impact

None — presentation only.

## Verification

### Automated Tests

- Command: `npx vitest run components/banking/own-account-transfer`
- Result: **PASS** — 10 files, 122 tests passed, 0 failed.

### Type Check

- Command: `npx tsc --noEmit`
- Result: **PASS for this change** — still only the 2 pre-existing locale-key errors in
  `OwnAccountTransferComposerDialog.locales.test.ts` (**category B**, unrelated, untouched).

### Token Audit

Post-change sweep of every size token in the file, confirming nothing was missed or over-reached:

```
text-wb-13   → all row labels/values, OTP label, FieldLabel, helper text, section headings
text-wb-14-tight → footer Cancel / Confirm buttons only (§3b button standard — intentionally kept)
text-wb-16   → dialog title only (intentionally kept)
```

The only remaining literal `text-wb-14` in the file is inside a doc comment describing the previous
value.

### Regression Test

**NO automated regression test — justified (CLAUDE.md §14d).** A `className` assertion would pin
implementation detail rather than observable behaviour (§14c), and jsdom applies no stylesheet, so it
could not verify the rendered size. The token audit above is the executed check. No visual-regression
tooling exists in this repo (`docs/testing/testing-strategy.md`).

### Manual Verification

- Environment: —
- Result: **NOT RUN** — the modal was not rendered; it needs the licensed NXiSAS engine and live bank
  credentials.

## Result

Row text is 13px throughout the modal, matching the section headings, the WeCMS body standard, and
legacy. **Visual confirmation outstanding.**

## Known Limitations / Follow-up

1. **Not visually verified** — confirm alongside the width and indent changes on a real transfer.
2. **Section-title size still differs from legacy.** Legacy uses a **14px** section title above 13px
   rows; this modal now has a 13px title above 13px rows. That was the explicit instruction ("kept
   this font size"), so it is a deliberate divergence, not an oversight — flagged in case the PO later
   wants full legacy rhythm.
3. **The `ModalField` 14px precedent is unchanged elsewhere.** Other feature dialogs still use 14px
   label/value rows. If 13px is the intended house standard for this row shape, aligning them is a
   separate, larger pass — deliberately not started here.
4. Remaining Finding 3b items (label column width, row gap, bullet geometry, title→rows gap) remain
   open.
