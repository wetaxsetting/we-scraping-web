import type { LoginCredentialRow } from "./types";

/**
 * Per-row data for the Registered Login Credentials dialog
 * (Figma 3881:22605). One entry per (loginId, password) pair, plus the
 * primary linked bank account label and a `+N` count for additional
 * accounts that share the same login.
 *
 * <p>{@code bankAccount} and {@code extraAccountCount} stay empty
 * until a per-credential linked-accounts endpoint ships (planned
 * {@code GET /api/v1/login-credentials/{rowId}/accounts}). The
 * dialog renders an em-dash placeholder for an empty
 * {@code bankAccount} and hides the chip when {@code extraAccountCount}
 * is 0, so the layout stays stable.
 *
 * <p>Source of truth: the live {@link LoginCredentialRow#bankAccounts}
 * array on the parent credential row — see
 * {@link buildRegisteredCredentialEntries} below.
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
 * dialog presents one row per {@code (loginId, password)} pair carried
 * on {@code row.accounts}.
 *
 * <p>The "Bank Account" column mirrors legacy {@code comm_0218_006}
 * ({@code IDO.BANK_CERT_INFO_R005.xml} {@code REC_1}): the linked-account
 * list is keyed per-bank (BANK_CD), so every credential row under the
 * same bank shows the same set. The primary cell shows ONLY the first
 * account's {@code ACCT_NO} — no nickname / company name (legacy parity)
 * — and the {@code +N} badge counts the remaining accounts
 * ({@code length - 1}). When the row has no linked accounts (GDT, or a
 * bank with none registered yet) the label stays empty so the dialog
 * renders the em-dash placeholder.
 */
export function buildRegisteredCredentialEntries(
    row: LoginCredentialRow,
): RegisteredCredentialEntry[] {
    const bankAccounts = row.bankAccounts ?? [];
    const primary = bankAccounts[0];
    // Account NUMBER only — legacy comm_0218_006 shows just ACCT_NO in
    // this column (no ACCT_NICK_NM / company name). The +N badge carries
    // the additional-linked-account count.
    const bankAccount = (primary?.acctNo ?? "").trim();
    const extraAccountCount =
        bankAccounts.length > 1 ? bankAccounts.length - 1 : 0;

    return row.accounts.map((acct) => ({
        loginId: acct.loginId,
        password: acct.password,
        bankAccount,
        extraAccountCount,
    }));
}
