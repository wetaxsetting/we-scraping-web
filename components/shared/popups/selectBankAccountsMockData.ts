/**
 * Row shape + scrape mapper for the Select Bank Accounts popup
 * (Figma 1081:25485).
 *
 * <p>Live data flows through {@link mapScrapedToBankRow}: the
 * Bank Account / Login Credentials Add chains pass NXISAS-scraped
 * accounts through this mapper into the popup's {@code rows} prop.
 * The earlier {@code SELECT_BANK_ACCOUNTS_ROWS} static seed was
 * retired 2026-05-26 — the popup now requires an explicit
 * {@code rows} prop and renders an empty body when none are scraped.
 */

import type { ApiScrapedAccount } from "@/lib/api/bankCredentials";

/** The legacy `ACCT_TYPE_CD` value set (`02`–`08`). The popup's Account
 *  Type dropdown stores one of these CODES, never the raw scraped string. */
const VALID_ACCT_TYPE_CDS = new Set(["02", "03", "04", "05", "06", "07", "08"]);

/**
 * Normalize a scraped account-type into a legacy {@code ACCT_TYPE_CD}.
 *
 * <p><b>Raw scrape type vs. mapped ACCT_TYPE_CD.</b> The Coocon
 * acct-list `acct_type` is a free-text, bank- and language-specific
 * label (e.g. {@code "DEMAND DEPOSIT-VND"}, {@code "Tiền gửi có kỳ hạn (TT) - VND"},
 * {@code "DEMAND"}). Legacy maps it to a 2-char {@code ACCT_TYPE_CD}
 * server-side via the {@code NXISAS_ACCT_TYPE_MAPPING} table keyed by
 * {@code (BANK_CD, CCY_CD, NXISAS_ACCT_TYPE)} (see
 * {@code fnsh_0101_001_r001_act.jsp:164-176}); when no mapping row
 * exists, {@code ACCT_TYPE_CD} is left blank.
 *
 * <p>That mapping table may not be seeded in every refactor env, so the
 * backend can return the raw string unmapped. We therefore accept the
 * value here ONLY when it is already a valid {@code ACCT_TYPE_CD}; any
 * free-text raw label normalizes to {@code ""}. When it does,
 * {@link mapScrapedToBankRow} applies the legacy Tier-2 fallback
 * ({@link defaultCurrentAcctTypeCd}) — it does NOT stay blank. The raw
 * string is NEVER stored on the row and NEVER shown as a dropdown option.
 */
export function normalizeAcctTypeCd(rawAcctType: string | null | undefined): string {
    const v = (rawAcctType ?? "").trim();
    return VALID_ACCT_TYPE_CDS.has(v) ? v : "";
}

/**
 * Legacy Tier-2 auto-fill fallback — when the scrape produced no mappable
 * {@code ACCT_TYPE_CD}, default to the FIRST option for the row's currency,
 * which is always **Current**: VND {@code 03}, USD {@code 04}, KRW {@code 07}.
 *
 * <p>Mirrors live JEX {@code comm_0218_nxisas.ts:1317-1332} exactly
 * ({@code getAcctType(ccy)[0]?.ACCT_TYPE}): the popup opens with Account
 * Type pre-selected rather than blank. An unknown currency has no option
 * set in legacy, so it stays {@code ""}.
 *
 * <p><b>Deliberate legacy quirk:</b> an unmapped term-deposit account
 * (one carrying a maturity date) still defaults to Current here — legacy
 * does NOT infer Fixed Deposit from the presence of a maturity date. This
 * is bug-for-bug parity; changing it is a PO decision.
 */
export function defaultCurrentAcctTypeCd(currency: string | null | undefined): string {
    const ccy = (currency ?? "").trim().toUpperCase();
    if (ccy === "VND") return "03";
    if (ccy === "USD") return "04";
    if (ccy === "KRW") return "07";
    return "";
}

export type BankAccountRow = {
    id: string;
    accountNo: string;
    currency: string;
    /** Mapped legacy {@code ACCT_TYPE_CD} (`02`–`08`) or `""` when the
     *  scraped type couldn't be mapped. NEVER the raw scraped label —
     *  see {@link normalizeAcctTypeCd}. The popup's dropdown renders the
     *  three business labels (Current / Savings / Fixed Deposit) and
     *  stores the currency-specific code. */
    accountType: string;
    /** Maturity date (legacy `EXPI_DT`) for term / fixed-deposit
     *  accounts. Read-only display; blank for current accounts. Sourced
     *  from the Coocon acct-list `maturity_date` field. */
    maturityDate: string;
    accountNickname: string;
    /** Initial Account Details value — empty so the placeholder shows. */
    accountDetails: string;
    /** VAS Code / VAS Account Name (legacy VAS_ACCT_CD / VAS_ACCT_NM).
     *  User-entered; start blank. Rendered + persisted only for non-`H`
     *  product types — the popup hides these columns for product type
     *  `H` and the host omits them from the save payload. */
    vasCode: string;
    vasAccountName: string;
    /** Scraped balance / available balance — preserved off the gateway
     *  response so the register payload's `bal` can persist balance and
     *  a future Balance column (PO decision) can consume them. NOT
     *  rendered today (legacy popup shows no Balance column either). */
    balance: string;
    availableBalance: string;
};

/** Map an NXISAS-scraped account to the popup's BankAccountRow shape.
 *  Shared by LoginCredentialsPanel + BankAccountPanel Add flows.
 *
 *  VAS Code / VAS Account Name start blank (user-entered). They are
 *  rendered + saved to `ACCT_MSTR.VAS_ACCT_CD` / `VAS_ACCT_NM` for
 *  non-`H` product types; for product type `H` the popup hides the
 *  columns and the host omits them from the save payload (legacy
 *  product-type-H parity). */
export function mapScrapedToBankRow(
    acc: ApiScrapedAccount,
    index: number,
): BankAccountRow {
    const accountNo = (acc.acct_num ?? "").trim();
    const currency = (acc.currency ?? "").trim();
    // Account Type auto-fill (two-tier legacy parity):
    //   Tier 1 — prefer the server-mapped ACCT_TYPE_CD resolved from
    //            NXISAS_ACCT_TYPE_MAPPING (or a raw label that is already a
    //            valid code); never store the raw free-text label.
    //   Tier 2 — when Tier 1 yields "", default to Current for the currency
    //            (legacy comm_0218_nxisas.ts:1317-1332), so the dropdown opens
    //            pre-selected instead of blank.
    const mappedAcctTypeCd = normalizeAcctTypeCd(acc.acct_type_cd ?? acc.acct_type);
    return {
        id:               accountNo || `scraped-${index}`,
        accountNo,
        currency,
        accountType:      mappedAcctTypeCd || defaultCurrentAcctTypeCd(currency),
        maturityDate:     (acc.maturity_date ?? "").trim(),
        accountNickname:  (acc.acct_name ?? "").trim(),
        accountDetails:   "",
        vasCode:          "",
        vasAccountName:   "",
        balance:          (acc.balance ?? "").trim(),
        availableBalance: (acc.available_bal ?? "").trim(),
    };
}
