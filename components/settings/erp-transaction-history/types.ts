/**
 * ERP Transaction History panel — Settings popup submenu (Figma 134:16546).
 *
 * Frontend in-memory types (camelCase semantic) — matches the Phase 2
 * backend DTO {@code ErpTrnsHistoryRow} translated through
 * {@code lib/api/mappers.ts}. The wire shape (snake_case) lives in
 * {@code lib/types/api.ts}.
 */

/** Direction-tab key. Tab is `"all"` for the cross-direction view, or
 *  one of the three direction codes for a single-direction filter. */
export type ErpDirection = "W" | "E" | "D";
export type ErpTransactionHistoryTabKey = "all" | ErpDirection;

/**
 * Transaction-type code — `"01"` through `"17"` per legacy
 * `wabooks.enums.ErpTypeCd`. Modelled as `string` (not an enum union) so
 * that backend can return any 2-digit code without a fragile client-side
 * whitelist; the dropdown renders a stable subset enforced via
 * {@link TRANSACTION_TYPE_CODES} below.
 */
export type ErpTransactionTypeCode = string;

/** Closed list of transaction-type codes the dropdown renders on the
 *  All / W / E tabs, in **legacy display order** — NOT numeric code
 *  order. Mirrors the hardcoded `<li>` sequence in legacy
 *  `comm_0219_001_view.jsp:229-304`. The HAENGSUNG-only Exchange Rate
 *  (`15`) is intentionally excluded here — legacy appends it last and
 *  only when `prdtType === 'H'` (jsp:307-315), so it lives in
 *  {@link HAENGSUNG_ONLY_TYPE_CODES} and is appended at render time. */
export const TRANSACTION_TYPE_CODES: ErpTransactionTypeCode[] = [
    "09", // Account Inquiry (VND)
    "10", // Account Inquiry (FCY)
    "01", // Transaction History (VND)
    "08", // Transaction History (FCY)
    "11", // Approval Result
    "16", // Internal Scheduled Transfer
    "17", // Internal Transfer Result
    "02", // Vendor Scheduled Payment
    "04", // Vendor Payment Result
    "03", // Expense Scheduled Payment
    "05", // Expense Payment Result
    "12", // Payroll Scheduled Payment
    "06", // Payroll Payment Result
    "13", // Overseas Payment Request
    "14", // Overseas Request Result
    "07", // Corporate Card Transactions
];

/** HAENGSUNG-only transaction-type code(s). Legacy renders Exchange
 *  Rate (`15`) last in the dropdown and ONLY when the tenant's product
 *  type is `H` (`comm_0219_001_view.jsp:307-315`,
 *  `loginUser.getPrdtType().getValue()`). Restored 2026-06-30 — the
 *  earlier OQ-2 "product-agnostic, show 15 to everyone" cutover was
 *  reverted to legacy behaviour at Sonny's direction. The frontend
 *  reads the product type via `isProductType(userStorage.get(), "H")`
 *  (signed JWT claim → `StoredUser.productType`); see
 *  `ErpTransactionHistoryFilters.tsx`. */
export const HAENGSUNG_ONLY_TYPE_CODES: ErpTransactionTypeCode[] = [
    "15", // Exchange Rate
];

/** Deleted-tab subset — the only universal legacy per-tab filter
 *  (`comm_0219_001.ts:482-511` runs this branch for ALL product types).
 *  Ordered to match the master display order above (16 precedes 02/03/
 *  12/13 in the legacy `<ul>`), since legacy show/hides `<li>`s within
 *  the single ordered list rather than rebuilding it. */
export const DELETED_TAB_TYPE_SUBSET: ErpTransactionTypeCode[] = [
    "16", // Internal Scheduled Transfer
    "02", // Vendor Scheduled Payment
    "03", // Expense Scheduled Payment
    "12", // Payroll Scheduled Payment
    "13", // Overseas Payment Request
];

/** Wire-aligned row shape — one row of the ERP transaction history list,
 *  ready for component consumption (camelCase). Translated from
 *  {@link import("@/lib/types/api").ApiErpTransactionHistoryRow} via
 *  {@code lib/api/mappers.ts}.
 */
export type ErpTransactionHistoryRow = {
    /** Composite-key sequence number — doubles as React key + download id. */
    seqNo: number;
    orgFileNm: string;
    saveFileNm: string;
    fileSize: number;
    erpType: ErpDirection;
    /** Server-resolved i18n key (`settings.erp_transaction_history.direction.*`).
     *  `null` only when the wire `erp_type` is outside the known set. */
    erpTypeKey: string | null;
    trnsTypeCd: ErpTransactionTypeCode;
    /** Server-resolved i18n key (`settings.erp_transaction_history.type.NN`).
     *  `null` when the code is outside the known 01..17 range. */
    trnsTypeKey: string | null;
    /** Raw `yyyyMMddHHmmss` — formatted at render time for the Date column. */
    regDtm: string;
    regId: string;
    /** Resolved `USER_INFM.USER_NM` via backend LEFT JOIN. `null` for
     *  `SYSTEM` writes or removed users — frontend falls back to {@link regId}. */
    userNm: string | null;
};

/** Tab counts surfaced alongside the page slice (server fan-out). */
export type ErpTransactionHistoryTabCounts =
    Record<ErpTransactionHistoryTabKey, number>;
