# Daily Cash — Component & File Index (Frontend)

All paths under `c:\WECMS PROJECT\wecms-web\`.

---

## 1. Route & page

| File | Type | Owns |
|---|---|---|
| `app/(dashboard)/banking/reports/daily-cash/page.tsx` | Server component | Page metadata (`title`); renders `<DailyCashClient />`. |

## 2. Feature components — `components/banking/reports/daily-cash/`

| File | Type | Owns |
|---|---|---|
| `DailyCashClient.tsx` | Client component | Filter state (`asOfIsoDate`, `scope`, `hasSearched`, `searchKey`); keyed `useApiData` fetch; currency-scope→wire mapping (`toWireCurrency`); wire→view mappers (`toSummaryRow`, `toAccountRow`); summary fallback (`rollupSummary`); Current/Savings split (`isCurrentType` 03/04, `isSavingType` 05/06). |
| `DailyCashPage.tsx` | Client component | Pure presentation: `PageHeader`, `FilterRow` (Search button, `DateField`, `CurrencyScopeToggle`), export buttons, per-currency `SummaryTable`, two `AccountLedger` grids, `currencyTotal`, `compareCurrency` ordering, zero-row fallback. |
| `types.ts` | Types | `DailyCashSummaryRow`, `DailyCashAccountRow`, `DailyCashHoldingRow` (⚠ dead — see §5). |
| `mockData.ts` | Mock data | `mockSummaryRows`, `mockCashRows`, `mockCurrentAccountRows`, `mockSavingsAccountRows` — **all dead** (never imported; mock seed removed Sprint 1 stabilization). |

## 3. Shared components consumed

| Component | Path | Used for |
|---|---|---|
| `PageLayout` / `PageHeader` | `components/shared/` | Page chrome + title. |
| `FilterRow` | `components/shared/` | Filter bar layout (Search button right slot). |
| `DateField` | `components/shared/` | As-of single-date picker (`formatDmyChip` → DD-MM-YYYY). |
| `CurrencyScopeToggle` | `components/shared/CurrencyScopeToggle.tsx` | All / FCY / VND radio. |
| `ReportLayout` | `components/shared/ReportLayout.tsx` | `sectioned` continuous-scroll container. |
| `ReportSection` | `components/shared/` | Titled section wrapper (summary blocks + each ledger). |
| `AccountLedger` | `components/shared/` (rendered in `DailyCashPage`) | The 8-column ledger grid (used twice: Current, Savings). |
| `SummaryTable` / `TableHeaderCell` / `CellLeft` / `CellRight` | `components/shared/` (or in-file) | Summary 2-col table + ledger header/body cells. |

## 4. Lib layer

| File | Type | Owns |
|---|---|---|
| `lib/api/banking.ts` | API client | `fetchDailyCashReport({ asOfDate, currency })` → `GET /api/v1/banking/reports/daily-cash-report` (active). Inline wire type `ApiDailyCashReportResponse` (lowercase snake_case). Also `fetchDailyCash(...)` → legacy `/daily-cash` (⚠ dead — see §5). |
| `lib/dailyCashExport.ts` | Export helper | `exportDailyCashExcel(...)` (`xlsx-js-style`), `printDailyCashReport(...)` (hidden-iframe HTML), `reportTimestampSuffix()`, currency number-format helpers (`isDecimalCcy`), zeroed fallback rows. |
| `lib/api/mappers.ts` | Mappers | `mapDailyCashSummaryRow` / `mapDailyCashHoldingRow` / `mapDailyCashAccountRow` (⚠ dead — superseded by the local mappers in `DailyCashClient.tsx`). |
| `lib/types/api.ts` | Wire types | `ApiDailyCashSummaryRow` / `ApiDailyCashHoldingRow` / `ApiDailyCashAccountLedgerRow` / `ApiDailyCashReport` — UPPER_SNAKE Sprint-1 holdovers (⚠ dead — the active page uses the inline `ApiDailyCashReportResponse` in `banking.ts`). |
| `components/layout/Sidebar.tsx` | Nav | Banking → Reports → Daily Cash menu entry. |

## 5. Dead / orphaned code (cleanup backlog)

The Daily Cash UI is complete, but several Sprint-1 holdovers remain disconnected. None affect runtime;
all are safe to delete in a cleanup MR:

- `components/banking/reports/daily-cash/mockData.ts` — entire file unused.
- `DailyCashHoldingRow` (`types.ts`) — unused type (former Cash table row).
- `DailyCashSummaryRow.cash` — populated but always `"0"` (cash source not ported); never rendered.
- `lib/api/banking.ts` `fetchDailyCash` + `lib/types/api.ts` UPPER_SNAKE `ApiDailyCash*` types +
  `lib/api/mappers.ts` `mapDailyCash*` — the legacy `/daily-cash` surface, superseded by the inline
  `ApiDailyCashReportResponse` + local mappers; **no live consumer**.
- `currency_flow` tier of `ApiDailyCashReportResponse` — fetched but never rendered by the page.

> Cross-ref: backend [fix-plan.md](../../../../../../wecms-api/docs/features/banking/reports/daily-cash/fix-plan.md)
> and [refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/reports/daily-cash/refactor-gap-analysis.md).
