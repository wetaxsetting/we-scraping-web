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
    /** Backend `CHART_ACCT_SEQ_NO` — surrogate FK to the chart-of-accounts
     *  master. `null` ⇒ unassigned (row renders the "Select Account"
     *  brand-blue placeholder). */
    chartAcctSeqNo?: string | null;
    /** `CHART_ACCT_CD` (e.g. "1025001"). */
    reportingAccountCode?: string | null;
    /** `CHART_ACCT_NM_EN` — display name beside the code. */
    reportingAccountName?: string | null;
    /** Hierarchical breadcrumb (e.g. "REVENUE > OTHERS"). Built on the
     *  client from the parent-code walk so the picker + cell render the
     *  same trail without a second backend field. */
    reportingAccountBreadcrumb?: string | null;
    /** Purpose picker — backend `USE_USAG_CD` (10-digit system PK).
     *  Null when unassigned. */
    useUsagCd?: string | null;
    /** User-visible Purpose code (e.g. "40", "BD01-01"). Built on the
     *  client by joining `useUsagCd` against the loaded purpose list. */
    purposeCode?: string | null;
    /** Purpose display name (e.g. "Loan Repaid"). */
    purposeName?: string | null;
    /** VAS Account picker — backend `VAS_ACCT_CD` (user-visible code).
     *  Null when unassigned. */
    vasAcctCd?: string | null;
    /** VAS Account display name. Built on the client by joining
     *  `vasAcctCd` against the loaded VAS Account list. */
    vasAcctName?: string | null;
    /** Contact picker — backend `RCV_PAY_TRCO_KEY` snapshot. Null when
     *  unassigned. */
    rcvPayTrcoKey?: string | null;
    /** Contact display-name snapshot at pick time (`RCV_PAY_TRCO_NM`). */
    rcvPayTrcoNm?: string | null;
};

/** One option in the Reporting Account picker. Sourced from
 *  `/api/v1/settings/chart-of-accounts` — restricted root rows are
 *  surfaced as selectable options too because legacy `fnsh_0200_001`
 *  exposes the full tree, not just the leaves. */
export type ReportingAccountOption = {
    /** Backend surrogate. */
    chartAcctSeqNo: string;
    /** `CHART_ACCT_CD`. */
    code: string;
    /** Localised account name (defaults to `chart_acct_nm_en`). */
    name: string;
    /** Pre-computed parent trail (`"REVENUE > OTHERS"`); `null` for roots. */
    breadcrumb: string | null;
};

/** One option in the Purpose picker. Sourced from
 *  `/api/v1/settings/purpose-settings` — the level-1 + level-2 tree is
 *  flattened so the popover lists every active node (legacy
 *  `fnsh_0200_001` exposes the full set the same way). */
export type PurposeOption = {
    /** Backend system PK (`USE_USAG_CD`) — written verbatim into
     *  `ACCT_TRNS_RCV_PAY_INFM.RCV_PAY_USAG_CD`. */
    useUsagCd: string;
    /** User-visible short code (`HAND_USE_USAG_CD` — e.g. "40", "BD01-01"). */
    code: string;
    /** Display name (`USE_USAG_NM` — e.g. "Loan Repaid"). */
    name: string;
};

/** One option in the VAS Account picker. Sourced from
 *  `/api/v1/settings/vas-account` — active rows only
 *  (`STTS='A'` + `DEL_YN='N'`). */
export type VasAccountOption = {
    /** User-visible code (`VAS_ACCT_CD`) — written verbatim into
     *  `ACCT_TRNS_RCV_PAY_INFM.VAS_ACCT_CD`. */
    vasAcctCd: string;
    /** Display name (`VAS_ACCT_NM`). */
    name: string;
};

/** One option in the Contact picker. Sourced from
 *  `/api/v1/settings/contacts` — non-trashed rows only
 *  (`TRCO_STTS != 'C'`). */
export type ContactOption = {
    /** Global PK (`TRCO_KEY`) — written into
     *  `ACCT_TRNS_RCV_PAY_INFM.RCV_PAY_TRCO_KEY`. */
    trcoKey: string;
    /** User-visible nick / short code (`HAND_TRCO_KEY` — e.g. "00501"). */
    handTrcoKey: string;
    /** Display name (`TRCO_CMNM`). */
    name: string;
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
