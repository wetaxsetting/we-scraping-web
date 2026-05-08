/**
 * Login Credentials panel — Settings popup submenu (Figma 999:21715).
 *
 * Static UI types for the login-credentials management table — one row per
 * registered institution, where each row may carry one or more (loginId,
 * password) pairs (e.g. multiple corporate-banking IDs for the same bank).
 * Backend wiring lands later — fields named for the on-screen labels, not
 * the legacy WSVC contract, so the static seed reads cleanly.
 */

export type LoginCredentialType = "corporate_banking" | "e_invoices";

export type LoginCredentialAccount = {
    /** Visible login ID (e.g. "honggildong"). */
    loginId: string;
    /** Plain-text password — masked behind a `<span>` until the eye icon
     *  is toggled. The static UI never persists this; the real panel will
     *  call the backend for the masked digest and reveal on demand. */
    password: string;
};

export type LoginCredentialRow = {
    id: string;
    /** Institution label rendered as a blue link in the first column.
     *  Mixed scripts (BIDV, AGRIBANK, 기업은행, 우리은행, GDT) — render
     *  as supplied so the existing Inter + Noto KR stack picks the right
     *  glyph per script. */
    institution: string;
    type: LoginCredentialType;
    /** One or more accounts. The first entry is the primary ID shown in
     *  the cell; entries after the first surface only inside the popover
     *  panel and drive the `+N` badge. */
    accounts: LoginCredentialAccount[];
    /** Audit-log actor + action (e.g. "김세명, 비번수정"). */
    auditLogActor: string;
    /** Audit-log date (e.g. "20-09-2024"). */
    auditLogDate: string;
};
