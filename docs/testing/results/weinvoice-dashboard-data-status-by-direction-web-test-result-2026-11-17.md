# WeInvoice Dashboard Data Status per Direction (Web) — Test Result

**Date:** 2026-11-17
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web
**Related Record:** [weinvoice-dashboard-data-status-by-direction-2026-11-17](../../issues/weinvoice-dashboard-data-status-by-direction-2026-11-17.md)
**Backend result:** `we-scraping-api/docs/testing/results/weinvoice-dashboard-data-status-by-direction-api-test-result-2026-11-17.md` (backend repository)

## Scope

Dashboard "Tình trạng dữ liệu" rows per direction with links; `?missing=pdf` on the list; the list's "PDF: missing" filter
and KPI card use the dashboard rule (replaced / cancelled left out).

## Environment

LOCAL (Windows laptop), Vitest 2.1.9 (jsdom). No browser run.

## Code / Build Under Test

Branch: `main` (working tree) · Commit: NOT COMMITTED · API: mocked (`@/lib/axios`).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `Dashboard.test.tsx` "API source: missing XML / PDF rows per direction, each linking to its own filtered list" | PASS | rows + hrefs `/invoices/purchase?missing=xml`, `/invoices/sales?missing=xml`, `/invoices/sales?missing=pdf`; 0-count direction has no row |
| Same case on the old `Dashboard.tsx` (`git stash push -- components/dashboard/Dashboard.tsx`) | FAIL (expected) | `Unable to find an element with the text: 56 HĐ mua vào có mã còn thiếu XML` |
| `dashboard.test.ts` — per-direction mapping + older-backend fallback; mock store per-direction sums = totals | PASS | 9/9 in file |
| `invoices.api.test.ts` — "PDF: missing" filter returns the 3 invoices the KPI counts (replaced left out) | PASS | 29/29 in file |
| `npx vitest run` (whole suite) | PASS | 22 files, 204 tests |
| `npx tsc --noEmit -p .` (source; `.next` filtered) | PASS | no errors |
| `npx eslint` on the 8 changed source / test files | PASS | no findings |

## Regression Tests

The Dashboard case above protects the original problem (mixed total linked to the purchase list; PDF row without link).

## Existing Failures

None.

## New Failures

None.

## Not Tested

- Browser run of the dashboard and the list (`?missing=pdf` pre-selecting "PDF: Thiếu"): **NOT RUN** — local backend and web
  dev server not running on 2026-11-17. Scenario 35 in [test-scenarios.md](../../features/weinvoice/test-scenarios.md).
- No component test drives `InvoiceListPage` with `?missing=pdf` (no list-page test harness exists); the state initialiser
  is one line next to the existing `?missing=xml` one.

## Final Result

PASS

## Recommendation

READY FOR MANUAL COMMIT (deploy the backend change with it; an older backend still works — totals stay on the purchase row).
