# WeInvoice "Needs a Lookup Code" by Provider (Web, Mock Parity) — Test Result

**Date:** 2026-11-18
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web
**Related Record:** [weinvoice-needs-lookup-code-by-provider-2026-11-18](../../issues/weinvoice-needs-lookup-code-by-provider-2026-11-18.md)

## Scope

Mock branch of `needsLookupCode()` follows the backend rule; API mode keeps reading the backend flag.

## Environment

LOCAL (Windows laptop), Vitest 2.1.9 (jsdom). No browser run.

## Code / Build Under Test

Branch: `scraping-data` (working tree, on top of `d0affdb`) · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `lib/api/weinvoice/needsLookupCode.test.ts` (new) — FPT needs; PDF / code → no; 6 providers without code → no | PASS | 3/3 |
| `npx vitest run` (whole suite) | PASS | 26 files, 215 tests |
| `npx tsc --noEmit -p .`, `npx eslint` on the changed files | PASS | no errors / findings |

## Not Tested

Browser: NOT RUN (the API-mode flag comes from the backend; see its result).

## Final Result

PASS

## Recommendation

READY FOR MANUAL COMMIT
