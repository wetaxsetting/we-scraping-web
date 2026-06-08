# Account Inquiry (FCY) — API Consumption (Frontend)

> Endpoints consumed, request params, response shapes, and wire → in-memory mapping.
> Backend contract: [wecms-api/docs/features/banking/account-inquiry-fcy/interface-specification.md](../../../../../wecms-api/docs/features/banking/account-inquiry-fcy/interface-specification.md).
> Wire is lowercase snake_case; in-memory is camelCase; translation happens once in `lib/api/mappers.ts`.

## 1. List — `fetchAccounts`

```ts
// lib/api/banking.ts
GET /api/v1/banking/accounts
params: {
  currency: wireCurrency,   // "FCY" (All Currency) or "USD" | "KRW" | "EUR" | … (concrete narrow)
  bankCd?:  string,         // legacy BANK_CD
  keyword?: string,         // formatted-nickname LIKE
  sort?:    { sortField, sortDirection } | null,  // FIELD_ID + ASC|DESC; null → backend default
  page?:    number,         // zero-based
  size?:    number,         // clamped to 100 server-side
}
```

### `wireCurrency` derivation (`AccountInquiryClient`)

```ts
wireCurrency = multiCurrencyMode
  ? (selectedCurrency ?? currency)   // FCY page: selectedCurrency || "FCY"
  : currency;                         // VND page: always "VND"
```

`selectedCurrency === null` ("All Currency") → `currency=FCY` → backend `ccy_cd <> 'VND'`.
A concrete pick → that CCY → backend `ccy_cd = <CCY>`.

### Response → in-memory

`ApiAccountListResponse` (wire) → mapped:

| Wire | In-memory | Notes |
|---|---|---|
| `accounts[]` (`ApiAccountRow`) | `AccountInquiryRow[]` via `mapAccountRow` | see field map below |
| `total_count` | `totalAccounts` | |
| `totals_by_ccy[]` (`ApiCurrencyTotal`) | `CurrencyTotal[]` via `mapCurrencyTotal` | one tile per entry |
| `balance` / `available_bal` | scalar fallbacks | FCY reads `totalsByCcy`; scalars are cross-CCY sums |
| `banks_available[]` | `bankOptions` | bank dropdown |
| `page_number` / `page_size` / `total_pages` | server paging state | 0-based wire → 1-based UI |

`ApiAccountRow → AccountInquiryRow`:

```
acct_seq_no       → id
bank_cd           → bankCd
bank_nm           → bankName
acct_type_nm      → bankType ("Current" | "Savings" | "Fixed")
acct_no           → accountNo
acct_nick_nm      → nickname
bal               → balance        (wire decimal string)
real_amt          → available      (wire decimal string)
acct_bal_upd_dtm  → lastUpdate     (YYYYMMDDHHmmss; value sourced from ACCT_HIS_LST_INQ_DT — FCY-A02)
acct_bal_inq_stts → error?         (true when non-success)
ccy_cd            → currencyCd     (USD/KRW/EUR/… — never VND on FCY)
ccy_cd + bankType → currencyLabel  ("USD • Current")   [FCY-specific]
hand_reg_yn/cert_conn_yn → selectable? + disabledReasonKey
```

## 2. Balance popup — `fetchTransactions`

```ts
GET /api/v1/banking/accounts/{acctSeqNo}/transactions
params: { from: "YYYYMMDD", to: "YYYYMMDD", type?, cnfmYn?, keyword? }
→ ApiTransactionListResponse { rows[], deposit_total, withdraw_total, total_count }
```

The FCY balance popup calls this with `from=to=selectedDate`; the footer totals are formatted per the
clicked row's CCY.

## 3. Update / sync — `syncTransactions` (+ challenge resume)

```ts
POST /api/v1/banking/accounts/transactions-sync
body: { accounts: [{ bank_cd, acct_no }], from_dt?, to_dt?, auto? }
→ ApiTransactionsSyncResponse { status, session_id?, accounts_synced?, debit_count?, credit_count?,
                                credit_total?, debit_total?, last_update?, challenge_prompt?,
                                qna_questions?, captcha_image?, error_code?, error_message? }

POST …/transactions-sync/{sessionId}/qna      { question, hidden_value, answer }
POST …/transactions-sync/{sessionId}/otp      { value }
POST …/transactions-sync/{sessionId}/captcha  { value }
```

`status ∈ { COMPLETED, OTP_REQUIRED, QNA_REQUIRED, CAPTCHA_REQUIRED, ERROR }` drives the dialog branch.
On `COMPLETED`, `onSyncComplete()` triggers a parent list refetch so balances + Last Update refresh.

## 4. Export — `useExcelExport`

```ts
POST /api/v1/banking/accounts/export
body: {
  screenId: SCREEN_IDS.ACCOUNT_INQUIRY_FCY,   // "banking-account-inquiry-fcy"
  dymAreaId: DEFAULT_AREA_ID,
  fileName, title,                            // export_title_fcy (file) vs title_fcy (in-sheet)
  columns,                                    // live vs.items ∩ columnConfig (CHECKBOX/ETC dropped)
  filters: { currency: wireCurrency, bankCd, keyword },
  sort,
}
→ XLSX blob (per-CCY subheader, server-computed)
```

The frontend ships JSON and saves the returned blob; it never generates the workbook. CSV is not a
sanctioned format.

## 5. Error handling

All fetchers unwrap the `{ status, data }` envelope and throw `ApiCallError { code, message, traceId }`
on `status.error === true`. Pages route non-401 errors to `useDialog({ type:"error", errorCode })`; 401s
hit the global session-expired interceptor in `lib/axios.ts`.

| Code | Meaning |
|---|---|
| `WBE2010/2011/2013` | Export config / row-cap / no-columns |
| `WBE2050/2060/2093/2095/9001` | Sync: no credential / session expired / no bank config / gateway rejection / wrong resume verb |
| `WBE_BANK_ACCOUNT_NOT_FOUND` | Account not in tenant |
| `WBE1003` | Unauthorized (menu permission) |
