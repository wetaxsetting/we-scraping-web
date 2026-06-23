# Transfer History — UI Specification (Frontend)

> Figma: 96:42769 (table) · legacy `trns_0003_001_view.jsp`
> Components: `TransferHistoryPage` / `TransferHistoryTable` / `TransferHistoryTableColumns` / `TransferHistoryTableFooter`

## 1. Page composition

```
<PageLayout>
  <PageHeader title={t("transfer_history.title")} />        ← NO action toolbar (no list/print/export)
  <FilterRow>
     <InteractiveDateRangePicker startIso endIso onChange/>  ← left
     [ ◯ All  ◯ Success  ◯ Failed ]   (custom radios)       ← left
  </FilterRow>
  <ErrorBanner/>   (only when error)
  <DataTableShell footerMode="paginationWithTotals"
     table={<TransferHistoryTable/>}
     footer={<TransferHistoryTableFooter className="mt-auto"/>}
     pagination={<Pagination className="shrink-0"/>} />
</PageLayout>
```

The page **intentionally renders no toolbar** — mirroring live JEX `trns_0003_001.act` (no View Setting list icon per OQ-5, no Excel export per OQ-7, no print). A prominent comment in `TransferHistoryPage.tsx` documents this.

## 2. Filters

### Date range
- Shared `<InteractiveDateRangePicker>` (a real interactive picker, not the UI-only `DateRangePicker`).
- Default: last 7 days (`defaultRangeIso()`).
- ISO `YYYY-MM-DD` in state → `YYYYMMDD` on the wire (`isoToWireDate`).

### Status radios
- Three custom `RadioButton`s: `all` / `success` / `failed`.
- Labels: `t("transfer_history.filter.{all|success|failed}")` → "All" / "Success" / "Failed".
- Visual: 18px circle, brand border, 8px brand dot when active.
- Wire mapping (`radioToWire`): success→`"00000000"`, failed→`"99999999"`, all→`""` (omitted from request).

## 3. Table (6 columns)

`<table>` `w-full min-w-[1080px] table-fixed`, sticky `<thead>`, shared `<colgroup>` via `TransferHistoryTableColumns`. All header text `text-wb-13`.

| # | Header (key → EN) | Data | Sortable (FIELD_ID) | Align | Col width |
|---|---|---|---|---|---|
| 1 | `col.date_time` → "Date/Time" | `date` (ink) + `time` (muted), stacked | ✅ `TRNS_DT` | left | 120px |
| 2 | `col.from_bank` → "From Bank" | BankCell: `fromBank` + building icon + `fromCurrency`; `fromAccount` (muted) | ✅ `OUT_BANK_NM` | left | 260px |
| 3 | `col.to_bank` → "To Bank" | BankCell: `toBank` / `toCurrency` / `toAccount` | ✅ `IN_BANK_NM` | left | 260px |
| 4 | `col.amount` → "Transfer Amount" | `amount` (pre-formatted string) | ✅ `TRSC_AMT` | right | 160px |
| 5 | `col.remarks` → "Remarks" | `remarks` (`truncate`) | ✅ `RMRK` | left | flex |
| 6 | `col.results` → "Results" | status display (below) | ❌ (no backend mapping) | left | 140px |

- `TRANSFER_HISTORY_COLUMN_COUNT = 6`. Colgroup reused by table + footer.
- `TRANSFER_HISTORY_SORT_FIELD_IDS = [TRNS_DT, OUT_BANK_NM, IN_BANK_NM, TRSC_AMT, RMRK]` (mirror backend `TransferHistorySortField`).
- Sort glyphs via shared `<TableHeaderCell>` (inactive = `ico-sort.svg`; ASC = `ChevronUp text-brand`; DESC = `ChevronDown text-brand`).
- **BankCell:** building icon sits **between** bank name and currency (matches JEX cell composition, not a leading icon); account number muted on line 2.
- Row height `var(--h-wb-table-row)`.

## 4. Status display (Results column)

Driven by `row.status` (`"success" | "failed"`):

| Status | Rendering | Tokens |
|---|---|---|
| `failed` | Stacked: red **"Failed"** (`transfer_history.status.failed`) over `row.lastUpdate` (muted) | `text-wb-status-rejected-text` |
| `success` | `row.lastUpdate` only (muted) — **no green "Success" label rendered** | muted |

- The cell has a native `title={row.statusMessage}` tooltip carrying the legacy `TRNS_MSG` (failed-row error detail).
- Note: the `transfer_history.status.success` key exists but is **not** rendered in the cell (success rows show only the timestamp) — matches legacy.

## 5. Footer (totals)

Sibling `<table>` via shared `<DataTableFooter>` (`minWidth="1080px"`, `mt-auto`). One `<tr>`:

| Cells | Content |
|---|---|
| col 1 | `t("transfer_history.footer.total_currency", {currency})` → "Total(VND)" |
| cols 2–3 (`colSpan=2`) | `t("transfer_history.footer.transaction_count", {count})` → "{count} Transaction(s)" |
| col 4 (right) | `totals.total` (semibold amount, with ₫ symbol) |
| cols 5–6 | empty (`aria-hidden`) |

- `count` reflects the **full filter scope** (backend pre-aggregated `total_count`), not the current page.
- Only the **VND** total row renders today; USD totals ride on the wire (`total_usd_*`) for a future second row.

## 6. Pagination

- Shared `<Pagination>`: `page=pageNo`, `pageCount=max(1, ceil(max(totalCount,1)/pageSize))`, `pageSize`, `totalLabel = t("common.showing_of", {shown: rows.length, total: totalCount})`, `className="shrink-0"`.
- Page-size options: shared `PAGE_SIZE_OPTIONS` `[10,20,50,100]` (default 10). Backend also accepts 15 but the FE does not surface it.

## 7. Typography / tokens

All text via WB365 tokens (`text-wb-13`, etc.); no inline px sizes. Status colors from `wb-status-*`. Building icon from `public/assets/`. Follows the global typography rules — no ad-hoc font-family/size.

## 8. Responsive

- Table `min-w-[1080px]` → horizontal scroll inside `<DataTableShell>` on narrow viewports.
- Verified at 375 / 768 / 1024 / 1440 via the standard shell/filter/table/pagination responsive behaviour.
