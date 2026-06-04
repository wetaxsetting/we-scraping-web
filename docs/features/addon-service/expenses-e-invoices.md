> ⚠️ **Design-history document — status claims are stale.** The consolidated, code-accurate frontend docs now live in **[expenses-e-invoices/](expenses-e-invoices/README.md)** (which documents the deltas over the shared [sales-e-invoices/](sales-e-invoices/README.md) shell). This file describes the page as "static UI; handlers NOT wired" and flags the `EXPENSE → 'E'` backend bug — both are stale: the page is wired (`type=EXPENSE`) and the backend maps `EXPENSE → 'B'`. Read this file for original design rationale; read the folder for current behaviour.

# Add-on Service > Expenses e-Invoices — Frontend Page Design

**Module:** Add-on Service
**Refactor screen ID (proposed):** `addon-expenses-einvoices`
**JEX counterpart:** `einv_0001_001` (view) — `einvType=2` ⇒ Expenses (inbound). Same JSP also drives `einvType=1` ⇒ Sales (outbound).
**Feature spec:** expenses-e-invoices.md _(wecms-api backend repo — not included in this clone)_
**Sister page (primary doc — most rules are inherited):** [sales-e-invoices-page.md](sales-e-invoices.md)
**Status:** Static UI implemented as a thin variant wrapper around the shared Sales shell. Data fetch wired to the shared backend; filters / sort / pagination / Print / Excel / Update handlers NOT wired. **View Setting management UI is intentionally out of scope** (IR-9).

JEX is **read-only reference**.

> **Inherits Phase 2 implementation rules from the Sales planning doc** — see Sales § Phase 2 implementation rules (locked decisions) _(wecms-api backend repo — not included in this clone)_. IR-1 through IR-9 apply verbatim with the obvious substitutions (`type=EXPENSE`, `DOC_TYPE='B'`, `dymId='table2'`, `WEB_SVC_ID='addon-expenses-einvoices'`, `translationPrefix='expenses_einvoices'`, `BUYER` column header rendered as "Supplier"). The Expenses page contributes only data + an entry wrapper; everything else is inherited from the shared shell.

---

## Route

```
/addon/expenses-einvoices
```

- App Router file: `app/(dashboard)/addon/expenses-einvoices/page.tsx` — thin (`metadata` + `<ExpensesEInvoicesPage />`).
- Auth, shell, sidebar / top-nav active state — all inherited from `(dashboard)/layout.tsx` and the shared `<AppShell>` per CLAUDE.md. **No per-page override.**
- Sister route (shares the page shell): `/addon/sales-einvoices` (`type="SALES"`, `translationPrefix="sales_einvoices"`).

---

## Page layout structure

Identical to Sales — every layout decision lives in the shared [`<EInvoicesPage>`](../../../../wecms-web/components/addon/sales-einvoices/EInvoicesPage.tsx). Per CLAUDE.md §7a, forking the shell is forbidden.

```
PageLayout
├── PageHeader
│     title          ← t("expenses_einvoices.title")
│     children slot  ← <SalesEInvoiceActionBar /> (Print · Excel▾ · Update — name lies; shared)
│
├── FilterRow
│     children       ← <InvoiceStatusFilter /> · <DateRangePicker />
│     right slot     ← <SearchInput />
│
└── DataTableShell  (footerMode="paginationWithTotals")
      table         ← <EInvoiceTable rows={filteredRows} translationPrefix="expenses_einvoices" />
      footer        ← <EInvoiceTableFooter totals={totals} className="mt-auto" />
      pagination    ← <Pagination className="shrink-0" totalLabel={t("common.showing_of", …)} />
```

