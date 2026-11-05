# WeInvoice Dashboard API Wiring — Test Result

**Date:** 2026-11-04
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [weinvoice-api-integration-2026-11-03.md](../../features/weinvoice/weinvoice-api-integration-2026-11-03.md)

## Scope

Dashboard (screen 03) wired to `GET /api/v1/weinvoice/dashboard` against the frontend's **draft**
contract, behind `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE` (default `mock`).

## Environment

LOCAL — Vitest + jsdom. Browser: NOT RUN (see Not Tested).

## Code / Build Under Test

Branch: `main` (working tree) · Commit: NOT COMMITTED · API: none reachable (see Not Tested).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run` | PASS | 6 files, 33 tests, 33 passed |
| `lib/api/weinvoice/dashboard.test.ts` | PASS | 7 / 7 — mapper (all fields, 12-month fill, nulls), mock computation (cancelled + replaced excluded, top 5 sorted), mock source makes no HTTP call, API params `company_mst` + `year`, `status.error` → backend code, 404 → `HTTP_404`, no response → `WBE_NETWORK` |
| `components/dashboard/Dashboard.test.tsx` | PASS | 2 / 2 — mock source renders the KPI count; API source shows the error card with `HTTP_404`, Retry re-requests and renders the API value (4.321) |
| `npx tsc --noEmit` | PASS | 0 errors |
| `npx eslint components/dashboard lib/api/weinvoice lib/types` | PASS | 0 problems |
| `npm run build` | PASS | 30 static pages |

## Not Tested

- **Real endpoint**: `GET /api/v1/weinvoice/dashboard` does not exist on the backend (local `sit`
  returned 404 on 2026-11-04; no branch contains `domain/weinvoice`). The draft field names are
  unverified until the backend confirms them.
- **Browser**: login is real and port 8080 is currently occupied by an unrelated local project
  (`Desktop/personal/MERN/backend`), not the WeInvoice backend — no session could be opened, so the
  Dashboard was not viewed in the browser. Covered by the component test instead.

## Existing Failures

None in the files touched. (Pre-existing ESLint errors in untouched shared components unchanged.)

## New Failures

None.

## Final Result

PARTIAL — all executed checks pass; real-endpoint and browser checks NOT RUN.

## Recommendation

PARTIAL — confirm the draft contract with the backend; re-verify in the browser with the backend running.
