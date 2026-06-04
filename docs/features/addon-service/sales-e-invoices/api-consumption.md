# Sales e-Invoices — API Consumption

How the frontend talks to the backend. All calls go through `api` (Axios + JWT interceptor in [lib/axios.ts](../../../../lib/axios.ts)), unwrap the `ApiResponse<T>` envelope, and throw `ApiCallError` (carrying the WBE `status.code` + `trace_id`) on `status.error`. Wire JSON is lowercase snake_case; in-memory rows are camelCase (translated in [lib/api/mappers.ts](../../../../lib/api/mappers.ts)).

Backend contract: [../../../../../wecms-api/docs/features/addon-service/sales-e-invoices/interface-specification.md](../../../../../wecms-api/docs/features/addon-service/sales-e-invoices/interface-specification.md).

---

## 1. Endpoints consumed

| Function | Method + URL | Purpose |
|---|---|---|
| `fetchEInvoices(params)` ([lib/api/addon.ts](../../../../lib/api/addon.ts)) | `GET /api/v1/addon/einvoices` | list (filter/sort/paginate + totals) |
| (via `useExcelExport`) | `POST /api/v1/addon/einvoices/export` | list XLSX |
| (via `useExcelExport`) | `POST /api/v1/addon/einvoices/export-details` | line-item-expanded XLSX |

The scrape-intake (`POST .../scrape-results`, `.../scrape-detail-results`) and history (`GET .../history`, `.../detail-history`) endpoints exist backend-side; the `<UpdateEInvoiceModal>` is the intended trigger surface (the live GDT pull engine is out of refactor R&D scope).

## 2. Request params (list)

```ts
fetchEInvoices({
    type,            // "SALES"  (Expenses sends "EXPENSE")
    from,            // YYYYMMDD (required — last 30 days default)
    to,              // YYYYMMDD (required)
    keyword,         // 5-column server-side match (debounced 300 ms)
    status,          // canonical English status — forward-compat (backend IR-4 filter not live; FE post-filters)
    page,            // zero-based
    size,            // backend clamps to 100 (default 10)
    sortField,       // EInvoiceSortField FIELD_ID
    sortDirection,   // "ASC" | "DESC"
})
```

## 3. Wire types ([lib/types/api.ts](../../../../lib/types/api.ts))

```ts
interface ApiEInvoiceRow {
    doc_id: string; disp_doc_id: string;
    issu_dt: string; issu_tm: string;        // YYYYMMDD / HHmmss
    einv_invoicesymbol: string;
    trco_cmnm: string; trco_tax_id: string;  // buyer (Sales) / supplier (Expenses)
    trco_trsc_ccy_cd: string;
    totl_amt: string; sply_amt_sum: string; tax_amt_sum: string;  // decimal strings
    einv_invoicestatus: string;              // raw locale string
    einv_invoicestatus_bef: string | null;
    prov_stts: string | null; due_dt: string | null; over_due_days: string | null;
}
interface ApiEInvoiceCurrencyTotal {
    ccy_cd: string; count: number;
    amount: string; tax_amount: string; pretax_amount: string;
}
interface ApiEInvoiceListResponse {
    rows: ApiEInvoiceRow[];
    total_count: number; total_pages: number; page_number: number; page_size: number;
    totals: ApiEInvoiceCurrencyTotal[];
}
```

## 4. Mappers ([lib/api/mappers.ts](../../../../lib/api/mappers.ts))

```ts
mapEInvoiceRow(api): EInvoiceRow = {
    id:              api.doc_id,
    date:            formatLegacyDate(api.issu_dt),   // DD-MM-YYYY
    time:            formatLegacyTime(api.issu_tm),    // HH:mm:ss  (REG_DTM[8..14] proxy)
    invoiceNo:       api.einv_invoicesymbol ?? api.doc_id,
    invoiceType:     api.einv_invoicestatus ?? "",     // status sub-line under invoice no
    buyerName:       api.trco_cmnm ?? "",
    mstCode:         api.trco_tax_id ?? "",
    buyerStatus:     "",                                // placeholder (not yet on wire)
    currency:        coerceInvoiceCurrency(api.trco_trsc_ccy_cd),
    totalAmount:     api.totl_amt ?? "0",
    invoiceStatus:   api.einv_invoicestatus ?? "",      // raw — regex-matched for badge tint
    taxAmount:       api.tax_amt_sum ?? "0",
    amountBeforeTax: api.sply_amt_sum ?? "0",
};
mapEInvoiceTotal(api): EInvoiceCurrencyTotal = {
    currency: api.ccy_cd?.trim() ?? "", count: api.count ?? 0,
    total: api.amount ?? "0", taxAmount: api.tax_amount ?? "0", pretaxAmount: api.pretax_amount ?? "0",
};
```

## 5. State handling ([EInvoicesClient.tsx](../../../../components/addon/sales-einvoices/EInvoicesClient.tsx))

- `useApiData(fetchEInvoices(...), [type, fromDt, toDt, debouncedKeyword, wireStatus, page, pageSize, sortField, sortDirection, refreshKey])` — refetch on any dep.
- **Latched `stableData`** — last non-null response retained so rows/count/pagination don't flicker; `useStickyLoading(loading && !stableData)` gates first-load only.
- **Keyword debounce** 300 ms.
- **Status post-filter** — `visibleRows = statusKey === "all" ? allRows : allRows.filter(r => matchInvoiceStatus(r.invoiceStatus) === statusKey)`. Client-side until the backend ships the IR-4 `invoiceStatus` filter.
- **Export gates** — `exporting` + sticky disables Print/Excel during a download.

## 6. Validation

- Date range required (`from`/`to` always sent; default last 30 days).
- All other validation is server-authoritative; bad input returns a WBE code surfaced via the system dialog.

## 7. Error handling

- Non-401 errors surface once (deduped by code) via `useDialog({ type: "error", errorCode })`; 401 handled by the global Axios session-expired interceptor.
- "Excel with Details" failures surface the `ApiCallError.code` like any other export.
