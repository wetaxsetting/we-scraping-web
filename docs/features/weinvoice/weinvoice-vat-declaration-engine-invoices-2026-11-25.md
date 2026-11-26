# WeInvoice VAT Declaration on Engine Invoices

**Date:** 2026-11-25
**Type:** FEATURE
**Status:** READY FOR MANUAL COMMIT
**Repository:** we-scraping-web
**Approval Status:** NOT REQUIRED (user, 2026-11-25: "đem module kê khai cũ sang dùng hoá đơn engine đi")
**Implementation Status:** COMPLETE
**Test Status:** PASS (automated) · UI on SIT NOT RUN

Backend counterpart (separate repository): we-scraping-api
`docs/features/addon-service/weinvoice/weinvoice-vat-declaration-engine-invoices-2026-11-25.md`.

## Purpose

`/tax/vat-return` renders `ComingSoon`. The old WeCMS VAT declaration screens were removed in the WeInvoice P1
transformation (2026-11-03); the backend still has the old module. The user asked to bring the old module over,
fed by the engine invoices WeInvoice already shows.

## Current System Behavior

`app/(dashboard)/tax/vat-return/page.tsx` → `ComingSoon`; no `lib/api/weinvoice/*` module for declarations; ~213
orphan `tax_filing.*` locale keys from the old screens.

## Target Behavior

PLANNED: `/tax/vat-return` lists the declarations of the active MST, creates a period, shows / edits indicators,
locks / unlocks, shows the 8% annex, exports XML / PDF / Excel — through the backend endpoints of the counterpart
record.

## Scope

New WeInvoice screen (not a port of the ~5,000-line removed WeCMS screen, whose shared dependencies are gone):
list per year, "Khai báo mới" dialog (month / quarter, period, year, business line 00–03), declaration view with the
01/GTGT indicator table (schema restored from the old screen, labels = the surviving `tax_filing.*` keys), white cells
editable while draft, sync / save / delete / lock / unlock, XML / PDF / Excel when locked, annex tabs BKBR / BKMV /
PL 8% with search, paging and per-rate subtotals.

## Out of Scope

Tax agent / dependent-unit header fields [06]–[11] (accepted by the API, not shown); annex Excel export; mock-mode data
(the screen says it needs the server).

## Database Impact

NONE (frontend) — database dependency only, see the backend record above.

## Implementation

- `lib/api/weinvoice/vatDeclarations.ts` (new): wire types + calls for the 12 endpoints; mock mode → `WBE3000`.
- `components/tax/VatReturnPage.tsx` (new) + `components/tax/vatIndicatorSchema.ts` (restored schema).
- `app/(dashboard)/tax/vat-return/page.tsx`: `ComingSoon` → `VatReturnPage`; `lib/weinvoice/nav.ts` badge P4 → MVP.
- 21 `vat.*` keys in `locales/{vi,en,ko}.json`; existing `tax_filing.*` keys reused.
- Docs: [README](README.md) route table, [test-scenarios.md](test-scenarios.md) row 38.

## Files Changed

`lib/api/weinvoice/vatDeclarations.ts` · `lib/api/weinvoice/vatDeclarations.api.test.ts` · `components/tax/VatReturnPage.tsx`
· `components/tax/VatReturnPage.test.tsx` · `components/tax/vatIndicatorSchema.ts` · `app/(dashboard)/tax/vat-return/page.tsx`
· `lib/weinvoice/nav.ts` · `locales/{vi,en,ko}.json` · README · test-scenarios · this record · the test-result record.

## API Impact

Consumes the backend endpoints of the counterpart record.

## Verification

### Automated Tests

- Test: `npx vitest run` (32 files, 245 tests); eslint; tsc (source)
- Result: PASS

### Manual Verification

- Environment: LOCAL
- Result: NOT RUN — needs the backend; verify scenario 38 on SIT.

## Test Evidence

Test result:
[WeInvoice VAT Declaration on Engine Invoices (Web) — Test Result](../../testing/results/weinvoice-vat-declaration-engine-invoices-web-test-result-2026-11-25.md)

Final test result:    PARTIAL (automated PASS, UI on SIT NOT RUN)
Regression coverage:  PASS

## Result

READY FOR MANUAL COMMIT. No commit / push performed.

## Known Limitations / Follow-up

- Agent / dependent-unit fields and the annex Excel export are not on the screen yet.
- Depends on the backend tables `vat_decl` / `vat_decl_items` existing on SIT (backend record).
