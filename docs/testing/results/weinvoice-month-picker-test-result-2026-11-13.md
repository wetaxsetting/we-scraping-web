# WeInvoice Month Picker — Test Result

**Date:** 2026-11-13
**Type:** TEST RESULT
**Status:** PASS (automated) · UI PARTIAL
**Repository:** we-scraping-web
**Related Record:** [weinvoice-month-picker-2026-11-13](../../issues/weinvoice-month-picker-2026-11-13.md)

## Scope

`MonthPicker` replacing the flat month selects in the sync dialog, bulk sync and the invoice list; month helpers in
`components/invoices/period.ts`.

## Environment

LOCAL (Windows, Node from `node_modules`).

## Code / Build Under Test

Branch: `scraping-data` · Commit: NOT COMMITTED · API: not involved (no request shape changed).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/shared/MonthPicker.test.tsx` | PASS | 7/7 |
| `npx vitest run` (full suite) | PASS | 20 files, 193 tests, 0 failed |
| `npx tsc --noEmit -p .` (errors outside stale `.next/types`) | PASS | 0 errors in source |
| `npx eslint` on the 5 changed source files | PASS | 0 problems |

## Regression Tests

`MonthPicker.test.tsx`: current month (11/2026) selectable and 12/2026 disabled with the clock at 2026-11-13 (the old
list ended at 10/2026); year navigation down to `min`; sync range helpers keep `from ≤ to ≤ now` and ≤ 36 months
(backend `WBE3016` / `WBE3023`).

## UI Verification

PARTIAL — local dev server with a dummy session (backend not running at first), bulk sync screen at 1280×760:
grid, current month selected, December disabled, shortcuts — PASS. Trigger text cut at 170 px — FIXED (200 px),
not rechecked. Sync dialog and invoice list not opened in the browser.

## Not Tested

Visual check of the popover at 375 / 1440 px; the sync request itself (unchanged: `from_month` / `to_month`).

## Final Result

PARTIAL — automated checks PASS, visual check on bulk sync only.

## Recommendation

READY FOR MANUAL COMMIT; developer glances at the sync dialog and invoice list after signing in.
