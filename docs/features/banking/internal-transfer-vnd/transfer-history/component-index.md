# Transfer History — Component Index (Frontend)

> All paths relative to `wecms-web/`.

## 1. Route & page

| File | Role |
|---|---|
| `app/(dashboard)/banking/transfer-history/page.tsx` | Thin server component; `metadata.title="Transfer History — WeCMS"`; renders `<TransferHistoryClient/>` |

## 2. Feature components (`components/banking/internal-transfer/`)

| File | Role |
|---|---|
| `TransferHistoryClient.tsx` | `"use client"` — **state owner + data fetch**. Holds `range`, `statusRadio`, `pageNo`, `pageSize`, `useTableSort()`. Derives wire params, calls `fetchTransferHistory` via `useApiData`, maps rows/totals, maps errors, stable-data latch. |
| `TransferHistoryPage.tsx` | `"use client"` — **presentational**. `PageLayout`/`PageHeader`/`FilterRow`/`ErrorBanner`/`DataTableShell`. Exports `StatusRadio`, `radioToWire`, `STATUS_RADIOS`. Documents "no toolbar" intent. |
| `TransferHistoryTable.tsx` | Bare `<table>`, sticky thead, 6 columns, BankCell, status display. Exports `TRANSFER_HISTORY_SORT_FIELD_IDS`. |
| `TransferHistoryTableColumns.tsx` | Shared `<colgroup>` (120/260/260/160/flex/140). Exports `TRANSFER_HISTORY_COLUMN_COUNT=6`. |
| `TransferHistoryTableFooter.tsx` | Sibling footer `<table>` via `<DataTableFooter>`; VND totals row. |
| `types.ts` | `TransferStatus`, `TransferRow`, `TransferHistoryTotal` (also hosts Own Account Transfer types). |

> No `mockData.ts` exists for this page — it is wired to the live API only.

## 3. Shared components consumed

| Component | Source |
|---|---|
| `<PageLayout>` | `components/shared/PageLayout.tsx` |
| `<PageHeader>` | `components/shared/PageHeader.tsx` |
| `<FilterRow>` | `components/shared/FilterRow.tsx` |
| `<InteractiveDateRangePicker>` | `components/shared/` (interactive date range) |
| `<DataTableShell>` | `components/shared/DataTableShell.tsx` (`footerMode="paginationWithTotals"`) |
| `<DataTableFooter>` | `components/shared/DataTableFooter.tsx` |
| `<TableHeaderCell>` | `components/shared/TableHeaderCell.tsx` (sort glyphs) |
| `<Pagination>` + `PAGE_SIZE_OPTIONS` | `components/shared/Pagination.tsx` |

## 4. Hooks

| Hook | Source | Use |
|---|---|---|
| `useTableSort()` | `hooks/useTableSort.ts` | sort cycle (default→ASC→DESC→default) |
| `useApiData(...)` | `lib/api/useApiData.ts` | fetch on mount + on dep change |
| `useStickyLoading(...)` | shared hook | min-visible loading window |

## 5. API / types / mappers

| File | Symbol |
|---|---|
| `lib/api/banking.ts` | `fetchTransferHistory(params)` → `GET /api/v1/banking/internal-transfer/transfer-history` |
| `lib/types/api.ts` | `ApiTransferHistoryRow`, `ApiTransferHistoryResponse` (lowercase snake_case, flipped 2026-05-20) |
| `lib/api/mappers.ts` | `mapTransferHistoryRow`, `mapTransferHistoryTotals` |

## 6. Routing / nav / permissions

| File | Symbol |
|---|---|
| `lib/viewSettingScreens.ts` | `SCREEN_IDS.TRANSFER_HISTORY="transfer-history"`; `SCREEN_ID_TO_ROUTE → /banking/transfer-history` (no `SYS_SCR_OPTION_WECMS` seed — no View Setting) |
| `lib/menuAuth.ts` | `/banking/transfer-history` → `banking-internal-transfer-history` |
| `components/layout/sidebarNav.ts` | leaf `banking-transfer-history`, label `sidebar.banking.transferHistory`, icon `ICON.arrow` |

## 7. i18n keys (`locales/{en,ko,vi}.json`)

Prefix `transfer_history.*`:

- `title`
- `filter.all` / `filter.success` / `filter.failed`
- `col.date_time` / `col.from_bank` / `col.to_bank` / `col.amount` / `col.remarks` / `col.results`
- `status.success` / `status.failed`
- `footer.total_currency` / `footer.transaction_count`
- `loading`
- `empty.default` / `empty.after_error`
- `error.title` / `error.invalid_period` / `error.validation` / `error.network` / `error.coocon_timeout` / `error.coocon_failure` / `error.unknown`

(Separate concern: `settings.users.menu.banking.inquire_transfer_history` — Users-panel entitlement label.)

## 8. Not present (scope boundary)

No match dialog, candidate grid, detail route (`[id]`), export/print buttons, View Setting popover, or mock data file exist for this page. Matching UI belongs to the Transaction-History matching feature.
