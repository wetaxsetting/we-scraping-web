/**
 * Per-bank UI extras for the Login ID/PW dialog. Mirrors the legacy
 * {@code certFormInfoUI} array in
 * {@code WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/comm/comm_0218_nxisas.ts:743}.
 *
 * <p>The DB-backed form-info from
 * {@code GET /api/v1/login-credentials/banks/{bankCd}/form-info}
 * already drives:
 * <ul>
 *   <li>Sub-type radio buttons (Corporate / Personal Banking, VCB
 *       iB@nking / DigiBiz / Personal)</li>
 *   <li>Localised ID / Password / Confirm Password labels</li>
 *   <li>The optional Corporate-ID input (Agribank / MB) — driven by
 *       the {@code extra_label} field being non-blank</li>
 * </ul>
 *
 * <p>This file fills in the LAST piece — the per-bank+sub-type
 * <b>Login Type dropdown</b> that legacy ships hardcoded for ABBANK
 * and Vietcom Personal. There's no DB source for these in
 * {@code BANK_INFM_DETL}; the legacy frontend literally typed them
 * into a JS array. We do the same, but as a typed lookup.
 *
 * <p>To add a new bank's dropdown options: append an entry keyed on
 * {@code <bank_cd>:<seq_no>}.
 */

export type LoginTypeOption = {
    /** Value sent to the backend as {@code login_type} on Create.
     *  Matches the {@code data-option} attribute the legacy renders
     *  on each `<li>` so Coocon's adapter receives the same value
     *  the live system sends. */
    value: string;
    /** i18n key for the user-visible label. Resolved via
     *  {@code t(...)} at render time. */
    labelKey: string;
    /** Plain-English fallback when {@code labelKey} is missing in
     *  the active locale (mirrors how the legacy code hardcoded
     *  English text into the ML lookup defaults). */
    defaultLabel: string;
};

/** Composite key: {@code <bank_cd>:<seq_no>}. */
type BankSubTypeKey = `${string}:${number}`;

/**
 * Banks + sub-types that require a Login Type dropdown alongside the
 * standard ID + Password + Confirm fields.
 */
const LOGIN_TYPE_OPTIONS: Record<BankSubTypeKey, LoginTypeOption[]> = {
    // ABBANK (11704106) — single sub-type, dropdown selects OTP delivery
    // channel. Legacy hardcoded as comm_0218_nxisas_j015 / j016.
    "11704106:0": [
        {
            value:        "",
            labelKey:     "settings.login_credentials.bank_login_type.abbank_sms",
            defaultLabel: "Login With SMS OTP",
        },
        {
            value:        "EMAIL",
            labelKey:     "settings.login_credentials.bank_login_type.abbank_email",
            defaultLabel: "Login With Email OTP",
        },
    ],

    // Vietcom (11704004) — Personal Banking sub-type (seq 2) carries
    // a Login Type dropdown for OTP delivery. Corporate sub-types
    // (seq 0 / 1) have no dropdown.
    "11704004:2": [
        {
            value:        "",
            labelKey:     "settings.login_credentials.bank_login_type.vcb_mobile",
            defaultLabel: "Confirm from Mobile App",
        },
        {
            value:        "OTP",
            labelKey:     "settings.login_credentials.bank_login_type.vcb_smart",
            defaultLabel: "VCB-Smart OTP",
        },
        {
            value:        "SMS",
            labelKey:     "settings.login_credentials.bank_login_type.vcb_sms",
            defaultLabel: "SMS OTP",
        },
    ],
};

/**
 * Lookup the dropdown options for a given (bank_cd, seq_no) pair.
 * Returns {@code null} when the combination has no per-bank
 * dropdown — the dialog then skips the Login Type field entirely.
 */
export function getLoginTypeOptions(
    bankCd: string,
    seqNo: number,
): LoginTypeOption[] | null {
    const key: BankSubTypeKey = `${bankCd}:${seqNo}`;
    return LOGIN_TYPE_OPTIONS[key] ?? null;
}
