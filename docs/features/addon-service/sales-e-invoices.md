# Add-on Service > Sales e-Invoices — Frontend Page Design

**Module:** Add-on Service
**Refactor screen ID (proposed):** `addon-sales-einvoices`
**JEX counterpart:** `einv_0001_001` (view) — `einvType=1` ⇒ Sales (outbound). Same JSP also drives `einvType=2` ⇒ Expenses (inbound).
**Feature spec:** [../../../../wecms-api/docs/features/addon-service/sales-e-invoices.md](../../../../wecms-api/docs/features/addon-service/sales-e-invoices.md)
**Status:** Static UI implemented; data fetch wired to a partial backend; filters / sort / pagination / Print / Excel / Update handlers NOT wired. **View Setting management UI is intentionally out of scope** for this page (IR-9) — the page consumes View Setting *data* internally for column metadata + Excel export, but renders no popover, no list-view toolbar icon, and no Update / Reset controls.

JEX is **read-only reference**.

> **Phase 2 implementation rules are locked.** See [planning § Phase 2 implementation rules (locked decisions)](../../../../wecms-api/docs/planning/addon/sales-e-invoices-plan.md#phase-2-implementation-rules-locked-decisions). Frontend implementation is approved to start. The relevant rules for this page are: IR-3 (always send `from`+`to`), IR-4 (consume raw `EINV_INVOICESTATUS` and apply regex-based display), IR-5 (debounced `keyword` over the simplified 5-column subset), IR-7 (drop `invoiceType` from `EInvoiceRow`/types/mapper and source the status sub-line from `invoiceStatus`), and **IR-9 (consume View Setting data internally; do NOT render the popover or add a list-view toolbar icon — the toolbar stays Print + Excel + Update)**.

---

## Route

```
/addon/sales-einvoices
```

- App Router file: [`app/(dashboard)/addon/sales-einvoices/page.tsx`](../../../../wecms-web/app/(dashboard)/addon/sales-einvoices/page.tsx)
- Auth: protected by the `(dashboard)` layout's client-side guard (`tokenStorage.get()` + `fetchMe()` on mount). The route inherits `<AppShell>` chrome — never re-mount Header / Sidebar per page.
- Sidebar / top-nav active state is auto-resolved from `usePathname()` against the declarative `addonGroups` config in [`<Sidebar>`](../../../../wecms-web/components/layout/Sidebar.tsx); no per-page override.
- Sister route (shares the page shell): `/addon/expenses-einvoices` (`type="EXPENSE"`, `translationPrefix="expenses_einvoices"`).

---

## Page layout structure

Standard menu page following the **Sales e-Invoices baseline** (one of the four canonical UI references in [wecms-web/CLAUDE.md § Approved reference set](../../../../wecms-web/CLAUDE.md)). Bottom layout follows the Approval Box `paginationWithTotals` pattern (CLAUDE.md §7a) — table + sibling-table footer share one scroll container, footer pinned via `mt-auto`, pagination outside the scroll container.

```
PageLayout
├── PageHeader
│     title          ← t("sales_einvoices.title")
│     children slot  ← <SalesEInvoiceActionBar /> (Print · Excel▾ · Update)
│
├── FilterRow
│     children       ← <InvoiceStatusFilter /> · <DateRangePicker />
│     right slot     ← <SearchInput />
│
└── DataTableShell  (footerMode="paginationWithTotals")
      table         ← <EInvoiceTable rows={filteredRows} translationPrefix=… />
      footer        ← <EInvoiceTableFooter totals={totals} className="mt-auto" />
      pagination    ← <Pagination className="shrink-0" totalLabel={t("common.showing_of", …)} />
```

Vertical stack inside the `<DataTableShell>` shared scroll container (CLAUDE.md §7a):

1. `<thead>` (sticky top, `bg-wb-bg-sidebar`, h `var(--h-wb-table-head)`)
2. `<tbody>` rows (h `var(--h-wb-table-row)` per row)
3. Flex spacer — `mt-auto` on the footer expands when rows don't fill the viewport
4. Sibling footer `<table>` rendering one `<tr>` per currency (VND + USD + …) — shares the main table's `<colgroup>` so amounts line up under their columns
5. Horizontal scrollbar (inside the shared scroll container; appears when content > `var(--w-wb-si-table-min)`)

Pagination row (`<Pagination>`) lives **outside** the scroll container, separated from the footer by `PageLayout`'s `gap-5` and pinned via `shrink-0`.

---

## Component breakdown

| File | Purpose |
|---|---|
| [`app/(dashboard)/addon/sales-einvoices/page.tsx`](../../../../wecms-web/app/(dashboard)/addon/sales-einvoices/page.tsx) | Thin App Router page — sets metadata, composes `<SalesEInvoicesPage>` |
| [`components/addon/sales-einvoices/SalesEInvoicesPage.tsx`](../../../../wecms-web/components/addon/sales-einvoices/SalesEInvoicesPage.tsx) | Sales-specific entry — wraps `<EInvoicesClient type="SALES" translationPrefix="sales_einvoices" />` |
| [`components/addon/sales-einvoices/EInvoicesClient.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoicesClient.tsx) | Client wrapper shared with the Expenses sibling. Calls `fetchEInvoices(type)` via `useApiData`, maps `ROWS` / `TOTALS` through [`mapEInvoiceRow`](../../../../wecms-web/lib/api/mappers.ts) / `mapEInvoiceTotal`, computes pagination state, passes everything down to `<EInvoicesPage>` |
| [`components/addon/sales-einvoices/EInvoicesPage.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoicesPage.tsx) | Shared page shell — owns the in-memory `search` state, the `useMemo` filter, the `<DataTableShell>` composition |
| [`components/addon/sales-einvoices/EInvoiceTable.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoiceTable.tsx) | `<thead>` + `<tbody>` only. 8 columns; multi-line cells for Date/Time, Invoice No., Buyer (composite); right-aligned numeric cells for Total / Tax / Pre-tax |
| [`components/addon/sales-einvoices/EInvoiceTableFooter.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoiceTableFooter.tsx) | Sibling `<table>` via `<DataTableFooter>` — one `<tr>` per currency. Reuses the same colgroup as the main table |
| [`components/addon/sales-einvoices/EInvoiceTableColumns.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoiceTableColumns.tsx) | Shared `<colgroup>` keyed by `--w-wb-si-*` width tokens. `EINVOICE_COLUMN_COUNT = 8` |
| [`components/addon/sales-einvoices/InvoiceStatusFilter.tsx`](../../../../wecms-web/components/addon/sales-einvoices/InvoiceStatusFilter.tsx) | Dropdown trigger — thin wrapper around shared `<FilterDropdown>`. **No popover wired today** (see TODO) |
| [`components/addon/sales-einvoices/SalesEInvoiceActionBar.tsx`](../../../../wecms-web/components/addon/sales-einvoices/SalesEInvoiceActionBar.tsx) | Page-specific toolbar (Figma 9194:6859) — Print + Excel-with-chevron + Update. Diverges intentionally from the shared `<PageActionButtons>` |
| [`components/addon/sales-einvoices/types.ts`](../../../../wecms-web/components/addon/sales-einvoices/types.ts) | TS types: `EInvoiceRow`, `EInvoiceCurrencyTotal`, `InvoiceStatus`, `BuyerMstStatus` |
| `mockData.ts` (removed Sprint 1 — Needs Confirmation if still referenced) | Static seed mirroring Figma node 9194:6696. **Not used at runtime** (Sprint 1 stripped the fallback) — kept for screenshot/Figma reference |
| [`lib/api/addon.ts`](../../../../wecms-web/lib/api/addon.ts) | `fetchEInvoices(type)` Axios wrapper (UPPER_SNAKE → camelCase via mapper) |
| [`lib/api/mappers.ts`](../../../../wecms-web/lib/api/mappers.ts) | `mapEInvoiceRow`, `mapEInvoiceTotal`, `coerceInvoiceCurrency` |

Shared shell components consumed (never rebuilt per page): [`<PageLayout>`](../../../../wecms-web/components/shared/PageLayout.tsx), [`<PageHeader>`](../../../../wecms-web/components/shared/PageHeader.tsx), [`<FilterRow>`](../../../../wecms-web/components/shared/FilterRow.tsx), [`<FilterDropdown>`](../../../../wecms-web/components/shared/FilterDropdown.tsx), [`<DateRangePicker>`](../../../../wecms-web/components/shared/DateRangePicker.tsx), [`<SearchInput>`](../../../../wecms-web/components/shared/SearchInput.tsx), [`<DataTableShell>`](../../../../wecms-web/components/shared/DataTableShell.tsx), [`<DataTableFooter>`](../../../../wecms-web/components/shared/DataTableFooter.tsx), [`<Pagination>`](../../../../wecms-web/components/shared/Pagination.tsx), [`<TableHeaderCell>`](../../../../wecms-web/components/shared/TableHeaderCell.tsx).

---

## Filter UI behaviour

### 1. Invoice status (`<InvoiceStatusFilter>`)

- **Today:** dropdown trigger renders the static label `t("sales_einvoices.filter.status.all")`. Clicking does nothing — the `onClick` prop is unwired.
- **Option set** (in `mockData.ts → invoiceStatusFilterOptions`): `all` · `Original` · `Replacement` · `Adjustment` · `Cancelled`. **Legacy actually has 6 logical statuses** — `Replaced` and `Adjusted` are missing from the static UI option list. The frontend should expand to 6 options once the localisation parity decision lands (see "Refactor target" below).
- **Refactor target:**
  - Build (or reuse) a shared `<FilterPopover>` keyed by the trigger's anchor rect.
  - Selection emits the chosen logical status up to `<EInvoicesClient>`, which forwards it as the `invoiceStatus` query param on the next fetch.
  - Wire shape depends on the **`EINV_INVOICESTATUS` localisation strategy** (TBD in Phase 2):
    - If the backend ports `wb_get_invoice_status` and applies it server-side → frontend sends the locale-resolved string (matches legacy behaviour where the dropdown sends the Vietnamese form).
    - If the backend emits a canonical key (`ORIGINAL` / `REPLACEMENT` / `ADJUSTMENT` / `REPLACED` / `ADJUSTED` / `CANCELLED`) → frontend sends the canonical key.
    - If the regex matching lives frontend-side → frontend translates display labels via i18n and sends the value the backend stores.
  - Selection resets pagination to `page=0` (call `usePagination().resetPage()` per CLAUDE.md §4).
  - Width fixed via `--w-wb-si-status-filter`.

### 2. Date range (`<DateRangePicker>`)

- **Today:** displays a hardcoded default range `05-Jan-2025 → 30-Jan-2025` (set in `<EInvoicesClient>`). Display-only — no calendar popover.
- **Legacy parity — `from` / `to` are REQUIRED.** Legacy `validateInput` rejects requests without `FROM_DT` and `TO_DT`. The frontend must always supply a non-empty range.
- **Refactor target:**
  - Adopt the product-wide picker contract (Approval Box / Transaction History track this — gated on the picker becoming interactive). When ready, the picker emits `{ start, end }` ISO dates which the wrapper translates to legacy `YYYYMMDD` for the wire `from` / `to` params.
  - Default range — TBD with PO (last 30 days · current month · current fiscal year). **See the open question in the planning doc.**
  - Reset to `page=0` on change.

### 3. Keyword search (`<SearchInput>`)

- **Today:** in-memory `useState<string>` filter inside `<EInvoicesPage>`. The `useMemo` runs case-insensitive partial match against the joined string of `invoiceNo`, `buyerName`, `mstCode`, `invoiceStatus`, `invoiceType`. No debounce, no wire roundtrip.
- **The current in-memory composite is wrong vs legacy.** Verified against [`SearchHelper.java#L89-L193`](../../../../WECMS%20DEV/WECMS/src/wabooks/helper/SearchHelper.java):
  - Legacy search is **View-Setting-driven**: only the user's currently-visible columns participate.
  - Sales-side whitelist is 16 `FIELD_ID`s with **per-field predicate variation** (text partial match, exact match, date equality, numeric equality):
    - **Text partial match (`ilike '%' || ? || '%'`)** — `DOC_ID`, `TRCO_CMNM`, `TRCO_NICK_NM`, `DOC_NO`, `USAG_NM`, `USER_NM`, `CONT`, `DOC_TITLE`, `REG_NM`, `PRJT_NM`, `NOTE` — most go through `wb_get_translate_text(...)` for accent + case folding (Vietnamese-aware).
    - **Exact match (`ilike ?`, no wildcards)** — `TRCO_TAX_ID`.
    - **Date equality (`ISSU_DT = ?`)** — `ISSU_DT`, after `StringUtils.forSearcDate` normalisation.
    - **Numeric equality (`= cast(? as NUMERIC)`)** — `TOTL_AMT`, `TAX_AMT_SUM`, `SPLY_AMT_SUM`. Forces no-match when input isn't numeric.
  - **`EINV_INVOICESTATUS`, `EINV_INVOICESYMBOL`, and `INV_TYPE` are NOT searchable** in legacy. The static UI's "search by status / serial / invoice type" is wrong.
- **Refactor target:**
  - Lift the search value into `<EInvoicesClient>`.
  - Debounce 300 ms (mirror Account Inquiry).
  - Forward as the `keyword` query param on the wire (`SRCH_WD` in legacy).
  - Drop the in-memory `useMemo` filter once the wire path lands — the backend is the authority.
  - Reset to `page=0` on change.
  - **Backend (Phase 2 task #7) must decide:** replicate legacy View-Setting walk verbatim, ship a fixed Phase-2 subset, or hybrid; and whether to port `wb_get_translate_text` for accent folding. Whatever the backend does, the frontend simply forwards the `keyword` string.

---

## Table rendering logic

The table is a bare `<table>` + shared `<colgroup>` per CLAUDE.md §7a (footer pattern). 8 columns, no checkbox column today (the View Setting `CHECKBOX` special row is part of the proposed seed but is NOT yet rendered).

Body cells use Tailwind text tokens only (`text-wb-13` / `font-medium` / `font-normal` / `text-wb-ink` / `text-wb-muted` / `text-brand-hover`). No inline `style`, no `text-[Npx]`. Per [§5 / Table typography](../../../../wecms-web/CLAUDE.md), header + body share the 13 px size; header is `font-semibold`, body is `font-medium`.

| Column | Cell composition (see `<EInvoiceTable>`) |
|---|---|
| **Date / Time** | Two stacked spans — `row.date` (ink) + `row.time` (muted). **`row.time` is a refactor-only proxy** sliced from `REG_DTM[8..14]` (registration time, NOT issue time). Legacy doesn't expose any issue-time field. |
| **e-Invoice No.** | Two stacked spans — `row.invoiceNo` (ink, normal weight, sourced from `EINV_INVOICESYMBOL`) + `row.invoiceType` (`text-brand-hover`, blue accent). **`row.invoiceType` is misnamed** — it carries an `EINV_INVOICESTATUS` value (e.g. `Original`), NOT the legacy `INV_TYPE` ('Commercial' / 'Tax' classifier). When refactoring, rename to `row.invoiceStatusLabel` or surface via a single `EINV_INVOICESTATUS` field shared with the Status column. |
| **Buyer** | Two stacked spans — `row.buyerName` (truncated) + composite `MST : {mstCode}` followed by `row.buyerStatus` in `text-brand-hover`. The `mst_label` translation key carries the prefix |
| **Currency** | `row.currency` text (`VND` / `USD` / `KRW`) |
| **Total** | `row.totalAmount` right-aligned |
| **Status** | `row.invoiceStatus` text. Badge tint comes from regex matching the localised `EINV_INVOICESTATUS` (legacy TS `loadTextColorInvBillOut`) — `Original` = blue, `Replacement` / `Adjustment` / `Replaced` / `Adjusted` = green, `Cancelled` = red. **NOT driven by the `COLOR` field** (`COLOR` is a per-doc memo sticker CSS class, default `"white"`, unrelated to status). |
| **Tax** | `row.taxAmount` right-aligned |
| **Pre-tax** | `row.amountBeforeTax` right-aligned |

Sub-line typography:

- Account-style sub-lines (Buyer's MST + status, Invoice No.'s type sub-line) follow the §8b "table cell composition" rule — placement, order, gap, and weight match Figma node 9194:6696.
- The Buyer cell **deliberately renders the Vietnamese full-text MST status** (e.g. `NNT ngừng hoạt động nhưng chưa hoàn thành thủ tục chấm dứt hiệu lực MST`) verbatim — it's a compliance flag, not a styled badge.

Empty / null amount values today render the raw backend string (`"0"`). Refactor target — render `"-"` for `null` / empty (parity with Account Inquiry per CLAUDE.md). Numeric formatting goes through the shared [`formatAmount`](../../../../wecms-web/lib/currency.ts) helper once the wire returns raw decimals.

### Sort

- **Today:** every header renders the inactive sort glyph but no `onSort` is wired.
- **Refactor target:** adopt the shared [`useTableSort()`](../../../../wecms-web/hooks/useTableSort.ts) hook per CLAUDE.md §13a. Pass `sortField` / `sortDirection` / `toggleSort` from `<EInvoicesClient>` down. Migrate the headers to `<TableHeaderCell sortFieldId="DATE_TIME" …>` etc. Backend whitelist enum (`EInvoiceSortField`) supplies the wire `FIELD_ID → entity property` mapping. Default sort: `ISSU_DT DESC, REG_DTM DESC` (legacy parity).

---

## Pagination behaviour

**Today (presentational only):**

- `<EInvoicesClient>` computes `pageCount = Math.max(1, Math.ceil(totalCount / pageSize))` with `pageSize = 5` hardcoded and `page = 1` hardcoded.
- `totalCount` falls back to `rows.length` when `data.TOTAL_COUNT` is missing.
- `<Pagination>` renders the page-size dropdown, prev/next arrows, and `{shown} of {total}` label — but **none of the controls are wired**. Clicking page-size or arrows does nothing.

**Refactor target (mirror Account Inquiry):**

- Adopt the shared [`usePagination()`](../../../../wecms-web/components/shared/Pagination.tsx) hook per CLAUDE.md §4. Default `pageSize = 10`. Options: `[10, 20, 50, 100]` (`PAGE_SIZE_OPTIONS`). Backend clamps to `MAX_PAGE_SIZE = 100`.
- Filter `onChange` handlers (search, status, date range) call `resetPage()` per the §4 rule.
- `<EInvoicesClient>` forwards `page` / `size` query params to the backend; backend returns Spring Data `Page<EInvoiceRow>`.
- Multi-currency totals are computed by a sibling unpaged aggregation query so they stay stable across pagination — see the backend API doc.
- Excel export bypasses pagination (`Pageable.unpaged()`).

---

## Button actions: Update, Excel, Print

All three live in [`<SalesEInvoiceActionBar>`](../../../../wecms-web/components/addon/sales-einvoices/SalesEInvoiceActionBar.tsx) (Figma 9194:6859). The component accepts handler props but **none are wired** today.

### Print

- **Asset:** `/assets/common/ico-print.svg` at `size-5`. `aria-label = t("common.print")`.
- **Refactor target:** route through the shared [`printReport({ title, summary, columns, rows })`](../../../../wecms-web/lib/print.ts) helper per CLAUDE.md §6d.
  - `title` = `t("sales_einvoices.title")`
  - `summary` = the per-currency total line(s) currently shown in the footer
  - `columns` = Date/Time · e-Invoice No. · Buyer · Currency · Total · Status · Tax · Pre-tax (no Status badge — render plain text)
  - `rows` = the page-level filtered, in-memory dataset BEFORE pagination (mirror Account Inquiry `printAllTable`)
  - Default landscape (the table is 8 columns wide).

### Excel (with chevron dropdown)

- **Asset:** `/assets/common/ico-excel.svg` at `size-5` + lucide `<ChevronDown>` (`size-5`, `text-wb-ink`, `strokeWidth=2`) inside a `bg-wb-bg-sidebar` chip.
- **Today:** the chevron renders but the dropdown menu is undesigned (Figma 9194:6859 shows the chevron without a defined options panel).
- **Refactor target:** route through the shared [`useExcelExport()`](../../../../wecms-web/hooks/useExcelExport.ts) hook per CLAUDE.md §13b.
  - `endpoint = "/api/v1/addon/einvoices/export"` (TBD — backend Phase 2 task #10)
  - `screenId = "addon-sales-einvoices"`
  - `dymAreaId = "default"`
  - `fileName` from `t("sales_einvoices.export_title")` + `_DDMMYYYY` suffix
  - `title` from `t("sales_einvoices.title")` (in-sheet row 0; date suffix MUST NOT appear here)
  - `items` = live View Setting `vs.items` (drops `CHECKBOX` / `ETC` via `isSpecialViewSettingField`)
  - `columnConfig` = per-page registry (`DATE_TIME` text, `INVOICE_NO` text, `BUYER` text, `CURRENCY` text, `TOTAL/TAX/PRETAX` amount, `STATUS` text)
  - `filters` = `{ type, from, to, invoiceStatus, keyword }`
  - `sort` = current `sortParams` from `useTableSort()`
- **Chevron-dropdown semantics — TBD with PO/Designer.** Likely: "Download visible columns" (default) vs "Download all columns" — the latter posts the same endpoint with `columns: []` to indicate "all allowed FIELD_IDs".

### Update

- **Asset:** raised button with lucide `<RotateCw>` icon (`size-5`, `text-brand`, `strokeWidth=2`) + `t("common.update")` label, `bg-white` + `shadow-wb-btn`.
- **Legacy semantics:** "Update" pulls fresh e-invoice data from the GDT (Vietnamese tax authority) via the NXISAS bridge (`nxisas_einvoice_c001/c002`, `nxisas_einvhis_*`). **Out of refactor R&D scope** per `project_refactoring_scope.md` (no bank/tax-authority integration in local R&D).
- **Refactor target — Phase 1 (R&D scope):** wire to a `refreshKey++` state bump → re-fires `useApiData(...)`'s loader (refetches `GET /api/v1/addon/einvoices` with current filters). Tooltip the button so the local-only behaviour is explicit.
- **Refactor target — Phase 2 (deferred):** if/when the refactor adopts a GDT bridge, swap the handler to call the new pull endpoint. Page shape does not change.

---

## Data binding expectations

Wire path (server → page):

```
Spring  GET /api/v1/addon/einvoices?type=SALES&from=…&to=…&invoiceStatus=…&keyword=…&page=…&size=…&sortField=…&sortDirection=…
        → COMMON_HEAD + REC: { ROWS[], TOTAL_COUNT, TOTALS[] }   (current shape)
        → COMMON_HEAD + REC: { ROWS[], TOTAL_COUNT, TOTAL_PAGES, PAGE_NUMBER, PAGE_SIZE, TOTALS[] }   (target shape)

lib/api/addon.ts → fetchEInvoices(type, params)
        ↓ unwraps ApiResponse envelope, throws ApiCallError on COMMON_HEAD.ERROR=true

EInvoicesClient
        ↓ data.ROWS.map(mapEInvoiceRow)        → rows: EInvoiceRow[]
        ↓ data.TOTALS.map(mapEInvoiceTotal)    → totals: EInvoiceCurrencyTotal[]
        ↓ data.TOTAL_COUNT                     → totalCount

EInvoicesPage
        ↓ in-memory keyword filter  (will move server-side)
        ↓ <EInvoiceTable rows={filteredRows} /> + <EInvoiceTableFooter totals={totals} />
```

The wire JSON is UPPER_SNAKE today (`DOC_ID`, `ISSU_DT`, `TRCO_CMNM`, `EINV_INVOICESTATUS`, …) — driven by `@JsonProperty` annotations on the Spring DTOs `EInvoiceListResponse` + `EInvoiceRow` + `CurrencyTotal`. The frontend mapper translates UPPER_SNAKE → camelCase for the React component shape (`row.invoiceNo` etc.). This is the project's standard pattern; do not alter.

**Today's frontend column → wire field mapping** (per `mapEInvoiceRow`):

| TS field | Wire field | Notes |
|---|---|---|
| `id` | `DOC_ID` | |
| `date` | `ISSU_DT` (legacy `YYYYMMDD`) | Formatted via `formatLegacyDate` to `DD-MM-YYYY` |
| `time` | `ISSU_TM` (`HHmmss`) | Formatted via `formatLegacyTime` to `HH:mm:ss`. **Refactor-only proxy** — sliced from `REG_DTM[8..14]` server-side. Legacy doesn't expose any issue-time field. |
| `invoiceNo` | `EINV_INVOICESYMBOL` (fallback `DOC_ID`) | |
| `invoiceType` | `INV_TYPE` | **Mock-only / misnamed.** The mock seeds `Original` / `Replacement` / `Adjustment` here, but those values belong to `EINV_INVOICESTATUS`. The refactor wire DOES carry `INV_TYPE` today, populated from `BUSA_DOC_MSTR.INV_TYPE` (single-char) — but the legacy IDO computed it as `'Commercial'` (when `'C'`) / `'Tax'` (otherwise) and the legacy WSVC drops it. Recommendation: stop using `INV_TYPE` for the status sub-line; pull the sub-line from `EINV_INVOICESTATUS` instead. |
| `buyerName` | `TRCO_CMNM` | |
| `mstCode` | `TRCO_TAX_ID` | Vietnamese tax code |
| `buyerStatus` | (not yet on wire) | TODO — backend should expose `COMPANYSTATUS` |
| `currency` | `TRCO_TRSC_CCY_CD` | Coerced to `VND` \| `USD` \| `KRW` via `coerceInvoiceCurrency` |
| `totalAmount` | `TOTL_AMT` | Pre-formatted string today (`"1.000.000"`); will become raw decimal once backend amount-formatting moves to display layer |
| `invoiceStatus` | `EINV_INVOICESTATUS` | Localised string (vi/en/ko); legacy resolves via `wb_get_invoice_status(value, LANG_CD)`. Refactor DB function + Java replication strategy is open — see "Invoice status meaning" in the feature spec. |
| `taxAmount` | `TAX_AMT_SUM` | |
| `amountBeforeTax` | `SPLY_AMT_SUM` | |

`mapEInvoiceTotal` reads `CCY_CD` / `COUNT` / `AMOUNT` from the `TOTALS[]` element.

**Empty-state guard:** when `data.ROWS` is empty, the table renders zero rows. Today there's **no empty-state placeholder** (`No results` message) — TODO, mirror Approval Box.

**Mock fallback:** Sprint 1 stripped the `mockData.ts` fallback from `<EInvoicesClient>`. The mock file is retained for screenshot/Figma reference but is NOT used at runtime. Bringing it back is forbidden — empty wire = empty table.

---

## i18n keys

All keys live under the `sales_einvoices.*` prefix in `locales/{en,ko,vi}.json`. KM (Khmer) is NOT yet translated (product-wide gap).

| Key | Used in |
|---|---|
| `sales_einvoices.title` | `<PageHeader>` title + Excel in-sheet row 0 (when wired) |
| `sales_einvoices.export_title` *(proposed — not yet present)* | Excel filename base (no inner space; `_DDMMYYYY` suffix appended at runtime) |
| `sales_einvoices.filter.invoice_status` | `<InvoiceStatusFilter>` aria-label |
| `sales_einvoices.filter.status.all` / `.original` / `.replacement` / `.adjustment` / `.cancelled` | Status dropdown options |
| `sales_einvoices.col.date_time` / `.invoice_no` / `.buyer` / `.currency` / `.total` / `.status` / `.tax` / `.pretax` | Column header labels |
| `sales_einvoices.mst_label` | Buyer cell — `MST : {code}` interpolation |
| `sales_einvoices.total_label` | Footer `Total ({currency})` row label |
| `sales_einvoices.transaction_count` | Footer `{count} transaction(s)` count |

Common keys consumed: `common.print`, `common.export_excel`, `common.update`, `common.search`, `common.showing_of`.

---

## Related frontend files

**Owned by this feature:**

- `app/(dashboard)/addon/sales-einvoices/page.tsx`
- `components/addon/sales-einvoices/SalesEInvoicesPage.tsx`
- `components/addon/sales-einvoices/EInvoicesClient.tsx` *(shared with Expenses)*
- `components/addon/sales-einvoices/EInvoicesPage.tsx` *(shared with Expenses)*
- `components/addon/sales-einvoices/EInvoiceTable.tsx`
- `components/addon/sales-einvoices/EInvoiceTableColumns.tsx`
- `components/addon/sales-einvoices/EInvoiceTableFooter.tsx`
- `components/addon/sales-einvoices/InvoiceStatusFilter.tsx`
- `components/addon/sales-einvoices/SalesEInvoiceActionBar.tsx`
- `components/addon/sales-einvoices/types.ts`
- `components/addon/sales-einvoices/mockData.ts` *(reference seed; not runtime-active)*

**Sister page (Expenses):**

- `app/(dashboard)/addon/expenses-einvoices/page.tsx`
- `components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx`
- `components/addon/expenses-einvoices/mockData.ts`

**Shared library / API client:**

- `lib/api/addon.ts` — `fetchEInvoices(type)`
- `lib/api/mappers.ts` — `mapEInvoiceRow`, `mapEInvoiceTotal`, `coerceInvoiceCurrency`, `formatLegacyDate`, `formatLegacyTime`
- `lib/api/useApiData.ts` — `useApiData()` hook
- `lib/axios.ts` — `api` Axios instance + JWT interceptor + 401 handler
- `lib/print.ts` — shared print pipeline (consume when wiring Print)
- `lib/excel.ts` — shared Excel pipeline (consume when wiring Excel)
- `hooks/useExcelExport.ts` — shared Excel export hook (consume when wiring Excel)
- `hooks/useTableSort.ts` — shared sort hook (consume when wiring sort)
- `lib/viewSettingScreens.ts` — `SCREEN_IDS` registry — **add** `ADDON_SALES_EINVOICES = "addon-sales-einvoices"` here when wiring View Setting
- `components/shared/view-setting/` — `useViewSetting` is consumed for column metadata (drives `<colgroup>` widths, column visibility/order, Excel-export column set). **`<ViewSettingPopover>` is NOT rendered on this page** per IR-9 — the popover, list-view icon, and Update / Reset UI are out of scope for the Sales e-Invoices toolbar.

**Tokens (CSS):**

- `app/globals.css` — `--w-wb-si-datetime`, `--w-wb-si-invoice-no`, `--w-wb-si-buyer`, `--w-wb-si-currency`, `--w-wb-si-total`, `--w-wb-si-status`, `--w-wb-si-tax`, `--w-wb-si-pretax`, `--w-wb-si-table-min`, `--w-wb-si-status-filter`

---

## Cross-references

- Feature spec: [../../../../wecms-api/docs/features/addon-service/sales-e-invoices.md](../../../../wecms-api/docs/features/addon-service/sales-e-invoices.md)
- Backend API: [../../backend/addon/sales-e-invoices-api.md](../../../../wecms-api/docs/references/api-spec/addon/sales-e-invoices-api.md)
- Database: [../../database/addon/sales-e-invoices-db.md](../../../../wecms-api/docs/references/database/addon/sales-e-invoices-db.md)
- Migration mapping: [../../migration/service-mapping.md](../../../../wecms-api/docs/references/migration/service-mapping.md)
- Implementation plan: [../../planning/addon/sales-e-invoices-plan.md](../../../../wecms-api/docs/planning/addon/sales-e-invoices-plan.md)
