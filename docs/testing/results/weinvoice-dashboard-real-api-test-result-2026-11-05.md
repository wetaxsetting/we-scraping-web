# WeInvoice Dashboard — Real API Test Result

**Date:** 2026-11-05
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [weinvoice-api-integration-2026-11-03.md](../../features/weinvoice/weinvoice-api-integration-2026-11-03.md)

## Scope

User request: test the Dashboard against the real API, no mock data.

## Environment

LOCAL — FE `next dev` with `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE=api` on `http://localhost:3000`;
BE `we-scraping-api` (process up ~16 h, branch `sit` = `origin/sit` `6aa0c1f`) on `http://localhost:8080`.

## Code / Build Under Test

Branch: `main` (working tree) · Commit: NOT COMMITTED · API: `http://localhost:8080`.

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| `GET /api/v1/weinvoice/dashboard?company_mst=0109876543&year=2026`, no token | 401 envelope | `WBE1401` "Your session is no longer valid…" (security filter answers before routing — does not show whether the endpoint exists) | PASS (gate only) |
| `POST /api/v1/auth/login` (unknown user) | `WBE1009` envelope | **No response within 30 s** | BLOCKED |
| `GET /actuator/health` | `UP` | **No response within 15 s** | BLOCKED |
| Log in → open `/dashboard` in API mode → real request + data | Real KPIs from the backend | Not reachable: login hangs; and the endpoint has no implementation in any backend branch | BLOCKED |
| **Re-run after the user enabled VPN** (same day): `GET /actuator/health` | `UP` | `{"status":"UP"}` in 0.28 s | PASS |
| Re-run: login with an unknown user | `WBE1009` | `WBE1009` in 0.92 s | PASS |
| Re-run: **user** logs in with their own backend account (browser pane), lands on `/dashboard` | Real login, `/me` 200 | `POST /auth/login` 200 → redirect `/dashboard`; `GET /auth/me` 200; tenant `CÔNG TY TNHH WEBCASH VIỆT NAM`, `tax_id 1201496252`, ADMIN | PASS |
| Re-run: Dashboard data in API mode (no mock) | `GET /api/v1/weinvoice/dashboard?company_mst=…&year=2026` → data | Request sent to the real backend → **404** envelope `WBE_NOT_FOUND` "The requested resource was not found."; screen shows the error card "Could not load the overview … (WBE_NOT_FOUND)" + Retry | FAIL — endpoint not implemented (backend) |
| Re-run: working MST sent | The logged-in company's MST `1201496252` | `company_mst=0109876543` — the **mock** MST from the header list (`GET /companies` not wired) | FAIL — frontend gap |

## Not Tested

The Dashboard with real data. Two independent blockers:

1. **Backend unhealthy** — every DB-backed request hangs (login, health); only the security filter
   answers. Cause: VPN was off — resolved by the user the same day (re-run rows above).
2. **Endpoint not implemented** — `domain/weinvoice` is in no backend branch (`git fetch` +
   all remote branches searched on 2026-11-05). Even a healthy backend would answer 404.

## Existing Failures

None new on the frontend (automated suite from 2026-11-04 unchanged: 33 / 33).

## New Failures

None caused by frontend code. Observation: the shared axios instance has **no request timeout**, so
a hanging backend leaves the login button spinning indefinitely — recorded as a follow-up.

Dev-mode note: each request appears twice — React StrictMode double-invokes effects in `next dev`; not a production behaviour.

## Final Result

PARTIAL — real login and the real Dashboard request work end-to-end; no data because the backend has
no `/api/v1/weinvoice/dashboard`, and the working MST still comes from the mock company list.

## Recommendation

1. Backend: merge / push `domain/weinvoice` (endpoint + `interface-specification.md`).
2. Frontend: in API mode, take the working MST from the logged-in company (`/me` `tax_id`) until
   `GET /companies` is wired — today the header's mock list sends a foreign MST.
