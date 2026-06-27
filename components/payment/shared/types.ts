/**
 * Shared types for the payment list pages (Sprint 2). All Sprint 2 screens
 * (Scheduled / Result variants for Internal Transfer, Vendor, Expense,
 * Payroll, Overseas, plus Exchange Rate Inquiry and Card Transactions)
 * compose the same `<PaymentListPage>` template — column shape, currency
 * total shape, and search-result-status vocabulary live here so every page
 * follows the same contract.
 */

/**
 * Sub-transaction shape used on every Payment detail page. The same
 * row shape powers both Scheduled and Result detail tables — the Result
 * variant additionally renders the `result` column.
 */
export type DetailTransaction = {
    id: string;
    dateTime?: string;
    resultDateTime?: string;
    /** Raw legacy `yyyyMMddHHmmss` PROC_DTTM wire value (bank-side,
     *  Vietnam-local). When set, the Date/Time cell formats it per language
     *  WITHOUT a timezone shift; falls back to the pre-formatted {@link dateTime}. */
    dateTimeRaw?: string;
    /** Raw legacy `yyyyMMddHHmmss` RSLT_DTTM wire value (bank-side,
     *  Vietnam-local). No timezone shift; falls back to {@link resultDateTime}. */
    resultDateTimeRaw?: string;
    depositBank: string;
    depositBankCode?: string;
    depositBankName?: string;
    depositBankCurrency?: string;
    accountNo: string;
    recipientName: string;
    transferAmount: string;
    remark: string;
    reportingAccountUnassigned?: boolean;
    reportingAccount: string;
    reportingAccountBreadcrumb?: string;
    description: string;
    documentNo?: string;
    bankingTxnId?: string;
    result?: ResultStatus;
    trnSeq?: number;
    bnfcAddr?: string;
    feePayer?: string;
    /** Bank-side process timestamp (`yyyyMMddHHmmss`, UTC). Used by the
     *  Result detail page to decide whether the line is Re-run eligible
     *  (legacy mirror: `pymn_0010_002.ts:443-449` `executedToday`). */
    procDttm?: string;
    /** Bank-side response code (4-char). Re-run eligibility requires it
     *  to be in the transient-failure set `{"0001"…"0005"}` per legacy
     *  `pymn_0010_002.ts:441` `validResponseCode`. */
    rsCd?: string;
    /** Bank-side failure message — surfaces as a hover tooltip on the
     *  Results badge when {@code result === "failed"}. Legacy mirror:
     *  {@code pymn_0010_002.ts:418} `<div class="error_message">`. */
    rsMsg?: string;
    /** Match link state — `"Y"` when the row has been linked to a
     *  banking transaction. Drives the Match vs Unmatch CTA in the
     *  Banking Transaction ID column. Legacy mirror:
     *  {@code pymn_0010_002.ts:452-457} (`LINK_MATCH_YN`). */
    linkMatchYn?: string;
    /** Overseas per-line match IDENTITY (`OVRS_PYMN_DETL_NO`). Carried only by
     *  the Overseas Result detail so the per-line match endpoints (keyed on this,
     *  not `trnSeq`) can be called. Other modules key match on the row `id`. */
    ovrsPymnDetlNo?: string;
};

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
    /**
     * Opt-in sort wiring. When `true`, the column's header becomes clickable
     * and feeds into the shared `useTableSort` cycle (default → ASC → DESC →
     * default). Columns without backing data (`render`-only badges, decorative
     * cells) should leave this `false` / omitted.
     */
    sortable?: boolean;
    /**
     * Optional projection for sort comparisons. Returns the underlying value
     * to compare — defaults to `row[key]`. Use this for columns whose
     * displayed value is a pre-formatted string (e.g. `"1,000.00"`) but
     * whose sort order should be numeric.
     */
    sortValue?: (row: Row) => string | number;
    /**
     * Optional extra class names applied to the `<td>` of every data row in
     * this column. Use for column-wide cell background tints that match
     * legacy parity — e.g. the Reporting Account yellow highlight
     * (`bg-[#FFFEDB]`) on the Scheduled / Result detail tables. Layout
     * defaults (`px-2.5 py-2.5`, alignment) are preserved; this is
     * additive only.
     */
    cellClassName?: string;
};

export type CurrencyTotal = {
    currency: string;
    total: string;
};
