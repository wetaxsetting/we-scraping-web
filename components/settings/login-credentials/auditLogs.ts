/**
 * Audit-log row shape for the Login Credentials Audit Logs dialog
 * (Figma 3435:22565). One entry per password / credential mutation;
 * the panel maps `AUDIT_LOGS_INFM` rows into this shape via
 * {@code lib/api/mappers.ts mapLoginCredentialAuditLogList}.
 *
 * <p>Source of truth: live endpoint
 * {@code GET /api/v1/login-credentials/{api_type}/{api_seq_no}/audit-logs}
 * (via {@code fetchLoginCredentialAuditLogs}). This module exposes
 * only the row type — no static seed.
 */
export type LoginCredentialAuditActivity = "login_credentials";

export type LoginCredentialAuditLogRow = {
    id: string;
    /** ISO date — rendered as DD-MM-YYYY in the table cell. */
    date: string;
    /** Time of day — `HH:MM:SS`. */
    time: string;
    /** Display name of the actor. */
    user: string;
    activity: LoginCredentialAuditActivity;
    /** Free-form details string — the activity description. */
    details: string;
};
