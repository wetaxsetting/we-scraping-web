# WeInvoice: Provider Pill Tooltip Without the "Mở hoá đơn gốc" Link Line

**Date:** 2026-11-18
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** NOT REQUIRED (developer request 2026-11-18: "giúp t ẩn dòng "Mở hóa đơn gốc:..." khi click chuột dòng chỗ NCC")
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web

## Problem

Invoice list, column "Phát hành qua": hovering / pressing the provider pill shows a two-line tooltip — "Công ty Cổ phần MISA ·
MST 0101243150" and "Mở hoá đơn gốc: https://www.meinvoice.vn/tra-cuu/?sc=…". The developer wants the second line gone
(it exposes the lookup URL with the lookup code).

## Current Behavior

`InvoiceListPage.tsx` provider `<a>`: `title` = provider full name · MST + newline + `inv.open_original_tip` /
`inv.open_portal` + `: <url>`.

## Expected Behavior

Tooltip shows only the provider line. The pill still opens the original / portal in a new tab (and copies the lookup code
for copy-assist providers) — unchanged.

## Scope

`components/invoices/InvoiceListPage.tsx` (provider cell `title`), locales (drop the now-unused `inv.open_original_tip`).

## Database Impact

NONE (frontend).

## Implementation

- `InvoiceListPage.tsx` provider `<a>`: `title` = `<full name> · MST <mst>` only. Link, new tab and copy-assist unchanged.
- Locales VI/EN/KO: `inv.open_original_tip` removed (no other user). `inv.open_portal` stays (detail modal, XML viewer).

## Files Changed

`components/invoices/InvoiceListPage.tsx`, `components/invoices/InvoiceListPage.providerTooltip.test.tsx` (new),
`locales/{vi,en,ko}.json`, this record, the test-result record.

## Verification

- New component test PASS; FAILS on the old `InvoiceListPage.tsx`. `npx vitest run` — PASS (23 files, 205 tests);
  `tsc`, `eslint` — PASS. Browser: NOT RUN.

## Test Evidence

Test result: [WeInvoice Provider Pill Tooltip Without URL Test Result](../testing/results/weinvoice-provider-pill-tooltip-hide-url-test-result-2026-11-18.md)

Final test result: PASS · Regression coverage: PASS
