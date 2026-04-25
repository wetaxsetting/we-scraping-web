/**
 * Shared types for the payment list pages (Sprint 2). All Sprint 2 screens
 * (Scheduled / Result variants for Internal Transfer, Vendor, Expense,
 * Payroll, Overseas, plus Exchange Rate Inquiry and Card Transactions)
 * compose the same `<PaymentListPage>` template — column shape, currency
 * total shape, and search-result-status vocabulary live here so every page
 * follows the same contract.
 */

export type ResultStatus = "success" | "failed" | "pending" | "cancelled";

export type PaymentListColumn<Row> = {
    /** Unique key — also used as React `key` for the cell. */
    key: string;
    /** Already-translated header label. ReactNode to support icon+text composites (e.g. Remarks ⓘ). */
    label: React.ReactNode;
    /** Cell alignment — defaults to `left`. */
    align?: "left" | "right" | "center";
    /** CSS width for the `<col>` (e.g. `"160px"`, `"var(--w-wb-ap-amount)"`). */
    width: string;
    /**
     * Optional custom renderer. When omitted the cell renders `row[key]` as
     * plain text. Use for badges / multi-element cells (status pills, approver
     * + count, etc.).
     */
    render?: (row: Row) => React.ReactNode;
};

export type CurrencyTotal = {
    currency: string;
    total: string;
};
