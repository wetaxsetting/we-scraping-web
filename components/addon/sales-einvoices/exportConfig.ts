/**
 * Excel export column registry for Add-on Service > Sales / Bill
 * e-Invoices. Used by both the Sales and Bill variants — column set
 * mirrors the V45 View Setting seed verbatim and matches the backend's
 * {@code EInvoiceExportProvider.allowedFieldIds()} 8-column subset.
 *
 * <p>The column key is the View Setting {@code FIELD_ID} (uppercase
 * semantic key). The {@code headerKey} is i18n-prefix-relative — the
 * caller prepends the page-specific prefix ({@code sales_einvoices.}
 * or {@code expenses_einvoices.}) before passing it to {@code t(...)}.
 * Width values are conservative defaults sized so the spreadsheet is
 * immediately readable without manual resize; backend writer falls
 * back to View Setting {@code SIZE} when {@code widthChars} is omitted.
 */
import type { ApiScreenOptionItem } from "@/lib/types/api";
import type { ExcelExportColumnConfig } from "@/hooks/useExcelExport";

/**
 * Builds the column registry for a given page prefix. Both Sales and
 * Bill share the same column set; only the BUYER header label differs
 * (Buyer vs. Supplier) — the i18n layer handles that via the prefix.
 */
export function buildEInvoiceExportColumns(
    prefix: "sales_einvoices" | "expenses_einvoices",
): Record<string, ExcelExportColumnConfig> {
    const k = (suffix: string) => `${prefix}.${suffix}`;
    return {
        DATE_TIME: {
            headerKey: k("col.date_time"),
            format: "text",
            widthChars: 18,
        },
        INVOICE_NO: {
            headerKey: k("col.invoice_no"),
            format: "text",
            widthChars: 18,
        },
        // Buyer cell flattens to "<name> (MST: <tax-id>)" on the backend
        // (provider.toFieldMap composes the BUYER cell). Wider than the
        // on-screen 320px so the composite line doesn't truncate in
        // Excel without manual resize.
        BUYER: {
            headerKey: k("col.buyer"),
            format: "text",
            widthChars: 40,
        },
        CURRENCY: {
            headerKey: k("col.currency"),
            format: "text",
            widthChars: 8,
            align: "left",
        },
        TOTAL: {
            headerKey: k("col.total"),
            format: "amount",
            align: "right",
            widthChars: 22,
        },
        STATUS: {
            headerKey: k("col.status"),
            format: "text",
            widthChars: 16,
        },
        TAX: {
            headerKey: k("col.tax"),
            format: "amount",
            align: "right",
            widthChars: 22,
        },
        PRETAX: {
            headerKey: k("col.pretax"),
            format: "amount",
            align: "right",
            widthChars: 22,
        },
    };
}

/**
 * Hardcoded fallback {@link ApiScreenOptionItem} list mirroring the
 * V45 seed for {@code addon-sales-einvoices} / {@code addon-expenses-einvoices}.
 *
 * <p>Per IR-9 the Sales / Bill pages do NOT render the View Setting
 * popover, so they never fetch the live View Setting data via
 * {@code useViewSetting()}. The export hook still expects an
 * {@code items} array shaped like a View Setting response — we feed
 * it this fallback. The 8 visible columns (CHECKBOX is dropped server-
 * side via {@code ScreenOptionService.SPECIAL_FIELD_IDS}) match the
 * seed; backend re-intersects with the persisted seed visibility, so
 * even if this list drifts the export still emits exactly what the
 * server says is visible.
 */
export const EINVOICE_FALLBACK_COLUMNS: ApiScreenOptionItem[] = [
    { field_id: "DATE_TIME",  field_nm: "Date / Time",  disp_ord: 1, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "120px" },
    { field_id: "INVOICE_NO", field_nm: "Invoice No.",  disp_ord: 2, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "BUYER",      field_nm: "Buyer",        disp_ord: 3, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "320px" },
    { field_id: "CURRENCY",   field_nm: "Currency",     disp_ord: 4, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "80px"  },
    { field_id: "TOTAL",      field_nm: "Total",        disp_ord: 5, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "140px" },
    { field_id: "STATUS",     field_nm: "Status",       disp_ord: 6, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "120px" },
    { field_id: "TAX",        field_nm: "Tax",          disp_ord: 7, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "140px" },
    { field_id: "PRETAX",     field_nm: "Pre-tax",      disp_ord: 8, use_yn: "Y", fix_yn: "N", disp_yn: "Y", sort_yn: "Y", size: "140px" },
];
