# WeInvoice: List "Phát hành qua" Badge Follows the Backend Lookup Flag

**Date:** 2026-11-11
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Investigation Status:** COMPLETE · **Approval Status:** APPROVED (developer, 2026-11-11: "Duyệt, sửa cả hai") · **Implementation Status:** COMPLETE · **Test Status:** PASS (automated)
**Repository:** we-scraping-web
**Evidence:** [audit](../audits/weinvoice-provider-badge-warning-audit-2026-11-11.md)
**Backend record:** `we-scraping-api/docs/issues/weinvoice-list-row-lookup-code-2026-11-11.md` (backend repository)

## Problem

The list shows "MISA !" for invoices whose lookup code is in the DB, because the cell tests `inv.lookupCode`, which a
list row only has after its detail was opened.

## Expected Behavior

- "!" only when the backend says the code is needed (`needs_lookup_code`), as `needsLookupCode(inv)` already reads.
- List rows take `lookup_code` / `lookup_code_company` / `lookup_url` from the backend, so "↗" opens the original
  directly from the list.

## Scope

`components/invoices/InvoiceListPage.tsx`, `lib/api/weinvoice/invoices.ts`, tests.

## Database Impact

NONE (frontend). Backend change in the backend record above (no DB change).

## Implementation

- `InvoiceListPage.tsx` row: `needCode = hasFile(xml) && needsLookupCode(inv) && supportsDeepLink(...)` — the backend
  flag in api mode, the cached code only in mock mode.
- `lib/api/weinvoice/invoices.ts`: `InvoiceRowWire` gains optional `lookupCode`, `lookupCodeCompany`, `lookupUrl`;
  `fromRow` takes them (falling back to the cached detail values when an older backend omits them); an own
  `lookup_url` sets `lookupDirect: true`. `lookupHref` then deep-links from the list.

## Files Changed

`components/invoices/InvoiceListPage.tsx`, `lib/api/weinvoice/invoices.ts`, `lib/api/weinvoice/invoices.api.test.ts`,
this record, the test-result record.

## Verification

- `npx vitest run components/invoices lib/api/weinvoice` — PASS, 124 tests (1 new); `tsc`, eslint clean.
- UI on .13: NOT RUN (needs the backend change deployed + login).

## Test Evidence

[WeInvoice List Provider Badge — Test Result](../testing/results/weinvoice-list-provider-badge-lookup-flag-test-result-2026-11-11.md)
— PASS (automated), regression coverage YES.