Vertical stack inside `<DataTableShell>`, multi-currency footer behaviour, scroll container — all the same as Sales. See [Sales § Page layout structure](sales-e-invoices.md#page-layout-structure) for the canonical breakdown.

---

## Component reuse

The Expenses page contributes **two files**. Everything else is consumed verbatim from the Sales folder / shared layer.

| File | Owner | Purpose |
|---|---|---|
| `app/(dashboard)/addon/expenses-einvoices/page.tsx` | Expenses | Thin App Router page — sets metadata, composes `<ExpensesEInvoicesPage>` |
| [`components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx`](../../../../wecms-web/components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx) | Expenses | Thin variant entry — `<EInvoicesClient type="EXPENSE" translationPrefix="expenses_einvoices" />`. **Two lines of meaningful code.** |
| `mockData.ts` (removed Sprint 1 — Needs Confirmation if still referenced) | Expenses | Static seed (Vietnamese supplier names, `2C24SUPP-*` invoice serials). **Not used at runtime** (Sprint 1 stripped the fallback) — kept for screenshot/Figma reference |
| [`components/addon/sales-einvoices/EInvoicesClient.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoicesClient.tsx) | **Shared** (despite the folder name) | Client wrapper. Calls `fetchEInvoices("EXPENSE")` via `useApiData`, maps `ROWS` / `TOTALS`, passes everything to `<EInvoicesPage>` |
| [`components/addon/sales-einvoices/EInvoicesPage.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoicesPage.tsx) | **Shared** | Page shell — owns the in-memory `search` state, the `useMemo` filter, the `<DataTableShell>` composition |
| [`components/addon/sales-einvoices/EInvoiceTable.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoiceTable.tsx) | **Shared** | `<thead>` + `<tbody>`. Reads `translationPrefix` to label the BUYER column as "Supplier" for Expenses |
| [`components/addon/sales-einvoices/EInvoiceTableFooter.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoiceTableFooter.tsx) | **Shared** | Sibling `<table>` via `<DataTableFooter>`, multi-currency rows |
| [`components/addon/sales-einvoices/EInvoiceTableColumns.tsx`](../../../../wecms-web/components/addon/sales-einvoices/EInvoiceTableColumns.tsx) | **Shared** | `<colgroup>` keyed by `--w-wb-si-*` width tokens |
| [`components/addon/sales-einvoices/InvoiceStatusFilter.tsx`](../../../../wecms-web/components/addon/sales-einvoices/InvoiceStatusFilter.tsx) | **Shared** | Dropdown trigger |
| [`components/addon/sales-einvoices/SalesEInvoiceActionBar.tsx`](../../../../wecms-web/components/addon/sales-einvoices/SalesEInvoiceActionBar.tsx) | **Shared** (name lies — used by both pages; rename in a follow-up MR) | Page-specific toolbar (Print · Excel▾ · Update) |
| [`components/addon/sales-einvoices/types.ts`](../../../../wecms-web/components/addon/sales-einvoices/types.ts) | **Shared** | TS types: `EInvoiceRow`, `EInvoiceCurrencyTotal`, `InvoiceStatus`, `BuyerMstStatus` |

**Hooks (shared infrastructure):** `useApiData`, `usePagination` (CLAUDE.md §4), `useTableSort` (§13a), `useExcelExport` (§13b), `useViewSetting` (§13). Phase 2 wires all of them via the shared `<EInvoicesClient>` — Expenses gets every adoption for free.

**Helpers (shared):** `printReport`, `exportExcel`, `formatAmount`, `formatLegacyDate`, `formatLegacyTime`, `mapEInvoiceRow`, `mapEInvoiceTotal`, `coerceInvoiceCurrency`. Same set as Sales.

**Per [§ Common Reusability Rule](../../../../wecms-web/CLAUDE.md), no Expenses-folder copy of any shared file is allowed.** If a reviewer sees [`components/addon/expenses-einvoices/`](../../../../wecms-web/components/addon/expenses-einvoices/) gaining anything beyond the entry wrapper + mock seed, it is a regression.

---

## Key differences vs Sales

Two semantic differences and one column-header relabel — nothing else.

| Aspect | Sales | Expenses |
|---|---|---|
| `type` query param | `SALES` | **`EXPENSE`** |
| Backend `DOC_TYPE` (legacy correct) | `'I'` | **`'B'`** (NOT `'E'` — current Spring code is wrong; see Sales planning IR-1 _(wecms-api backend repo — not included in this clone)_) |
| `translationPrefix` | `sales_einvoices` | `expenses_einvoices` |
| Counterparty column header | "Buyer" (`t("sales_einvoices.col.buyer")`) | **"Supplier"** (`t("expenses_einvoices.col.supplier")`) |
| Counterparty cell `MST :` prefix key | `sales_einvoices.mst_label` | `expenses_einvoices.mst_label` |
| Compliance angle | Output VAT, GDT issuance to buyer | **Input VAT credit** — supplier MST status (`COMPANYSTATUS = 'NNT ngừng hoạt động …'`) flags potential VAT credit denial |
| Refactor `screenId` | `addon-sales-einvoices` | `addon-expenses-einvoices` |
| Excel filename base (i18n key) | `sales_einvoices.export_title` | `expenses_einvoices.export_title` |

The underlying entity field for the counterparty column is `TRCO_CMNM` either way — only the rendered column header text differs. The cell composition (name + MST + status) is the **same `<BuyerCell>` component in `<EInvoiceTable>`** — Expenses does NOT introduce a `<SupplierCell>`.

**Open question (PO):** whether the View Setting `FIELD_ID` should be `BUYER` (reuses Sales seed key, header text comes only from i18n) or `SUPPLIER` (separate seed key, clearer for cross-screen analytics). Both spellings are technically valid (PK is `(WEB_SVC_ID, FIELD_ID)`, no collision). See feature spec.

---

## Filter UI behaviour

Identical wire contract and component instances to Sales — see [Sales § Filter UI behaviour](sales-e-invoices.md#filter-ui-behaviour). Expenses-specific notes:

### 1. Invoice status (`<InvoiceStatusFilter>`)

- Same shared component, same option set, same six-state vocabulary, same localisation strategy (IR-4 — frontend regex resolves stored value to canonical key + badge tint).
- Dropdown labels resolved through `expenses_einvoices.filter.status.*` — keys exist for `all` / `original` / `replacement` / `adjustment` / `cancelled`. **`replaced` and `adjusted` are missing in the static UI** — same gap as Sales; expand to all six when the localisation parity decision lands.

### 2. Date range (`<DateRangePicker>`)

- Same shared display-only picker. **`from` / `to` are REQUIRED** per IR-3 (legacy `validateInput` rejects requests without them).
- Default range — TBD with PO; same open question as Sales.

### 3. Keyword search (`<SearchInput>`)

- Today: in-memory `useMemo` filter — same wrong composite as Sales (`invoiceNo + buyerName + mstCode + invoiceStatus + invoiceType`). `EINV_INVOICESTATUS` and `EINV_INVOICESYMBOL` are NOT searchable in legacy.
- Refactor target (Phase 2 / IR-5): debounced 300 ms `keyword` query param, server-side OR-clause across the fixed 5-column subset (`DOC_ID`, `TRCO_CMNM`, `TRCO_TAX_ID`, `EINV_INVOICESYMBOL`, `DOC_NO`).
- **Verify the `dymId='table2'` whitelist** in `SearchHelper.java` _(external reference — not included in this repository)_ before the seed migration lands. If the legacy Expenses whitelist diverges from `'table1'`, document the delta — the Phase 2 5-column subset is the same either way for Phase 2.

---

## Table rendering logic

Identical to Sales — see [Sales § Table rendering logic](sales-e-invoices.md#table-rendering-logic) for the full cell-by-cell breakdown. Expenses-specific deltas:

| Column | Cell composition (same `<EInvoiceTable>`, Expenses delta only) |
|---|---|
| **Date / Time** | Same — `row.date` (ink) + `row.time` (muted, refactor-only proxy from `REG_DTM[8..14]`) |
| **e-Invoice No.** | Same — `row.invoiceNo` (sourced from `EINV_INVOICESYMBOL`, e.g. `2C24SUPP-1101` for Expenses mock) + `row.invoiceType` (misnamed — carries `EINV_INVOICESTATUS`; will be renamed in IR-7) |
| **Supplier** (was Buyer) | Same `<BuyerCell>`. Header label resolved from `expenses_einvoices.col.supplier` → "Supplier" (en) / "공급자" (ko) / "Nhà cung cấp" (vi). MST sub-line uses `expenses_einvoices.mst_label`. Cell content order, gap, weight, and the brand-tinted `buyerStatus` text are unchanged — per CLAUDE.md §8b "table cell composition" rule. |
| **Currency / Total / Status / Tax / Pre-tax** | Identical. |

**Compliance flag rendering — Expenses is the page where `COMPANYSTATUS = 'NNT ngừng hoạt động nhưng chưa hoàn thành thủ tục chấm dứt hiệu lực MST'` matters most.** The cell renders the Vietnamese full text verbatim per CLAUDE.md §8b. This is NOT styled as a controlled-vocabulary badge — it's a free-form GDT-supplied string. Treating it any other way (truncating, abbreviating, mapping to an enum) breaks the compliance signal.

### Sort

Same shared `useTableSort()` hook, same `EInvoiceSortField` whitelist enum, same default sort `ISSU_DT DESC, REG_DTM DESC`. Sort field IDs: `DATE_TIME`, `INVOICE_NO`, `BUYER` (header label "Supplier" but the wire `FIELD_ID` is still `BUYER` per the open PO question), `CURRENCY`, `TOTAL`, `STATUS`, `TAX`, `PRETAX`.

---

## Pagination behaviour

Identical to Sales — same shared `<Pagination>` + `usePagination()` adoption (Phase 2). Default `pageSize=10`, options `[10, 20, 50, 100]`, max `100`. Filter `onChange` calls `resetPage()`. Multi-currency totals computed unpaged (IR-6). Excel export bypasses pagination (`Pageable.unpaged()`).

See [Sales § Pagination behaviour](sales-e-invoices.md#pagination-behaviour).

---

## Button actions: Update, Excel, Print

All three live in the shared `<SalesEInvoiceActionBar>` (name lies — used by both pages). Identical handler design to Sales. Expenses-specific deltas:

### Print

- Shared `printReport({ title, summary, columns, rows })` per CLAUDE.md §6d.
  - `title` = `t("expenses_einvoices.title")`
  - `summary` = per-currency total line(s) from the footer
  - `columns` = Date/Time · e-Invoice No. · **Supplier** (header from `expenses_einvoices.col.supplier`) · Currency · Total · Status · Tax · Pre-tax (no checkbox; render Status badge as plain text)
  - `rows` = page-level filtered, in-memory dataset BEFORE pagination
  - Default landscape

### Excel (with chevron dropdown)

- Shared `useExcelExport()` hook per §13b.
  - `endpoint = "/api/v1/addon/einvoices/export"` — **shared with Sales**
  - `screenId = "addon-expenses-einvoices"` — **differs from Sales**
  - `dymAreaId = "default"`
  - `fileName` from `t("expenses_einvoices.export_title")` + `_DDMMYYYY` suffix
  - `title` from `t("expenses_einvoices.title")` (in-sheet row 0; date suffix MUST NOT appear here)
  - `items` = live View Setting `vs.items` for the Expenses screen id
  - `columnConfig` = same FIELD_IDs as Sales; only the `BUYER`/`SUPPLIER` `headerKey` flips to the Expenses translation prefix
  - `filters` = `{ type: "EXPENSE", from, to, invoiceStatus, keyword }` — **`type=EXPENSE` is critical**; if missing, the request body's `type` falls through and the export returns Sales data (silent regression). Phase 4 testing must verify this.
  - `sort` = current `sortParams` from `useTableSort()`
- Chevron-dropdown semantics — TBD (same open question as Sales).

### Update

- Same Phase 1 wire: `refreshKey++` → re-fires `useApiData(...)` against `GET /api/v1/addon/einvoices?type=EXPENSE`.
- Phase 2 (deferred): GDT-pull endpoint — out of refactor R&D scope.

---

## Data binding expectations

Wire path (server → page) — same shape as Sales, only `type` differs:

```
Spring  GET /api/v1/addon/einvoices?type=EXPENSE&from=…&to=…&invoiceStatus=…&keyword=…&page=…&size=…&sortField=…&sortDirection=…
        → COMMON_HEAD + REC: { ROWS[], TOTAL_COUNT, TOTALS[] }   (current shape)
        → COMMON_HEAD + REC: { ROWS[], TOTAL_COUNT, TOTAL_PAGES, PAGE_NUMBER, PAGE_SIZE, TOTALS[] }   (target shape)

lib/api/addon.ts → fetchEInvoices("EXPENSE", params)
        ↓ unwraps ApiResponse envelope, throws ApiCallError on COMMON_HEAD.ERROR=true

EInvoicesClient (shared)
        ↓ data.ROWS.map(mapEInvoiceRow)        → rows: EInvoiceRow[]
        ↓ data.TOTALS.map(mapEInvoiceTotal)    → totals: EInvoiceCurrencyTotal[]
        ↓ data.TOTAL_COUNT                     → totalCount

EInvoicesPage (shared)
        ↓ in-memory keyword filter  (will move server-side)
        ↓ <EInvoiceTable rows={filteredRows} translationPrefix="expenses_einvoices" /> + <EInvoiceTableFooter totals={totals} />
```

Wire JSON is UPPER_SNAKE on the response (driven by `@JsonProperty`); `mapEInvoiceRow` translates to camelCase for React. The translation layer is shared with Sales — never fork the mapper.

**Today's frontend column → wire field mapping** is identical to Sales (per `mapEInvoiceRow`). Expenses-specific notes:

- `invoiceNo` carries supplier-issued serials (typical pattern `2C24SUPP-*` in the mock; real shape per the supplier's GDT registration — no client-side formatting).
- `buyerName` / `mstCode` / `buyerStatus` carry the **supplier's** name / MST / GDT status (the field names are legacy holdovers — `TRCO_CMNM`/`TRCO_TAX_ID`/`COMPANYSTATUS` describe the counterparty regardless of direction).
- `currency` is dominated by VND in real data; USD/KRW exist in the seed for footer-multi-currency demonstration.

**Empty wire = empty table.** Same as Sales. Plus an Expenses-specific risk: until the IR-1 `EXPENSE → 'B'` fix lands, the wire is **always empty** because the local DEV seed carries no `DOC_TYPE='E'` rows. The static screenshot match comes from the mock seed in `mockData.ts` (removed Sprint 1 — Needs Confirmation if still referenced), which is not used at runtime — bringing it back as a fallback is forbidden (would mask the bug).

---

## i18n keys

All keys live under the `expenses_einvoices.*` prefix in `locales/{en,ko,vi}.json`. KM (Khmer) is NOT yet translated.

| Key | Used in |
|---|---|
| `expenses_einvoices.title` | `<PageHeader>` title + Excel in-sheet row 0 (when wired) |
| `expenses_einvoices.export_title` *(proposed — confirm in i18n MR)* | Excel filename base |
| `expenses_einvoices.filter.invoice_status` | `<InvoiceStatusFilter>` aria-label |
| `expenses_einvoices.filter.status.all` / `.original` / `.replacement` / `.adjustment` / `.cancelled` | Status dropdown options |
| `expenses_einvoices.col.date_time` / `.invoice_no` / **`.supplier`** / `.currency` / `.total` / `.status` / `.tax` / `.pretax` | Column header labels — **`supplier`** is the Expenses-specific delta (Sales is `.buyer`) |
| `expenses_einvoices.mst_label` | Supplier cell — `MST : {code}` interpolation |
| `expenses_einvoices.total_label` | Footer `Total ({currency})` row label |
| `expenses_einvoices.transaction_count` | Footer `{count} transaction(s)` count |

Common keys consumed: `common.print`, `common.export_excel`, `common.update`, `common.search`, `common.showing_of`. Same as Sales.

---

## Related frontend files

**Owned by this feature (Expenses-folder):**

- `app/(dashboard)/addon/expenses-einvoices/page.tsx`
- `components/addon/expenses-einvoices/ExpensesEInvoicesPage.tsx`
- `components/addon/expenses-einvoices/mockData.ts` *(reference seed; not runtime-active)*

**Sister page (Sales) — owns the shared shell, table, footer, columns, filter, action bar, types, mockData:**

- See [Sales § Related frontend files](sales-e-invoices.md#related-frontend-files)

**Shared library / API client:** identical set as Sales. Add `SCREEN_IDS.ADDON_EXPENSES_EINVOICES = "addon-expenses-einvoices"` to [`lib/viewSettingScreens.ts`](../../../../wecms-web/lib/viewSettingScreens.ts) when wiring View Setting (Phase 2).

**Tokens (CSS):** identical set — same `--w-wb-si-*` widths, same `--w-wb-si-table-min` minimum width. Reuse, do not duplicate.

---

## Cross-references

- Feature spec: expenses-e-invoices.md _(wecms-api backend repo — not included in this clone)_
- Sister page (primary doc — most rules inherited): [sales-e-invoices-page.md](sales-e-invoices.md)
- Backend API: expenses-e-invoices-api.md _(wecms-api backend repo — not included in this clone)_
- Database: expenses-e-invoices-db.md _(wecms-api backend repo — not included in this clone)_
- Migration mapping: service-mapping.md _(wecms-api backend repo — not included in this clone)_
- Implementation plan: expenses-e-invoices-plan.md _(wecms-api backend repo — not included in this clone)_
- Sales planning rules (IR-1 through IR-9 inherited): sales-e-invoices-plan.md _(wecms-api backend repo — not included in this clone)_
