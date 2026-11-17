# WeInvoice Dashboard: Missing XML / PDF Rows per Direction

**Date:** 2026-11-17
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** APPROVED (developer, 2026-11-17: "Tách mua/bán")
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web
**Audit (evidence):** `we-scraping-api/docs/audits/modules/weinvoice-dashboard-missing-xml-pdf-summary-audit-2026-11-17.md` (backend repository)
**Backend record:** `we-scraping-api/docs/issues/weinvoice-dashboard-data-status-by-direction-2026-11-17.md` (backend repository)
**Related:** [weinvoice-list-missing-xml-count-fix-2026-11-17](../bugs/weinvoice-list-missing-xml-count-fix-2026-11-17.md)

## Problem

Dashboard "Tình trạng dữ liệu": "HĐ có mã thiếu XML" counts purchases + sales but opens the purchase list; "HĐ chưa có PDF
gốc" counts both and has no link. Spec: each row opens the invoice list already filtered.

## Expected Behavior

Missing XML and missing PDF each shown per direction (mua vào / bán ra); each row opens `/invoices/purchase` or
`/invoices/sales` with `?missing=xml` / `?missing=pdf`, and the list shows exactly the counted invoices.

## Scope

`lib/api/weinvoice/dashboard.ts` (wire + mock), `components/dashboard/Dashboard.tsx`, `InvoiceListPage` (`?missing=pdf`),
`lib/api/weinvoice/invoices.ts` (missing-PDF rule), locales VI/EN/KO, tests, test-scenarios.

## Out of Scope

"HĐ không mã chưa có XML" (unchanged, links to email); carrying the dashboard year into the list period.

## Database Impact

NONE (frontend).

## Implementation

- `lib/types/api.ts` + `lib/api/weinvoice/dashboard.ts`: `missingXmlPurchase/Sales`, `missingPdfPurchase/Sales` (wire
  `missing_*_purchase/_sales`; an older backend without them → total on the purchase row, 0 on sales); the mock store
  computes the same split.
- `Dashboard.tsx`: one row per direction with a count > 0 — "{n} HĐ mua vào / bán ra có mã còn thiếu XML" → "Xử lý"
  `/invoices/{purchase|sales}?missing=xml`; "{n} HĐ mua vào / bán ra chưa có PDF gốc" → "Xem" `?missing=pdf`; both
  directions 0 → the old single "0" row.
- `InvoiceListPage`: `?missing=pdf` pre-selects "PDF: Thiếu".
- `lib/api/weinvoice/invoices.ts`: `isMissingPdf` (no PDF, not replaced / cancelled) for the "PDF: missing" filter and the
  KPI card, so the list shows what the dashboard row counted.
- Locales VI/EN/KO: `dash.health.missing_xml_purchase/_sales`, `dash.health.missing_pdf_purchase/_sales`, `dash.health.view`.

## Files Changed

`lib/types/api.ts`, `lib/api/weinvoice/dashboard.ts`, `components/dashboard/Dashboard.tsx`,
`components/invoices/InvoiceListPage.tsx`, `lib/api/weinvoice/invoices.ts`, `locales/{vi,en,ko}.json`, tests
`components/dashboard/Dashboard.test.tsx`, `lib/api/weinvoice/dashboard.test.ts`, `lib/api/weinvoice/invoices.api.test.ts`,
`docs/features/weinvoice/test-scenarios.md` (scenario 35), this record, the test-result record.

## Verification

- `npx vitest run` — PASS (22 files, 204 tests); the new Dashboard case FAILS on the old `Dashboard.tsx`.
- `tsc --noEmit` and `eslint` on changed files — PASS.
- Browser run: NOT RUN (backend / dev server not running on 2026-11-17).

## Test Evidence

Test result: [WeInvoice Dashboard Data Status per Direction (Web) Test Result](../testing/results/weinvoice-dashboard-data-status-by-direction-web-test-result-2026-11-17.md)

Final test result: PASS · Regression coverage: PASS

## Known Limitations / Follow-up

- The "PDF: Thiếu" filter no longer lists replaced / cancelled invoices (same rule as the dashboard and the KPI card).
- The dashboard year is not carried to the list: the list opens on its default period ("Năm nay").
