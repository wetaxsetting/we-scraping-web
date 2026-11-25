# Test Result: WeInvoice Invoice List Download Bar (UI Spec v1.1)

**Date:** 2026-11-25
**Implementation record:** [weinvoice-invoice-downloads-v1-1-2026-11-25.md](../../features/weinvoice/weinvoice-invoice-downloads-v1-1-2026-11-25.md)
**Final Result:** PASS (Vitest, tsc, eslint) · browser check not run

## Scope

Download bar, bulk PDF dialog, Excel missing-XML dialog, Bảng kê gốc, i18n.

## Environment

Local Windows, Node from the repo `node_modules`, Vitest + jsdom. Backend not running.

## Code / Build Under Test

Working tree of `scraping-data` (uncommitted), including unrelated uncommitted work already present (unlimited tax codes 2026-11-16).

## Automated Tests

`npx vitest run`: 27 files, 221 tests, 0 failures. New: `InvoiceListPage.downloadBar.test.tsx` 6/6.

## Regression Tests

`InvoiceListPage.serverPaging.test.tsx`, `InvoiceListPage.providerTooltip.test.tsx`, `invoices*.test.ts` pass.

## API Verification

Wire bodies checked in the new tests (snake_case, `ids` only when ticked, `filter` for the PDF job). Real backend not called.

## UI Verification

Not run in a browser (login needs the backend + a real account).

## Database Verification

Not applicable (backend record declares no DB impact).

## Existing Failures

None.

## New Failures

None.

## Not Tested

Browser layout at 375 / 1024 / 1440, real ZIP / XLSX downloads.

## Recommendation

Check on SIT with a real MST: each PDF mode, retry, Excel dialog, Bảng kê gốc.
