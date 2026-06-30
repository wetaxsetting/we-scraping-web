/**
 * Tax-authority operation status for a customer/supplier company. Mirrors
 * the JEX live screen `aosv_0001_001.act` — companies whose e-invoice
 * certificate + operating state are polled from the Vietnamese General
 * Department of Taxation (Tổng cục Thuế).
 *
 * The code set reproduces the legacy `aosv_0001_001.ts` `companyStatus`
 * map 1:1 — 13 distinct statuses + `"unknown"` (raw GDT string shown
 * verbatim). The earlier 3-state model (active / suspended /
 * not_registered) was a refactor invention and is retired.
 *
 * Presentation (legacy parity):
 *   - ACTIVE_CODES → green text, no icon
 *   - every other known code → red text + error icon
 *   - "unknown" → muted text, no icon, raw `companyStatusRaw` label
 */
export type OperationStatusCode =
    | "active"
    | "active_certificate_issued"
    | "active_tax_notice_issued"
    | "address_mismatch"
    | "bankruptcy_in_progress"
    | "closed"
    | "mst_terminated"
    | "on_closing"
    | "pending_address_verification"
    | "pending_personal_id_update"
    | "tax_code_issued"
    | "tax_office_changed"
    | "temporarily_closed"
    | "unknown";

/** The three legacy `status:"active"` codes — green text, no icon. Every
 *  other known code is legacy `status:"Inactive"` (red text + error icon). */
export const OPERATION_STATUS_ACTIVE_CODES: ReadonlySet<OperationStatusCode> = new Set([
    "active",
    "active_certificate_issued",
    "active_tax_notice_issued",
]);

export type OperationCompanyRow = {
    id: string;
    companyName: string;
    taxCode: string;
    address: string;
    status: OperationStatusCode;
    /** Raw GDT `COMPANYSTATUS` string — rendered verbatim when
     *  {@link OperationCompanyRow.status} is `"unknown"` (legacy
     *  `status:"", msg: v.COMPANYSTATUS` fallback). */
    companyStatusRaw: string;
    lastUpdate: string;
};
