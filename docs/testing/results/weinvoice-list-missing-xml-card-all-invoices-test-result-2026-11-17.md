# WeInvoice List "Thiếu XML" Card — All Invoices — Test Result

**Date:** 2026-11-17
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web
**Related Record:** [weinvoice-list-missing-xml-card-all-invoices-2026-11-17](../../issues/weinvoice-list-missing-xml-card-all-invoices-2026-11-17.md)

## Scope

List card "Thiếu XML" / "HĐ thiếu XML" chip / `?missing=xml` count every invoice without XML (K included, replaced /
cancelled left out); dashboard coded rows open `?missing=xml_coded` (coded only, chip "HĐ có mã thiếu XML").

## Environment

LOCAL (Windows laptop), Vitest 2.1.9 (jsdom). No browser run.

## Code / Build Under Test

Branch: `scraping-data` (working tree, on top of `8d4d331`) · Commit: NOT COMMITTED · API: mocked.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `invoices.api.test.ts` "list data-status counts …" — `missingXml: "coded"` → coded only; `"all"` → coded + K; card = 2; replaced excluded | PASS | |
| Same case on the previous `invoices.ts` (`git stash push -- lib/api/weinvoice/invoices.ts`) | FAIL (expected) | `expected [ 'excel', 'nocode', 'withxml', …(1) ] to deeply equal [ 'excel' ]` |
| `Dashboard.test.tsx` per-direction rows → `?missing=xml_coded` | PASS | |
| `npx vitest run` (whole suite) | PASS | 22 files, 204 tests |
| `npx tsc --noEmit -p .` (source) | PASS | no errors |
| `npx eslint` on the 5 changed source / test files | PASS | no findings |

## Existing Failures

None.

## New Failures

None.

## Not Tested

- Browser run (card on SIT for 1201496252 should read 226 + coded missing, chip label in coded mode): **NOT RUN** —
  not deployed yet. Scenarios 34–35 in [test-scenarios.md](../../features/weinvoice/test-scenarios.md).
- No component test drives `InvoiceListPage` (no harness); the URL → filter mapping is two lines.

## Final Result

PASS

## Recommendation

READY FOR MANUAL COMMIT
