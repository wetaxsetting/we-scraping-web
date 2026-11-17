# WeInvoice: Invoice List Shows "Thiếu XML 0" for Coded Invoices Without XML

**Date:** 2026-11-17
**Type:** BUG FIX
**Current Work Classification:** BUG
**Status:** READY FOR MANUAL COMMIT
**Approval Status:** APPROVED (developer, 2026-11-17: "Sửa luôn", after the audit below)
**Implementation Status:** COMPLETE · **Test Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web
**Audit (evidence):** `we-scraping-api/docs/audits/modules/weinvoice-dashboard-missing-xml-pdf-summary-audit-2026-11-17.md` (backend repository)

## Problem

Purchase list of MST 3603379922, "Năm nay": the KPI card reads "THIẾU XML **0** · Thiếu PDF: 273" while 38 coded (C)
purchase invoices have no XML. The dashboard counts them; clicking its "Thiếu XML" row opens a list showing none.

## Current Behavior

`lib/api/weinvoice/invoices.ts`: a coded invoice is "missing XML" only when it **has a CQT code** and no XML file
(`filterInvoices` `missingXmlOnly`, `kpisFor.missingXml`). The CQT code is only known once the XML is in, or from the old
JSON list; the engine reads the GDT list from Excel, which has no CQT code. So every coded invoice still waiting for its
XML is invisible to the card and to `?missing=xml`. The list's missing counts also keep replaced / cancelled invoices,
which the dashboard leaves out.

## Expected Behavior

Same rule as the dashboard (backend `DashboardRepository.dataStatus`): coded = symbol not starting with `K`
(`isNoCode`), replaced / cancelled left out. The card count equals the number of rows `?missing=xml` shows.

## Scope

`filterInvoices` (`missingXmlOnly`) and `kpisFor` (`missingXml`, `missingPdf`) in `lib/api/weinvoice/invoices.ts`; tests.

## Out of Scope

Dashboard per-direction rows and a link for "Thiếu PDF" (product decision pending — see the audit); engine mapping of the
CQT code from the Excel list.

## Root Cause

"Coded" was derived from the presence of the CQT code instead of the invoice symbol.

## Implementation

- `lib/api/weinvoice/invoices.ts`: new `isMissingXml(i)` = not replaced / cancelled, not `isNoCode` (symbol `K…`), no XML
  file. `filterInvoices` (`missingXmlOnly`) and `kpisFor.missingXml` use it; `kpisFor.missingPdf` also leaves replaced /
  cancelled out. `counts` moved up so both share it.
- Effect: on the 3603379922 purchase list the card goes from 0 to the coded invoices still waiting for XML (38 at the
  time of the audit recount) and `?missing=xml` lists them.

## Files Changed

`lib/api/weinvoice/invoices.ts`, `lib/api/weinvoice/invoices.api.test.ts` (new case + `symbol` in one fixture),
`docs/features/weinvoice/test-scenarios.md` (scenario 34), this record, the test-result record.

## API Impact

None — reads the same `GET /invoices` rows.

## UI Impact

Purchase / sales list KPI card "Thiếu XML" / "Thiếu PDF" and the "missing XML" filter (also reached from the dashboard
row and the pre-filing check link).

## Database Impact

NONE (frontend).

## Regression Test

Test file: `lib/api/weinvoice/invoices.api.test.ts` · Test case: "a coded invoice from the GDT Excel list (no CQT code
yet) without XML is missing XML; K, XML-present and replaced ones are not" · Behavior protected: an Excel-sourced coded
invoice without XML is counted and listed. Fails on the unfixed `invoices.ts` (`expected [] to deeply equal ['excel']`),
passes after.

## Verification

### Automated Tests

- `npx vitest run` — PASS (22 files, 201 tests); `tsc --noEmit` and `eslint` on changed files — PASS.

### Manual Verification

- NOT RUN — local backend and web dev server not running on 2026-11-17 (scenario 34).

## Test Evidence

Test result: [WeInvoice List Missing XML Count Test Result](../testing/results/weinvoice-list-missing-xml-count-test-result-2026-11-17.md)

Final test result: PASS · Regression coverage: PASS

## Known Limitations / Follow-up

- Dashboard rows still count both directions while "Thiếu XML" opens the purchase list, and "Thiếu PDF" has no link —
  waiting on the product decision recorded in the audit.
- The pre-filing check's "HĐ chưa có XML" (`lib/api/weinvoice/checks.ts`) counts every invoice without XML, K included;
  not changed here.
