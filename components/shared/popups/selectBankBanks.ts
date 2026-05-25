/**
 * Static bank list for the Select Bank popup (Figma 1081:25910).
 *
 * Static UI only — no API. Replace this constant with a real fetcher
 * (`useApiData` + `lib/api/banks.ts`) once the bank-master endpoint
 * lands; the popup composition above does not change.
 *
 * `color` + `initial` drive the lightweight placeholder logo rendered
 * by `<BankLogoMark>` inside `SelectBankDialog`. The Figma frame ships
 * vendor-specific bitmap/mask-composite logos that aren't viable to
 * inline here for a static UI; swapping in real SVG assets under
 * `public/assets/banks/ico-{id}.svg` later is the single migration
 * path.
 */

export type BankOption = {
    id: string;
    /** Brand name as it should appear in the input + dropdown row. */
    name: string;
    /** Background color for the placeholder logo (Figma WB365 reference). */
    color: string;
    /** Single-letter mark for the placeholder logo. */
    initial: string;
    /** Optional resolved logo URL (e.g. {@code /banklogo/AB_BANK_EN.png}).
     *  When present, the picker row renders this PNG; when absent or the
     *  asset fails to load, the row falls back to the coloured initial
     *  chip. Sourced from the legacy {@code BANK_INFM_DETL} code-'12'
     *  rows (mirrors V122 seed). */
    logoUrl?: string;
};

/**
 * Per-{@code BANK_CD} brand-icon path. Maps to the curated brand
 * thumbnails copied from the legacy
 * {@code assets_v2/images/banking_VN/icon/bank logo {BANK_NM}1.png}
 * set into {@code wecms-web/public/banklogo/icon/}.
 *
 * <p>These are the small, locale-neutral bank wordmark / monogram
 * icons used by the legacy comm_0218_search_bank picker (see
 * comm_0218_nxisas.ts line 312–313). NOT the
 * {@code BANK_INFM_DETL.BANK_DETL_INFO_CD='12'} rows — those point at
 * login-form-overlay guidance graphics (with "Mã đăng nhập / Mật khẩu"
 * pointer arrows) that are useful inside the bank's own login surface
 * but render as broken thumbnails inside our picker + Login ID/PW
 * dialog. The user feedback (2026-05-15) confirmed those overlays are
 * the wrong asset for both surfaces.
 *
 * <p>Banks are keyed on {@code BANK_CD} (stable, from V122 seed,
 * SEQ_NO=0 corporate-banking row) so we don't depend on the
 * potentially-variable {@code BANK_NM} value. Coverage matches the
 * Vietnam bank registry shown by the live picker; new banks added in
 * future migrations need a new entry here (and the matching PNG/SVG
 * copied into the icon folder).
 */
export const BANK_CD_TO_LOGO_PATH: Readonly<Record<string, string>> = {
    "11704001": "/banklogo/icon/bank logo VIETIN1.png",
    "11704002": "/banklogo/icon/bank logo TECHCOM1.png",
    "11704003": "/banklogo/icon/bank logo IBK VN1.png",
    "11704004": "/banklogo/icon/bank logo Vietcom1.png",
    "11704007": "/banklogo/icon/bank logo MB1.png",
    "11704008": "/banklogo/icon/bank logo BIDV1.png",
    "11704011": "/banklogo/icon/bank logo ACB1.png",
    "11704012": "/banklogo/icon/bank logo VIB1.png",
    "11704013": "/banklogo/icon/bank logo KB VN1.png",
    "11704014": "/banklogo/icon/bank logo MSB1.png",
    "11704020": "/banklogo/icon/bank logo Woori VN1.png",
    "11704080": "/banklogo/icon/bank logo KEBHana1.png",
    "11704088": "/banklogo/icon/bank logo Shinhan VN1.png",
    "11704100": "/banklogo/icon/bank logo Agri1.png",
    "11704101": "/banklogo/icon/bank logo HD1.png",
    "11704102": "/banklogo/icon/bank logo VP1.png",
    "11704103": "/banklogo/icon/bank logo TP1.png",
    "11704104": "/banklogo/icon/bank logo SC VN1.png",
    "11704105": "/banklogo/icon/bank logo SHB1.png",
    "11704106": "/banklogo/icon/bank logo ABBANK1.png",
    "11704108": "/banklogo/icon/bank logo PG Bank1.png",
    "11704112": "/banklogo/icon/bank logo Eximbank 1.png",
};

/** Resolved brand-icon URL for a given {@code BANK_CD}. Returns
 *  {@code undefined} when no icon is registered, so callers fall back
 *  to the coloured-initial chip. Locale is accepted for forward
 *  compatibility but currently ignored — the legacy brand icons under
 *  {@code /banklogo/icon/} are locale-neutral. */
export function resolveBankLogoUrl(
    bankCd: string,
    _locale: "EN" | "KO" | "VI",
): string | undefined {
    return BANK_CD_TO_LOGO_PATH[bankCd];
}

/**
 * NAPAS bank-code → internal {@code BANK_CD} adapter. Firm Banking
 * Settings carries the NAPAS code on the wire ({@code out_bank_cd})
 * while {@link BANK_CD_TO_LOGO_PATH} is keyed on the internal
 * {@code BANK_CD} (the same key Login Credentials uses). This map
 * bridges the two so the firm-banking surfaces resolve the same PNG
 * brand assets that LoginCredentials does — one source of truth for
 * the PNG paths, no duplicated NAPAS-keyed registry.
 *
 * <p>Coverage is the bounded set actually supported by the firm
 * banking flow ({@code FirmBankingSettingsService} +
 * {@code NAPAS_TO_BRAND} in {@code mappers.ts}). Adding a bank means
 * adding one row here and the corresponding row in the two NAPAS
 * maps in {@code mappers.ts}.
 */
