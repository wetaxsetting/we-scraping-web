# Transfer History — API Consumption (Frontend)

> Client: `lib/api/banking.ts → fetchTransferHistory` · Mappers: `lib/api/mappers.ts`

## 1. Endpoint

| Property | Value |
|---|---|
| URL | `GET /api/v1/banking/internal-transfer/transfer-history` (spec-aligned path) |
| Auth | JWT auto-attached by the Axios interceptor (`lib/axios.ts`) |
| Envelope | `ApiResponse<ApiTransferHistoryResponse>`; unwrapped, throws `ApiCallError` on `status.error` |

> ⚠️ Not the legacy `/api/v1/banking/transfers/history` — that URL appears only in a stale CLAUDE.md table + a stale comment at `banking.ts:972`. The live code calls the `internal-transfer/transfer-history` path.

## 2. Request

`fetchTransferHistory(params: FetchTransferHistoryParams)`:

| Param | Wire | Sent when |
|---|---|---|
| `fromDt` | `from_dt` | always |
| `toDt` | `to_dt` | always |
| `trnsStts` | `trns_stts` | only when not `""`/undefined (`""`=All → omitted) |
| `pageNo` | `page_no` | when ≥ 1 |
| `pagePerCnt` | `page_per_cnt` | one of `10\|15\|20\|50\|100` |
| `sort` (`ListSortParams`) | `sort_field` + `sort_direction` | only when both present |

The function returns the **raw** `ApiTransferHistoryResponse` — rows are mapped by the client via the mappers, not inside the fetcher.

## 3. Wire types (`lib/types/api.ts`, lowercase snake_case)

### `ApiTransferHistoryRow`
`seq_no` (number), `trns_dt` (`YYYYMMDD`), `trns_tm` (`HHmm`), `out_bank_code`, `out_bank_nm`, `out_acct_no`, `in_bank_code`, `in_bank_nm`, `in_acct_no`, `owan_nm`, `ccy_cd`, `trsc_amt` (string|number), `fee` (string|number|null), `trans_type` (string|null), `rmrk` (string|null), `trns_stts` (string, `"00000000"`=success), `trns_msg` (string|null), `user_nm`.

### `ApiTransferHistoryResponse`
`total_count`, `total_vnd_amount`, `total_usd_amount`, `total_vnd_count`, `total_usd_count`, `rows: ApiTransferHistoryRow[]`.

(Flipped from UPPER_SNAKE to lowercase snake_case 2026-05-20 in the MR that landed the spec-aligned endpoint.)

## 4. Mappers (`lib/api/mappers.ts`)

### `mapTransferHistoryRow(api) → TransferRow`
| In-memory field | Source |
|---|---|
| `id` | `String(seq_no)` |
| `status` | `trns_stts === "00000000" ? "success" : "failed"` |
| `date` / `time` | `formatTrnsDate(trns_dt)` / `formatTrnsTime(trns_tm)` |
| `fromBank` | `out_bank_nm \|\| out_bank_code \|\| ""` |
| `toBank` | `in_bank_nm \|\| in_bank_code \|\| ""` |
| `fromCurrency` / `toCurrency` | `coerceCurrency(ccy_cd)` (both = the single row currency) |
| `fromAccount` / `toAccount` | `out_acct_no` / `in_acct_no` |
| `amount` | `formatCurrencyAmount(trsc_amt, ccy, false)` — locale separators, **no symbol** |
| `remarks` | `rmrk` |
| `lastUpdate` | `formatLastUpdate(trns_dt, trns_tm)` |
| `statusMessage` | `trns_msg ?? ""` (failed-row tooltip) |

### `mapTransferHistoryTotals(api) → TransferHistoryTotal`
Collapses to the **VND bucket only**: `{ currency: "VND", count: total_vnd_count, total: formatCurrencyAmount(total_vnd_amount, "VND") }` (with ₫ symbol). USD totals (`total_usd_*`) ride on the wire for a future second footer row but are not rendered today (documented OQ).

## 5. Error handling

- `ApiCallError.code` is mapped to a locale key by `errorKeyForCode` (see [screen-flow.md](screen-flow.md) §6). Surfaced via the in-context `ErrorBanner`, not a blocking dialog.
- 401 → global session-expired interceptor in `lib/axios.ts`.

## 6. Out of scope (no API calls)

The page makes **no** calls for matching, candidates, unmatch, detail, or export. Those endpoints live on `AccountController` (`/api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/match[-candidates]`) and belong to the Transaction-History matching feature, not Transfer History.
