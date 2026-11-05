# WeInvoice All Endpoints Wiring — Test Result

**Date:** 2026-11-05
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [weinvoice-api-integration-2026-11-03.md](../../features/weinvoice/weinvoice-api-integration-2026-11-03.md)

## Scope

Every P1 endpoint of the backend design note wired behind `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE=api`
(draft contract), API-mode hydration of an empty store, error surfacing.

## Environment

LOCAL — Vitest + jsdom; FE `next dev` (API mode) on `localhost:3000`; BE `we-scraping-api` branch
`sit` (`6aa0c1f`) on `localhost:8080`, VPN on, health `UP`; logged in with the user's own account
(tenant `1201496252`).

## Code / Build Under Test

Branch: `main` (working tree) · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run` | PASS | 15 files, 106 tests (105 + 1 added after the browser run), all passed |
| `npx tsc --noEmit` | PASS | 0 errors |
| `npm run build` | PASS | 30 static pages |
| `npx eslint app components lib proxy.ts` | PASS (pre-existing only) | errors only in untouched `DateField`, `InteractiveDateRangePicker`, `SearchSelect`, `LocaleProvider`, warning in `InfoIcon` |
| `node scripts/check-doc-links.mjs` | PASS | 0 in-repo broken |

## Test Scenarios (real backend, browser)

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Open the app logged in (API mode) | Hydration calls the P1 loaders with the real working MST | `GET /companies`, `/invoices?company_mst=1201496252&direction=purchase&from=2026-01-01&to=2026-12-31&page=0&size=500`, `/email/messages?company_mst=1201496252`, `/tags`, `/sync-runs`, `/mailboxes`, `/sub-accounts`, `/dashboard?company_mst=1201496252&year=2026` | PASS |
| Backend has no WeInvoice endpoints | Clear error, no fake data | every call 404 `WBE_NOT_FOUND`; banner lists each endpoint + message + code + Thử lại; dashboard error card; purchase list shows MST 1201496252 with 0 invoices | PASS (behaviour) / FAIL (data — backend) |
| First run: dashboard before hydration | No request without an MST | `company_mst=` (empty) sent once → **fixed** (dashboard waits for the working MST; test added); re-run shows only the 8 requests above | PASS after fix |
| No mock record in API mode | Empty store | no seed invoice / company / tag rendered | PASS |

## Not Tested

- Any successful response: the backend has no `domain/weinvoice` (all 404). Draft field names
  unverified.
- Mutations (add MST, sync, upload, tags, sub-accounts, files, exports) against a backend: covered by
  unit tests with a mocked HTTP layer only.

## Existing Failures

ESLint errors in untouched shared components (category B).

## New Failures

None.

## Final Result

PARTIAL

## Recommendation

PARTIAL — re-run against the backend once `domain/weinvoice` + `interface-specification.md` are
published, reconcile the `// DRAFT` fields, then READY FOR MANUAL COMMIT.
