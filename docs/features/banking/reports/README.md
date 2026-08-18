# Banking › Reports

**Status: CURRENT (index)** — navigation only. Each linked screen doc carries its own status; see [../../../README.md § Status vocabulary](../../../README.md#status-vocabulary).

Frontend design docs for the Banking **Reports** group — "as-of" snapshot reports (no pagination). Mirrors the WeCMS Banking sidebar group **Reports**.

## Screens

Each submenu page is a leaf folder with the standard 6-doc set; the older one-page specs are preserved inside each leaf as `legacy-spec.md`.

| Leaf folder | Route | Component |
|---|---|---|
| [daily-cash/](daily-cash/README.md) | `/banking/reports/daily-cash` | [`DailyCashPage`](../../../../components/banking/reports/daily-cash/DailyCashPage.tsx) |
| [daily-financial/](daily-financial/README.md) | `/banking/reports/daily-financial` (CMC) | [`DailyFinancialPage`](../../../../components/banking/reports/daily-financial/DailyFinancialPage.tsx) |
| [daily-financial-hs/](daily-financial-hs/README.md) | `/banking/reports/daily-financial-hs` (HAENGSUNG) | [`DailyFinancialHsPage`](../../../../components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx) — **live, code-complete 2026-07-02** (real API + per-field save + Excel download + DB-backed View Setting) |
| [cash-flow/](cash-flow/README.md) | `/banking/reports/cash-flow` | [`CashFlowPage`](../../../../components/banking/reports/cash-flow/CashFlowPage.tsx) |

## UI rules

Report pages route through the shared [`ReportLayout`](../../../../components/shared/ReportLayout.tsx). They **must not** render `<Pagination>` or `<DataTableShell>` (see wecms-web/CLAUDE.md §7b / §7c / §7d).

## Related backend docs

`banking` _(wecms-api backend repo — not included in this clone)_ · `banking` _(wecms-api backend repo — not included in this clone)_

> **OQ-DOC-6** — the JEX WSVC ids for Daily Cash / Daily Financial / Cash Flow are inconsistent between the feature docs and the JEX screen-flow index; verify against source before editing. Tracked at `documentation-follow-up.md` _(wecms-api backend repo — not included in this clone)_. Not resolved here.
