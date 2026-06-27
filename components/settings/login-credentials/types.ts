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
    /** Backend SEQ_NO for this credential row. Populated by
     *  {@code mapLoginCredentialAccount} when the data comes from the
     *  API; static mock seeds omit it (the reveal / delete handlers
     *  treat the absence as "no server identity, skip the call"). */
    seqNo?: number;
    /** Human-readable sub-type label (e.g. "Corporate", "Personal
     *  Connect", "DigiBiz"). Rendered after the login ID in the popover
     *  so two rows that share the same `loginId` across different bank
     *  sub-types are visually distinguishable. Null/blank when the
     *  row carries no sub-type discriminator (GDT, legacy rows). */
    loginType?: string | null;
};

/** One bank account linked to a credential group's BANK_CD. Mirrors the
 *  legacy `BANK_CERT_INFO_R005` REC_1 element. Per-bank, so every row in
 *  the Registered popup shares the same list. */
export type LoginCredentialBankAccount = {
    bankCd: string | null;
    acctNo: string;
    acctNickNm: string | null;
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
    /** Bank accounts linked to this group's BANK_CD (per-bank, shared
     *  across every credential row). Drives the Registered Login
     *  Credentials popup's "Bank Account" column + `+N` badge. Empty for
     *  GDT and for legacy mock seeds that omit it. */
    bankAccounts?: LoginCredentialBankAccount[];
    /** Audit-log actor + action (e.g. "김세명, 비번수정"). */
    auditLogActor: string;
    /** Raw `modified_at` wire timestamp (`yyyyMMddHHmmss`, UTC instant —
     *  BANK_CERT_INFO/GDT_CERT_INFO.MOD_DTM written `LocalDateTime.now(UTC)`).
     *  The table shifts it to VN + renders the date per active language;
     *  `auditLogDate` below is a non-locale fallback. */
    auditLogDtm: string;
    /** Pre-formatted audit-log date (e.g. "20-09-2024") — fallback only. */
    auditLogDate: string;
};
