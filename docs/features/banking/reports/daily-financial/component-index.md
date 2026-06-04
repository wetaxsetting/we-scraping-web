# Daily Financial — Component / Source-Code Index (Frontend)

Complete map of every `wecms-web` artifact for both variants. Pair with the backend
[source-code-index.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/source-code-index.md)
for the full legacy → refactor traceability.

## 1. Routes / pages

| Artifact | Path |
|---|---|
| CMC route page | [app/(dashboard)/banking/reports/daily-financial/page.tsx](../../../../../app/(dashboard)/banking/reports/daily-financial/page.tsx) |
| HS route page | [app/(dashboard)/banking/reports/daily-financial-hs/page.tsx](../../../../../app/(dashboard)/banking/reports/daily-financial-hs/page.tsx) |

## 2. CMC components — `components/banking/reports/daily-financial/`

| Component | File | Role |
|---|---|---|
| `DailyFinancialClient` | [DailyFinancialClient.tsx](../../../../../components/banking/reports/daily-financial/DailyFinancialClient.tsx) | Client wrapper — owns filter state, search gate (`hasSearched`), fetch + mapping |
| `DailyFinancialPage` | [DailyFinancialPage.tsx](../../../../../components/banking/reports/daily-financial/DailyFinancialPage.tsx) | Presentational: filters, title card, `<FinancialStatusTable>`, `<CurrentAccountsTable>`, `<CellLink>`, Excel/print handlers |
| `TransactionHistoryDialog` | [TransactionHistoryDialog.tsx](../../../../../components/banking/reports/daily-financial/TransactionHistoryDialog.tsx) | Per-account drill-down popup (real API, paginated) |
| types | [types.ts](../../../../../components/banking/reports/daily-financial/types.ts) | `FinancialStatus`, `CurrentAccountRow`, `TransactionDetailRow`, `TxHistoryRow`, `TxHistoryResponse` |
| mock | [mockData.ts](../../../../../components/banking/reports/daily-financial/mockData.ts) | `mockFinancialStatus`, `mockCurrentAccounts` — **fallback only** (⚠️ rows use `accountTypeCd:"11"`) |

## 3. HS components — `components/banking/reports/daily-financial-hs/`

| Component | File | Role |
|---|---|---|
| `DailyFinancialHsClient` | [DailyFinancialHsClient.tsx](../../../../../components/banking/reports/daily-financial-hs/DailyFinancialHsClient.tsx) | Eager fetch on mount; `projectHsRows` flat → `BankGroup[]`; mock fallback |
| `DailyFinancialHsPage` | [DailyFinancialHsPage.tsx](../../../../../components/banking/reports/daily-financial-hs/DailyFinancialHsPage.tsx) | Header + static filters + `<LedgerTable>` / `<BankGroupRows>` |
| types | [types.ts](../../../../../components/banking/reports/daily-financial-hs/types.ts) | `LedgerEntry`, `BankGroup`, `LedgerTotal` |
| mock | [mockData.ts](../../../../../components/banking/reports/daily-financial-hs/mockData.ts) | `mockLedgerGroups` (7 groups, VND+USD sections) |

## 4. Shared components consumed

| Component | File | Used by |
|---|---|---|
| `ReportLayout` | [components/shared/ReportLayout.tsx](../../../../../components/shared/ReportLayout.tsx) | both — continuous-scroll body (§7b) |
| `ReportSection` | [components/banking/reports/ReportSection.tsx](../../../../../components/banking/reports/ReportSection.tsx) | CMC sectioned layout |
| `PageHeader` / `FilterRow` / `DateField` / `CalendarIconButton` / `FilterDropdown` | `components/shared/` | filters + header |
| `Dialog` (shadcn) | [components/ui/dialog.tsx](../../../../../components/ui/dialog.tsx) | CMC popup |
| `printReport` | [lib/print.ts](../../../../../lib/print.ts) | both — Print |
| `formatAmount` | [lib/currency.ts](../../../../../lib/currency.ts) | both — amount formatting |

> `DataTableShell` and `<Pagination>` are **deliberately not used** (report-page rule §7b).

## 5. API clients & mappers — `lib/`

| Function | File | Endpoint |
|---|---|---|
| `fetchDailyFinancial` | [lib/api/banking.ts](../../../../../lib/api/banking.ts) | `GET /api/v1/banking/reports/daily-financial` |
| `fetchDailyFinancialTransactions` | [lib/api/banking.ts](../../../../../lib/api/banking.ts) | `GET …/daily-financial/transactions` |
| `fetchDailyFinancialHs` | [lib/api/banking.ts](../../../../../lib/api/banking.ts) | `GET …/daily-financial-hs` (stub backend) |
| `mapFinancialStatus`, `mapCurrentAccountRow`, `mapDailyFinancialTransactionsResponse` | [lib/api/mappers.ts](../../../../../lib/api/mappers.ts) | wire → in-memory |
| `mapDailyFinancialHsRows` | [lib/api/mappers.ts](../../../../../lib/api/mappers.ts) | ⚠️ **dead no-op returning `null`** — real HS projection lives in `DailyFinancialHsClient.projectHsRows` |
| `useApiData` | [lib/api/useApiData.ts](../../../../../lib/api/useApiData.ts) | fetch-on-mount + mock fallback |

## 6. Wire types — `lib/types/api.ts`

`ApiFinancialStatusRow`, `ApiTransactionDetailRow`, `ApiCurrentAccountRow`, `ApiDailyFinancialCmcReport`,
`ApiDailyFinancialTransactionRow`, `ApiDailyFinancialTransactionsReport`, `ApiHsLedgerRow`,
`ApiDailyFinancialHsReport` — all **UPPER_SNAKE holdovers** (per `wecms-web/CLAUDE.md` § Holdovers).
Flip to lowercase snake_case in the same MR the backend DTO flips.

## 7. Export — `lib/reportExcel.ts`

`exportReportExcel`, `reportDateSuffix` (`DDMMYYYY`) — client-side `xlsx-js-style` (interim §13b
divergence). CMC builds the workbook inline; HS uses the shared `exportReportExcel`.

## 8. i18n — `locales/{en,ko,vi}.json`

`report.daily_financial.*` (incl. `tx_dialog.*`) + `report.daily_financial_hs.*` — 54 keys per locale.

## 9. Sidebar registration — `components/layout/Sidebar.tsx`

CMC entry always shown; HS entry gated behind `showDailyFinancialHs` (tenants with `PRDT_TYPE = "H"`).
