# Daily Financial — API Consumption (Frontend)

How `wecms-web` calls the backend and maps the response. Authoritative request/response contract:
[wecms-api/.../interface-specification.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/interface-specification.md).

All fetchers go through `api` ([lib/axios.ts](../../../../../lib/axios.ts)) — JWT auto-attached,
`ApiResponse<T>` envelope unwrapped (`status.error` checked), `ApiCallError` thrown on failure.
Pages fetch via [useApiData](../../../../../lib/api/useApiData.ts) and fall back to the static mock seed
on empty/error.

## 1. Endpoints consumed

| Fetcher ([lib/api/banking.ts](../../../../../lib/api/banking.ts)) | Method · URL | Query params | Returns |
|---|---|---|---|
| `fetchDailyFinancial` | `GET /api/v1/banking/reports/daily-financial` | `asOf` (`yyyyMMdd`), `currencyScope` (`ALL`/`VND`/`FCY`), `activeAccountsOnly`, `includeInternalTransfers` | `ApiDailyFinancialCmcReport` |
| `fetchDailyFinancialTransactions` | `GET …/daily-financial/transactions` | `asOf`, `bankCd`, `acctNo`, `includeInternalTransfers`, `page`, `size` | `ApiDailyFinancialTransactionsReport` |
| `fetchDailyFinancialHs` | `GET …/daily-financial-hs` | `asOf`, `bankCd` | `ApiDailyFinancialHsReport` (**live** — backend calls `fn_get_haengsung_daily_financial_report` since 2026-06-14; wire type still reflects the stub-era shape, `projectHsRows` bridges it) |

> Query params are camelCase (`asOf`, `currencyScope`) — they are query string params, and the report
> response DTOs are UPPER_SNAKE Sprint-1 holdovers. This is consistent with the CTO snake_case
> directive: query params are not the JSON body, and the holdover wire types flip when the backend
> DTO flips.

## 2. Request building (CMC — `DailyFinancialClient`)

| UI state | → wire param | Transform |
|---|---|---|
| `asOfIsoDate` (`YYYY-MM-DD`) | `asOf` (`yyyyMMdd`) | `toBackendDate` |
| `scope` (`ALL`/`VND`/`FCY`) | `currencyScope` | `toWireScope` |
| `activeOnly` (bool) | `activeAccountsOnly` | stringified |
| `includeInternalTransfers` (bool) | `includeInternalTransfers` | stringified |

Fetch is gated on `hasSearched` — the loader resolves `undefined` until the user clicks Search, so no
request fires on initial render.

## 3. Response mapping (wire → in-memory) — [lib/api/mappers.ts](../../../../../lib/api/mappers.ts)

### `mapFinancialStatus`
`CCY_CD → currency` · `TOTAL → total` · `CURRENT_ACCOUNTS → currentAccounts` · `SAVING_ACCOUNTS → savingAccounts`.

### `mapCurrentAccountRow`
`ID → id` · `BANK → bank` · `BANK_CD → bankCd` · `ACCT_NO → accountNo` · `ACCT_NICK_NM → accountNickname` (falls back to `BANK`) · `CCY_CD → currency` · `ACCT_TYPE_CD → accountTypeCd` · `ACTV_YN → activeYn` (default `"Y"`) · debit/credit counters + amounts (`NUM_DEBITS`/`DEBIT`/`NUM_INTERNAL_DEBITS`/… ) · `BAL → balance` · `TRANSACTIONS → transactions` (via `mapTransactionDetailRow`; backend always sends empty — inline REC2_1 deferred).

### `mapDailyFinancialTransactionsResponse`
`TOT_CNT → totalCount` · `TOT_IN_AMT → totalIn` · `TOT_OUT_AMT → totalOut` · `TOT_BAL → closingBalance` · `PAGE_NO → pageNo` · `PAGE_PER_CNT → pageSize` (default 15) · `REC[] → rows` (`TRSC_TM`→`transactionTime`, `CCY_CD`→`currency`, `TRSC_AMT`→`amount`, `BAL`→`balanceAfter`, `INOUT_DV`→`inOutDiv` (`"1"`=credit/`"2"`=debit), `RMRK`→`remark`).

### `mapDailyFinancialHsRows` — ⚠️ dead
A no-op returning `null`. The real HS projection (`flat ROWS → BankGroup[]`) lives in
`DailyFinancialHsClient.projectHsRows`, **not** the mapper. Treat `mapDailyFinancialHsRows` as
unused/legacy; remove or wire in a cleanup MR.

## 4. Error & fallback handling

- **CMC main report:** `useApiData` falls back to `mockFinancialStatus` / `mockCurrentAccounts` on empty/error. With `NEXT_PUBLIC_API_BASE_URL` correctly set, real data is returned (HTTP 200, VND/USD/KRW) — mock is fallback-only. ⚠️ mock rows use `accountTypeCd:"11"`, which is in neither the Current (03/04/07) nor Saving (05/06/08) set, so a mock fallback renders empty ledgers — a real-data signal, but worth knowing during testing.
- **Transaction popup:** on fetch error, `<TransactionHistoryDialog>` falls back to an empty zeroed response (not a dialog error). Flagged for a stabilisation pass (should surface `useDialog({type:"error"})`).
- **HS:** backend is **live** (`fn_get_haengsung_daily_financial_report`, since 2026-06-14) and returns `data.ROWS`; `DailyFinancialHsClient` falls back to `mockLedgerGroups` only on empty/error.

## 5. Known contract notes

- **`includeInternalTransfers`** travels to the backend but the **exclusion-from-totals is not implemented** server-side (P1/G-4) — the frontend uses it for column visibility/masking only.
- **`activeAccountsOnly=false`** is sent but **not honored** server-side (active-only finder retained, P1/G-6).
- **HS** returns flat `DETAIL/SUBTOTAL/TOTAL` rows that the frontend regroups; the backend's `dailyFinancialHs` now calls the real `rept_0017_001` ledger function `fn_get_haengsung_daily_financial_report` (since 2026-06-14), not a hardcoded seed.

> Cross-reference: the matching backend gap analysis enumerates these as P1/non-SIT-blockers —
> [refactor-gap-analysis.md](../../../../../../wecms-api/docs/features/banking/reports/daily-financial/refactor-gap-analysis.md).
