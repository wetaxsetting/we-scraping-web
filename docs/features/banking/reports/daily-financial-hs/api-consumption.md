# Daily Financial (HS) — API Consumption

> Endpoints, wire types, projection and error handling — verified in `lib/api/banking.ts`,
> `lib/types/api.ts`, and `projectRows.ts`. Full request/response contracts live in the backend
> package's [wecms-api/…/interface-specification.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial-hs/interface-specification.md)
> — not duplicated here.

---

## 1. Endpoints consumed

| Endpoint | Method | Fetcher (`lib/api/banking.ts`) | When |
|---|---|---|---|
| `/api/v1/banking/reports/daily-financial-hs` | GET | `fetchDailyFinancialHs({ asOf?, accountFilter? })` (~L1004) | mount + every Search (`searchKey` dep); plus one mount-only unfiltered call (`accountFilter:"ALL"`) to derive bank options |
| `/api/v1/banking/reports/daily-financial-hs/entries/{acctSeqNo}` | PATCH | `updateDailyFinancialHsEntry(acctSeqNo, patch)` (~L1022) | per-field save on blur/Enter |
| `/api/v1/banking/reports/daily-financial-hs/report` | GET (blob) | `downloadDailyFinancialHsReport({ asOf?, accountFilter?, lang })` (~L1062) | Download Excel button |

All three go through the shared `api` Axios instance (JWT interceptor; 401 handled centrally by
the session-expired interceptor). The download is a **binary** endpoint — consumed via the shared
`downloadFile` (`lib/file.ts`), never through the JSON `unwrap`.

## 2. Request parameter shaping (`DailyFinancialHsClient`)

| Helper | Rule |
|---|---|
| `toPeriodDate(iso)` | `yyyy-MM-dd` state → `yyyyMMdd` wire (`asOf`) |
| `toAccountFilter(filters)` | `[]` → literal `"ALL"`; else `JSON.stringify([{BANK_CD, ACCT_NO}, …])` — verbatim legacy `rept_0017_001.js` contract |
| `lang` | `locale.toLowerCase()` (`en`/`ko`/`vi`) — download only |
| `FIELD_WIRE_KEY` (in `DailyFinancialHsPage.tsx`) | FIELD_ID → wire key: `RECEIPT_CODE→rept_cd`, `PAYMENT_CODE→pymn_cd`, `DESCRIPTION_EN→desc_nm_en`, `DESCRIPTION_KO→desc_nm_ko`, `MEMO_NOTE→memo` |

## 3. Wire types (`lib/types/api.ts`, lowercase snake_case)

- `ApiDailyFinancialHsReport` (~L970): `{ as_of_dt, account_filter, rows: ApiHsLedgerRow[] }`
- `ApiHsLedgerRow` (~L945): 22 fields — `row_type` (`HEADER | BEFORE_BALANCE | TRANSACTION |
  ACCOUNT_TOTAL | CURRENCY_TOTAL`), `bank_account`, `currency`, `rept_cd`, `pymn_cd`,
  `description_en`, `description_ko`, `customer_supplier`, `before_balance`, `receipt`,
  `payment`, `balance`, `balance_company_actual`, `account_number`, `account_type_order`,
  `acct_seq_no`, `transaction_date`, `transaction_time`, `transaction_seq`, `memo`, `bank_cd`,
  `bank_name_sort`. Amounts are wire **strings** (raw numeric) or `null`.

## 4. Projection — `projectHsRows` ([projectRows.ts](../../../../../components/banking/reports/daily-financial-hs/projectRows.ts))

Flat row stream → `BankGroup[]` (in-memory camelCase types in
[types.ts](../../../../../components/banking/reports/daily-financial-hs/types.ts)):

| `row_type` | Effect |
|---|---|
| `HEADER` | opens a group; `parseBankHeader` splits `bank_account` into bank name / account-type parenthetical / red accent (BRANCH) / `Due date:` label+value; carries `account_number`, `currency` |
| `BEFORE_BALANCE` | entry with `editable:false`, codes/descriptions blanked, `acctSeqNo:""` |
| `TRANSACTION` | entry with `editable:true` + `acctSeqNo` (PATCH key) |
| `ACCOUNT_TOTAL` | sets the current group's `subtotal` (`LedgerTotals`) |
| `CURRENCY_TOTAL` | closes the **last group of that currency**: `group.total` (+ `memo` ← `balance_company_actual`) and `closesTotal:true` — anchored per currency, not merely the last group in the stream |

- Every amount runs through `formatAmount(wire, ccy, false)` once at projection time (id-ID
  locale, no symbol); null/blank → `""` (never `"0"`).
- `deriveBankOptions(rows)` builds the dropdown option list from the `ALL` response's HEADER rows
  (`bank_cd` + `account_number` + parsed bank name) — replaces the legacy `cash_0001_001_r003`
  service.

## 5. Save call semantics

- One field per request (`{ [wireKey]: value }`); backend treats `null` = unchanged, `""` =
  clear.
- `updateDailyFinancialHsEntry` is **void-tolerant**: it checks `status.error` only and does not
  require a `data` payload (the backend returns `ApiResponse<Void>`); a `WBI0000` success with
  null data is treated as success (regression fixed 2026-07-01).
- Errors throw `ApiCallError(code, message, traceId)` → caught in `handleSaveEntry` → shared
  error dialog.

## 6. Download call semantics

- Query string from the same `asOf`/`accountFilter` shaping + `lang`; response saved as a blob.
- Filename comes from the server `Content-Disposition`
  (`WeCMS_Daily_Financial_Report_{EN|KO|VI}.xlsx`); the client fallback name is
  `"Daily Financial (HS).xlsx"`.
- The workbook always contains all 12 columns — the page sends **no** column/View-Setting context
  (deliberate; legacy parity).

## 7. Error & loading handling

| Path | Handling |
|---|---|
| Report fetch | `useApiData` → `loading` disables Search; error leaves the previous/empty state (no bespoke banner) |
| Bank-options fetch | non-fatal — silent degrade to an empty dropdown |
| Save / download | try/catch → `useDialog().open({ type: "error", … })` with the server `status.code` |
| 401 | global Axios interceptor → session-expired re-auth dialog (no per-call handling) |
