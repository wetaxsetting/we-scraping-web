# ERP Transaction History — Component Index (Frontend)

Component / hook / API-client / wire-type / mapper file map. Backend mirror:
[wecms-api/.../source-code-index.md](../../../../../wecms-api/docs/features/settings/transaction-history/source-code-index.md).

---

## Components (`components/settings/erp-transaction-history/`)

| File | Role |
|---|---|
| [ErpTransactionHistoryPanel.tsx](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryPanel.tsx) | State owner — tabs / filters / sort / pagination state, `useApiData` fetch, response latching (`stableData`), error→dialog mapping, download + (future) export handlers |
| [ErpTransactionHistoryTabs.tsx](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryTabs.tsx) | Four-tab strip (All / WeCMS → ERP / ERP → WeCMS / Deleted) with counts |
| [ErpTransactionHistoryFilters.tsx](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryFilters.tsx) | Date range (preset/manual) + transaction-type dropdown + search; Deleted-tab type subset |
| [ErpTransactionHistoryTable.tsx](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryTable.tsx) | Bare `<table>` + `table-fixed` + `<colgroup>` + sticky `<thead>`; sortable headers; File download cell; two-line Date cell |
| [types.ts](../../../../components/settings/erp-transaction-history/types.ts) | In-memory types — `ErpTransactionHistoryRow`, `ErpDirection`, `ErpTransactionHistoryTabKey`, `ErpTransactionHistoryTabCounts`, `TRANSACTION_TYPE_CODES`, `DELETED_TAB_TYPE_SUBSET` |

Shared shell / primitives consumed: `<SettingsModal>` · `<SettingsNav>` · shared
[`<Pagination>`](../../../../components/shared/Pagination.tsx) · [`<TableHeaderCell>`](../../../../components/shared/TableHeaderCell.tsx) ·
[`<DateRangeFilter>`](../../../../components/shared/DateRangeFilter.tsx) · `<InteractiveDateRangePicker>` ·
[`<SearchInput>`](../../../../components/shared/SearchInput.tsx) · [`<FilterDropdown>`](../../../../components/shared/FilterDropdown.tsx) ·
`useDialog()`.

> **No `mockData.ts`** — the panel is fully wired to the live API (`useApiData` + `lib/api/erpTransactionHistory.ts`),
> with no mock fallback. (The flat WEB spec planned a `mockData.ts` during the static-UI phase; it was
> superseded by the API wiring.)

## Hooks

- [`useApiData`](../../../../lib/api/useApiData.ts) — fetch-on-mount + refetch-on-dep. The project does
  **not** use React Query / SWR.
- [`useTableSort`](../../../../hooks/useTableSort.ts) — default → ASC → DESC cycle; supplies
  `sortField` / `sortDirection` / `sortParams` / `toggleSort`.
- [`useStickyLoading`](../../../../hooks/useStickyLoading.ts) — smooths the empty/loading toggle so a
  fast cached response doesn't flash "No Data Found".

## API client + mappers + types

- [lib/api/erpTransactionHistory.ts](../../../../lib/api/erpTransactionHistory.ts) —
  `fetchErpTransactionHistory(params)` (camelCase → snake_case query marshalling) +
  `getErpTransactionHistoryDownloadUrl(seqNo)`.
- Wire types in [lib/types/api.ts](../../../../lib/types/api.ts) — `ApiErpTransactionHistoryRow`,
  `ApiErpTransactionHistoryListResponse` (snake_case).
- Mapper `mapErpTransactionHistoryRow` in [lib/api/mappers.ts](../../../../lib/api/mappers.ts) (wire →
  `ErpTransactionHistoryRow`; narrows `erp_type` to `ErpDirection`).
- Download helper [lib/file.ts](../../../../lib/file.ts) `downloadFile(url, filename)` — authenticated
  XHR + blob + synthetic anchor click (carries the Bearer header).
- Datetime [lib/datetime.ts](../../../../lib/datetime.ts) `formatLegacyDtmInDisplayTz(regDtm)` — splits
  `yyyyMMddHHmmss` into the two-line Date cell.

## i18n

`locales/{en,ko,vi}.json` — namespace `settings.erp_transaction_history.*`. The direction / type labels
are emitted by the backend as `erp_type_key` / `trns_type_key` and rendered via `t(key)`. Full key list:
[ui-specification.md § i18n keys](ui-specification.md#i18n-keys-namespace-settingserp_transaction_history).

## Scroll utility

`<ErpTransactionHistoryPanel>` scroll region uses `custom-scrollbar` (per `wecms-web/CLAUDE.md` §6c).

## Not used

- **No route** — modal panel only (no `app/(dashboard)/settings/...` page).
- **No View Setting** — panel does not adopt the column-visibility popover (OQ-FE-2).
- **No create / edit / delete** — read-only audit ledger.
- **No upload UI** — upload write-path not ported (OQ-1).
