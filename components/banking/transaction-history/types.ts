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
    /** Locale-formatted transaction date (legacy fallback). Prefer
     *  rendering from {@link dateRaw} via `formatDateLang(dateRaw, locale)`
     *  so the date follows the active language (EN `DD-MMM-YYYY`, KO
     *  `YYYY-MM-DD`, VI `DD-MM-YYYY`) — legacy `fnsh_0002_001` parity. */
    date: string;
    /** Raw legacy `YYYYMMDD` transaction date (`TRSC_DT`). Carried so the
     *  cell can re-format per active locale at render (raw-value-at-render
     *  pattern). */
    dateRaw?: string;
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
    /** Raw UTC `BUSI_MATCH_LOG.MATCHED_AT` (`yyyyMMddHHmmss`). Carried so the
     *  Matched Date cell converts UTC→Vietnam-local + formats per active locale
     *  at render (`formatUtcDtmByLanguage`), instead of the locale-blind,
     *  unshifted legacy slice. Null for unmatched rows. */
    matchedAtRaw?: string;
    /** Raw UTC `AcctTrnsRcvPayInfm.CNFM_DTM` (`yyyyMMddHHmmss`) — the confirm
     *  timestamp, used as the Matched Date fallback. Same UTC→local + locale
     *  treatment as {@link matchedAtRaw}. */
    confirmedDtmRaw?: string;
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
    /** Row-level memo sticker color (newest memo's `MEMO_INFM.COLOR` wire
     *  token — `fileG/fileB/fileY/fileW/fileR/fileP`). `null` when the
     *  transaction has no memos. Backend returns it for every row; the
     *  memo icon renders only on confirmed rows (legacy runtime parity). */
    memoColor?: import("@/lib/types/api").MemoColor | null;
    /** Number of memos on this transaction's thread. 0 when none. */
    memoCount?: number;
};

/** One option in the Reporting Account picker. The type now lives with
 *  the shared `<ReportingAccountSelect>` component (consumed by both
 *  Transaction History and Card Transactions); re-exported here so
 *  existing `import { ReportingAccountOption } from "./types"` call
 *  sites keep working. */
export type { ReportingAccountOption } from "@/components/shared/ReportingAccountSelect";

/** One option in the Purpose picker. The type now lives with the shared
 *  `<PurposeSelect>` component (consumed by both Transaction History and
 *  Card Transactions); re-exported here so existing
 *  `import { PurposeOption } from "./types"` call sites keep working. */
export type { PurposeOption } from "@/components/shared/PurposeSelect";

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

/**
 * Smart Organizer candidate row (camelCase, in-memory). Mapped from the
 * wire `ApiMatchCandidateRow` by `mapMatchCandidateRow` so the dialog never
 * reads raw snake_case wire keys directly.
 */
export type MatchCandidate = {
    /** Composite identifier the match-create endpoint expects
     *  (`SCDUL_PYMN_NO + "_" + SCDUL_PYMN_DETL_NO`). */
    payTrnsId: string;
    /** `'S'` = domestic scheduled (only variant in the first slice). */
    payTypeCd: string;
    scdulPymnNo: string;
    scdulPymnDetlNo: string;
    scdulPymnTypeCd: string;
    trnfDt: string;
    trnfDtm: string | null;
    tranAmt: string;
    trnfCcyCd: string;
    rcptNm: string;
    bnfcBankCd: string | null;
    bnfcBankNm: string | null;
    bnfcAcctNo: string | null;
    tranUsag: string | null;
    titl: string;
};
