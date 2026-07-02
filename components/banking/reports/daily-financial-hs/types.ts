/**
 * Types for the Banking > Daily Financial (HS) report — bank-grouped ledger
 * (Figma 291:7180). One `BankGroup` per bank/account block; each block renders
 * its transaction `entries`, a blue SUB TOTAL row, and — when it closes a
 * currency section — a green TOTAL row.
 *
 * All monetary fields are pre-formatted **display strings** (e.g. "350.000",
 * "(10.000)", "-", ""). This is a static-UI report: no amount formatting or
 * arithmetic happens at render time — the mock seed holds exactly what the
 * cell shows. Empty string renders blank; "-" renders a dash.
 */

export type LedgerEntry = {
    id: string;
    /** {@code ACCT_SEQ_NO} — the row key for per-field save. Empty string for
     *  non-persistable rows (e.g. the BEFORE_BALANCE row, which legacy does not
     *  edit); the page skips the save call when this is empty. */
    acctSeqNo: string;
    /** True only for {@code TRANSACTION} rows — legacy renders the editable
     *  Receipt/Payment/Description inputs ONLY on transaction rows. A
     *  BEFORE_BALANCE row is non-editable: its code/description cells render
     *  empty (no input boxes, no label text), only the Before Balance amount. */
    editable: boolean;
    /** Editable "Receipt Code" (입금코드) input value; empty → placeholder. */
    receiptCode: string;
    /** Editable "Payment Code" (출금코드) input value; empty → placeholder. */
    paymentCode: string;
    /** Editable "Description (English)" (적요(현지)) input value. */
    descriptionEn: string;
    /** Editable "Description (Korean)" (적요(번역)) input value. */
    descriptionKo: string;
    /** Customer / Supplier (고객 / 거래처명) — plain text, truncated. */
    counterparty: string;
    /** Before Balance (전일잔고) — right-aligned display string. */
    beforeBalance: string;
    /** Receipt (입금) — right-aligned display string. */
    receipt: string;
    /** Payment (출금) — right-aligned display string. */
    payment: string;
    /** Balance (통장잔고) — right-aligned display string. */
    balance: string;
    /** Editable "Memo" (메모) input value. */
    memo: string;
};

export type LedgerTotals = {
    beforeBalance: string;
    receipt: string;
    payment: string;
    balance: string;
};

export type BankGroup = {
    id: string;
    /** Bank name (은행명) — bold first line of the frozen Bank cell. */
    bankName: string;
    /** Optional account-type parenthetical (e.g. "(운용통장)", "(Saving account)"). */
    accountType?: string;
    /** Optional red accent label rendered before the account number
     *  (e.g. "BRANCH", "LOAN"). */
    accentLabel?: string;
    /** Optional red "Due Date" label rendered after the account number. */
    dueDateLabel?: string;
    /** Optional red due-date value (e.g. "13 Jan 2026"). */
    dueDateValue?: string;
    /** Account number (e.g. "700-004-700415"). */
    accountNo: string;
    /** Currency (통화) — "VND" / "USD". */
    currency: string;
    entries: LedgerEntry[];
    /** Blue SUB TOTAL row values for this account. */
    subtotal: LedgerTotals;
    /** When true, this group closes a currency section — a green TOTAL row is
     *  rendered immediately after its SUB TOTAL row. */
    closesTotal?: boolean;
    /** Green TOTAL row values (present only when `closesTotal`). `memo` is the
     *  optional right-most figure the Figma shows at the table's right edge. */
    total?: LedgerTotals & { memo?: string };
};
