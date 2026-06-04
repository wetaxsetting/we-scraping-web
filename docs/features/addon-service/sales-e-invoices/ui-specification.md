# Sales e-Invoices — UI Specification

Figma node 9194:6696 (table) / 9194:6859 (toolbar). One of the four approved UI references in [wecms-web/CLAUDE.md § Approved reference set](../../../../CLAUDE.md). Page composes `PageLayout → PageHeader → FilterRow → DataTableShell` (`footerMode="paginationWithTotals"`). Source: [EInvoicesPage.tsx](../../../../components/addon/sales-einvoices/EInvoicesPage.tsx).

---

## 1. Layout

```
PageLayout
├── PageHeader  title = t("sales_einvoices.title")  "Sales e-Invoices"
│     children → <SalesEInvoiceActionBar />   (Print · Excel▾ · Update)
├── FilterRow
│     children  → <InvoiceStatusFilter /> · <DateRangeFilter />
│     right     → <SearchInput />
└── DataTableShell footerMode="paginationWithTotals"
      table     → <EInvoiceTable>  (8 columns, shared <colgroup>)
      footer    → <EInvoiceTableFooter className="mt-auto">  (one <tr> per currency)
      pagination→ <Pagination className="shrink-0">  (outside scroll container)
```

The footer is a sibling `<table>` reusing [`<EInvoiceTableColumns>`](../../../../components/addon/sales-einvoices/EInvoiceTableColumns.tsx) so totals align under their columns. `min-w-[var(--w-wb-si-table-min)]` (1340px) governs horizontal scroll.

## 2. Toolbar — `<SalesEInvoiceActionBar>`

Page-specific (the shared `PageActionButtons` trio doesn't match — documented divergence, Figma 9194:6859). Order: **Print · Excel** (icon + chevron dropdown) · **Update** (raised brand CTA).

- Print/Excel icons: `/assets/common/ico-print.svg`, `/assets/common/ico-excel.svg` at `size-5`.
- Excel chevron opens a 2-row dropdown: **Download Excel with List** + **Download Excel with Details**.
- `exporting` disables Excel; the Update button opens `<UpdateEInvoiceModal>`.

## 3. Filters

| Control | Behaviour |
|---|---|
| Invoice-status dropdown | [`<InvoiceStatusFilter>`](../../../../components/addon/sales-einvoices/InvoiceStatusFilter.tsx) popover (All / Original / Replacement / Adjustment / Cancelled). Selection drives a **client-side** post-filter (`matchInvoiceStatus`) until the backend ships the IR-4 status param. Width `--w-wb-si-status-filter` (168px). |
| Date range | `<DateRangeFilter>` — preset or manual chips; default last 30 days; emits `from`/`to` (`YYYYMMDD`). |
| Keyword search | [`<SearchInput>`](../../../../components/shared/SearchInput.tsx) right slot; 300 ms debounce → wire `keyword` (5-column server-side match). |

## 4. Table columns

8 columns, View-Setting-driven (the page walks `vs.items` / `FALLBACK_COLUMNS` from [exportConfig.ts](../../../../components/addon/sales-einvoices/exportConfig.ts)). The View Setting **popover is not rendered** (IR-9 — no list-view toolbar icon); the data feeds column metadata + Excel column intersection only.

| # | FIELD_ID | Header key | Width token | Cell |
|---|---|---|---|---|
| 1 | (checkbox) | — | — | row-select checkbox |
| 2 | `DATE_TIME` | `sales_einvoices.col.date_time` | `--w-wb-si-datetime` | two-line: `date` (ink) + `time` (muted) — time is a `REG_DTM[8..14]` proxy |
| 3 | `INVOICE_NO` | `sales_einvoices.col.invoice_no` | `--w-wb-si-invoice-no` | two-line: `invoiceNo` (ink) + status sub-line (`invoiceType`, brand-hover) |
| 4 | `BUYER` | `sales_einvoices.col.buyer` | `--w-wb-si-buyer` | `buyerName` + `MST : {mstCode}` + `buyerStatus` (brand-hover) |
| 5 | `CURRENCY` | `sales_einvoices.col.currency` | `--w-wb-si-currency` | `currency` (VND/USD/KRW) |
| 6 | `TOTAL` | `sales_einvoices.col.total` | `--w-wb-si-total` | `totalAmount`, right-aligned via `formatAmount` |
| 7 | `STATUS` | `sales_einvoices.col.status` | `--w-wb-si-status` | [`<EInvoiceStatusText>`](../../../../components/addon/sales-einvoices/EInvoiceStatusText.tsx) — coloured text |
| 8 | `TAX` | `sales_einvoices.col.tax` | `--w-wb-si-tax` | `taxAmount`, right-aligned |
| 9 | `PRETAX` | `sales_einvoices.col.pretax` | `--w-wb-si-pretax` | `amountBeforeTax`, right-aligned |

Body text `text-wb-13 font-medium`; header via `<TableHeaderCell textSizeClass="text-wb-13">` with a sort glyph on every column.

## 5. Status display rules

[`<EInvoiceStatusText>`](../../../../components/addon/sales-einvoices/EInvoiceStatusText.tsx) renders the raw `invoiceStatus` string with a tint derived by `matchInvoiceStatus(value)` ([lib/api/einvoiceStatus.ts](../../../../lib/api/einvoiceStatus.ts)) — a Vietnamese/English/Korean-aware regex returning a logical key:

| Logical key | Tone |
|---|---|
| `original` | `text-wb-status-progress-text` (blue) |
| `replacement` / `adjustment` / `replaced` / `adjusted` | `text-wb-status-pending-text` (green/amber) |
| `cancelled` | `text-wb-status-rejected-text` (red) |
| `other` | `text-wb-ink` (fallback) |

The badge tint is **NOT** driven by the legacy `COLOR` field (memo-sticker class) — that field is not consumed.

## 6. Footer totals

[`<EInvoiceTableFooter>`](../../../../components/addon/sales-einvoices/EInvoiceTableFooter.tsx) renders one `<tr>` per `EInvoiceCurrencyTotal`: `Total ({currency})` label + `{count} transaction(s)` + total / tax / pre-tax aligned under their columns. NULL currency preserved as `""`.

## 7. Update modal — `<UpdateEInvoiceModal>`

shadcn modal (stackLevel 1). Date range picker + Settings / History buttons + per-variant progress card ("Sales e-Invoice") + GDT re-pull CTA + auto-close checkbox. On a successful run fires `onScraped()` → parent `refreshKey++`. The live GDT pull engine (NXISAS) is out of refactor R&D scope.

## 8. i18n keys (EN / KO / VI; KM not yet)

`sales_einvoices.title`, `.empty`, `.export_title`, `.export_details_not_implemented`, `.mst_label`, `.total_label`, `.transaction_count`, `.filter.invoice_status`, `.filter.status.{all,original,replacement,adjustment,cancelled}`, `.col.{date_time,invoice_no,buyer,currency,total,status,tax,pretax}`. Common: `common.{loading,showing_of,print,export_excel,update,download_excel_with_list,download_excel_with_details,excel_details_suffix}`.

## 9. Responsive

Standard menu-page behaviour — table scrolls horizontally below `--w-wb-si-table-min` (1340px); filter row wraps; sidebar drawer < lg. Verify 375 / 768 / 1024 / 1440.
