# Sales e-Invoices — Screen Flow

Route `/addon/sales-einvoices`. Page: `app/(dashboard)/addon/sales-einvoices/page.tsx` → [`<SalesEInvoicesPage>`](../../../../components/addon/sales-einvoices/SalesEInvoicesPage.tsx) → [`<EInvoicesClient type="SALES" translationPrefix="sales_einvoices">`](../../../../components/addon/sales-einvoices/EInvoicesClient.tsx) → [`<EInvoicesPage>`](../../../../components/addon/sales-einvoices/EInvoicesPage.tsx). Auth + chrome inherited from the `(dashboard)` layout; sidebar active state auto-resolves from `usePathname()` against `addonGroups`. The Expenses route reuses this exact client with `type="EXPENSE"`.

---

## 1. Load & list

1. `<EInvoicesClient>` owns server-side state: `keyword`/`debouncedKeyword` (300 ms), invoice-status filter key, date range (default last 30 days), `page` (zero-based), `pageSize` (default 10), sort (`useTableSort` seeded `DATE_TIME`/`DESC`), `refreshKey`.
2. `useApiData(() => fetchEInvoices({ type, from, to, keyword, status, page, size, ...sortParams }), [type, fromDt, toDt, debouncedKeyword, wireStatus, page, pageSize, sortField, sortDirection, refreshKey])` fires on mount and on any dep change.
3. The latest non-null response is **latched** (`stableData`) so chrome doesn't flicker between refetches; `useStickyLoading` gates the first-load message only.
4. `data.rows.map(mapEInvoiceRow)` → camelCase `EInvoiceRow[]`; `data.totals.map(mapEInvoiceTotal)` → `EInvoiceCurrencyTotal[]`; `data.total_count` / `total_pages` / `page_number` / `page_size` drive pagination.

## 2. Filter & search

- **Invoice-status dropdown** ([`<InvoiceStatusFilter>`](../../../../components/addon/sales-einvoices/InvoiceStatusFilter.tsx)) — popover with All / Original / Replacement / Adjustment / Cancelled. Selecting resets `page` to 0.
  - **Status filtering is still client-side** (the backend has no `invoiceStatus` filter param yet — IR-4). `visibleRows = allRows.filter(r => matchInvoiceStatus(r.invoiceStatus) === statusKey)` using `matchInvoiceStatus` from [lib/api/einvoiceStatus.ts](../../../../lib/api/einvoiceStatus.ts). A canonical English form is also sent forward-compat as the wire `status` param.
- **Date range** (`<DateRangeFilter>`) — preset (last 30/90/180 days) or manual chips; default last 30 days. `onChange` recomputes ISO → `YYYYMMDD` wire `from`/`to` and resets `page` to 0.
- **Keyword search** ([`<SearchInput>`](../../../../components/shared/SearchInput.tsx), right slot) — immediate input value; 300 ms debounce into `debouncedKeyword` for the wire `keyword`. Resets `page` to 0. Server-side 5-column match.

## 3. Sort

- `useTableSort()` cycles `default → ASC → DESC → default` per column; `<TableHeaderCell>` renders the glyph. All 8 columns are sortable (`DATE_TIME`, `INVOICE_NO`, `BUYER`, `CURRENCY`, `TOTAL`, `STATUS`, `TAX`, `PRETAX`).
- Sort happens **server-side** — `sortParams` is spread into the fetch; no client-side `Array.sort`. Backend validates against `EInvoiceSortField`.

## 4. Pagination

- Shared [`<Pagination>`](../../../../components/shared/Pagination.tsx) outside the scroll container, `footerMode="paginationWithTotals"` (the footer row carries the per-currency totals). Display page = `page + 1`; page-size change resets `page` to 0.

## 5. Update (GDT re-pull) modal

Toolbar "Update" → opens [`<UpdateEInvoiceModal variant="SALES">`](../../../../components/addon/sales-einvoices/UpdateEInvoiceModal.tsx):

```
[Update modal] date range picker · Settings · History buttons · per-variant progress card · auto-close checkbox
   │ on completion → onScraped()
   ▼
parent refreshKey++ → useApiData refetch → list refreshes
```

The modal is the WeCMS-side trigger for the GDT scrape intake (`POST .../einvoices/scrape-results` / `scrape-detail-results` exist backend-side). The live NXISAS/GDT pull engine is out of refactor R&D scope, so the modal's in-browser "fetch from GDT" trigger is the remaining wiring; closing the modal discards its local state and a successful run refreshes the list.

## 6. Export & Print

- **Excel — with List** → `handleExportExcel` → `useExcelExport()` with `endpoint: /api/v1/addon/einvoices/export`, `screenId: addon-sales-einvoices`, current `items` (View Setting fallback columns), `columnConfig` (from [exportConfig.ts](../../../../components/addon/sales-einvoices/exportConfig.ts)), `filters: { type, from, to, keyword }`, translated `sort`. Filename `${sales_einvoices.title} ${common.excel_details_suffix?}`… in-sheet title `sales_einvoices.title`.
- **Excel — with Details** → `handleExportDetails` → same hook, `endpoint: /api/v1/addon/einvoices/export-details` (line/fee/tax expansion server-side).
- **Print** → `handlePrint` → shared `printReport` over the visible (status-filtered) in-memory rows, 8 columns minus checkbox.
- All gated by `exporting` + `useStickyLoading` so the chrome can't double-trigger.

## 7. Loading / empty / error

| State | Behaviour |
|---|---|
| First load | `loading && !stableData` → centered `common.loading` in the table body. |
| Empty result | centered `sales_einvoices.empty` ("No Data Found"). |
| Refetch (filter/sort/page) | previous rows stay visible via `stableData` — no flicker. |
| Error | non-401 backend errors surface once (dedup by code) via `useDialog({ type: "error", errorCode })`; 401 handled by the global Axios interceptor. |
