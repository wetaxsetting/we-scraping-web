/**
 * Firm Banking Settings panel — Settings popup submenu (Figma 134:17061).
 *
 * Static UI types for the configuration screen: a pair of automation toggles
 * plus the list of linked banking accounts with status / last-update / kebab
 * row actions. Backend wiring lands later.
 */

export type FirmBankingAccountStatus = "active" | "inactive";

export type FirmBankingAutomationKey =
    | "match_payment_after_history"
    | "transfer_after_full_approval";

export type FirmBankingAutomationSetting = {
    key: FirmBankingAutomationKey;
    /** Wire code on {@code BUSI_ENV_SET_INFM.ENV_SET_INF} — five-char
     *  zero-padded (legacy {@code 00078} Auto Transfer / {@code 00079}
     *  Auto Match). Used by the panel to reach the API client. */
    envCd: string;
    /** Translation key for the row label. */
    labelKey: string;
    enabled: boolean;
};

/**
 * Identity for the bank logo. The renderer ([BankLogo]) maps the key to a
 * brand colour + initials so the static UI stays self-contained until real
 * SVG / PNG bank assets are committed under `public/assets/banks/`.
 */
export type BankBrand = "woori" | "shinhan" | "bidv" | "vcb" | "hd_bank";

export type FirmBankingLinkedAccount = {
    id: string;
    bank: BankBrand;
    /** Display name as shown on the row (e.g. "WOORI BANK"). */
    bankName: string;
    /** Account number with currency suffix — e.g. "0001-000000561-14 (USD)".
     *  When sourced from the live list endpoint the digits portion is
     *  masked server-side per OQ-4 (e.g. "1009****0384 (VND)"). */
    accountNumber: string;
    /** Currency code from the joined ACCT_MSTR row. {@code null} when
     *  no matching ledger row exists (the LEFT JOIN returns nulls).
     *  Pre-API mocks use string literals; the live shape allows
     *  {@code null} so the mapper doesn't have to fabricate a value. */
    currency: string | null;
    status: FirmBankingAccountStatus;
    /** Free-form display string mirroring Figma — e.g. "30-10-2024, Krong". */
    lastUpdated: string;

    // -------------------------------------------------------------------
    //  API-keyed fields (added Phase 3 — read-only slice). The static
    //  mock retains them as empty strings so the existing component
    //  surface stays unchanged; live rows supply real values.
    // -------------------------------------------------------------------

    /** NAPAS bank code (Shinhan {@code 970424} / Vietcombank
     *  {@code 970436} / Woori {@code 970457}). Used as the first PK
     *  component when fetching the detail / audit endpoints. */
    outBankCd: string;
    /** Tenant company account number — masked when the row was
     *  produced by the list endpoint (the wire value is already
     *  masked); the detail endpoint returns cleartext for the edit
     *  dialog round-trip. The Phase-3 read-only slice never propagates
     *  cleartext into this field — the panel only consumes list rows. */
    wdrlActNo: string;
};

/**
 * One row in the Withdrawal Account autocomplete (Create dialog).
 * Mapped from `ApiAccountLookupRow` via `mapAccountLookupOption` —
 * keeps the dialog free of any wire-snake-case access per the
 * boundary-translation rule.
 *
 * `acctNo` is the raw value submitted as `wdrl_act_no` when the
 * user picks a row. `acctNoMasked` is the server-formatted
 * display variant (legacy presentation: `1009****0384`). `ccyCd`
 * drives the `(VND)` / `(USD)` suffix the dialog renders client
 * side per JEX `comm_0220_002.ts` parity. `displayLabel` is the
 * pre-composed `<masked> (<ccy>)` chip / list-item string — kept
 * here so the dialog never reaches into masking logic itself.
 */
export type AccountLookupOption = {
    /** Raw `ACCT_MSTR.ACCT_NO` — the form submits this value as
     *  `wdrl_act_no`. Never logged or displayed unmasked. */
    acctNo: string;
    /** Server-masked variant (`1009****0384`-style). */
    acctNoMasked: string;
    /** Pre-composed display label `<acctNoMasked> (<ccyCd>)`.
     *  The fallback for missing currency is just the masked digits
     *  with no parenthesised suffix — matches legacy behavior when
     *  `CCY_CD` is null. */
    displayLabel: string;
    ccyCd: string;
    acctNickNm: string | null;
    acctNm: string | null;
};

/**
 * Audit-log row consumed by the FirmBankingDetailsDialog audit panel.
 * Mapped from the wire {@code ApiFirmBankingAuditEntry} via
 * {@code mapFirmBankingAuditEntry}; the {@code reg_dtm} legacy 14-char
 * timestamp is split into date / time strings for the table cells.
 */
export type FirmBankingAuditLogRow = {
    /** Synthetic stable key for React lists (composite of
     *  {@code reg_dtm + reg_id} — neither alone is unique). */
    id: string;
    /** {@code DD-MM-YYYY} display. */
    date: string;
    /** {@code HH:mm:ss} display. */
    time: string;
    /** Display name of the actor (legacy {@code REG_NM}). */
    user: string;
    /** Pre-localized activity detail string, written one-row-per-locale
     *  by the backend writer (legacy {@code AUDIT_LOGS_ACTV_DTL}).
     *  Render verbatim — do not pass through the i18n loader. */
    activityDetail: string;
};
