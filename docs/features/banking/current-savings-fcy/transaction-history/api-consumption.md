# Transaction History (FCY) — API Consumption (Frontend)

Endpoints the FCY transaction inquiry calls, request params, response shapes, and the wire →
in-memory mapping. All calls go through the `api` Axios instance (JWT auto-attached) in `lib/api/banking.ts`
and unwrap the `{ status, data }` envelope. Backend contract:
[wecms-api/docs/features/banking/current-savings-fcy/transaction-history/interface-specification.md](../../../../../../wecms-api/docs/features/banking/current-savings-fcy/transaction-history/interface-specification.md).

> FCY consumes the **same endpoints** as the VND twin — the only difference is the `acctSeqNo`
> identifies an FCY account and the account list is fetched with `currency=FCY`.

---

## 1. Endpoints consumed

| Function (`lib/api/banking.ts`) | Method + URL | Purpose |
|---|---|---|
| `fetchAccounts("FCY")` | `GET /api/v1/banking/accounts?currency=FCY` | resolve the FCY account record (bankName, `ccy_cd`, nickname) + sidebar list |
| `fetchTransactions(acctSeqNo, params)` | `GET /api/v1/banking/accounts/{acctSeqNo}/transactions` | the grid rows |
| `fetchTransactionsSummary(acctSeqNo, params)` | `GET .../{acctSeqNo}/transactions/summary` | tab counts + totals |
| `fetchTransactionDetail(acctSeqNo, trnsSeqNo)` | `GET .../{acctSeqNo}/transactions/{trnsSeqNo}` | single-transaction detail (backs mutation responses) |
| `confirmTransaction` / `undoConfirmTransaction` | `PUT` / `DELETE .../{trnsSeqNo}/confirm` | confirm / undo |
| `updateTransactionReportingAccount` / `clear…` | `PATCH` / `DELETE .../{trnsSeqNo}/reporting-account` | classify reporting account |
| `updateTransactionPurpose` / `clear…` | `PATCH` / `DELETE .../{trnsSeqNo}/purpose` | classify purpose |
| `updateTransactionVasAccount` / `clear…` | `PATCH` / `DELETE .../{trnsSeqNo}/vas-account` | classify VAS account |
| `updateTransactionContact` / `clear…` | `PATCH` / `DELETE .../{trnsSeqNo}/contact` | classify contact |
| match candidates / match / unmatch | `GET/POST/DELETE .../{trnsSeqNo}/match[-candidates]` | Smart Organizer |
| export (via `useExcelExport`) | `POST /api/v1/banking/accounts/transactions/export` | XLSX |

`acctSeqNo` (= the `[accountId]` route slug) equals the backend composite `BANK_CD_ACCT_NO`.

---

## 2. List request params

`transactionsQueryParams(params)` builds the query from `FetchTransactionsParams`
(`{ from?, to?, type?, cnfmYn?, keyword? }`):

| Wire key | From | Values |
|---|---|---|
| `from` / `to` | date range | `yyyyMMdd` |
| `type` | type filter | `DEPOSIT` / `WITHDRAW` / `ALL` |
| `cnfm_yn` | status tab | `Y` / `N` / `ALL` |
| `keyword` | search box | free text |

**No `currency` param** — the FCY account already scopes the currency server-side.

---

## 3. List response → in-memory mapping

**`ApiTransactionListResponse`** (UPPER_SNAKE wire holdover): `ROWS: ApiTransactionRow[]`,
`TOTAL_COUNT`, `DEPOSIT_TOTAL`, `WITHDRAW_TOTAL`.

`mapTransactionRow(api, idx)` (`lib/api/mappers.ts`) →

