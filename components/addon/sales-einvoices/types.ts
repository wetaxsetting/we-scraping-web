/**
 * Types for the Sales e-Invoices screen (Add-On Service module).
 * Field shape matches what the Spring Boot backend is expected to return
 * once the API endpoint lands — UI-pre-formatted strings for values the
 * server already formats (amounts), raw values for others.
 */

export type InvoiceStatus = "original" | "replacement" | "adjustment" | "cancelled";

export type InvoiceStatusTabKey = "all" | InvoiceStatus;

export type BuyerMstStatus =
    | "active"
    | "on_closing"
    | "suspended_incomplete";

export type EInvoiceRow = {
    id: string;
    /** Issue date in DD-MM-YYYY form (e.g. "05-12-2024"). */
    date: string;
    /** Issue time in HH:mm:ss form (e.g. "11:39:50"). */
    time: string;
    /** e-invoice serial number (e.g. "1C24TLM-0405"). */
    invoiceNo: string;
    /** Invoice type label shown under the number (Original, Replacement, etc). */
    invoiceType: string;
    buyerName: string;
    /** Vietnamese tax code — shown as `MST : {mstCode}` on a sub-row. */
    mstCode: string;
    /** Free-form buyer status shown next to the MST code (blue link style). */
    buyerStatus: string;
    currency: "VND" | "USD" | "KRW";
    /** UI-formatted total amount (e.g. "1.000.000"). */
    totalAmount: string;
    /** Invoice status shown in its own column (Original, Replacement, …). */
    invoiceStatus: string;
    taxAmount: string;
    amountBeforeTax: string;
};

export type EInvoiceCurrencyTotal = {
    /**
     * Currency code straight from the backend's `GROUP BY TRCO_TRSC_CCY_CD`
     * bucket — kept as a raw string (not the strict row union) because
     * legacy / hand-registered invoices may carry a NULL currency, which
     * the backend emits as its own bucket and the footer must render as a
     * distinct row from VND/USD/KRW.
     */
    currency: string;
    /** Transaction count for this currency bucket. */
    count: number;
    /**
     * Raw decimal grand total (wire string from the backend, e.g.
     * `"27475200.000000"`). Cell renderer formats via
     * {@link formatAmount} at display time.
     */
    total: string;
    /** Raw decimal sum of {@code TAX_AMT_SUM}. */
    taxAmount: string;
    /** Raw decimal sum of {@code SPLY_AMT_SUM} (amount before tax). */
    pretaxAmount: string;
};
