# Banking › Reports

Frontend design docs for the Banking **Reports** group — "as-of" snapshot reports (no pagination). Mirrors the WeCMS Banking sidebar group **Reports**.

## Screens

| Doc | Route | Component |
|---|---|---|
| [daily-cash.md](daily-cash.md) | `/banking/reports/daily-cash` | [`DailyCashPage`](../../../../components/banking/reports/daily-cash/DailyCashPage.tsx) |
| [daily-financial.md](daily-financial.md) | `/banking/reports/daily-financial` (CMC) · `/banking/reports/daily-financial-hs` (HS) | [`DailyFinancialPage`](../../../../components/banking/reports/daily-financial/DailyFinancialPage.tsx) |
| [cash-flow.md](cash-flow.md) | `/banking/reports/cash-flow` | [`CashFlowPage`](../../../../components/banking/reports/cash-flow/CashFlowPage.tsx) |

## UI rules

Report pages route through the shared [`ReportLayout`](../../../../components/shared/ReportLayout.tsx). They **must not** render `<Pagination>` or `<DataTableShell>` (see wecms-web/CLAUDE.md §7b / §7c / §7d).

## Related backend docs

[`../../../../../wecms-api/docs/features/banking/`](../../../../../wecms-api/docs/features/banking/) · [`../../../../../wecms-api/docs/api-spec/banking/`](../../../../../wecms-api/docs/references/api-spec/banking/)

> **OQ-DOC-6** — the JEX WSVC ids for Daily Cash / Daily Financial / Cash Flow are inconsistent between the feature docs and the JEX screen-flow index; verify against source before editing. Tracked at [`../../../../../wecms-api/docs/planning/open-questions/documentation-follow-up.md`](../../../../../wecms-api/docs/planning/open-questions/documentation-follow-up.md). Not resolved here.
