# Transfer History — Test Scenarios (Frontend)

> Route `/banking/transfer-history`. SIT/UAT coverage for the Next.js page.

## 1. Search

| # | Scenario | Steps | Expected |
|---|---|---|---|
| S1 | Default load | Open the page | Date range = last 7 days, status = All, page 1, size 10; grid loads from live API |
| S2 | Valid search | Pick a range with data | Rows render; VND totals footer shows count + amount; pagination shows `{shown} of {total}` |
| S3 | No-result search | Pick a range with no transfers | "Transfer History Not Found" empty state; footer count 0 |
| S4 | Multi-filter | Range + status Success + size 50 + sort Amount DESC | Only success rows; sorted desc; 50/page; page resets to 1 |

## 2. Transaction status

| # | Scenario | Expected |
|---|---|---|
| T1 | Success row | Results cell shows timestamp only (no green "Success" label); hover shows no error message |
| T2 | Failed row | Results cell shows red "Failed" + timestamp; hovering shows `TRNS_MSG` tooltip (e.g. "Transaction is cancelled…") |
| T3 | Pending/Processing/Cancelled | **N/A** — no such status; all non-success render as "Failed" |

## 3. Detail view

| # | Scenario | Expected |
|---|---|---|
| D1 | Row click / open detail | **N/A** — no detail route/dialog. Rows are not clickable to a detail page. All data is inline in the row. |

## 4. Matching

| # | Scenario | Expected |
|---|---|---|
| M1–M5 | Match Vendor/Expense, Unmatch, Unmatch All, Candidate search | **N/A for this page** — no match UI exists. Test matching under the Transaction-History matching feature. |

## 5. Export

| # | Scenario | Expected |
|---|---|---|
| E1 | Export with/without data, column verification | **N/A** — no export/print button on this page. |

## 6. Filters & interactions

| # | Scenario | Expected |
|---|---|---|
| F1 | Change date range | Refetch; page resets to 1 |
| F2 | Switch status radio (All→Success→Failed) | Refetch with `trns_stts` `""`/`00000000`/`99999999`; page resets to 1 |
| F3 | Sort a column (Date/From/To/Amount/Remarks) | Glyph cycles default→ASC→DESC→default; DB-side re-sort; page resets to 1 |
| F4 | Sort the Results column | Inert — no glyph, no action |
| F5 | Change page / page size | Refetch; size change resets to page 1 |

## 7. States

| # | Scenario | Expected |
|---|---|---|
| ST1 | Initial loading | Table chrome + centered "Loading…"; chrome does not blank on refetch (stable-data latch) |
| ST2 | Empty | "Transfer History Not Found" |
| ST3 | Error | Red `ErrorBanner` (`role="alert"`) with title + message + code; table area shows "No data — see the error banner above" |

## 8. Error handling

| # | Scenario | Expected key |
|---|---|---|
| ER1 | Inverted period (`to < from`) | `transfer_history.error.invalid_period` (from `WBE_TRANSFER_HISTORY_INVALID_PERIOD`) |
| ER2 | Validation error | `transfer_history.error.validation` |
| ER3 | Network failure | `transfer_history.error.network` |
| ER4 | Coocon timeout/failure | `transfer_history.error.coocon_timeout` / `.coocon_failure` |
| ER5 | Session expired (401) | Global session-expired dialog (Axios interceptor) |

## 9. Permissions

| # | Scenario | Expected |
|---|---|---|
| P1 | Authorized user | Page renders, data loads |
| P2 | Unauthenticated | Redirect to `/login` (dashboard guard) / 401 dialog |

## 10. i18n / locale

| # | Scenario | Expected |
|---|---|---|
| L1 | Switch EN/KO/VI | Title, filter labels, column headers, footer, empty/error strings all localized (`transfer_history.*` keys present in all three files) |

## 11. Responsive

| # | Scenario | Expected |
|---|---|---|
| R1 | 375 / 768 / 1024 / 1440 | Filter row wraps; table scrolls horizontally below `min-w-[1080px]`; pagination reflows; footer stays aligned |