| In-memory `TransactionRow` | From wire |
|---|---|
| `id` | `${ACCT_SEQ_NO}-${TRSC_DT}-${TRSC_TM}-${idx}` |
| `trnsSeqNo` | `ACCT_SEQ_NO` |
| `date` / `time` | `formatLegacyDate(TRSC_DT)` / `formatLegacyTime(TRSC_TM)` |
| `deposit` / `withdraw` | `DEPOSIT_AMT` / `WITHDRAW_AMT` (set only when non-`"0"`) — FCY amounts |
| `balance` | `BAL ?? "0"` |
| `remarks` | `RMRK` |
| `confirmed` / `confirmedBy` | `CONF_YN === "Y"` / `CONFIRMED_BY` + `CONFIRMED_DTM` |
| `transactionId` | `BANK_TRNS_SHORT_ID` |
| `fileName` / `matchedDate` / `matchedBy` | `PAY_ORG_FILE_NM` / `formatLegacyDate(MATCHED_AT)` / `MATCHED_BY` |
| `linkMatchYn` | `LINK_MATCH_YN` |
| `reportingAccountCode` / `useUsagCd` / `vasAcctCd` / `rcvPayTrcoKey` / `rcvPayTrcoNm` | `CHART_ACCT_CD` / `USE_USAG_CD` / `VAS_ACCT_CD` / `RCV_PAY_TRCO_KEY` / `RCV_PAY_TRCO_NM` |

`reportingAccountName` / `purposeName` / `vasAcctName` are left null by the mapper and filled at the
page layer by joining against the loaded picker-option Maps.

---

## 4. Summary response

**`ApiTransactionSummaryResponse`**: `TOTAL_COUNT`, `CONFIRMED_COUNT`, `UNCONFIRMED_COUNT`,
`DEPOSIT_TOTAL`, `WITHDRAW_TOTAL` → `mapTransactionSummary` → `TransactionSummary`. Drives the status
tab counts and the footer totals (FCY currency label via `t("txn_history.total_label", { currency })`).

---

## 5. Mutations

Confirm/undo and all four classification setters+clearers return `ApiTransactionDetailResponse` →
`mapTransactionDetail` → `TransactionDetail`. **Mutation request bodies are lowercase snake_case**
(the backend DTOs have no `@JsonProperty`): `{ chart_acct_seq_no, chart_acct_cd }`, `{ use_usag_cd }`,
`{ vas_acct_cd }`, `{ trco_key }`, and the optional confirm body
`{ rcv_pay_trco_key, rcv_pay_trco_nm, rcv_pay_usag_cd, vas_acct_cd }`. After each mutation the client
bumps `refreshKey` to re-fetch list + summary.

---

## 6. Export request

Via `useExcelExport().exportXlsx(...)` → `POST /api/v1/banking/accounts/transactions/export`:

```ts
{
  endpoint:  "/api/v1/banking/accounts/transactions/export",
  screenId:  SCREEN_IDS.BANKING_TRANSACTION_HISTORY,   // "banking-transaction-history"
  dymAreaId: DEFAULT_AREA_ID,                           // "default"
  fileName:  `${t("txn_history.export_title")}_${todayDmy()}`,  // FCY filename
  title:     t("txn_history.breadcrumb", { account: `${account.bankName} (${account.currency})` }),
  items:     TRANSACTION_HISTORY_FALLBACK_COLUMNS,
  columnConfig: TRANSACTION_HISTORY_EXPORT_COLUMNS,     // amounts → format:"amount"
  filters:   { acctSeqNo, from, to, type, cnfmYn, keyword },
  sort:      null,
}
```

Backend (POI) produces the XLSX; the shared helper downloads the blob. No client-side CSV.

---

## 7. Error handling

Fetchers throw `ApiCallError(code, message, traceId)` on `status.error`. The page wraps confirm/undo/
classify/export in `showErrorDialog(err)` → `useDialog().open({ type: "error", title: t("dialog.error"),
errorCode })`. 401s are handled globally by the axios response interceptor (session-expired dialog).
A per-account-authorization denial surfaces as `WBE1003` (HTTP 403) from `AccountAccessGuard`.

---

## 8. Holdover note

`ApiTransactionRow` / `ApiTransactionListResponse` / `ApiTransactionDetailResponse` keep **UPPER_SNAKE**
property names in `lib/types/api.ts` (documented Sprint-1 holdover) until the Transactions backend
flips its wire shape. The mutation request bodies are already lowercase snake_case. When the backend
flips, flip the wire types + consumers in the same MR — do not pre-migrate.
