# WeInvoice Test Data + Language Preference (API) — Test Result

**Date:** 2026-11-09
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** wecms-web (checked out as `we-scraping-web`)
**Related Record:** [../../issues/weinvoice-p1-api-wiring-gaps-2026-11-09.md](../../issues/weinvoice-p1-api-wiring-gaps-2026-11-09.md)

## Scope

`lib/api/weinvoice/testdata.ts` (API mode), `lib/api/weinvoice/me.ts`, the `/me` loader in `remote.ts`,
`AppShell` language apply / save, `TestDataPanel` counts line.

## Environment

LOCAL — Node (Vitest + jsdom). Backend and engine not running.

## Code / Build Under Test

Branch: local `scraping-data` + working tree · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run lib/api/weinvoice` | PASS | 12 files, 119 tests |
| `npx vitest run` | PASS | 16 files, 137 tests |
| `npx tsc --noEmit` | PASS | 0 errors in source |
| `npx eslint` (changed files) | PASS | no findings |

New cases (`lib/api/weinvoice/testdata-me.api.test.ts`): available only when `test_data_enabled`; mock mode
never calls the backend; load sends `company_mst` = working MST, reports "1/4" progress, maps the snake_case
engine report, reloads the MST's invoices; engine `no_folder` surfaces and skips the reload; `/me` language
remembered, unchanged language not saved, change saved as lowercase `lang_cd`, unknown code / mock mode ignored.

## UI Verification

NOT RUN — the test-data card and the language round trip need the backend + engine worker running.

## Existing Failures

None.

## New Failures

None.

## Not Tested

End-to-end with the backend and `web/weinvoice_worker.py` (see the backend record
`we-scraping-api/docs/issues/weinvoice-engine-request-worker-2026-11-09.md`).

## Final Result

PARTIAL — unit level PASS; end-to-end pending.

## Recommendation

READY FOR MANUAL COMMIT after the developer's end-to-end check.
