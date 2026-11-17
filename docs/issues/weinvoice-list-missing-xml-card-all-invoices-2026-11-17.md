# WeInvoice: List "Thiếu XML" Card Counts Every Invoice Without XML

**Date:** 2026-11-17
**Type:** ISSUE
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** APPROVED (developer, 2026-11-17: "2 - ý phần này là summary tất cả các hd thiếu PDF/ XML")
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web
**Related:** [weinvoice-list-missing-xml-count-fix-2026-11-17](../bugs/weinvoice-list-missing-xml-count-fix-2026-11-17.md),
[weinvoice-dashboard-data-status-by-direction-2026-11-17](weinvoice-dashboard-data-status-by-direction-2026-11-17.md)

## Problem

Purchase list of 1201496252 (SIT, 2026): card "THIẾU XML 0 · Thiếu PDF: 229" while 226 no-code (K) MobiFone invoices
have neither XML nor PDF. The card counted coded invoices only (the spec-prototype rule, kept by the fix above). The
developer wants the card to be a summary of **every** invoice without XML / PDF.

## Current Behavior

`isMissingXml` = not replaced / cancelled, symbol not `K`, no XML. Used by the card, the "HĐ thiếu XML" chip and
`?missing=xml` (dashboard coded rows, pre-filing check link).

## Expected Behavior

- Card "Thiếu XML" and the "HĐ thiếu XML" chip / `?missing=xml`: every invoice without XML (coded and no-code), replaced /
  cancelled left out. "Thiếu PDF" unchanged (already every invoice without PDF).
- The dashboard rows "HĐ mua vào / bán ra có mã còn thiếu XML" still open exactly the coded ones: new
  `?missing=xml_coded`, shown as the chip "HĐ có mã thiếu XML".

## Scope

`lib/api/weinvoice/invoices.ts`, `components/invoices/InvoiceListPage.tsx`, `components/dashboard/Dashboard.tsx`, locales,
tests, test-scenarios.

## Out of Scope

Backend (`InvoiceKpis` of `GET /invoices` is not read by the screen); the dashboard counts; "Lấy XML còn thiếu" (coded only).

## Database Impact

NONE (frontend).

## Implementation

- `lib/api/weinvoice/invoices.ts`: `isMissingXml` = no XML, not replaced / cancelled (K included); new
  `isCodedMissingXml` (+ symbol not `K`). `InvoiceQuery.missingXmlOnly` → `missingXml: "off" | "all" | "coded"`.
  `kpisFor.missingXml` uses the "all" rule; "Thiếu PDF" unchanged.
- `InvoiceListPage`: `?missing=xml` → "all", `?missing=xml_coded` → "coded"; the chip toggles off ↔ all and reads
  "HĐ có mã thiếu XML" in coded mode; the card opens "all".
- `Dashboard.tsx`: coded rows link `/invoices/{purchase|sales}?missing=xml_coded`.
- Locales VI/EN/KO: `inv.missing_xml_coded`.
- The pre-filing check link (`?missing=xml`, its "HĐ chưa có XML" counts every invoice without XML) now opens a list
  that matches its count.

## Files Changed

`lib/api/weinvoice/invoices.ts`, `components/invoices/InvoiceListPage.tsx`, `components/dashboard/Dashboard.tsx`,
`locales/{vi,en,ko}.json`, tests `lib/api/weinvoice/invoices.api.test.ts`, `components/dashboard/Dashboard.test.tsx`,
`docs/features/weinvoice/test-scenarios.md` (34, 35), this record, the test-result record.

## Verification

- `npx vitest run` — PASS (22 files, 204 tests); the changed case FAILS on the previous `invoices.ts`.
- `tsc --noEmit`, `eslint` on changed files — PASS. Browser: NOT RUN.

## Test Evidence

Test result: [WeInvoice List Missing XML Card — All Invoices Test Result](../testing/results/weinvoice-list-missing-xml-card-all-invoices-test-result-2026-11-17.md)

Final test result: PASS · Regression coverage: PASS

## Known Limitations / Follow-up

Expected on SIT for 1201496252, purchases 2026: card 226 (all K MobiFone etc.; coded 0) instead of 0. Most K invoices
cannot be fetched from GDT — their XML / PDF only come by mail.
