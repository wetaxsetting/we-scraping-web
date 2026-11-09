# WeInvoice Add / Change GDT Account in One Call — Test Result

**Date:** 2026-11-06
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** wecms-web (checked out as `we-scraping-web`)
**Related Record:** [../../issues/weinvoice-gdt-login-test-synchronous-2026-11-06.md](../../issues/weinvoice-gdt-login-test-synchronous-2026-11-06.md)
**Backend result:** `we-scraping-api/docs/testing/results/weinvoice-gdt-login-test-synchronous-test-result-2026-11-06.md`

## Environment

LOCAL — Node 22.14, Vitest (jsdom). No backend running.

## Code / Build Under Test

Branch: `scraping-data` + working tree · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run lib/api/weinvoice` | PASS | 11 files, 112 tests, 0 failed |
| `npx tsc --noEmit -p .` (source files) | PASS | 0 errors outside `.next/types` (stale generated types of an older build) |
| `npx eslint lib/api/weinvoice/sync.ts lib/api/weinvoice/sync.api.test.ts` | PASS | exit 0 |

## Regression Tests

`sync.api.test.ts` › `addConnection (api)`: the add is one `POST` + one `GET /companies` (no
`GET /requests`), `WBE3027` → `wrong_password`, a failed reload still reports the saved connection;
`PUT …/password` answers in one call and surfaces `WBE3027`.

## Not Tested

Running UI against the backend and the engine (backend not started on this machine).

## Final Result

PARTIAL — unit level PASS; end-to-end pending.

## Recommendation

READY FOR MANUAL COMMIT.
