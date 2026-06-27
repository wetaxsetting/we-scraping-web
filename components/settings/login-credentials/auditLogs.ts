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
export type LoginCredentialAuditLogRow = {
    id: string;
    /** Raw `reg_dtm` wire timestamp (`yyyyMMddHHmmss`, UTC instant).
     *  The shared dialog shifts it to VN + renders per active language;
     *  `date`/`time` below stay as a non-locale fallback. */
    dtm?: string;
    /** ISO date — rendered as DD-MM-YYYY in the table cell. */
    date: string;
    /** Time of day — `HH:MM:SS`. */
    time: string;
    /** Display name of the actor. */
    user: string;
    /** Server-localised activity label (legacy AUDIT_LOGS_ACTV), rendered
     *  verbatim — varies per row. */
    activity: string;
    /** Free-form details string — the activity description. */
    details: string;
};
