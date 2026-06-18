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
 * <p>That mapping table is **not in the refactor DB / table baseline**,
 * so the refactor backend currently returns the raw string unmapped.
 * We therefore accept the value here ONLY when it is already a valid
 * {@code ACCT_TYPE_CD} (forward-compatible with a future backend that
 * does the lookup); any free-text raw label normalizes to {@code ""} so
 * the dropdown stays unset and the user picks one of the three business
 * options (legacy parity: blank when unmappable). The raw string is
 * NEVER stored on the row and NEVER shown as a dropdown option.
 */
export function normalizeAcctTypeCd(rawAcctType: string | null | undefined): string {
    const v = (rawAcctType ?? "").trim();
    return VALID_ACCT_TYPE_CDS.has(v) ? v : "";
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
    return {
        id:               accountNo || `scraped-${index}`,
        accountNo,
        currency:         (acc.currency ?? "").trim(),
        // Prefer the server-mapped ACCT_TYPE_CD (NXISAS_ACCT_TYPE_MAPPING);
        // fall back to normalizing the raw label (yields "" for free-text,
        // so the dropdown stays blank). Never store the raw label.
        accountType:      normalizeAcctTypeCd(acc.acct_type_cd ?? acc.acct_type),
        maturityDate:     (acc.maturity_date ?? "").trim(),
        accountNickname:  (acc.acct_name ?? "").trim(),
        accountDetails:   "",
        vasCode:          "",
        vasAccountName:   "",
        balance:          (acc.balance ?? "").trim(),
        availableBalance: (acc.available_bal ?? "").trim(),
    };
}
