# WeInvoice Invoice List Server Paging (Web) — Test Result

**Date:** 2026-11-18
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web
**Related Record:** [weinvoice-invoice-list-server-paging-2026-11-18](../../issues/weinvoice-invoice-list-server-paging-2026-11-18.md)
**Backend result:** `we-scraping-api/docs/testing/results/weinvoice-invoice-list-server-paging-api-test-result-2026-11-18.md` (backend repository)

## Scope

API mode: the invoice list asks `GET /invoices` for one page (newest first) on every filter / sort / page change; KPIs,
incomplete periods, filter options (`/invoices/facets`) and "select all" (`/invoices/ids`) come from the server; no
whole-year download at app start / MST switch / after sync. Mock mode: same screen over the store.

## Environment

LOCAL (Windows laptop), Vitest 2.1.9 (jsdom), axios mocked. No browser run.

## Code / Build Under Test

Branch: `scraping-data` (working tree, on top of `de032e4`) · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `lib/api/weinvoice/invoices.serverList.api.test.ts` (new) — params of one page (every filter, 0-based page, chip → `xml=missing_all`, `__needcode` → `needs_code`, comma lists), KPI mapping (`missing_xml_all`, period counts), only the page cached; older-backend fallback; `/invoices/ids`; facets mapping; `?ids=` loader | PASS | 5/5 |
| `components/invoices/InvoiceListPage.serverPaging.test.tsx` (new) — page 0 requested with sort, server KPIs on the card, "Next page" → `page=1`, never `size=200`; `hydrate()` sends no `GET /invoices` | PASS | 2/2 |
| Same component test with the old `InvoiceListPage.tsx` + `remote.ts` (`git stash push -- …`) | FAIL (expected) | 2 failed |
| `npx vitest run` (whole suite) | PASS | 25 files, 212 tests |
| `npx tsc --noEmit -p .` (source) | PASS | no errors |
| `npx eslint components/invoices lib/api/weinvoice components/upload` | PASS | no findings |

## Database Verification

Dependency only — the backend's new SQL was run read-only on the engine DB (see the backend result).

## Existing Failures

None.

## New Failures

None.

## Not Tested

- Browser run against a backend: **NOT RUN** — local backend / web dev server not running; SIT not deployed yet.
  Scenario 36 in [test-scenarios.md](../../features/weinvoice/test-scenarios.md).
- Upload screen after an import (rows by id) is covered by the `?ids=` loader test only, not by a screen test.

## Final Result

PASS

## Recommendation

READY FOR MANUAL COMMIT — deploy the backend first (new `xml` / `provider` values and `ids` param are required by this web).
