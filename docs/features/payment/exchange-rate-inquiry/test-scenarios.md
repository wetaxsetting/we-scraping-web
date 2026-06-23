# Exchange Rate Inquiry — Frontend Test Scenarios

**No frontend tests exist** for this screen (`*.test.*` MISSING — gap-analysis G-OVRS-4).
The scenarios below are the checklist to implement. Backend coverage is in the API
[`test-scenarios.md`](../../../../../wecms-api/docs/features/payment/exchange-rate-inquiry/test-scenarios.md).

---

## 1. Render / load

| # | Scenario | Expected |
|---|---|---|
| FE1 | Initial mount | fixed 12-currency grid (USD, KRW, JPY, EUR, AUD, GBP, SGD, HKD, CAD, CHF, THB, NZD); `-` for missing rates |
| FE2 | Initial loading | `common.loading` centered for ≥ 400 ms (sticky), then matrix |
| FE3 | Stable-data latch | previous matrix stays visible while a filter change refetches |
| FE4 | Empty result | `payment.exchange_rate.empty` centered |

## 2. Filters

| # | Scenario | Expected |
|---|---|---|
| FE5 | Bank dropdown select | re-fetch with new `bank_cd`; compare bank auto-syncs to a different bank |
| FE6 | Bank dropdown — tenant has no rows | static Shinhan/Woori fallback list shown |
| FE7 | Round dropdown (Shinhan) | "Last time" (`seq_no` omitted) + "1st time" (lowest `seq_no`, not duplicated with Last) |
| FE8 | Round dropdown (Woori) | `HH:MM:SS [Nth]` reversed list, no "Last time" |
| FE9 | Round stale reset | if current `seqNo` not in refreshed rounds → reset to latest |
| FE10 | Date pick (`<DateField>`) | re-fetch with `ref_date` (dashes stripped) |
| FE11 | Currency search | client-side filter by currency code substring |

## 3. Compare

| # | Scenario | Expected |
|---|---|---|
| FE12 | Toggle compare on | second `fetchExchangeRates(compareBankCd, same seqNo)`; 13-col matrix |
| FE13 | Compare bank == primary | swap (page sets primary to old compare bank) |
| FE14 | Diff cell signs | positive green, negative `(parenthesised)` red, `0.00` green, `-` neutral when either side null/zero |
| FE15 | Toggle compare off | clears `compareData`; back to 5-col matrix |

## 4. Sort

| # | Scenario | Expected |
|---|---|---|
| FE16 | Click Currency header | cycle default → ASC → DESC → default; rows reorder by display currency |
| FE17 | Click a rate header | sort by that primary rate; nulls last; compare columns stay aligned |
| FE18 | Sort glyph state | inactive `ico-sort.svg`; ASC `ChevronUp text-brand`; DESC `ChevronDown text-brand` |

## 5. Errors / footer

| # | Scenario | Expected |
|---|---|---|
| FE19 | API error | `useDialog` error dialog (`type: "error"`, `payment.exchange_rate.error.load_failed`); no mock fallback |
| FE20 | 401 | global session-expired interceptor handles re-auth (no per-page handler) |
| FE21 | "Inquired on" footer | shown when first rate row has `lastUpdateDate` + `lastUpdateTime`; `DD/MM/YYYY HH:MM:SS` |

## 6. i18n

| # | Scenario | Expected |
|---|---|---|
| FE22 | EN / KO / VI | all `payment.exchange_rate.*` keys resolve; no raw key leakage |
