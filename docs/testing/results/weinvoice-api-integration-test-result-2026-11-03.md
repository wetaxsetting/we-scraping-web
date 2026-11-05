# WeInvoice API Integration — Test Result

**Date:** 2026-11-03
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [weinvoice-api-integration-2026-11-03.md](../../features/weinvoice/weinvoice-api-integration-2026-11-03.md)

## Scope

Real authentication against the backend (`/api/v1/auth/login`, `/me`, `/logout`) and the shared
HTTP transport. Data endpoints are out of this run (blocked on the backend contract).

## Environment

LOCAL — FE `next dev` on `http://localhost:3000`; BE `we-scraping-api` (branch `sit`) on
`http://localhost:8080`.

## Code / Build Under Test

Branch: `main` (working tree) · Commit: NOT COMMITTED · API: `http://localhost:8080`.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run` | PASS | 4 files, 24 tests, 24 passed |
| `lib/weinvoice/auth.test.ts` | PASS | 6 / 6 — authenticated shape, chooser + `biz_key` re-post, error envelope code, `WBE_NETWORK`, `/me` rehydrate, logout keeps `wecms_locale` |
| `npx tsc --noEmit` | PASS | 0 errors |
| `npm run build` | PASS | 30 static pages |
| `npx eslint app components lib proxy.ts vitest.setup.ts` | PASS (pre-existing only) | errors only in untouched `DateField`, `InteractiveDateRangePicker`, `SearchSelect`, `LocaleProvider` |
| `node scripts/check-doc-links.mjs` | PASS | 0 in-repo broken |

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| `curl POST /api/v1/auth/login` with an unknown user, `Origin: http://localhost:3000` | 200 + error envelope; CORS allows the origin | `{"status":{"error":true,"code":"WBE1009",…},"trace_id":…}`; `Access-Control-Allow-Origin: http://localhost:3000`; preflight 200 | PASS |
| Browser: log in with an unknown user | Backend message + code inline, no redirect | "ID or password does not match. (WBE1009)" | PASS |
| Browser: successful login / chooser / logout | Lands on `/dashboard`; chooser for multi-company users; logout back to `/login` | — | NOT RUN |

## Not Tested

The successful-login path in the browser: no documented test account for the local backend, and
the assistant does not enter real credentials. Left for the user.

## Existing Failures

ESLint `react-hooks/set-state-in-effect` in untouched shared components (category B).

## New Failures

None.

## Final Result

PARTIAL — every executed check passed; success path not run in the browser.

## Recommendation

PARTIAL — the user verifies login with a backend account; data wiring waits for the API contract.
