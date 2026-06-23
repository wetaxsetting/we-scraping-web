# Account Inquiry (VND) — Component / File Index

**Route:** `/banking/account-inquiry` · **Screen ID:** `banking-account-inquiry-vnd` · **Hub:** [README.md](README.md)

Every frontend file the screen uses. Paths relative to `wecms-web/`.

---

## 1. Route + page

| File | Role |
|---|---|
| `app/(dashboard)/banking/account-inquiry/page.tsx` | Server component; metadata `Account Inquiry (VND) — WeCMS`; renders `<AccountInquiryClient currency="VND" />` |
| `app/(dashboard)/banking/account-inquiry/AccountInquiryClient.tsx` | Currency-locked client wrapper. Owns `refreshKey`, `bankCd`, `keyword`/`debouncedKeyword`, `page`, `pageSize`, `useTableSort()` state; fetches via `useApiData`; maps rows; builds the `serverPaging` controlled-mode contract. |

## 2. Shared page shell

| File | Role |
|---|---|
| `components/shared/AccountInquiryPage.tsx` | Main shell (reused by VND + FCY). Owns row selection, filter UI, table render (`COLUMN_REGISTRY` / `FALLBACK_COLUMNS`), summary tiles, dialogs, pagination bridge, export/print handlers. Local helpers: `SummaryTile`, `BankFilterPopover`, `CurrencyFilterPopover`, `LastUpdateCell`. |

## 3. Feature dialogs / popups

| File | Role |
|---|---|
| `components/banking/account-inquiry/BalancePopover.tsx` | Balance-cell click → recent-transactions popup (portal) |
| `components/banking/account-inquiry/TransactionSyncDialog.tsx` | "Update" → real-time sync; OTP/CAPTCHA/QnA challenge handling |
| `components/banking/account-inquiry/SyncHistoryDialog.tsx` | Past sync attempts (date/bank/result filter) |
| `components/banking/account-inquiry/LatestTransactionHistoryModal.tsx` | Post-sync latest-transactions modal |

## 4. Shared components (reused, not owned)

`PageHeader`, `PageActionButtons`, `SearchInput`, `FilterDropdown`, `DateField`, `Pagination` (+ `usePagination`),
`DataTableShell`, `TableHeaderCell`, `Tooltip`, `components/shared/view-setting/ViewSettingPopover`, shadcn
`Table`/`Checkbox` (`components/ui/`).

## 5. Hooks

| Hook | File | Returns |
|---|---|---|
| `useApiData<T>()` | `lib/api/useApiData.ts` | `{ data, error, loading }` (fetch on dep change) |
| `useTableSort()` | `hooks/useTableSort.ts` | `{ sortField, sortDirection, toggleSort, sortParams, setSort }` |
| `useStickyLoading()` | `hooks/useStickyLoading.ts` | boolean (min-visibility gate) |
| `useViewSetting()` | `components/shared/view-setting/useViewSetting.ts` | `{ items, loading, error, setItems, save, reset, reload }` |
| `useExcelExport()` | `hooks/useExcelExport.ts` | async export fn (View Setting → wire columns) |
| `usePagination()` | `components/shared/Pagination.tsx` | local pagination (overridden by `serverPaging`) |

## 6. API client + mappers + types

| File | Role |
|---|---|
| `lib/api/banking.ts` | `fetchAccounts`, `syncTransactions`, `submitSyncOtp`, `submitSyncQna`, `submitSyncCaptcha`, `fetchSyncHistory`, `fetchTransactions` |
| `lib/api/mappers.ts` | `mapAccountRow` (wire `ApiAccountRow` → `AccountInquiryRow`, derives `error`/`selectable`), `mapCurrencyTotal` |
| `lib/types/api.ts` | `ApiAccountRow`, `ApiCurrencyTotal`, `ApiBankOption`, `ApiAccountListResponse` (lowercase snake_case wire) |
| `lib/currency.ts` | `formatAmount(value, ccy, includeSymbol)` |
| `lib/datetime.ts` | datetime/relative formatting (Last Update) |
| `lib/excel.ts` | `exportExcel(...)` (shared) |
| `lib/print.ts` | `printReport(...)` (shared) |
| `lib/viewSettingScreens.ts` | `SCREEN_IDS.ACCOUNT_INQUIRY_VND`, `DEFAULT_AREA_ID` |

## 7. In-memory types (camelCase semantic)

`AccountInquiryRow` — `id, bankCd, bankName, bankType, accountNo, nickname, balance, available, lastUpdate,
error?, currencyCd?, currencyLabel?, selectable?, disabledReasonKey?`.
`CurrencyTotal` — `ccy, count, balance, available`.
`ServerPagingControl` — `bankCd, keyword, page, pageSize, totalCount, totalPages, bankOptions, onBankCdChange,
onKeywordChange, onPageChange, onPageSizeChange`.
`BankOption` — `bankCd, bankName`.

## 8. Mock data

**None.** The screen calls live endpoints with no mock fallback (Sprint-1 mock seed removed).

---

## Cross-references

- Screen flow: [screen-flow.md](screen-flow.md) · UI spec: [ui-specification.md](ui-specification.md) · API: [api-consumption.md](api-consumption.md)
- Backend source index: [wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/source-code-index.md](../../../../../../wecms-api/docs/features/banking/current-savings-vnd/account-inquiry/source-code-index.md)
