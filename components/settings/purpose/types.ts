export type PurposeTabKey = "deposit" | "withdrawal" | "deleted";

export type PurposeRow = {
    id: string;
    /** Stable purpose code (e.g. "31", "004"). Empty string = unassigned placeholder row. */
    code: string;
    /** Business-facing purpose label ("Loan", "Card Sales Received", …). */
    account: string;
    /** Optional long description. Empty string = show placeholder copy. */
    description: string;
    /** On/off toggle state. Stored per row so the table can show mixed state. */
    enabled: boolean;
};
