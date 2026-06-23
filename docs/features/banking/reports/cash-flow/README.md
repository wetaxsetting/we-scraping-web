# Cash Flow — Frontend Feature Package (Next.js)

> **Scope of this folder.** Frontend (Next.js / `wecms-web`) design documentation for the **Cash Flow**
> report. Every statement is backed by reading the actual component tree under
> `components/banking/reports/cash-flow/` plus `app/(dashboard)/banking/reports/cash-flow/`,
> `lib/api/banking.ts`, `lib/api/mappers.ts`, `lib/excel.ts`, and `lib/currency.ts`. The backend
> counterpart (legacy spec, DB mapping, REST contract, parity) lives at
> [`wecms-api/docs/features/banking/reports/cash-flow/`](../../../../../../wecms-api/docs/features/banking/reports/cash-flow/).
>
> **Created 2026-06-04** during the Cash Flow documentation consolidation. Replaces the thin stub at
> [`../cash-flow.md`](legacy-spec.md) (kept as a short pointer).

| Field | Value |
|---|---|
| Feature slug | `cash-flow` (View Setting screenId `cash-flow-report`) |
| Module | Banking → Reports |
| Route | `/banking/reports/cash-flow` (`(dashboard)` group) |
| Page file | `app/(dashboard)/banking/reports/cash-flow/page.tsx` (server component) |
| Client root | `components/banking/reports/cash-flow/CashFlowClient.tsx` |
| Presentation | `components/banking/reports/cash-flow/CashFlowPage.tsx` (matrix + filters) |
| Backend endpoints consumed | `GET /api/v1/banking/reports/cash-flow-report` · `POST .../export` · `GET /api/v1/banking/exchange-rates` · `GET /api/v1/banking/accounts` |
| Export | `lib/excel.ts` `exportExcel(...)` → backend POI (`CashFlowExcelWriter`) |
| Print | **Not implemented** (legacy had none either) |
| View Setting | **Not adopted** as a popover (report page, no toolbar list-icon); screenId `cash-flow-report` exists only for the export visibility contract |
| Report layout | `<ReportLayout>` — no pagination (wecms-web §7b) |
| i18n prefix | `report.cash_flow.*` |
| Status | **Functionally complete & API-wired** (mock seed is dead code; API is the single source of truth) |

---

## Documents in this package

| File | Purpose |
|---|---|
| [README.md](README.md) | This file — identity, index, status. |
| [screen-flow.md](screen-flow.md) | Page load → rate/bank prefetch → search → render → export flow; empty / loading / zero-data states. |
| [ui-specification.md](ui-specification.md) | Filter row, the hierarchical matrix, special rows, monthly columns + quarter column-hiding, sticky chrome, Excel export structure & parity. |
| [component-index.md](component-index.md) | Every file: page, client, presentation, popover, types, mappers, export — with what each owns. |
| [api-consumption.md](api-consumption.md) | The fetchers, endpoints, query params, wire→view mapping, the quarter-not-sent rule, currency formatting. |
| [test-scenarios.md](test-scenarios.md) | Frontend SIT/UAT scenarios: search, currency, quarter column-hide, special rows, export, empty/loading states. |

---

## Related documents

- Backend package: [`wecms-api/docs/features/banking/reports/cash-flow/`](../../../../../../wecms-api/docs/features/banking/reports/cash-flow/) — legacy spec, calc rules, DB mapping, REST contract, parity.
- Parity audit: [`docs/features/cash-flow/parity-audit/gap-report.md`](../../../../../../docs/features/cash-flow/parity-audit/gap-report.md) — §8b covers the two frontend-only UI parity fixes (NON SALES PROFIT blue band + centered END BALANCE).
- [`../cash-flow.md`](legacy-spec.md) — one-line page-mapping stub (retained pointer).
- [`../README.md`](../README.md) — Banking → Reports frontend group index.
- Sibling reports: [`../daily-cash/`](../daily-cash/), `../daily-financial/` — same `<ReportLayout>` / no-pagination pattern.
- Layout rules: [`wecms-web/CLAUDE.md`](../../../../../CLAUDE.md) §7b (report pages, no pagination), §7d (wide report tables), §13b (Excel export).

---

## At a glance

- **One screen, one client component.** `page.tsx` (server) sets metadata and renders `<CashFlowClient />`;
  the client owns filter state + the keyed fetch + rate prefetch + bank options + export; `CashFlowPage`
  is pure presentation (the matrix is defined inline as `CashFlowMatrix`, not a separate file).
- **Search-then-fetch, full-year always.** `fetchCashFlow` is fired on mount and re-fired when **Search**
  bumps `searchKey`. **Quarter is never sent to the calc endpoint** — the page always receives all 12
  months and hides out-of-quarter columns client-side via `monthIndicesForQuarter(quarter)`.
- **Live-wired, no mock fallback.** `report` comes straight from `mapCashFlowReport(data)`;
  `mockData.ts` (`mockCashFlowReport`) is **dead code** (nothing imports it). On backend error/empty the
  page renders an empty matrix (`buildEmptyReport`), never mock rows.
- **Hierarchy rebuilt client-side.** `groupReport(report)` buckets the flat rows by `row_type` into
  `{ opening, groups[], salesProfit, nonSalesProfit, endBalance }`; L1/L2 cells use `rowSpan`; Opening
  Balance renders in the header; End Balance in a sticky-bottom green table.
- **No annual-total column on screen** — `annual_total` is exported to Excel only.
- **Single combined Exchange Rate input** (not separate USD/KRW boxes); it edits `krwRate` when
  base = USD, otherwise `usdRate`.

> **Doc-staleness note:** `wecms-web/CLAUDE.md`'s API table still labels `/banking/reports/cash-flow` as
> a "stub backend, falls back to mock", and lists `ApiCashFlowReport` among the UPPER-holdover wire
> types. The live code hits `/banking/reports/cash-flow-report` (note the `-report` suffix), has **no**
> mock fallback, and the wire row is already lowercase snake_case (`ApiCashFlowRow.display_cd`, etc.).
> See [api-consumption.md](api-consumption.md).
