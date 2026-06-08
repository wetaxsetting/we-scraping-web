# Transaction History (FCY) — Component Index (Frontend)

File-by-file map for the FCY transaction inquiry. All paths relative to `wecms-web/`. FCY and VND share
every component — the FCY-specific surface is the route folder + the `scope="FCY"` prop.

---

## 1. Routes (App Router)

| File | Renders |
|---|---|
| `app/(dashboard)/banking/transaction-history-fcy/page.tsx` | `<TransactionHistoryIndexRedirect scope="FCY" />` — redirects to first FCY account; `metadata.title = "Transaction History (FCY) — WeCMS"` |
| `app/(dashboard)/banking/transaction-history-fcy/[accountId]/page.tsx` | `<TransactionHistoryClient acctSeqNo={accountId} scope="FCY" />` (awaits `params: Promise<{ accountId }>`, Next.js 16) |

URL builder: `accountHref("FCY", id)` in `components/banking/transaction-history/accounts.ts` →
`/banking/transaction-history-fcy/${encodeURIComponent(id)}`.

---

## 2. Components (`components/banking/transaction-history/`)

| Component | Role |
|---|---|
| `TransactionHistoryClient.tsx` | **Shared** state + fetch wrapper (scope-aware). Owns filter/pagination/refreshKey state, the 6× `useApiData` calls, the picker-option joins, and the confirm/classify/export handlers. |
| `TransactionHistoryPage.tsx` | **Shared** pure presentation — two-column header, filters, custom table shell, View Setting popover, Smart Organizer dialog. |
| `TransactionHistoryIndexRedirect.tsx` | Index redirect to the first account for the scope; renders the empty stub when the FCY list is empty. |
| `TransactionTable.tsx` | The grid — bare `<table className="table-fixed">`, sticky thead, View-Setting-driven columns via `columnRegistry`. |
| `TransactionTableColumns.tsx` | Shared `<colgroup>` + `computeTransactionTableMinWidth()`. |
| `TransactionTableFooter.tsx` | Sibling footer table (count + deposit/withdraw totals), `mt-auto`. |
| `columnRegistry.tsx` | `TRANSACTION_HISTORY_COLUMN_REGISTRY` (FIELD_ID → header key + render). |
| `TransactionTypeFilter.tsx` | All / deposit / withdraw radios. |
| `TransactionStatusTabs.tsx` | All / Confirmed / Unconfirmed tabs + counts. |
| `TransactionHistoryActions.tsx` | Toolbar — list icon, Excel icon, Smart Organizer CTA (no print, no sync). |
| `SmartOrganizerButton.tsx` / `SmartOrganizerDialog.tsx` | Match hand-off (account-scoped). |
| `accounts.ts` | `TransactionAccount` type, `accountHref(scope, id)`, `useTransactionHistoryAccounts(scope)`. |
| `types.ts` | `TransactionRow`, `TransactionDetail`, `TransactionSummary`, filter unions, picker option types. |

---

## 3. Shared components consumed

`<InteractiveDateRangePicker>`, `<SearchInput>`, `<Pagination>` / `usePagination`,
`<ViewSettingPopover>` / `useViewSetting`, `<ReportingAccountSelect>`, `<PurposeSelect>`,
`<VasAccountSelect>`, `<ContactSelect>`, `useDialog()`, `useTranslation()`.

---

## 4. Hooks

| Hook | Home | Use |
|---|---|---|
| `useApiData(fetcher, deps)` | `lib/api/useApiData.ts` | the fetch primitive (accounts, list, summary, picker options) |
| `useTransactionHistoryAccounts(scope)` | `components/banking/transaction-history/accounts.ts` | sidebar + index redirect account list (`scope="FCY"`) |
| `useViewSetting(screenId, dymAreaId)` | `components/shared/view-setting/` | column visibility/order (`BANKING_TRANSACTION_HISTORY`) |
| `usePagination<TransactionRow>({ items })` | `components/shared/Pagination.tsx` | client-side paging |
| `useExcelExport()` | `hooks/useExcelExport.ts` | XLSX export |
| `useStickyLoading(flag)` | `hooks/useStickyLoading.ts` | min-visibility gate for loading/export |
| `useDialog()` / `useTranslation()` | shared | dialogs / i18n |

There is **no** `useTransactionHistory` hook — the data lifecycle is composed inline in
`TransactionHistoryClient` from `useApiData`. The codebase does not use react-query/SWR.

---

## 5. API client + types

| Concern | File |
|---|---|
| API calls | `lib/api/banking.ts` — `fetchTransactions`, `fetchTransactionsSummary`, `fetchTransactionDetail`, `confirmTransaction`, `undoConfirmTransaction`, `update*/clear*` classification, `fetchAccounts("FCY")` |
| Wire types | `lib/types/api.ts` — `ApiTransactionRow`, `ApiTransactionListResponse`, `ApiTransactionSummaryResponse`, `ApiTransactionDetailResponse`, request bodies (UPPER_SNAKE holdover; flip when backend flips) |
| Mappers | `lib/api/mappers.ts` — `mapTransactionRow`, `mapTransactionSummary`, `mapTransactionDetail`, `formatLegacyDate`, `formatLegacyTime` |
| Export | `lib/excel.ts` + `hooks/useExcelExport.ts` |
| i18n | `locales/{en,ko,vi}.json` prefix `txn_history.*` (incl. `title_fcy`, `empty_fcy`, `breadcrumb`, `export_title`) |

Detail: [api-consumption.md](api-consumption.md).

---

## 6. Sidebar integration

Nested expandable parent under Banking > Current & Savings (FCY) in `components/layout/Sidebar.tsx`
(`useTransactionHistoryAccounts("FCY")` at the FCY group); FCY accounts (WOORI 2308, BIDV 2913,
SHINHAN 6946) become per-account children. Active state from `usePathname()`. Source of truth shared
with the redirect + `[accountId]` route via `accounts.ts`.

---

## 7. FCY vs VND sharing

One client + one page + one table + one registry + one set of hooks serve both. FCY-only files:
the `app/(dashboard)/banking/transaction-history-fcy/` route folder. Everything in
`components/banking/transaction-history/` is shared. The `scope` prop ("FCY" | "VND") chooses the
account-list query, the empty-state key, and the title/footer currency label — nothing else forks.