const NAPAS_TO_BANK_CD: Readonly<Record<string, string>> = {
    "970424": "11704088", // Shinhan VN
    "970436": "11704004", // Vietcombank
    "970457": "11704020", // Woori VN
};

/** Resolved brand-icon URL for a given NAPAS code. Wraps
 *  {@link resolveBankLogoUrl} so callers that only have the NAPAS
 *  code ({@code out_bank_cd}) don't have to know the internal
 *  {@code BANK_CD} mapping. Returns {@code undefined} when neither
 *  side of the chain has a registered entry. */
export function resolveBankLogoUrlByNapas(
    napasCd: string,
    locale: "EN" | "KO" | "VI",
): string | undefined {
    const bankCd = NAPAS_TO_BANK_CD[napasCd];
    if (!bankCd) return undefined;
    return resolveBankLogoUrl(bankCd, locale);
}

/**
 * Larger bank-brand wordmark used as the "hero" logo above the Login
 * ID/PW form. This is the legacy source of truth — the live JEX
 * picker reads it from
 * {@code BANK_INFM_DETL.BANK_DETL_INFO_CONT WHERE BANK_DETL_INFO_CD = '11'}
 * (see IDO {@code BANK_INFM_DETL_R004.xml} + the WSVC
 * {@code nxisas_acctList_r002}). Snapshot taken 2026-05-15 against
 * the dev.wecms.vn DB; mirrored verbatim into
 * {@code wecms-web/public/banklogo/} so the refactor renders the
 * same hero wordmarks (BIDV's blue "BIDV ◆" lock-up, Woori's full
 * "WOORI BANK" wordmark, etc.) instead of the small picker icons.
 *
 * <p>Distinct from {@link BANK_CD_TO_LOGO_PATH} (small picker
 * thumbnails) and from the {@code BANK_DETL_INFO_CD = '12'} rows
 * seeded by V122 (login-form overlay guidance graphics — confirmed
 * NOT the right hero asset 2026-05-15). The caller falls back to
 * the small picker icon when a bank has no hero entry.
 */
export const BANK_CD_TO_HERO_LOGO_PATH: Readonly<Record<string, string>> = {
    "11704001": "/banklogo/ico_bank13.png",          // VietinBank
    "11704002": "/banklogo/ico_bank10.png",          // Techcombank
    "11704003": "/banklogo/ico_bank3.png",           // IBK
    "11704004": "/banklogo/ico_bank12.png",          // Vietcombank
    "11704007": "/banklogo/ico_bank6.png",           // MB
    "11704008": "/banklogo/ico_bank2.png",           // BIDV
    "11704011": "/banklogo/ico_bank1.png",           // ACB
    "11704012": "/banklogo/ico_bank11.png",          // VIB
    "11704013": "/banklogo/ico_bank4.png",           // KB
    "11704014": "/banklogo/ico_bank7.png",           // MSB
    "11704020": "/banklogo/ico_bank14.png",          // Woori
    "11704080": "/banklogo/ico_bank5.png",           // KEB Hana
    "11704088": "/banklogo/ico_bank8.png",           // Shinhan
    "11704100": "/banklogo/ico_bank15.png",          // Agribank
    "11704101": "/banklogo/ico_bank17.png",          // HD Bank
    "11704102": "/banklogo/ico_bank19.png",          // VPBank
    "11704103": "/banklogo/ico_bank18.png",          // TPBank
    "11704104": "/banklogo/sc_bank_icon.png",        // SC VN
    "11704105": "/banklogo/icon_join_stock_SHB.png", // SHB Joint Stock
    "11704106": "/banklogo/ab_bank_icon.png",        // ABBANK
    "11704108": "/banklogo/PG_Bank_logo.png",        // PG Bank
    "11704112": "/banklogo/Eximbank_logo.png",       // Eximbank
};

/** Resolved hero-logo URL for the Login ID/PW dialog. Returns the
 *  large brand wordmark when one is registered; falls back to the
 *  small picker icon otherwise so every bank renders something. */
export function resolveBankHeroLogoUrl(bankCd: string): string | undefined {
    return BANK_CD_TO_HERO_LOGO_PATH[bankCd] ?? BANK_CD_TO_LOGO_PATH[bankCd];
}

export const SELECT_BANK_LIST: readonly BankOption[] = [
    { id: "MB", name: "MB Bank", color: "#E1232E", initial: "M" },
    { id: "AGRIBANK", name: "Agribank", color: "#A21F2A", initial: "A" },
    { id: "BIDV", name: "BIDV", color: "#F5A623", initial: "B" },
    { id: "VIETIN", name: "Vietin Bank", color: "#0A3F8F", initial: "V" },
    { id: "IBK", name: "IBK (Industrial Bank of Korea)", color: "#0073C6", initial: "I" },
    { id: "NCB", name: "NCB (National Citizen Bank)", color: "#C8102E", initial: "N" },
    { id: "SHINHAN", name: "Shinhan Bank", color: "#0046AD", initial: "S" },
    { id: "WOORI", name: "Woori Bank", color: "#0083B0", initial: "W" },
];
