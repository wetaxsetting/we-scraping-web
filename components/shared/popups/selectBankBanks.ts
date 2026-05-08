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
};

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
