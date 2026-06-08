# Account Inquiry (VND) — API Consumption

**Route:** `/banking/account-inquiry` · **Screen ID:** `banking-account-inquiry-vnd` · **Hub:** [README.md](README.md)

Endpoints this page calls, the wire shapes, and the wire→in-memory mapping. The authoritative contract is
the backend [interface-specification.md](../../../../../wecms-api/docs/features/banking/account-inquiry-vnd/interface-specification.md);
this doc captures what the frontend sends/consumes.

All calls go through `api` (`lib/axios.ts`, JWT auto-attached), unwrap `ApiResponse<T>`, and throw
`ApiCallError` on `status.error`. Wire JSON is lowercase snake_case.

---

## 1. List — `GET /api/v1/banking/accounts`

`fetchAccounts({ currency, bankCd, keyword, sort, page, size })` (`lib/api/banking.ts`).

Query params: `currency=VND`, `bankCd?`, `keyword?`, `sortField?`, `sortDirection?`, `page` (0-based), `size`.

Response `ApiAccountListResponse`:

```ts
{ accounts: ApiAccountRow[]; total_count: number; balance: string; available_bal: string;
  totals_by_ccy: ApiCurrencyTotal[]; page_number: number; page_size: number; total_pages: number;
  banks_available: ApiBankOption[]; }
```

`ApiAccountRow`: `acct_seq_no, bank_cd, bank_nm, acct_no, acct_type_cd, acct_type_nm, acct_type_key, ccy_cd,
acct_nick_nm, bal, real_amt, acct_bal_inq_stts, acct_bal_upd_dtm, hand_reg_yn, cert_conn_yn`.

### Wire → in-memory (`mapAccountRow`)

| Wire | `AccountInquiryRow` | Notes |
|---|---|---|
| `acct_seq_no` | `id` | row key |
| `bank_cd` / `bank_nm` | `bankCd` / `bankName` | |
| `acct_type_nm` | `bankType` | coerced Current/Savings/Fixed |
| `acct_no` | `accountNo` | |
| `acct_nick_nm` | `nickname` | formatted (bank-name fallback) |
| `bal` / `real_amt` | `balance` / `available` | wire decimal strings |
| `acct_bal_upd_dtm` | `lastUpdate` | `yyyyMMddHHmmss`. Source changed 2026-06-06 (FCY-A02): backend now ships `ACCT_HIS_LST_INQ_DT` for online accounts (`ACCT_BAL_LST_INQ_DTM` fallback for FD-only banks) — legacy `fnsh_0001_001`/`fnsh_0005_001` parity. Wire field name retained. |
| `acct_bal_inq_stts` | `error` | `true` when `ERR`/`ERROR`/non-success |
| `ccy_cd` | `currencyCd` | defaults VND |
| `hand_reg_yn`/`cert_conn_yn` | `selectable` + `disabledReasonKey` | manual / disconnected → checkbox disabled |

`banks_available` → bank dropdown (never narrowed by filter). `totals_by_ccy` → summary tiles.

---

## 2. Sync — `POST /api/v1/banking/accounts/transactions-sync`

`syncTransactions({ accounts:[{bank_cd, acct_no}], from_dt, to_dt, auto })`.

Response `TransactionsSyncResponse`: `session_id`, `status ∈ {OTP_REQUIRED, CAPTCHA_REQUIRED, QNA_REQUIRED,
COMPLETED, ERROR}`, plus `accounts_synced/debit_count/credit_count/credit_total/debit_total/last_update`
(COMPLETED), `challenge_prompt/qna_questions/captcha_image/captcha_image_format/login_id` (`*_REQUIRED`),
`error_code/error_message` (ERROR).

Challenge resume:
- `submitSyncOtp(sessionId, value)` → `POST .../transactions-sync/{sessionId}/otp`
- `submitSyncCaptcha(sessionId, value)` → `.../{sessionId}/captcha`
- `submitSyncQna(sessionId, body)` → `.../{sessionId}/qna`

On `COMPLETED` the page calls `onRefresh()` → list re-fetch (updates Balance/Available/Last Update/status).

---

## 3. Sync history — `GET /api/v1/banking/sync-history`

`fetchSyncHistory({ from_dt, to_dt, currency?, bank_cd?, result? })` — past real-time inquiry attempts
(`EXT_TRAN_CALL_HIS`). Consumed by `<SyncHistoryDialog>`.

---

## 4. Transactions (balance popup) — `GET /api/v1/banking/accounts/{acctSeqNo}/transactions`

`fetchTransactions(acctSeqNo, { from, to, type?, cnfm_yn?, keyword? })` — recent transactions for the
clicked account, rendered by `<BalancePopover>`. (Full Transaction History is a sibling screen.)

---

## 5. Excel export — `POST /api/v1/banking/accounts/export`

Via `useExcelExport()` → `lib/excel.ts exportExcel({ endpoint, screenId, dymAreaId, fileName, columns, filters, sort })`.
Columns come from the live View Setting items ∩ `columnConfig` (CHECKBOX/ETC dropped); filters carry
`currency`/`bankName`/`keyword`; sort carries the current `sortParams`. Backend (Apache POI) streams the XLSX;
the frontend saves the blob. **No client-side CSV.**

---

## 6. View Setting — `GET/PUT/DELETE /api/v1/screen-options/{screenId}/{dymAreaId}`

Via `useViewSetting(SCREEN_IDS.ACCOUNT_INQUIRY_VND, DEFAULT_AREA_ID)` (`lib/api/screenOption.ts`). Loads merged
sys+user columns; `save()` persists user overrides; `reset()` restores sys defaults. `CHECKBOX`/`ETC` specials
are preserved but never user-editable.

---

## Related

- Backend interface spec: [wecms-api/docs/features/banking/account-inquiry-vnd/interface-specification.md](../../../../../wecms-api/docs/features/banking/account-inquiry-vnd/interface-specification.md)
- Page mapping: [references/page-mapping/page-mapping.md](../../../references/page-mapping/page-mapping.md)
