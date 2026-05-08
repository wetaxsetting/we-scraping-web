/**
 * Static audit-log rows for the Login Credentials Audit Logs dialog
 * (Figma 3435:22565). Three events that mirror the Figma frame —
 * every entry is a Login ID/PW password change by the same actor.
 */
export type LoginCredentialAuditActivity = "login_credentials";

export type LoginCredentialAuditLogRow = {
    id: string;
    /** ISO date — rendered as DD-MM-YYYY in the table cell. */
    date: string;
    /** Time of day — `HH:MM:SS`. */
    time: string;
    /** Display name of the actor (Korean in the Figma mock data). */
    user: string;
    activity: LoginCredentialAuditActivity;
    /** Free-form details string — the activity description; the
     *  Login Credentials frame ships a fixed
     *  "Login ID/PW - Changes password" detail row. */
    details: string;
};

export const mockLoginCredentialAuditLogs: LoginCredentialAuditLogRow[] = [
    {
        id: "lc-log-1",
        date: "09-12-2024",
        time: "15:13:24",
        user: "김세명",
        activity: "login_credentials",
        details: "Login ID/PW - Changes password",
    },
    {
        id: "lc-log-2",
        date: "09-12-2024",
        time: "15:13:24",
        user: "김세명",
        activity: "login_credentials",
        details: "Login ID/PW - Changes password",
    },
    {
        id: "lc-log-3",
        date: "02-10-2024",
        time: "15:13:24",
        user: "김세명",
        activity: "login_credentials",
        details: "Login ID/PW - Changes password",
    },
];
