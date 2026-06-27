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
    // 9-column legacy-parity set (production SALES E-INVOICE_*.xls):
    // Date | e-Invoice No. | Buyer's Name | Tax Code | Currency
    //      | Total Amount | Invoice Status | Tax Amount | Amount Before Tax.
    // Buyer name + tax code are SEPARATE columns (was one composite BUYER
    // cell). Amount columns use `format:"number"` so the backend writer's
    // NUMBER style (#,##0, zero-decimal) is applied, matching the
    // production integer amount format (AMOUNT would render #,##0.##).
    // Widths mirror the production column `wch` values.
    return {
        DATE: {
            headerKey: k("col.date"),
            format: "text", // backend ships pre-formatted dd-MM-yyyy text
            widthChars: 16,
        },
        INVOICE_NO: {
            headerKey: k("col.invoice_no"),
            format: "text",
            widthChars: 19,
        },
        BUYER_NAME: {
            headerKey: k("col.buyer_name"),
            format: "text",
            widthChars: 61,
        },
        TAX_CODE: {
            headerKey: k("col.tax_code"),
            format: "text",
            widthChars: 21,
        },
        CURRENCY: {
            headerKey: k("col.currency"),
            format: "text",
            widthChars: 15,
            align: "left",
        },
        TOTAL: {
            headerKey: k("col.total"),
            format: "number",
            align: "right",
            widthChars: 20,
        },
        STATUS: {
            headerKey: k("col.status"),
            format: "text",
            widthChars: 20,
        },
        TAX: {
            headerKey: k("col.tax"),
            format: "number",
            align: "right",
            widthChars: 18,
        },
        PRETAX: {
            headerKey: k("col.pretax"),
            format: "number",
            align: "right",
            widthChars: 25,
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
    { field_id: "DATE",       field_nm: "Date",               disp_ord: 1, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "120px" },
    { field_id: "INVOICE_NO", field_nm: "e-Invoice No.",      disp_ord: 2, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "BUYER_NAME", field_nm: "Buyer's Name",       disp_ord: 3, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "440px" },
    { field_id: "TAX_CODE",   field_nm: "Tax Code",           disp_ord: 4, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "150px" },
    { field_id: "CURRENCY",   field_nm: "Currency",           disp_ord: 5, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "110px" },
    { field_id: "TOTAL",      field_nm: "Total Amount",       disp_ord: 6, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "140px" },
    { field_id: "STATUS",     field_nm: "Invoice Status",     disp_ord: 7, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "140px" },
    { field_id: "TAX",        field_nm: "Tax Amount",         disp_ord: 8, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "130px" },
    { field_id: "PRETAX",     field_nm: "Amount Before Tax",  disp_ord: 9, use_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "180px" },
];
