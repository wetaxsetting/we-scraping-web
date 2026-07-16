# Add-on Service > Sales e-Invoices — Frontend Summary (Root)

> ⚠️ **This document is a high-level feature summary.**
> The detailed source of truth is the module-folder documentation:
> [`docs/features/addon-service/sales-e-invoices/`](sales-e-invoices/README.md)
> (+ the implementation code under `components/addon/sales-einvoices/` and `lib/api/addon.ts`). When this summary and the folder docs/code disagree, the **folder docs and code win**.

**Module:** Add-on Service · **Feature slug:** `sales-e-invoices`
**Route:** `/addon/sales-einvoices` · **View Setting / export screenId:** `addon-sales-einvoices` (`SCREEN_IDS.ADDON_SALES_EINVOICES`)
**Menu permission code:** `addon-einvoices-sales` (see [menu-route-authorization.md](menu-route-authorization.md))
**Status:** ✅ **Wired** — live data with server-side keyword search, status filter, header-click sort, pagination; multi-currency footer totals; Print, Excel (list **and** with-details), and an Update modal all call live endpoints (verified 2026-06-02).
**JEX counterpart (read-only reference):** `einv_0001_001` with `einvType=1` (Sales / outbound).

---

## Purpose

`/addon/sales-einvoices` lists every e-invoice the company has **issued to its customers** (`DOC_TYPE='I'`). The finance team filters, sorts, exports, prints, and refreshes the list from the GDT. Sales and Expenses **share one page shell** (`<EInvoicesClient>` / `<EInvoicesPage>` / `<EInvoiceTable>`); only `type` (`SALES`/`EXPENSE`) and `translationPrefix` differ.

## Feature overview (all wired)

- **List** — server-side keyword search (`keyword`, 300 ms debounce), invoice-status dropdown filter, header-click sort (`useTableSort`), server-side pagination.
- **Multi-currency totals** — sibling footer table, one `<tr>` per currency.
- **Print** — shared `printReport` over the current rows.
- **Excel — list** — `useExcelExport` → `POST /api/v1/addon/einvoices/export`.
- **Excel — with details** — line-item-expanded XLSX → `POST /api/v1/addon/einvoices/export-details`.
- **Update** — `<UpdateEInvoiceModal>` (Settings / History + GDT re-pull UI); on completion bumps `refreshKey`.
- **No View Setting popover** — the page consumes View Setting data internally for export column metadata only; `addon-sales-einvoices` is an **export screenId**, not an in-page column-settings popover (IR-9).

## Route / menu / permission mapping

| Concern | Value |
|---|---|
| Route | `/addon/sales-einvoices` |
| Menu permission code | `addon-einvoices-sales` |
| Export / View Setting screenId | `addon-sales-einvoices` |
| Components | [`components/addon/sales-einvoices/`](../../../components/addon/sales-einvoices/) |
| API client | [`lib/api/addon.ts`](../../../lib/api/addon.ts) — `fetchEInvoices`, `scrapeEInvoices`, `scrapeEInvoiceDetails`, `fetchEInvoiceHistory`, `fetchEInvoiceDetailHistory` |
| Product gating | F + M only (H omits Add-on) |

## Current implementation status

✅ Wired end-to-end, no mock fallback. **One known gap:** the invoice-**status** filter is applied **client-side** (`matchInvoiceStatus` in [`lib/api/einvoiceStatus.ts`](../../../lib/api/einvoiceStatus.ts)) because the backend has no server-side `invoiceStatus` param yet (IR-4). A canonical English `status` value is sent forward-compatibly but currently ignored by the backend.

## Legacy list parity (2026-07-16)

Three list-column fixes to match the live legacy `einv_0001_000` grid (shared by the Expenses variant):

- **Date column** — header is **Date** (not "Date/Time") and shows the `ISSU_DT` calendar date **only**; the `REG_DTM[8..14]` time proxy is no longer rendered (legacy shows date only).
- **e-Invoice No.** — renders the full display number from `disp_doc_id` (e.g. `1C26TWV-237`), falling back to `einv_invoicesymbol` then `doc_id`. Previously showed only the bare serial symbol (`C26TWV`). Matches the backend export's `INVOICE_NO = firstNonBlank(dispDocId, symbol)`.
- **Invoice Status** — the stored Vietnamese `einv_invoicestatus` (e.g. `Hóa đơn mới`) is translated to the localized label (`Original`, …) via `matchInvoiceStatus` → `filter.status.*` i18n key, both in the sub-line under the invoice number and in the Invoice Status column (legacy `wb_get_invoice_status` parity). Unknown values fall back to the raw string. Colour token still derives from the raw value.

Frontend-only (`EInvoiceTable.tsx`, `EInvoiceStatusText.tsx`, `mapEInvoiceRow`); the wire already carried `disp_doc_id`.

## Detailed docs (source of truth)

[sales-e-invoices/](sales-e-invoices/README.md) — screen-flow · ui-specification · component-index · api-consumption · test-scenarios. **Backend counterpart:** [`wecms-api/.../sales-e-invoices/`](../../../../wecms-api/docs/features/addon-service/sales-e-invoices/README.md).

## Design history

The prior verbose "static UI" version of this file is preserved in git history; original design rationale (IR rules) lives in the backend planning doc.
