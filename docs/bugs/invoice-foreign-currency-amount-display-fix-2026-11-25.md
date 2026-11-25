# Invoice Amounts Ignore the Invoice Currency (USD Shown as "₫", Cents Lost)

**Date:** 2026-11-25
**Type:** BUG FIX
**Status:** READY FOR MANUAL COMMIT
**Repository:** we-scraping-web
**Investigation Status:** COMPLETE
**Approval Status:** APPROVED (user, 2026-11-25: "Làm cả hai")
**Implementation Status:** COMPLETE
**Test Status:** PASS (automated) · UI on SIT NOT RUN

Evidence and root cause:
[Invoice Currency Unit Display — Audit](../audits/invoice-currency-unit-display-audit-2026-11-25.md).

## Problem

Every invoice amount is formatted with `fmtMoney` (always 0 decimals) and the detail modal appends a literal `₫`.
A USD invoice of 7,303.84 (3600790154 C26TKS-445) shows as **"7.304 ₫"**. Engine DB: 428 USD + 11 KRW invoices.

## Expected Behavior

An invoice amount is shown in the invoice's own currency, unit = ISO code (user 2026-11-25: "48.000 VND"): VND
`48.000 VND`, USD with 2 decimals `7.303,84 USD`, other ISO codes likewise. Non-VND invoices also show the VND equivalent and the exchange rate in
the detail modal.

## Scope

- New helper `fmtInvoiceMoney(value, currency)` in `lib/weinvoice/format.ts` (delegates to `lib/currency.ts`
  `formatAmount`; unknown ISO codes get the code as suffix).
- Use it where a single invoice's amount is shown: detail modal (amounts + replacement compare), list rows,
  `InvoiceSheet` (bản thể hiện), supplier-risk table, invoice-check table, command palette.
- `Invoice.currency` typed as `string` (ISO 4217, spec amendment).

## Out of Scope

KPI cards, totals footer, dashboard — already VND-converted (`total_vnd`) and correctly labelled ₫. Backend
(already returns the normalised ISO code + rate). Excel / ZIP exports (backend-generated).

## Database Impact

NONE (frontend) — no database dependency.

## Root Cause

See the audit: screens format every amount with `fmtMoney` (0 decimals) and the detail modal appends a literal `₫`,
ignoring `Invoice.currency` that the backend already sends normalised.

## Implementation

- `lib/weinvoice/format.ts`: `invoiceCurrency` (ISO, `VNĐ`/`Đ`/blank → `VND`), `fmtInvoiceAmount` (VND = `fmtMoney`;
  other currencies with their minor-unit digits from `Intl`, `vi-VN` separators), `fmtInvoiceMoney` (+ the ISO code as unit for
  every currency — "48.000 VND", "7.303,84 USD", matching "Loại tiền" on the PDF; user asked 2026-11-25 for "VND", not "₫"). `lib/currency.ts` › `formatAmount`
  was not reused: its OSMC table gives EUR 0 decimals and `$` prefixes.
- Detail modal: new `AmountSummary` (amounts in the invoice currency; non-VND adds `detail.fx` "≈ … VND (tỷ giá …)"
  from `total_vnd` / `exchange_rate`, or `detail.fx_vnd` without a rate); replacement compare uses `fmtInvoiceMoney`.
- List rows: pre-tax / tax / total in the invoice currency; total tagged with the code when ≠ VND.
- `InvoiceSheet` + print popup `renderedHtml`: amounts in the invoice currency, new "Loại tiền" line, "Số tiền viết bằng
  chữ" only for VND (the words read "đồng").
- Invoice check, supplier risk, command palette: `fmtInvoiceMoney` instead of `… đ`.
- `Invoice.currency: string`; mappers (`toInvoice`, detail) and `lib/weinvoice/xml.ts` use `invoiceCurrency`.
- Locale keys `detail.fx`, `detail.fx_vnd` (VI/EN/KO).
- VND KPI cards / totals footer (`InvoiceListPage`) and dashboard cards: unit `₫` → `VND` (same request).

## Files Changed

`lib/weinvoice/format.ts` · `lib/weinvoice/format.test.ts` (new) · `lib/weinvoice/types.ts` · `lib/weinvoice/xml.ts` ·
`lib/weinvoice/exporter.ts` · `lib/api/weinvoice/invoices.ts` · `components/invoices/InvoiceDetailModal.tsx` ·
`components/invoices/InvoiceListPage.tsx` · `components/invoices/InvoiceSheet.tsx` ·
`components/invoices/InvoiceAmounts.currency.test.tsx` (new) · `components/checks/InvoiceCheckPage.tsx` ·
`components/checks/SupplierRiskPage.tsx` · `components/layout/CommandPalette.tsx` · `components/dashboard/Dashboard.tsx` · `locales/{vi,en,ko}.json`
(2 keys each) · `docs/features/weinvoice/test-scenarios.md` (row 37) · this record · the test-result record.

## API Impact

None — reads existing `currency`, `exchange_rate`, `total_vnd`.

## UI Impact

Foreign-currency invoices show their own currency everywhere a single invoice amount appears; every money unit
is the ISO code (`48.000 VND` instead of `48.000 ₫`), including KPI cards, totals footer and dashboard.

## Verification

### Automated Tests

- Test: `npx vitest run` (30 files, 235 tests); eslint on changed files; `tsc` (source)
- Result: PASS

### Regression Test

Test file:          `lib/weinvoice/format.test.ts`, `components/invoices/InvoiceAmounts.currency.test.tsx`
Test case:          `shows USD with cents and the USD unit, never ₫` · `shows a USD invoice in USD with cents, plus its VND equivalent and rate`
Behavior protected: a USD invoice is never shown as a rounded VND/₫ amount; VND shows as "… VND"

### Regression Review

- Areas checked: VND output `… VND` (asserted), KPIs / totals footer / dashboard untouched (VND-converted), print
  popup, XML viewer parsing (`xml.test.ts` PASS), doc links (in-repo broken 0).
- Result: PASS

### Manual Verification

- Environment: LOCAL
- Result: NOT RUN — verify scenario 37 on SIT with a real USD invoice.

## Test Evidence

Test result:
[Invoice Foreign-Currency Amount Display — Test Result](../testing/results/invoice-foreign-currency-amount-display-test-result-2026-11-25.md)

Final test result:    PARTIAL (automated PASS, UI on SIT NOT RUN)
Regression coverage:  PASS

## Result

READY FOR MANUAL COMMIT. No commit / push performed.

## Known Limitations / Follow-up

- Item quantity still uses `fmtMoney` (0 decimals) — a quantity like 1.5 shows "2" (any currency); separate fix.
- `chk.found_money` on the invoice-check page sums tax across invoices without converting currency (P3 mock screen).
