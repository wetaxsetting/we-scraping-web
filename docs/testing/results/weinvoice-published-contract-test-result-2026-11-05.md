# WeInvoice — Published Contract Reconciliation — Test Result

**Date:** 2026-11-05
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [weinvoice-api-integration-2026-11-03.md](../../features/weinvoice/weinvoice-api-integration-2026-11-03.md)

## Scope

Every API branch aligned with the backend's published contract (`we-scraping-api` commit `8823f7f`,
`interface-specification.md` + `domain/weinvoice/dto/*`), user request "test lại thử, mình mới pull
code về".

## Environment

LOCAL — Vitest + jsdom. Backend: running process predates `8823f7f` (started 2026-11-04);
`.env` / `.env.local` have none of the 14 `WECMS_WEINVOICE_*` keys.

## Code / Build Under Test

Frontend branch `main` (working tree, NOT COMMITTED) · backend `sit` @ `8823f7f` (read-only reference).

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run` | PASS | 15 files, 129 tests, all passed (fixtures use the exact snake_case keys of the backend DTOs) |
| `npx tsc --noEmit` | PASS | 0 errors |
| `npm run build` | PASS | 30 static pages |
| `npx eslint app components lib proxy.ts` | PASS (pre-existing only) | errors only in untouched shared components |
| `node scripts/check-doc-links.mjs` | PASS | 0 in-repo broken |
| `// DRAFT` markers left in code | PASS | 0 (open points carry `// OPEN:`) |

## Test Scenarios

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Real backend serves `/api/v1/weinvoice/*` | 200 envelopes | Not reachable: the backend must be restarted on `8823f7f` with the 14 `WECMS_WEINVOICE_*` keys and the `weinvoice` schema applied by a DBA | BLOCKED |

## Not Tested

The whole real-API run (backend configuration + DBA script + engine worker are backend-owner actions;
the frontend does not set credentials or run SQL, §12g).

## Existing Failures

ESLint errors in untouched shared components (category B).

## New Failures

None.

## Final Result

PARTIAL — contract reconciled and unit-verified; real-API run BLOCKED on backend configuration.

## Recommendation

READY FOR SIT-style check once the backend owner restarts the API with WeInvoice configured.
