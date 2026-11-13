# WeInvoice: Month Dropdowns Replaced by a Month-Grid Picker

**Date:** 2026-11-13
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT (visual check done on bulk sync only)
**Approval Status:** APPROVED (developer, 2026-11-13: "trong dropdowns chọn tháng các list đó không hợp lý lắm giúp t chọn 1 loại khác")
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · UI PARTIAL
**Repository:** we-scraping-web

## Problem

The month selects (Đồng bộ dialog Từ/Đến tháng, Đồng bộ hàng loạt Từ/Đến, invoice list "Tháng…") all read
`monthOptions()` in `components/invoices/period.ts`:

- Hard-coded `CURRENT_YEAR = 2026` and "stop at October": in November 2026 the current month is missing.
- Only 2025-01 … 2026-10 (22 months): periods with real data (2023, 2024) cannot be synced or filtered.
- One long flat list (22 rows, scroll) for both ends of a range; "Đến" offers months before "Từ" and ranges over the
  backend limit, which the backend then refuses (`WBE3016` from > to / future month, `WBE3023` > 36 months,
  `SyncRunService.create`).
- Defaults hard-coded to `2026-10`.

## Expected Behavior

- One `MonthPicker` (`components/shared/MonthPicker.tsx`): same 32 px trigger as `Select`, showing `MM/YYYY`; popover
  with year navigation (‹ year ›) and a 4×3 grid of months; current month marked; months after the current month and
  outside `min`/`max` disabled; "Tháng này" / "Tháng trước" shortcuts.
- Years from 2022 (GDT e-invoice data, TT78) to the current year, computed from the clock, not a constant.
- Sync range: "Đến" only offers `from … min(now, from + 35 months)`; moving "Từ" past "Đến" or more than 36 months
  before it pulls "Đến" along — the backend rules can no longer be broken from the form.
- Defaults = current month.

## Scope

`components/shared/MonthPicker.tsx` (new), `components/invoices/period.ts` (month helpers from the clock),
`components/sync/SyncDialog.tsx`, `components/sync/SyncPages.tsx`, `components/invoices/InvoiceListPage.tsx`,
`locales/{vi,en,ko}.json`, tests.

## Database Impact

NONE.

## Root Cause

`monthOptions()` was written for the October 2026 prototype data: a constant year, a hard stop at month 10 and a
two-year window. Nothing tied it to the clock or to the backend range rules.

## Implementation

- `components/invoices/period.ts`: `CURRENT_YEAR` from the clock; `monthOptions()` removed; new `MIN_MONTH` (2022-01),
  `MAX_SYNC_MONTHS` (36), `currentMonth()`, `addMonths()`, `fmtMonth()`, `syncRangeEnd()`, `fitSyncTo()`.
- `components/shared/MonthPicker.tsx` (new shared component): `Select`-style trigger (calendar icon, `MM/YYYY` or
  placeholder, optional prefix) + popover: ‹ year › header bounded by `min`/`max`, 3×4 month grid (selected = brand
  fill, current month = brand outline, out of range = disabled), "Tháng này" / "Tháng trước" shortcuts. `max` defaults
  to the current month.
- `SyncDialog.tsx`, `SyncPages.tsx` (bulk sync): defaults = current month; "Đến" picker `min={from}`
  `max={syncRangeEnd(from)}`; changing "Từ" runs `fitSyncTo` on "Đến". The local `fmtMonth` of `SyncPages` now comes
  from `period.ts`.
- `InvoiceListPage.tsx`: month filter → `MonthPicker` with placeholder "Chọn tháng…"; the quarter chips show
  `/{CURRENT_YEAR}` instead of a literal `/2026`.
- `locales/{vi,en,ko}.json`: `period.this_month`, `period.last_month`, `period.prev_year`, `period.next_year`,
  `period.mon.1` … `period.mon.12`.

## Files Changed

`components/shared/MonthPicker.tsx` (new), `components/shared/MonthPicker.test.tsx` (new),
`components/invoices/period.ts`, `components/invoices/InvoiceListPage.tsx`, `components/sync/SyncDialog.tsx`,
`components/sync/SyncPages.tsx`, `locales/vi.json`, `locales/en.json`, `locales/ko.json`,
`docs/features/weinvoice/test-scenarios.md` (scenario 31), this record, the test-result record.

## API Impact

NONE — the sync request still sends `from_month` / `to_month`; the form now cannot build a range the backend rejects.

## UI Impact

Month selection in 3 places (sync dialog, bulk sync, invoice list filter).

## Verification

### Automated Tests

- Test: `npx vitest run` — Result: PASS (20 files, 193 tests; new `MonthPicker.test.tsx` 7/7).
- `tsc --noEmit` (source) and `eslint` on changed files — Result: PASS.

### Regression Test

Test file: `components/shared/MonthPicker.test.tsx` · Test case: "offers the current month and disables future months"
· Behavior protected: with the clock at 2026-11-13 the picker offers 11/2026 (the old list stopped at 10/2026).

### Manual Verification

- Environment: LOCAL (`npm run dev`, backend not running at first → dummy session, screens without data).
- Steps: Đồng bộ hàng loạt → open "Từ tháng" at 1280×760.
- Result: PASS for the grid — 2026 header, Tháng 11 selected, Tháng 12 disabled, shortcuts shown. FAIL found and fixed:
  the trigger text was cut ("Từ tháng: 11/2…") at 170 px → bulk-sync pickers widened to 200 px (not rechecked).
- NOT RUN: sync dialog, invoice list filter, year navigation and the "Đến" range limits in the browser (the dummy
  session was dropped once the backend came up; covered by `MonthPicker.test.tsx`).

## Test Evidence

Test result: [WeInvoice Month Picker Test Result](../testing/results/weinvoice-month-picker-test-result-2026-11-13.md)

Final test result: PASS (automated) · UI: PARTIAL (bulk sync only)

## Known Limitations / Follow-up

- `Dashboard.tsx` year select is still the fixed list 2026 / 2025 (not a month picker; left out of scope).
- `/invoices/purchase` returned 404 on the local dev server during the check (file exists; not investigated, unrelated).
- Mock data (`mockData.ts`) still stops at 2026-10 — mock mode shows empty months after that.
