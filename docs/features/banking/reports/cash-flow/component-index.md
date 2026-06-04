# Cash Flow — Component Index (Frontend)

Every file in the Cash Flow frontend slice and what it owns. Paths are `wecms-web/`-relative.

---

## 1. Route & components

| File | Owns |
|---|---|
| `app/(dashboard)/banking/reports/cash-flow/page.tsx` | Server component; sets `metadata.title`, renders `<CashFlowClient />`. Inherits auth guard + `<AppShell>`. |
| `components/banking/reports/cash-flow/CashFlowClient.tsx` | `"use client"`. All state + orchestration: `filters` (`CashFlowFilters`), `searchKey`, the keyed `fetchCashFlow` loader via `useApiData`, exchange-rate prefetch (`fetchExchangeRates`) + static fallback, bank options (`fetchAccounts`), `handleSearch`, `handleExport` (direct `exportExcel`). Maps wire → view with `mapCashFlowReport`. |
| `components/banking/reports/cash-flow/CashFlowPage.tsx` | Presentation. `<PageLayout>` → `<PageHeader>` (Export button) → filter card → `<ReportLayout>` → the inline **`CashFlowMatrix`** component + helpers `GroupRows`, `ProfitBand`, `SubtotalBand`, `CategoryCell`. Owns `groupReport`, `monthIndicesForQuarter` consumption (`visibleMonthIdx`), `renderAmount`, the combined-rate helpers, `buildExportColumns`, `buildEmptyReport`, and exports `defaultCashFlowFilters` + the `CashFlowFilters` type. |
| `components/banking/reports/cash-flow/BankFilterPopover.tsx` | Bank multi-select popover; outside-click close, search box, checkbox list; emits `{bankCd, acctNo}[]`. |
| `components/banking/reports/cash-flow/types.ts` | `CashFlowReport` / `CashFlowRow` / `CashFlowMonthlyAmounts` (camelCase), `MONTH_KEYS`, `monthIndicesForQuarter(quarter)`. `rowType` is a free `string` (deliberately not narrowed to an enum). |
| `components/banking/reports/cash-flow/mockData.ts` | `mockCashFlowReport` — **dead code**; nothing imports it. The page has no mock fallback. |

> There is **no** separate `CashFlowMatrix.tsx` file — the matrix is the inline `CashFlowMatrix`
> component inside `CashFlowPage.tsx`. (The stale `../cash-flow.md` pointer references a
> `<CashFlowMatrix>` as if it were a file.)

---

## 2. Shared / lib

| File | Owns (Cash Flow usage) |
|---|---|
| `lib/api/banking.ts` | `fetchCashFlow(params)` → `GET /api/v1/banking/reports/cash-flow-report` (params: `year`, `baseCurrency`, `usdRate?`, `krwRate?`, `bankFilters?` — **no `quarter`**); `fetchExchangeRates()`; `fetchAccounts()`. `CashFlowQueryParams` type. |
| `lib/api/mappers.ts` | `mapCashFlowReport` / `mapCashFlowRow` / `mapCashFlowMonthly` (~line 561) — snake_case wire → camelCase, string fields `?? ""`, amounts via `toStr`. |
| `lib/api/useApiData.ts` | the fetch-on-mount + refetch hook used by `CashFlowClient`. |
| `lib/types/api.ts` | `ApiCashFlowReport` / `ApiCashFlowRow` / `ApiCashFlowMonthlyAmounts` (~line 827) — the wire types (`display_cd`, `row_type`, `monthly`, `annual_total`, …). |
| `lib/excel.ts` | `exportExcel({ endpoint, screenId, dymAreaId, fileName, title, columns, filters })` — POSTs JSON, saves the XLSX blob. |
| `lib/currency.ts` | `formatAmount(value, ccy, includeSymbol)` — VND/USD/KRW formatting used by `renderAmount` + the export column ccy. |
| `lib/viewSettingScreens.ts` | `SCREEN_IDS.CASH_FLOW_REPORT = "cash-flow-report"`, `DEFAULT_AREA_ID = "default"`. |
| `lib/print.ts` | **Not used** by Cash Flow (no print action). |
| `hooks/useExcelExport.ts` | **Not used** — Cash Flow calls `exportExcel` directly (documented report-page deviation). |
| `components/shared/ReportLayout.tsx` | report scroll viewport (no pagination) per wecms-web §7b. |
| `components/shared/FilterSelect.tsx` | the Currency / Year / Period dropdowns. |
| `locales/{en,ko,vi}.json` | `report.cash_flow.*` (40 keys each): `title`, `empty_message`, `field.{year,quarter,base_currency,exchange_rate,all_banks,bank_filter,n_selected,search_account,no_accounts}`, `period.{this_year,quarter_n}`, `col.{code,display_name,item_code,item_name,row_type,total,display_currency}`, `month.{jan..dec}`, `opening_balance`, `end_balance`. Plus `report.download_excel`, `common.search`, `common.loading`, `dialog.error`. |

---

## 3. Dead / superseded code (cleanup candidates)

| Item | Location | Note |
|---|---|---|
| `mockCashFlowReport` | `mockData.ts` | unreferenced; the page never falls back to mock |
| `extractKoName` / `extractEnName` | `CashFlowPage.tsx` | superseded by the separate `displayNm` / `itemNm` wire fields |
| `"Grand Total"` handling | `groupReport` (End Balance branch) | the backend never emits this `row_type` (G8) |
| `cf-scrollbar` class | `CashFlowPage.tsx` scroll container | diverges from the shared `custom-scrollbar*` utilities (wecms-web §6c) — minor inconsistency |

---

## 4. Reuse-rule notes

- The page follows wecms-web **§7b** (report page — `<ReportLayout>`, no `<Pagination>`, no
  `<DataTableShell>`) and **§7d** (wide report table — single-table `<ReportLayout>`, horizontal scroll).
- Export follows **§13b** in spirit (backend is the single XLSX producer) but, as a report page that
  doesn't adopt the View Setting popover, calls `exportExcel` directly rather than via `useExcelExport`
  — the deviation is documented in `CashFlowClient`'s header comment.
- Backend component map: [wecms-api/docs/features/banking/reports/cash-flow/source-code-index.md](../../../../../../wecms-api/docs/features/banking/reports/cash-flow/source-code-index.md).
