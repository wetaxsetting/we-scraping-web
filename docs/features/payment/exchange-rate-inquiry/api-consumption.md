# Exchange Rate Inquiry — API Consumption

What the frontend calls and the wire ↔ in-memory shapes. Full backend contract:
[`wecms-api/.../interface-specification.md`](../../../../../wecms-api/docs/features/payment/exchange-rate-inquiry/interface-specification.md).

All calls go through `lib/api/banking.ts` (JWT auto-attached by `lib/axios.ts`), unwrap the
`ApiResponse<T>` envelope, and throw `ApiCallError` on `status.error`. Translation snake →
camel happens once in `lib/api/mappers.ts`.

---

## 1. Endpoints

| Frontend fn | Method + path | Returns |
|---|---|---|
| `fetchExchangeRates(params)` | `GET /api/v1/banking/exchange-rates` | `ExchangeRateListResult` |
| `fetchExchangeRateBanks()` | `GET /api/v1/banking/exchange-rates/banks` | `ExchangeRateBankOption[]` |
| `fetchExchangeRateCurrencies()` | `GET /api/v1/banking/exchange-rates/currencies` | `string[]` |

> Note the base is `/api/v1/banking`, **not** `/api/v1/payment` — the backend controller is in
> the `domain.banking` package even though the screen lives under the Payment → Overseas
> Payment menu.

## 2. `fetchExchangeRates` params → query

`fetchExchangeRates({ refDate?, bankCd?, seqNo?, sortField?, sortDirection? })` — only present
keys are sent.

| Param | Wire query | Notes |
|---|---|---|
| `refDate` | `ref_date` | YYYYMMDD (page strips dashes from the ISO `<DateField>` value) |
| `bankCd` | `bank_cd` | source bank |
| `seqNo` | `seq_no` | round; omitted → latest |
| `sortField` / `sortDirection` | `sort_field` / `sort_direction` | spread from `useTableSort().sortParams` (null in default state → omitted) |

## 3. Wire response → in-memory

### `GET /exchange-rates` → `ExchangeRateListResult`

Wire `ApiExchangeRateListResponse` (snake_case) → `toExchangeRateListResult` →
`ExchangeRateListResult` (camelCase):

| Wire | In-memory |
|---|---|
| `ref_date` | `refDate` |
| `bank_cd` | `bankCd` |
| `bank_nm` | `bankNm` |
| `rates[]` | `rates: ExchangeRateRow[]` |
| `rounds[]` | `rounds: { seqNo, lastUpdateTime }[]` |

`ExchangeRateRow` (in-memory): `ccyCd`, `refCcyCd`, `basicRate`, `basicTran`, `buyAmt`,
`sellAmt`, `tranBuyAmt`, `tranSellAmt` (all `number | null`), `standPoint`, `lastUpdateDate`,
`lastUpdateTime`, `exchRateRegDtm` (strings/null). Mapped from wire `ccy_cd`, `ref_ccy_cd`,
`basic_rate`, `basic_tran`, `buy_amt`, `sell_amt`, `tran_buy_amt`, `tran_sell_amt`,
`stand_point`, `last_update_date`, `last_update_time`, `exch_rate_reg_dtm`.

### `GET /exchange-rates/banks` → `ExchangeRateBankOption[]`

Wire `{ bank_cd, bank_nm }` → `{ bankCd, bankNm, logo? }` (the page injects `logo` from
`BANK_LOGO_MAP`). Empty array → page uses the static Shinhan/Woori list.

### `GET /exchange-rates/currencies` → `string[]`

Plain string array of display-currency codes (foreign side). The page does not currently
consume this for the matrix (it renders the fixed 12-currency grid); available for future use.

## 4. Display-currency derivation

`getDisplayCcy(row)` returns `row.ccyCd === "VND" ? row.refCcyCd : row.ccyCd` — Shinhan stores
the foreign currency in `ccyCd`; Woori stores `VND` in `ccyCd` and the foreign in `refCcyCd`.
The page keys its currency maps by this resolved display currency.

## 5. Compare flow

Compare is **two independent calls** to the same `GET /exchange-rates` — primary with `bankCd`,
secondary with `compareBankCd`, both using the same selected `seqNo`. There is no compare-specific
endpoint. The page merges the two `rates` arrays into the 13-column matrix.

## 6. Errors

- `ApiCallError` (carries `status.code` + `trace_id`) → `useDialog().open({ type: "error", ... })`.
- 401 → handled globally by the `lib/axios.ts` session-expired interceptor.
- Validation errors from the backend (`WBE_VALIDATION` on a malformed `ref_date`/`seq_no`)
  surface through the same error dialog — though the page only sends well-formed values.

## 7. Wire format

Lowercase snake_case both ways (project rule). Components never read snake_case directly —
the mapper is the single translation boundary; the page consumes only camelCase
`ExchangeRateRow` / `ExchangeRateListResult` shapes.
