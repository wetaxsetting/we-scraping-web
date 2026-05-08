/**
 * Static audit-log rows for the Bank Account Audit Logs dialog
 * (Figma 166:25291). Three events that mirror the Figma frame.
 */
export type AuditLogActivity = "bank_account";

export type AuditLogRow = {
    id: string;
    /** ISO date — formatted as DD-MM-YYYY in the table cell. */
    date: string;
    /** Time of day — `HH:MM:SS`. */
    time: string;
    /** Display name of the actor (Korean in the Figma mock data). */
    user: string;
    activity: AuditLogActivity;
    /** Free-form details string — the activity description plus any
     *  identifier in parens (e.g. bank code + account number). */
    details: string;
};

export const mockAuditLogs: AuditLogRow[] = [
    {
        id: "log-1",
        date: "09-09-2024",
        time: "15:13:24",
        user: "김세명",
        activity: "bank_account",
        details: "Add Bank Account (BIDV 08212345601012)",
    },
    {
        id: "log-2",
        date: "09-09-2024",
        time: "15:13:24",
        user: "김세명",
        activity: "bank_account",
        details: "Delete bank account (BIDV 08212345601012)",
    },
    {
        id: "log-3",
        date: "09-09-2024",
        time: "15:13:24",
        user: "김세명",
        activity: "bank_account",
        details: "Grant view permissions (BIDV 08212345601012)",
    },
];
