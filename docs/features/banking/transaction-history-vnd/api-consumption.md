# Transaction History (VND) — API Consumption (Frontend)

Which backend endpoints the screen calls, with what params, and how the wire is mapped to in-memory
state. Full contract detail lives backend-side — do not duplicate it here:
[wecms-api .../transaction-history-vnd/interface-specification.md](../../../../../wecms-api/docs/features/banking/transaction-history-vnd/interface-specification.md).

All calls go through `api` (`lib/axios.ts`, JWT auto-attached), unwrap the `{ status, data }`
envelope, and throw `ApiCallError(code, message, traceId)` on `status.error`.

---

## 1. Endpoints consumed

| Purpose | Method + path | Client fn (`lib/api/banking.ts`) |
|---|---|---|
| List | `GET /api/v1/banking/accounts/{acctSeqNo}/transactions` | `fetchTransactions(acctSeqNo, params)` |
| Summary (tab counts + totals) | `GET .../{acctSeqNo}/transactions/summary` | `fetchTransactionsSummary(acctSeqNo, params)` |
| Confirm | `PUT .../{acctSeqNo}/transactions/{trnsSeqNo}/confirm` | `confirmTransaction(...)` |
| Undo confirm | `DELETE .../{acctSeqNo}/transactions/{trnsSeqNo}/confirm` | `undoConfirmTransaction(...)` |
| Reporting account | `PATCH/DELETE .../{trnsSeqNo}/reporting-account` | `updateTransactionReportingAccount` / `clear…` |
| Purpose | `PATCH/DELETE .../{trnsSeqNo}/purpose` | `updateTransactionPurpose` / `clear…` |
| VAS account | `PATCH/DELETE .../{trnsSeqNo}/vas-account` | `updateTransactionVasAccount` / `clear…` |
| Contact | `PATCH/DELETE .../{trnsSeqNo}/contact` | `updateTransactionContact` / `clear…` |
| Export | `POST /api/v1/banking/accounts/transactions/export` | via `useExcelExport()` → `lib/excel.ts` |
| Account resolve (breadcrumb) | `GET /api/v1/banking/accounts?currency=VND` | `fetchAccounts("VND")` |
| Picker options | `GET /api/v1/settings/{chart-of-accounts,purpose,vas-account,contacts}` | respective settings clients |

## 2. List request params

| Param | Source (filter state) | Wire format |
|---|---|---|
| `from` / `to` | date range picker | `yyyyMMdd` |
| `type` | type filter | `DEPOSIT` / `WITHDRAW` (omitted = all) |
| `cnfm_yn` | status tab | `Y` / `N` (omitted = all) |
| `keyword` | search input | substring |

## 3. List response → in-memory mapping

Wire (`ApiTransactionListResponse`, UPPER_SNAKE holdover) → in-memory (`TransactionRow`, camelCase),
mapped in `lib/api/mappers.ts`:

| Wire (`ROWS[]`) | In-memory `TransactionRow` |
|---|---|
| `ACCT_SEQ_NO` | `trnsSeqNo` / `id` |
| `TRSC_DT` / `TRSC_TM` | `date` / `time` |
| `DEPOSIT_AMT` / `WITHDRAW_AMT` | `deposit` / `withdraw` |
| `BAL` | `balance` |
| `RMRK` | `remarks` |
| `CONF_YN` | `confirmed` (boolean) |
| `CONFIRMED_BY` / `CONFIRMED_DTM` | `matchedBy` / `matchedDate` |
| `LINK_MATCH_YN` | `linkMatchYn` |
| `CHART_ACCT_CD` / `CHART_ACCT_SEQ_NO` | `reportingAccountCode` / `chartAcctSeqNo` |
| `USE_USAG_CD` | `useUsagCd` / `purposeCode` |
| `VAS_ACCT_CD` | `vasAcctCd` |
| `RCV_PAY_TRCO_KEY` / `RCV_PAY_TRCO_NM` | `rcvPayTrcoKey` / `rcvPayTrcoNm` |

Top-level `TOTAL_COUNT` / `DEPOSIT_TOTAL` / `WITHDRAW_TOTAL` → `TransactionTotals { count, depositTotal, withdrawTotal }`.

## 4. Summary response

`{ TOTAL_COUNT, CONFIRMED_COUNT, UNCONFIRMED_COUNT, DEPOSIT_TOTAL, WITHDRAW_TOTAL }` →
`TransactionSummary { totalCount, confirmedCount, unconfirmedCount, depositTotal, withdrawTotal }`.
Drives the All / Confirmed / Unconfirmed tab counters; not status-filtered.

## 5. Mutations

Confirm / undo / the four classification setters all return the **refreshed transaction detail**, so
the client updates the affected row in place (no full refetch). Bodies use lowercase snake_case
(`{ chart_acct_seq_no, chart_acct_cd }`, `{ use_usag_cd }`, `{ vas_acct_cd }`, `{ trco_key }`).

## 6. Export request

`useExcelExport().exportXlsx(...)` POSTs `{ screenId: "banking-transaction-history", dymAreaId,
fileName, title, items (live View Setting cols), columnConfig, filters: { acctSeqNo, from, to, type,
cnfm_yn, keyword }, sort: null }`. Backend streams XLSX; the hook saves the blob with the
server-supplied filename. `sort` is null because per-column sort is not yet wired.

## 7. Error handling

`ApiCallError` carries `status.code` + `trace_id`. Confirm / undo / classify / export wrap the call
and route non-401 errors to `useDialog({ type: "error", errorCode, description })`; 401s are handled
globally by the axios session-expired interceptor.

## 8. Holdover note

`ApiTransactionRow` / `ApiTransactionListResponse` are explicitly UPPER_SNAKE wire types (wecms-web
CLAUDE.md §"Holdovers") pending the backend wire-casing flip; when the backend DTO flips to lowercase
snake_case, flip the wire type + mapper in the same MR.
