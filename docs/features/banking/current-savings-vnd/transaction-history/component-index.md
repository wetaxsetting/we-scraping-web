# Transaction History (VND) — Component Index (Frontend)

File-by-file map of the refactored Next.js screen. All paths are under `wecms-web/`; build artifacts
under `.next/` are excluded. Backend file index:
[wecms-api .../transaction-history-vnd/source-code-index.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/transaction-history/source-code-index.md).

---

## 1. Routes (App Router)

| File | Renders | Notes |
|---|---|---|
| `app/(dashboard)/banking/transaction-history/page.tsx` | `<TransactionHistoryIndexRedirect scope="VND" />` | index → first account redirect |
| `app/(dashboard)/banking/transaction-history/[accountId]/page.tsx` | `<TransactionHistoryClient acctSeqNo={accountId} scope="VND" />` | `params: Promise<{ accountId }>` (Next 16) |
| `app/(dashboard)/banking/transaction-history-fcy/page.tsx` | `<TransactionHistoryIndexRedirect scope="FCY" />` | FCY index |
| `app/(dashboard)/banking/transaction-history-fcy/[accountId]/page.tsx` | `<TransactionHistoryClient scope="FCY" />` | FCY per-account |

## 2. Components (`components/banking/transaction-history/`)

| File | Role |
|---|---|
| `TransactionHistoryClient.tsx` | **State + data fetching** wrapper (client). Filter state, list + summary fetch, picker options, confirm/undo + classify mutations, export, sticky-loading + data-latch. |
| `TransactionHistoryPage.tsx` | **Presentation**. Two-column header, filters, View-Setting-driven grid, footer, pagination, popover, Smart Organizer dialog. |
| `TransactionHistoryIndexRedirect.tsx` | Fetches `/accounts?currency=…`, redirects to first account. |
| `TransactionTable.tsx` | Bare `<table>` + sticky `<thead>`, iterates visible registry columns. |
| `TransactionTableColumns.tsx` | Shared `<colgroup>` reused by table + footer. |
| `TransactionTableFooter.tsx` | Sibling footer table: count + deposit/withdraw totals. |
| `TransactionStatusTabs.tsx` | All / Confirmed / Unconfirmed tabs + counters. |
| `TransactionTypeFilter.tsx` | All / Deposit / Withdraw radio. |
| `TransactionHistoryActions.tsx` | Toolbar (List → View Setting, Excel → export, Smart Organizer). |
| `SmartOrganizerDialog.tsx` | Match hand-off dialog. |
| `columnRegistry.tsx` | `TRANSACTION_HISTORY_COLUMN_REGISTRY` (FIELD_ID → header/width/align/renderer) + export-column map. |
| `types.ts` | `TransactionRow`, `TransactionStatusFilter`, `TransactionTypeFilter`, `TransactionTotals`, `TransactionSummary`, picker option types. |
| `accounts.ts` | Per-account list shared by sidebar nested menu + redirect + `[accountId]` route. |

Related (Account Inquiry): `components/banking/account-inquiry/LatestTransactionHistoryModal.tsx` —
the transaction drill-down modal that calls the same `/transactions` endpoint.

## 3. Shared components consumed

| Concern | Shared component |
|---|---|
| Table shell + footer + pagination | `components/shared/DataTableShell.tsx`, `DataTableFooter.tsx`, `Pagination.tsx` (`usePagination`) |
| View Setting popover + hook | `components/shared/view-setting/` (`ViewSettingPopover`, `useViewSetting`, `isSpecialViewSettingField`) |
| Date range | `components/shared/` interactive date range picker |
| Search | `components/shared/SearchInput.tsx` |
| Page header / action buttons | `components/shared/PageHeader.tsx`, `PageActionButtons.tsx` |
| Pickers | Reporting Account / Purpose / VAS / Contact selects (shared) |
| Dialogs | `useDialog()` (`components/shared/dialog`) |

## 4. Hooks

| Hook | Home | Use |
|---|---|---|
| `useViewSetting(screenId, dymAreaId)` | `components/shared/view-setting/` | column visibility/order |
| `useExcelExport()` | `hooks/useExcelExport.ts` | XLSX export |
| `usePagination()` | `components/shared/Pagination.tsx` | page/size state |
| `useApiData(fetcher, deps)` | `lib/api/useApiData.ts` | list + summary fetch lifecycle |
| `useStickyLoading()` | `hooks/` | min-visibility loading gate / export disable |

## 5. API client + types

| File | Symbols |
|---|---|
| `lib/api/banking.ts` | `fetchTransactions`, `fetchTransactionsSummary`, `confirmTransaction`, `undoConfirmTransaction`, `updateTransactionReportingAccount`/`Purpose`/`VasAccount`/`Contact` (+ `clear*`) |
| `lib/api/mappers.ts` | wire (UPPER_SNAKE holdover) → in-memory row mapping |
| `lib/types/api.ts` | `ApiTransactionRow`, `ApiTransactionListResponse` (UPPER_SNAKE holdovers — flip when backend wire flips) |
| `lib/viewSettingScreens.ts` | `SCREEN_IDS.BANKING_TRANSACTION_HISTORY = "banking-transaction-history"` + route map |

## 6. Sidebar integration

Nested expandable parent under Banking > Current & Savings (CLAUDE.md §2a): the Transaction History
parent expands to a per-account child list. Accounts come from `accounts.ts` so the sidebar, the index
redirect, and the `[accountId]` route share one source of truth. Active state derives from
`usePathname()`.

## 7. VND vs FCY sharing

100 % component reuse: two route folders (`transaction-history` / `transaction-history-fcy`) compose
the same `TransactionHistoryClient` + `TransactionHistoryPage`, differing only by the `scope` prop.
No forked components.
