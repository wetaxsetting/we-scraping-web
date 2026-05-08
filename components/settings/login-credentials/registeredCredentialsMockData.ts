import type { LoginCredentialRow } from "./types";

/**
 * Per-row data for the Registered Login Credentials dialog
 * (Figma 3881:22605). One entry per (loginId, password) pair, plus the
 * primary linked bank account label and a `+N` count for additional
 * accounts that share the same login.
 *
 * Static UI: this seed is keyed by the row that triggered the dialog —
 * for institutions in the static mock that aren't covered (e.g. GDT
 * e-Invoices), the dialog falls back to the row's `accounts[]` from
 * `mockData.ts` and renders a generic "—" bank-account placeholder.
 */
export type RegisteredCredentialEntry = {
    /** Visible login ID. */
    loginId: string;
    /** Plain-text password (masked behind `*` until the eye icon toggles). */
    password: string;
    /**
     * Primary linked bank account label, e.g. `"BIDV 123021212211"`. Empty
     * string renders an em-dash placeholder so the layout stays stable for
     * institutions that don't yet expose linked accounts.
     */
    bankAccount: string;
    /**
     * Count of additional bank accounts sharing the same login ID. Drives
     * the `+N` chip next to the primary account label. `0` hides the chip.
     */
    extraAccountCount: number;
};

/**
 * Build the dialog's row list from a Login Credentials table row. The
 * dialog presents one row per (loginId, password) pair; the panel-table
 * row's `accounts` already contains those tuples, so we just decorate
 * each one with a static linked-bank-account label.
 *
 * Real backend wiring will replace this with a per-credential lookup
 * (`GET /api/v1/login-credentials/{rowId}/accounts`) — the dialog shape
 * does not change.
 */
export function buildRegisteredCredentialEntries(
    row: LoginCredentialRow,
): RegisteredCredentialEntry[] {
    const overrides = STATIC_BANK_ACCOUNT_BY_LOGIN[row.institution] ?? {};
    return row.accounts.map((acct, index) => {
        const fallbackAccount =
            row.type === "corporate_banking"
                ? `${row.institution} 12302121221${index + 1}`
                : "";
        const override = overrides[acct.loginId];
        return {
            loginId: acct.loginId,
            password: acct.password,
            bankAccount: override?.bankAccount ?? fallbackAccount,
            extraAccountCount: override?.extraAccountCount ?? (index < 2 ? 2 : 0),
        };
    });
}

/**
 * Optional per-institution overrides so the static handoff matches the
 * Figma frame's wording (BIDV is the canonical example — the Figma shows
 * `BIDV 123021212211 +2`, `BIDV 123021212213 +2`, `BIDV 123021212214`).
 * Institutions absent from this map fall back to the synthetic
 * `<institution> 12302121221N` pattern in `buildRegisteredCredentialEntries`.
 */
const STATIC_BANK_ACCOUNT_BY_LOGIN: Record<
    string,
    Record<string, { bankAccount: string; extraAccountCount: number }>
> = {
    BIDV: {
        honggildong: { bankAccount: "BIDV 123021212211", extraAccountCount: 2 },
        donghonggil: { bankAccount: "BIDV 123021212213", extraAccountCount: 2 },
        gilhongdong: { bankAccount: "BIDV 123021212214", extraAccountCount: 0 },
    },
};
