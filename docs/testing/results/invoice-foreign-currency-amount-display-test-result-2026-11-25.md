# Invoice Foreign-Currency Amount Display — Test Result

**Date:** 2026-11-25
**Type:** TEST RESULT
**Status:** PARTIAL
**Repository:** we-scraping-web
**Related Record:** [Invoice Amounts Ignore the Invoice Currency](../../bugs/invoice-foreign-currency-amount-display-fix-2026-11-25.md)

## Scope

`fmtInvoiceAmount` / `fmtInvoiceMoney` / `invoiceCurrency` (`lib/weinvoice/format.ts`) and their use in the detail
modal (`AmountSummary`, replacement compare), list rows, `InvoiceSheet`, print popup (`renderedHtml`), invoice check,
supplier risk, command palette, KPI / totals / dashboard unit `₫` → `VND`; `Invoice.currency` widened to `string`.

## Environment

LOCAL (Windows, Node from the repository's `node_modules`). No SIT run.

## Code / Build Under Test

Branch: `scraping-data` · Base commit: `8521387` · Commit: NOT COMMITTED · API: not called.

## Automated Tests

| Test / Command | Result | Evidence |
|---|---|---|
| `npx vitest run lib/weinvoice components/invoices/InvoiceAmounts.currency.test.tsx` | PASS | 4 files, 20 tests |
| `npx vitest run` (full suite) | PASS | 30 files, 235 tests |
| `npx eslint` on the 13 changed / new source + test files | PASS | no findings |
| `npx tsc --noEmit -p .` | PASS for source | 0 errors outside `.next/` (stale `.next/types` errors pre-existing) |
| `node scripts/check-doc-links.mjs` | PASS (in-repo) | in-repo broken 0; 2 out-of-repo links in `CLAUDE.md` pre-existing |

## Regression Tests

Did a regression test cover the original defect? **YES**

- `lib/weinvoice/format.test.ts` › `shows USD with cents and the USD unit, never ₫` — `7303.84 USD` → `"7.303,84 USD"`
  (old `fmtMoney(…) ₫` gave `"7.304 ₫"`).
- `components/invoices/InvoiceAmounts.currency.test.tsx` › detail panel USD case asserts the text does not contain
  `7.304` and shows the VND equivalent / rate; VND case asserts `"44.445 + 3.555 = 48.000 VND"`;
  bản thể hiện + print popup assert "Loại tiền: USD", cents, no amount-in-words line.
- Result: PASS. Not re-run against the pre-fix source (the repository has other people's uncommitted changes, so no
  stash); the asserted old output is the literal behaviour of the removed code.

## UI Verification

NOT RUN — no browser session against the backend; verify scenario 37 of
[test-scenarios.md](../../features/weinvoice/test-scenarios.md) on SIT.

## Database Verification

NOT APPLICABLE — no database dependency (backend already sends `currency`, `exchange_rate`, `total_vnd`).

## Existing Failures

Stale `.next/types/validator.ts` tsc errors; 2 out-of-repo doc links in `CLAUDE.md` — present before this change.

## New Failures

None.

## Not Tested

Real USD / KRW invoices in the browser (SIT).

## Final Result

PARTIAL — automated checks PASS; UI check on SIT pending.

## Recommendation

READY FOR MANUAL COMMIT.
