# ERP Transaction History — UI Specification (Frontend)

The implemented ERP Transaction History panel UI (Figma 134:16546). Follows the Settings shell +
panel-composition contract in `wecms-web/CLAUDE.md` §3a / §3b. Backend contract:
[wecms-api/.../interface-specification.md](../../../../../wecms-api/docs/features/settings/transaction-history/interface-specification.md).

---

## Panel composition

[`<ErpTransactionHistoryPanel>`](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryPanel.tsx)
follows the standard Settings panel shape — header (shrink-0) → tabs (shrink-0) → filters (shrink-0) →
scroll region (`min-h-0 flex-1`, only this scrolls) → pagination (shrink-0, outside the scroll region):

```
<div className="flex min-h-0 flex-1 flex-col">
  <Header />        pt-14 pr-24 — clears the shell Esc/X; NO right-side action button
  <Tabs />          ErpTransactionHistoryTabs
  <Filters />       ErpTransactionHistoryFilters
  <ScrollRegion>    custom-scrollbar; min-w-[920px]; ErpTransactionHistoryTable + empty-state sibling
  <Pagination />    shared <Pagination>, pinned below the scroll region
</div>
```

- **Header:** title `settings.erp_transaction_history.title` (`text-wb-18 font-semibold tracking-wb-tight text-wb-dark`)
  + description `settings.erp_transaction_history.description` (`mt-1 text-wb-13 font-normal text-wb-muted`).
  No right-side action button → keep `pr-24` to reserve clearance for the shell's Esc/X group.

## Tabs

[`<ErpTransactionHistoryTabs>`](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryTabs.tsx)
— a `h-9` tab strip with a bottom border, each tab a label + count:

| Tab key | Label key | Count source |
|---|---|---|
| `all` | `settings.erp_transaction_history.tab.all` | `total_count` |
| `W` | `settings.erp_transaction_history.tab.wecms_to_erp` | `total_count_wecms` |
| `E` | `settings.erp_transaction_history.tab.erp_to_wecms` | `total_count_erp` |
| `D` | `settings.erp_transaction_history.tab.deleted` | `total_count_deleted` |

Active tab gets the brand bottom border + brand label/count colour. All four are always visible (product-agnostic, OQ-2). The row scrolls horizontally on narrow viewports so labels never truncate.

## Filters

[`<ErpTransactionHistoryFilters>`](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryFilters.tsx):

| Control | Notes |
|---|---|
| **Date range** | Two-state. Preset mode (default) = shared `<DateRangeFilter>` ("Last 30 / 90 / 180 Days / Enter Manually" + calendar trigger), seeded to last-30-days. Manual mode = shared `<InteractiveDateRangePicker>` (start/end chips + dual-month calendar popover). Panel translates the chosen range to wire `YYYYMMDD` at the axios boundary. |
| **Transaction Type** | dropdown of the 17 codes (`TRANSACTION_TYPE_CODES`) on All / W / E tabs; narrows to the Deleted subset (`DELETED_TAB_TYPE_SUBSET` = `02`,`03`,`12`,`13`,`16`) on the Deleted tab; `"all"` = no filter |
| **Search** | shared `<SearchInput>`; debounced 300ms; matches `reg_id` server-side |

There is no separate active/inactive filter — soft-deleted rows show on the Deleted tab.

## Table

[`<ErpTransactionHistoryTable>`](../../../../components/settings/erp-transaction-history/ErpTransactionHistoryTable.tsx)
— bare `<table>` + `table-fixed` + `<colgroup>` + sticky `<thead>`; headers use the shared
`<TableHeaderCell>` (`text-wb-13`) so the sort glyph + ARIA match other list pages.

| Column | Source field | Sort FIELD_ID | Width | Notes |
|---|---|---|---|---|
| **Date** | `regDtm` | `REG_DTM` | 146px | two-line stack — date on top, time muted under (`formatLegacyDtmInDisplayTz`) |
| **Type** | `erpType` | `ERP_TYPE` | 140px | renders `t(erpTypeKey)`, falls back to raw `erpType` |
| **Transaction Type** | `trnsTypeCd` | `TRNS_TYPE_CD` | 280px | renders `t(trnsTypeKey)`, falls back to raw `trnsTypeCd` |
| **File** | `orgFileNm` | — (non-sortable, OQ-5) | 280px | brand-link `<button>` when `fileSize > 0`; empty cell otherwise (batch rows) |
| **User** | `userNm` ?? `regId` | `REG_USER` | 160px | `USER_NM` (LEFT JOIN) with `reg_id` fallback for `SYSTEM`/removed users |

- The File cell is a `<button>`, not `<a href download>` — the JWT lives in localStorage, so the
  download flows through `lib/file.ts downloadFile(...)` (authenticated XHR + blob), OQ-FE-1.
- The `FILE` header has no sort glyph (non-sortable, OQ-5).

## Pagination

Shared [`<Pagination>`](../../../../components/shared/Pagination.tsx) — page-size dropdown + count
(`common.showing_of`) + arrows; pinned outside the scroll region. Server-side paging; boundary converts
0-based ↔ 1-based.

## States

Loading / empty / error per [screen-flow.md](screen-flow.md). The empty/loading text centers in the
scroll area below the sticky header. Error dialogs use `type: "error"` with `title: t("dialog.error")`
and the backend `errorCode`; never a module-name title (project dialog-variant rule).

## View Setting

**Not adopted** (OQ-FE-2) — the legacy panel has no toolbar list-icon button. The `<colgroup>` is a
fixed five-column definition; there is no `useViewSetting` call or `<ViewSettingPopover>` in this panel.
(The backend nevertheless reserves the `erp-transaction-history` screenId for the Excel export provider
— see the GAP-4 seed note in the backend gap analysis.)

## i18n keys (namespace `settings.erp_transaction_history.*`)

`title` · `description` · `loading` · `empty` · `tab.{all,wecms_to_erp,erp_to_wecms,deleted}` ·
`col.{date,type,transaction_type,file,user}` · `direction.{wecms_to_erp,erp_to_wecms,deleted}`
(server-emitted via `erp_type_key`) · `type.{01..17}` (server-emitted via `trns_type_key`) · plus the
shared filter / search / pagination chrome keys. All present in `locales/{en,ko,vi}.json`.

| Wire error code | Surfaced as |
|---|---|
| `WBE2014` | error dialog (download — row not found / wrong tenant) |
| `WBE2015` | error dialog (download — file unavailable) |
| `WBE_VALIDATION` | suppressed (panel state guards it) |
| network / other | error dialog with the code |
