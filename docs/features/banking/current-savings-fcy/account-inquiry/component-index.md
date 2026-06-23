# Account Inquiry (FCY) — Component Index (Frontend)

> Route → client wrapper → shared shell → dialogs → filters → hooks → API client → types, file-by-file.
> FCY shares almost everything with the VND baseline; FCY-specific pieces are flagged **[FCY]**.

## 1. Route & wrappers

| File | Role |
|---|---|
| `app/(dashboard)/banking/account-inquiry-fcy/page.tsx` | **[FCY]** Server component; sets metadata, renders `<AccountInquiryFcyClient />`. |
| `app/(dashboard)/banking/account-inquiry-fcy/AccountInquiryFcyClient.tsx` | **[FCY]** Client wrapper. Passes to the shared `AccountInquiryClient`: `currency="FCY"`, `titleKey="account_inquiry.title_fcy"`, `exportTitleKey="account_inquiry.export_title_fcy"`, `totalLabelKey="account_inquiry.total_label_ccy"`, `viewSettingScreenId={SCREEN_IDS.ACCOUNT_INQUIRY_FCY}`, `multiCurrencyMode={true}`. |
| `app/(dashboard)/banking/account-inquiry/AccountInquiryClient.tsx` | Shared client wrapper (VND + FCY). Owns `selectedCurrency`, `currencyOptions` cache, `wireCurrency = multiCurrencyMode ? (selectedCurrency ?? currency) : currency`, `useApiData` fetch, sort/page/filter state, mappers, `serverPaging` control object. |
| `components/shared/AccountInquiryPage.tsx` | Shared shell — page header, filter row, summary tiles, grid (`COLUMN_REGISTRY` / `FALLBACK_COLUMNS`), pagination, popovers, dialogs. Approved UI baseline. |

## 2. Feature components

| File | Role |
|---|---|
| `components/banking/account-inquiry/BalancePopover.tsx` | Balance-cell click popup; fetches the account's transactions for `from=to=selectedDate`; Type/Amount/Reference rows + deposit/withdraw footer; "View Details" deep-link to FCY Transaction History. |
| `components/banking/account-inquiry/TransactionSyncDialog.tsx` | "Update" dialog — `syncTransactions` + OTP/QNA/CAPTCHA resume; status flow COMPLETED/ERROR/*_REQUIRED; refetch on complete. |
| `components/banking/account-inquiry/SyncHistoryDialog.tsx` | Past sync-attempt history popup. |
| `CurrencyFilterPopover` (in `AccountInquiryPage.tsx`) | **[FCY]** Currency dropdown chip; rendered only when `multiCurrencyMode`. |
| `BankFilterPopover` (in `AccountInquiryPage.tsx`) | Bank dropdown chip (shared). |
| `SummaryTile` (in `AccountInquiryPage.tsx`) | Per-CCY summary card; one per `totals_by_ccy` entry under `multiCurrencyMode`. |
| `LastUpdateCell` (in `AccountInquiryPage.tsx`) | Last-update relative-time + error renderer. |

## 3. Hooks

| Hook | Home | Role on FCY |
|---|---|---|
| `useApiData(loader, deps)` | `lib/api/useApiData.ts` | Fetch on mount + refetch on dep change; stale-while-revalidate. Deps include `wireCurrency`, sort, bank, debounced keyword, page, size, refreshKey. |
| `useTableSort()` | `hooks/useTableSort.ts` | Sort cycle state (`default → ASC → DESC → default`); `sortParams` spread into the fetch. |
| `useStickyLoading(loading, minMs?)` | `hooks/useStickyLoading.ts` | Holds the loading flag ≥400ms to avoid flicker. |
| `useViewSetting(screenId, areaId)` | `components/shared/view-setting/useViewSetting.ts` | **[FCY]** Column metadata for `SCREEN_IDS.ACCOUNT_INQUIRY_FCY`. |
| `useExcelExport()` | `hooks/useExcelExport.ts` | Builds the export request from live `vs.items` ∩ `columnConfig` + filters + sort. |
| `useTranslation()` | `lib/i18n` | i18n; FCY keys `account_inquiry.title_fcy` / `.export_title_fcy` / `.total_label_ccy` / `.empty_fcy`. |

## 4. API client

| Function | Endpoint | Notes |
|---|---|---|
| `fetchAccounts(params)` | `GET /api/v1/banking/accounts` | `params.currency = wireCurrency` (`FCY` or concrete CCY) + bankCd/keyword/sort/page/size. |
| `fetchTransactions(acctSeqNo, params)` | `GET /api/v1/banking/accounts/{acctSeqNo}/transactions` | Balance popup (`from=to=date`). |
| `syncTransactions(body)` | `POST /api/v1/banking/accounts/transactions-sync` | Update flow. |
| `submitSyncQna / submitSyncOtp / submitSyncCaptcha(sessionId, …)` | `POST …/transactions-sync/{sessionId}/{qna\|otp\|captcha}` | Challenge resume. |
| `useExcelExport()` → `lib/excel.ts` | `POST /api/v1/banking/accounts/export` | XLSX; `screenId=SCREEN_IDS.ACCOUNT_INQUIRY_FCY`. |

All in `lib/api/banking.ts`; envelope unwrap + `ApiCallError` in the shared layer. Wire→in-memory
mapping in `lib/api/mappers.ts`.

## 5. Types

| Type | Home | Notes |
|---|---|---|
| `ApiAccountRow` | `lib/types/api.ts` | wire row (snake_case): `acct_seq_no`, `bank_cd`, `ccy_cd`, `bal`, `real_amt`, `acct_bal_inq_stts`, `acct_bal_upd_dtm`, `hand_reg_yn`, `cert_conn_yn`, … |
| `ApiAccountListResponse` | `lib/types/api.ts` | `accounts[]`, `total_count`, `balance`, `available_bal`, `totals_by_ccy[]`, `page_*`, `banks_available[]`. |
| `ApiCurrencyTotal` | `lib/types/api.ts` | `ccy_cd`, `count`, `balance`, `available_bal`. |
| `AccountInquiryRow` | (in-memory) | camelCase: `id`, `bankCd`, `bankName`, `bankType`, `accountNo`, `nickname`, `balance`, `available`, `lastUpdate`, `error?`, `currencyCd?`, `currencyLabel?`, `selectable?`, `disabledReasonKey?`. |
| `CurrencyTotal` | `lib/api/currencyTotal.ts` | camelCase: `ccy`, `count`, `balance`, `available`. |
| `SCREEN_IDS.ACCOUNT_INQUIRY_FCY` | `lib/viewSettingScreens.ts` | `"banking-account-inquiry-fcy"`. |

## 6. Shared-system rules this page obeys

- **View Setting** (§13) — via `components/shared/view-setting/*`, never a feature-folder copy.
- **Table sort** (§13a) — `useTableSort()`, DB-side ORDER BY, no client `rows.sort()`.
- **Excel export** (§13b) — `useExcelExport()`, backend XLSX, no client CSV.
- **Pagination** (§4) — shared `<Pagination>` + `usePagination`.
- **Dialogs** — system messages via `useDialog()`; the sync dialog is a feature dialog.

Backend counterparts: [wecms-api/docs/features/banking/current-savings-fcy/account-inquiry/source-code-index.md](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/account-inquiry/source-code-index.md).
