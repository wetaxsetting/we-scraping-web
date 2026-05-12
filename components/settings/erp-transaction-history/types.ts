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

/** Closed list of transaction-type codes the dropdown renders.
 *  Mirrors legacy `comm_0219_001_view.jsp:217-316`. The refactor is
 *  product-agnostic per OQ-2 (resolved 2026-05-11) — every tenant sees
 *  every code including `15` (Exchange Rate), which legacy hid for
 *  non-HAENGSUNG tenants. The Deleted-tab subset filter is applied
 *  separately at render time per {@link DELETED_TAB_TYPE_SUBSET}. */
export const TRANSACTION_TYPE_CODES: ErpTransactionTypeCode[] = [
    "01", "02", "03", "04", "05", "06", "07", "08", "09",
    "10", "11", "12", "13", "14", "15", "16", "17",
];

/** Deleted-tab subset — the only universal legacy per-tab filter
 *  (`comm_0219_001.ts:482-510` runs this branch for ALL product types,
 *  so it survives the OQ-2 product-agnostic cutover). */
export const DELETED_TAB_TYPE_SUBSET: ErpTransactionTypeCode[] = [
    "02", "03", "12", "13", "16",
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
