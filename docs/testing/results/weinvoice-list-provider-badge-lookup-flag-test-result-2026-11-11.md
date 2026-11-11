# WeInvoice List Provider Badge — Test Result

**Date:** 2026-11-11
**Type:** TEST RESULT
**Status:** PASS (automated) · UI NOT RUN
**Repository:** we-scraping-web
**Related Record:** [weinvoice-list-provider-badge-lookup-flag-2026-11-11](../../issues/weinvoice-list-provider-badge-lookup-flag-2026-11-11.md)

## Environment

LOCAL, Vitest (jsdom). Branch `scraping-data`, Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run components/invoices lib/api/weinvoice` | PASS | 12 files, 124 tests |
| new: `row lookup_code: no "!" and ↗ opens the original directly without loading the detail` | PASS | |
| `npx tsc --noEmit`, `npx eslint` (3 changed files) | PASS | no findings |

## Regression Tests

Did a regression test cover the original defect? **YES** — a row with `needs_lookup_code=false` and a code gives
`needsLookupCode() = false` and a direct link; the list cell now uses that function.

## Not Tested

UI in a browser: NOT RUN.

## Final Result

PASS (automated)

## Recommendation

READY FOR MANUAL COMMIT
