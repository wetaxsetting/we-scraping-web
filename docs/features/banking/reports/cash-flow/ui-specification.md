# Cash Flow — UI Specification (Frontend)

Filter bar, the hierarchical matrix, special rows, monthly columns + quarter hiding, sticky chrome, and
the Excel export structure. Backed by `CashFlowPage.tsx` (the matrix is the inline `CashFlowMatrix`
component, not a separate file).

---

## 1. Filter row (`CashFlowPage.tsx`)

One `FilterRow`-style card, left → right:

| Control | Component | Behaviour |
|---|---|---|
| **Exchange Rate** | text input (`inputMode="decimal"`) | single combined field. Edits `krwRate` when `baseCurrency === "USD"`, else `usdRate` (`combinedRate`/`applyCombinedRate`). Displays VND-style dot grouping (`26000`→`26.000`); `parseExchangeRateInput` strips dots/commas back to a numeric string. **There are no separate USD and KRW inputs.** |
| **Currency** | `FilterSelect<BaseCcy>` over `["VND","USD","KRW"]` | each option carries a `CURRENCY_FLAG` icon; sets `baseCurrency` |
| **Year** | `FilterSelect<number>` (`buildYearOptions()`) | current year + 8 prior (9 entries); calendar icon |
| **Period / Quarter** | `FilterSelect<number\|null>` (`buildPeriodOptions`) | `This Year` (null) + Quarter 1–4; sets `quarter` (client-side column visibility only) |
| **Banks** | `<BankFilterPopover>` | multi-select `{bankCd, acctNo}`; "All Banks" = empty = all |
| **Search** | bare `<button>` | disabled while loading; bumps `searchKey` |

The **Export** button is in the `<PageHeader>` (disabled when `!report`), not in the filter row. There
is **no Print** action and no `<SearchInput>` text field.

---

## 2. The matrix

`groupReport(report)` reshapes the flat `report.rows` into `{ opening, groups[], salesProfit,
nonSalesProfit, endBalance }`, bucketing by `row_type` (secondary discriminator `displayCd === "NON
SALES PROFIT"` for the ACC-03 subtotal). `GroupRows` renders each L1 group; `groupCd`/`displayOrder`
are **not** used for bucketing.

### 2.1 Sticky columns (5 left columns)

`STICKY_COL_WIDTHS = {outer:160, mid:200, koNm:220, itemCd:100, itemNm:180}` (cumulative 610px). Columns:
L1 (outer) · L2 (mid) · L3 KO name · Item code · Item name. The `<thead>` is `sticky top-0`; the End
Balance band is `sticky bottom-0`. Scroll container class is `cf-scrollbar` (a report-page deviation
from the shared `custom-scrollbar*` utilities).

### 2.2 Hierarchy rendering (`GroupRows`)

- **L1 cell** — emitted once with `rowSpan` over its whole tree; sticky-left, `font-semibold`. Name from
  `L1_DISPLAY_NAME` (`수입 REVENUE` / `지출 EXPENSES` / `투자 INVESTMENT`).
- **L2 cell** — once per L2 with `rowSpan` over its L3 children; sticky-left. Name = `ko en`.
- **L3 rows** — three sticky cells: KO name (`displayNm`), Item code (`displayCd`), Item name (`itemNm`),
  then the month amounts. The contract ships `displayNm` (= `chart_acct_nm_ko`) and `itemNm`
  (= `chart_acct_nm_en`) as **separate fields** — the older `extractKoName`/`extractEnName` heuristics
  are now dead.
- **No expand/collapse** — the hierarchy is static `rowSpan` rendering.

### 2.3 Special rows

| Row | Detection | Style / placement |
|---|---|---|
| **Opening Balance** | `row_type === "Opening Balance"` | rendered in the `<thead>` second row (per month); `bg-wb-bg-sidebar`, `font-semibold` |
| **Level 1 Subtotal (S.TOTAL)** | `row_type === "Level 1 Subtotal"`, not `NON SALES PROFIT` | `SubtotalBand` — blue tint (`bg-wb-status-progress-bg`), `colSpan=4` from the mid column, `font-semibold` |
| **NON SALES PROFIT** | `Level 1 Subtotal` + `displayCd === "NON SALES PROFIT"` | rendered **twice** — a blue subtotal band (ACC-03) **and** a green `ProfitBand` — intentional legacy duplicate (parity audit §8b Defect A, PO 2026-06-04) |
| **SALES PROFIT** | `row_type` `"Sales Profit"` / `"SALES PROFIT"` | green `ProfitBand` (`bg-wb-status-approved-bg`), emitted before the first ACC-03 group |
| **End Balance** | `row_type` `"End Balance"` / `"Grand Total"` | separate **sticky-bottom** sibling `<table>`, solid green `#16a34a`, white `font-semibold`, label `colSpan=5` **centered** (Defect B fix) |

