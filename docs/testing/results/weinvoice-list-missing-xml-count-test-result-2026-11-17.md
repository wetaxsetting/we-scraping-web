# WeInvoice List "Thiếu XML" Count — Test Result

**Date:** 2026-11-17
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web
**Related Record:** [weinvoice-list-missing-xml-count-fix-2026-11-17](../../bugs/weinvoice-list-missing-xml-count-fix-2026-11-17.md)

## Scope

The invoice list's "missing XML" rule (`filterInvoices` `missingXmlOnly`, `kpisFor.missingXml`) and its "missing PDF"
count now follow the dashboard rule: coded by symbol, replaced / cancelled left out.

## Environment

LOCAL (Windows laptop), Node + Vitest 2.1.9 (jsdom). No browser run.

## Code / Build Under Test

Branch: `main` (we-scraping-web working tree) · Commit: NOT COMMITTED · API: mocked (`@/lib/axios` request mock).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run lib/api/weinvoice/invoices.api.test.ts -t "data-status"` — new case | PASS | 1 passed |
| Same case on the unfixed `invoices.ts` (`git stash push -- lib/api/weinvoice/invoices.ts`) | FAIL (expected) | `AssertionError: expected [] to deeply equal [ 'excel' ]` |
| `npx vitest run` (whole suite) | PASS | 22 files, 201 tests |
| `npx tsc --noEmit -p .` (source, `.next` output filtered) | PASS | no errors |
| `npx eslint lib/api/weinvoice/invoices.ts lib/api/weinvoice/invoices.api.test.ts` | PASS | no findings |

## Regression Tests

**Did a regression test cover the original defect? YES**

- Test file: `lib/api/weinvoice/invoices.api.test.ts`
- Test case: "a coded invoice from the GDT Excel list (no CQT code yet) without XML is missing XML; K, XML-present and
  replaced ones are not"
- Original failure reproduced: yes — on the old rule the Excel-sourced coded invoice (`cqt_code: null`) was not listed.
- Result: PASS after the fix.

## Existing Failures

None. First full run after the change: 1 failure in "kpisFor — VND totals … uses total_vnd / exchange_rate for USD
invoices" — its hand-built invoices had no `symbol` (a real `Invoice` always has one), and the new rule reads it.
Classified **D (test data)**, caused by this change: `symbol: "C26TAA"` added to that fixture; suite green afterwards.

## New Failures

None.

## Not Tested

- UI (purchase list card, dashboard link) in a browser: **NOT RUN** — the local backend (`:8080`) and web dev server were
  not running on 2026-11-17; the list needs a real login. Scenario 34 in
  [test-scenarios.md](../../features/weinvoice/test-scenarios.md) covers it.

## Final Result

PASS

## Recommendation

READY FOR MANUAL COMMIT
