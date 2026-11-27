# WeInvoice Invoice Screens v1.2 (web) — Test Result

**Date:** 2026-11-27
**Type:** TEST RESULT
**Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web
**Related Record:** [weinvoice-invoice-screen-v1-2-2026-11-27](../../features/weinvoice/weinvoice-invoice-screen-v1-2-2026-11-27.md)

## Scope

Web share of UI Spec v1.2 parts A–D: period range picker + current-month default, new list columns, items cell and
"Chi tiết hàng hoá" popup, totals bar per currency, column-setting merge, detail "Hoá đơn liên quan" + amounts with
fee, rendered copy (screen + HTML), Tax › "Danh mục" menu + ComingSoon routes, locale fixes; API mapping of the new
backend fields. Backend side: `we-scraping-api` `docs/features/addon-service/weinvoice/weinvoice-invoice-screen-v1-2-2026-11-27.md`.

## Environment

LOCAL (Windows, `node_modules`). No dev server, no backend.

## Code / Build Under Test

Branch: `scraping-data` · Commit: NOT COMMITTED · API URL/environment: none (mocked transport in tests).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run` before the change (baseline) | PASS | 33 files, 247 tests |
| `npx vitest run lib/api/weinvoice/invoices.v12.api.test.ts` | PASS | 6/6 (new) |
| `npx vitest run components/invoices/DateRangePicker.test.tsx` | PASS | 8/8 (new) |
| `npx vitest run components/invoices/InvoiceScreenV12.test.tsx` | PASS | 19/19 (new) |
| same, "never reach the row" case with the `stopPropagation` wrapper removed | FAIL as expected | 1 failed — portal clicks reached the row |
| `npx vitest run` after the change | PASS | 36 files, 280 tests |
| `npx eslint` on the 21 changed / new files | PASS | 0 problems |
| `npx tsc --noEmit -p .` | PASS (source) | 0 errors outside `.next/types`; 44 lines in stale `.next/types/validator.ts` (removed `addon/*` pages) — pre-existing |

## Regression Tests

- `InvoiceListPage.serverPaging`, `InvoiceListPage.downloadBar`, `InvoiceAmounts.currency` pass unchanged.
- `InvoiceListPage.providerTooltip` failed once after B2 (mock data ends 2026-10; the list now opens on the current
  month → no rows). The test now pins "today" to 2026-10-20 with `vi.useFakeTimers({ toFake: ["Date"] })`; it asserts
  the same tooltip behaviour as before.

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| List opens (today 27/11/2026) | `GET /invoices` from 2026-11-01 to 2026-11-30; trigger "Tháng 11/2026"; no range text line | as expected | PASS |
| Picker: Q I → Áp dụng | list asks 2026-01-01 … 2026-03-31; trigger "Tháng 1/2026 → Tháng 3/2026" | as expected | PASS |
| Picker (today 27/11): Tháng 12 / days after 27/11 | disabled | disabled | PASS |
| Q IV / Cả năm | end = 27/11/2026 | as expected | PASS |
| Typed 15/01/2026 → 02/02/2026; end 30/11/2026 | applied; Áp dụng disabled | as expected | PASS |
| Totals bar VND only / VND + USD | 1 row / 2 rows + "Tổng quy đổi (VND)" without "VND" suffix | as expected | PASS |
| Items popup with fee | fee row "Không thuế"; Cộng tiền hàng → Phí / lệ phí → Tổng thanh toán; on-invoice line; ⚠ on mismatch | as expected | PASS |
| Items popup, USD | VND column per line; single "Tổng cộng" | as expected | PASS |
| Items cell hover / click | "1/5 … 3/5" list; popup opens; row click not triggered | as expected | PASS |
| Related: original not stored / stored / original with adjustment | ⚠ + note / button opens it / list + effective value | as expected | PASS |
| Amounts with fee; USD without rate | "300.000 + 24.000 + 10.000 = 334.000 VND"; "Thiếu tỷ giá" | as expected | PASS |
| Rendered copy + HTML | related line, fee table, Tổng tiền phí, CK thương mại (≠ 0 only), 6-decimal price | as expected | PASS |
| Column setting saved by v1.1 | new columns at default position with default visibility | as expected | PASS |
| API mapping (row, KPIs, detail; older backend) | fields mapped; `by_currency` fallback; no invented fields | as expected | PASS |

## API Verification

Wire shapes checked against the backend DTOs `InvoiceRow` / `InvoiceKpis` / `InvoiceDetail` (uncommitted backend
working tree, 2026-11-27) with a mocked transport only. Not run against a live backend.

## UI Verification

NOT RUN — no dev server (task instruction). Widths 375 / 1440 not checked.

## Database Verification

NOT APPLICABLE (frontend; §12g) — see the backend record.

## Existing Failures

None in Vitest. `tsc` errors only in stale `.next/types` (pre-existing, generated files for removed routes).

## New Failures

None.

## Not Tested

Browser rendering and layout, real backend data, Excel / ZIP outputs (unchanged by this work).

## Final Result

PASS (automated)

## Recommendation

READY FOR MANUAL COMMIT — then verify on SIT with the backend change deployed.