`ACC-99` subtotal is suppressed; `"Grand Total"` is treated as an End Balance synonym (never actually
emitted — dead handling, G8).

### 2.4 Monthly columns + quarter hiding

Months render from `MONTH_KEYS[idx]` for the **visible** indices only:
`visibleMonthIdx = monthIndicesForQuarter(filters.quarter)` (This Year → all 12; Q1 → `[0,1,2]` … Q4 →
`[9,10,11]`). `tableMinWidth = STICKY_LEFT_TOTAL + visibleMonthIdx.length * 120`. Hidden months are
**never rendered** (not CSS-hidden). **There is no annual-total column on screen** —
`annualTotal`/`TOTAL_AMT` is export-only.

### 2.5 Amount rendering

`renderAmount(value, ccy)`: empty/NaN/zero → empty string (no "0", no "–"); otherwise
`formatAmount(value, ccy, true)` from `lib/currency.ts` (VND → `₫` suffix / 0 digits; USD → `$` prefix /
2 digits; KRW → `₩` prefix / 0 digits). L3 cells use `l3.displayCurrency || dispCcy`; other rows use the
report's `baseCurrency`.

### 2.6 States

- **Loading** — centered "Loading…" only when `loading && !report`.
- **Empty** — when `groups.length === 0 && !salesProfit`, 8 empty rows render so the chrome shows
  borders; `buildEmptyReport(baseCurrency)` keeps the matrix chrome up even before the first search.

---

## 3. Excel export structure (server-produced)

The frontend POSTs the column spec + filters; the backend `CashFlowExcelWriter` (POI XSSF) produces the
workbook. Structure (mirrors the legacy ExcelJS layout):

- **Row 1** — "Cash Flow" title, merged across all 17 columns.
- **Row 2** — subtitle `Year: <y> - Currency: <ccy> - Exchange Rate: <rate>`.
- **Rows 3–4** — two-row header: "Opening Balance" merged across cols 0–2 (rows 3–4), "Item code" /
  "Item name" in row 4, month headers Jan–Dec in row 3, Opening Balance amounts in row 4.
- **Columns** — L1, L2, L3-name, Item code, Item name, Jan–Dec (5 + 12 = **17**, no Total column on
  screen but `TOTAL_AMT` ships in the column registry for the sheet).
- **Body** — L1 cell merged vertically over its L3 rows; L2 cell merged over its children; empty L2 gets
  a placeholder row. Bands: blue subtotal (`E9EFFF`), green Sales Profit & NON SALES PROFIT (`E9F5EE`),
  **solid green End Balance** (`16A34A`, bold white). All data cells thin-bordered; amount cells
  `#,##0.##`, right-aligned; zero cells left blank.

### 3.1 Legacy parity (verify in SIT)

- Export matches the legacy report output (title / subtitle / 2-row header / merged L1-L2 / bands).
- **No duplicate NON SALES PROFIT row in the sheet** — the writer emits the NON SALES PROFIT band once
  (the *frontend matrix* shows blue + green by design, but the Excel grouper treats the ACC-03 subtotal
  as one band).
- **No empty row before End Balance** — the writer ends the body cleanly (the legacy ExcelJS had a
  `const endBalanceRow` redeclaration artifact that produced a spurious empty row; the refactor writer
  does not).
- Safe merge handling — vertical L1/L2 merges are guarded; empty L2 placeholders prevent zero-span merges.

> **Open PO call (G7):** the writer applies a generic `#,##0.##` to every amount cell; legacy used
> per-currency `[$-vi-VN]#,##0` (VND/KRW, no decimals) and `[$-de-DE]#,##0.00` (USD). Cell *values* are
> unaffected — only display format differs.

---

## 4. Typography / tokens

Report page; amount/label styling uses the shared `wb-*` tokens and `formatAmount`. The two inline-hex
exceptions are the End Balance solid green `#16a34a` (matrix sticky footer) and the Excel fills (server
side) — both report-specific, outside the Settings token rules.
