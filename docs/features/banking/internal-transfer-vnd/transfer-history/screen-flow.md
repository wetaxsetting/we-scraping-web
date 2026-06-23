# Transfer History — Screen Flow (Frontend)

> Route `/banking/transfer-history` · `TransferHistoryClient` → `TransferHistoryPage`

## 1. Entry

- Sidebar: Banking group → "Transfer History" (`sidebar.banking.transferHistory`), leaf `banking-transfer-history`, sibling of "Own Account Transfer".
- Direct URL: `/banking/transfer-history`. The route page is a thin server component rendering `<TransferHistoryClient />`.

## 2. Initial state

On mount, `TransferHistoryClient` initializes:

- `range` = last 7 days (`defaultRangeIso()` → today and today−7, legacy `trns_0003_001.ts` parity).
- `statusRadio` = `"all"`.
- `pageNo` = 1, `pageSize` = 10 (`PAGE_SIZE_OPTIONS[0]`).
- Sort = default (no user sort) via `useTableSort()`.

It then fires the first fetch (see [api-consumption.md](api-consumption.md)).

## 3. Flow diagram

```
User opens /banking/transfer-history
        │
        ▼
TransferHistoryClient: defaults (last 7 days, All, page 1, size 10)
        │  derive wire params: from_dt, to_dt, trns_stts(""→omit)
        ▼
fetchTransferHistory(...)  ──►  GET /api/v1/banking/internal-transfer/transfer-history
        │
        ├─ loading        → table chrome + centered "Loading…" (sticky-loading window)
        ├─ success+rows   → grid rows + VND totals footer + pagination
        ├─ success+empty  → "Transfer History Not Found"
        └─ error          → ErrorBanner (red strip) + "No data — see the error banner above"
        │
        ▼
User changes a filter/sort/page  →  pageNo reset to 1 (filter/sort change)  →  refetch
```

## 4. User interactions

| Action | Handler | Effect |
|---|---|---|
| Change date range | `handleDateRangeChange` | updates `range`, resets `pageNo=1`, refetch |
| Pick status radio (All/Success/Failed) | `handleStatusRadioChange` | updates `statusRadio`, resets `pageNo=1`, refetch |
| Click sortable column header | `handleSort` (`useTableSort.toggleSort`) | cycles default→ASC→DESC→default, resets `pageNo=1`, refetch |
| Change page | `handlePageChange` | clamps `pageNo ≥ 1`, refetch |
| Change page size | `handlePageSizeChange` | updates `pageSize`, resets `pageNo=1`, refetch |

The filter-change → page-1 invariant mirrors legacy `fn_loadData(input, option=true)`.

## 5. States

| State | Rendering |
|---|---|
| **Initial loading** | Table colgroup + sticky header + empty tbody always render; a sibling `flex-1` centered block shows `transfer_history.loading` ("Loading…"). Uses `useStickyLoading` for a min-visible window. |
| **Loaded with data** | Grid rows mapped from the API; VND totals footer; pagination with `{shown} of {total}`. |
| **Empty result** | Centered `transfer_history.empty.default` ("Transfer History Not Found"). |
| **Error** | Non-blocking `ErrorBanner` (red `wb-status-rejected` strip, `role="alert"`) showing title + message + code; table area shows `transfer_history.empty.after_error`. |

A **stable-data latch** (`stableData`/`prevData`) keeps the last successful payload visible during refetches so chrome doesn't blank.

## 6. Error → message mapping

`errorKeyForCode` maps `ApiCallError.code` → locale key:

| Code | Key |
|---|---|
| `WBE_TRANSFER_HISTORY_INVALID_PERIOD` | `transfer_history.error.invalid_period` |
| `WBE_VALIDATION` | `transfer_history.error.validation` |
| `NETWORK` | `transfer_history.error.network` |
| `WBE_COOCON_TIMEOUT` | `transfer_history.error.coocon_timeout` |
| `WBE_COOCON_FAILURE` | `transfer_history.error.coocon_failure` |
| (default) | `transfer_history.error.unknown` |

Non-`ApiCallError` exceptions map to `.network` + code `"NETWORK"`. 401s are handled globally by the Axios interceptor (session-expired dialog).
