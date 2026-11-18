# WeInvoice Provider Pill Tooltip Without URL — Test Result

**Date:** 2026-11-18
**Type:** TEST RESULT
**Status:** PASS
**Repository:** we-scraping-web
**Related Record:** [weinvoice-provider-pill-tooltip-hide-url-2026-11-18](../../issues/weinvoice-provider-pill-tooltip-hide-url-2026-11-18.md)

## Scope

Provider pill ("Phát hành qua") tooltip shows only "<provider> · MST <mst>"; the "Mở hoá đơn gốc: <url>" line is gone.

## Environment

LOCAL (Windows laptop), Vitest 2.1.9 (jsdom), mock data source. No browser run.

## Code / Build Under Test

Branch: `scraping-data` (working tree, on top of `4d8c202`) · Commit: NOT COMMITTED.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `components/invoices/InvoiceListPage.providerTooltip.test.tsx` (new) — every provider pill: no newline, no "Mở hoá đơn gốc" / URL, has "MST", still has `href` | PASS | 1/1 |
| Same test on the old `InvoiceListPage.tsx` (`git stash push -- components/invoices/InvoiceListPage.tsx`) | FAIL (expected) | `expected 'Tập Đoàn Bưu chính viễn thông Việt Na…' not to contain '\n'` |
| `npx vitest run` (whole suite) | PASS | 23 files, 205 tests |
| `npx tsc --noEmit -p .` (source) | PASS | no errors |
| `npx eslint` on the 2 changed files | PASS | no findings |

## Not Tested

Browser hover on SIT: **NOT RUN** (not deployed yet).

## Final Result

PASS

## Recommendation

READY FOR MANUAL COMMIT
