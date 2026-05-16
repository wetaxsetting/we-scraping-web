/**
 * Transaction row shape for the per-account Transaction History page.
 * Figma shows a split layout: left side is the bank statement (Date/Time,
 * Deposit, Withdraw, Balance, Remarks); right side is the classification
 * / matching panel (Purpose, VAS Account, Contacts Name, Confirmed by).
 * Unconfirmed rows are editable (yellow-tinted, Confirm button); confirmed
 * rows are read-only with an Undo button.
 */
export type TransactionFlow = "deposit" | "withdraw";

export type TransactionRow = {
    id: string;
    /**
     * Backend surrogate (`ACCT_SEQ_NO`) for the row. Carries the value the
     * detail / confirm / undo endpoints expect as `{trnsSeqNo}`. Optional only
     * for legacy mock data that pre-dates the live-API wiring.
     */
    trnsSeqNo?: string;
    /** Human-readable transaction id shown in the legacy on-screen table.
     *  Optional until the refactor's `TransactionRow` DTO surfaces it; the
     *  table renders "—" in the meantime. */
    transactionId?: string;
    date: string;
    time: string;
    /** Credit amount when this is an incoming transaction. */
    deposit?: string;
    /** Debit amount when this is an outgoing transaction. */
    withdraw?: string;
    /** Running balance after this transaction. */
    balance: string;
    remarks: string;
    /** Source file name (legacy ERP upload). Optional pending DTO extension. */
    fileName?: string;
    /** Date the matching/classification was confirmed (`YYYY-MM-DD`).
     *  Optional pending DTO extension; sourced from `confirmedBy.date` when
     *  the mapper has it. */
    matchedDate?: string;
    /** Operator who confirmed the matching. Sourced from `confirmedBy.name`
     *  when present; otherwise null. */
    matchedBy?: string;
    /**
     * Matching fields — filled only after the row has been classified.
     * `confirmed: false` renders an editable (yellow) row with placeholders;
     * `confirmed: true` renders read-only values plus the confirmer + date.
     */
    confirmed: boolean;
    purpose?: string;
    vasAccount?: string;
    contactsName?: string;
    confirmedBy?: {
        name: string;
        date: string;
    };
    /** Doc icon colour — Figma shows yellow / pink variants on confirmed rows. */
    docIconVariant?: "yellow" | "pink";
    /** Smart Organizer match state — `'Y'` when the row is linked to a
     *  payment via `BUSI_MATCH_LOG`. Drives the popup's "matched mode"
     *  branch and the per-row Unmatch affordance. */
    linkMatchYn?: string;
};

export type TransactionTypeFilter = "all" | "deposit" | "withdraw";

export type TransactionStatusFilter = "all" | "confirmed" | "unconfirmed";

export type TransactionStatusCounts = {
    all: number;
    confirmed: number;
    unconfirmed: number;
};

export type TransactionTotals = {
    /** Count of transactions in the current filter scope. */
    count: number;
    /** Sum of all deposits (formatted string, per currency convention). */
    depositTotal: string;
    /** Sum of all withdraws (formatted string, per currency convention). */
    withdrawTotal: string;
};

/**
 * In-memory shape backing the status-tab counters + footer totals. Sourced
 * from the `/transactions/summary` endpoint so the counts honour every active
 * filter (date range, type, keyword) — including the rows that the current
 * status tab itself filters out.
 */
export type TransactionSummary = {
    totalCount: number;
    confirmedCount: number;
    unconfirmedCount: number;
    depositTotal: string;
    withdrawTotal: string;
};

/**
 * Full single-transaction detail returned by `/transactions/{trnsSeqNo}` and
 * also by `PUT .../confirm`. Mirrors `TransactionRow` plus the matching panel
 * fields (purpose / VAS / contact) and the confirmer metadata.
 */
export type TransactionDetail = TransactionRow & {
    trnsSeqNo: string;
    remarks2: string;
    bankRefNo?: string;
    currency?: string;
    contactsKey?: string;
};

/**
 * Body for the confirm dialog. All fields optional — the backend accepts a
 * bare confirm that just flips `CNFM_YN` to 'Y'.
 */
export type TransactionConfirmInput = {
    contactsKey?: string;
    contactsName?: string;
    purposeCode?: string;
    vasAccountCode?: string;
};
