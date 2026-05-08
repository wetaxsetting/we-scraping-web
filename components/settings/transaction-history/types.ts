/**
 * Transaction History panel — Settings popup submenu (Figma 134:16546).
 *
 * Static UI types for the ERP transaction-history list. The panel surfaces
 * sync activity between WeCMS and the customer's ERP across four tabs (All
 * / WeCMS → ERP / ERP → WeCMS / Deleted) with the originating user and the
 * uploaded file. Backend wiring lands later.
 */

export type TransactionHistoryTabKey =
    | "all"
    | "wecms_to_erp"
    | "erp_to_wecms"
    | "deleted";

/** The narrow "Type" column value — also drives which tab a row belongs to. */
export type TransactionHistoryType =
    | "wecms_to_erp"
    | "erp_to_wecms"
    | "deleted";

/** Closed list of payment-type batches that can appear in the table. */
export type TransactionTypeKey =
    | "internal_scheduled_transfer"
    | "vendor_scheduled_payment"
    | "expense_scheduled_payment"
    | "payroll_scheduled_payment"
    | "overseas_scheduled_payment";

export type TransactionHistoryRow = {
    id: string;
    /** ISO date `YYYY-MM-DD`. The panel formats it for display. */
    date: string;
    /** Display time `HH:mm:ss`. */
    time: string;
    type: TransactionHistoryType;
    transactionType: TransactionTypeKey;
    fileName: string;
    user: string;
};

export type TransactionHistoryTabCounts = Record<TransactionHistoryTabKey, number>;
