# WeInvoice VAT Declaration on Engine Invoices (Web) — Test Result

**Date:** 2026-11-25
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [WeInvoice VAT Declaration on Engine Invoices](../../features/weinvoice/weinvoice-vat-declaration-engine-invoices-2026-11-25.md)

## Scope

`lib/api/weinvoice/vatDeclarations.ts`, `components/tax/VatReturnPage.tsx`, `components/tax/vatIndicatorSchema.ts`
(restored from the removed WeCMS screen), route `/tax/vat-return`, nav badge, 21 `vat.*` locale keys (VI/EN/KO).

## Environment

LOCAL (Windows, Node from the repository's `node_modules`). No browser run, no backend.

## Code / Build Under Test

Branch: `scraping-data` · Base commit: `d57f8dc` · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run lib/api/weinvoice/vatDeclarations.api.test.ts` | PASS | 6 tests (paths, snake_case body / params, save sends only edited cells, mock mode calls nothing) |
| `npx vitest run components/tax/VatReturnPage.test.tsx` | PASS | 4 tests (list → open, draft edit saves `{ ct22 }` only, locked has no inputs + exports, mock-mode message) |
| `npx vitest run` (full suite) | PASS | 32 files, 245 tests |
| `npx eslint components/tax lib/api/weinvoice/vatDeclarations*.ts lib/weinvoice/nav.ts app/(dashboard)/tax/vat-return/page.tsx` | PASS | no findings |
| `npx tsc --noEmit -p .` | PASS for source | 0 errors outside `.next/` (stale `.next/types` errors pre-existing) |
| `node scripts/check-doc-links.mjs` | PASS (in-repo) | in-repo broken 0; 2 out-of-repo links in `CLAUDE.md` pre-existing |

## UI Verification

NOT RUN — the screen needs the backend (login + `/companies/{mst}/vat-declarations`); verify scenario 38 of
[test-scenarios.md](../../features/weinvoice/test-scenarios.md) on SIT.

## Database Verification

NOT APPLICABLE — dependency only (backend record).

## Existing Failures

Stale `.next/types` tsc errors; 2 out-of-repo doc links — present before this change.

## New Failures

None.

## Final Result

PARTIAL — automated checks PASS; UI on SIT NOT RUN.

## Recommendation

READY FOR MANUAL COMMIT.
