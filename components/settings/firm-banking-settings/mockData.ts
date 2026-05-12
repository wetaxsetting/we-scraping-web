import type { FirmBankingLinkedAccount } from "./types";

/**
 * Static mock for the Firm Banking Settings linked-accounts list —
 * mirrors the Figma frame (134:17061).
 *
 * <p>The panel now fetches the live list via
 * {@code fetchFirmBankingSettings} and only falls back to this mock
 * during offline / failed-fetch development. The shape mirrors the
 * mapper output in {@code lib/api/mappers.ts#mapFirmBankingSettingRow}
 * so the static path renders identically to the live path.
 *
 * <p>Automation toggles are no longer mocked here — they live on the
 * separate environment-settings client
 * ({@code lib/api/environmentSettings}) consumed via the
 * {@code useEnvironmentSettings} hook.
 */
export const mockLinkedAccounts: FirmBankingLinkedAccount[] = [
    // wdrlActNo MUST be cleartext (PK shape — addresses Detail / Update /
    // Delete / Audit endpoints). accountNumber is the masked display
    // string. Earlier revisions kept the masked value in wdrlActNo too,
    // matching the (incorrectly) server-masked wire — that broke every
    // write flow. Mock now mirrors the post-fix wire contract.
    {
        id: "970457-100912150384",
        bank: "woori",
        bankName: "WOORI BANK",
        accountNumber: "1009****0384 (USD)",
        currency: "USD",
        status: "active",
        lastUpdated: "30-10-2024, Krong",
        outBankCd: "970457",
        wdrlActNo: "100912150384",
    },
    {
        id: "970424-700005285280",
        bank: "shinhan",
        bankName: "SHINHAN BANK",
        accountNumber: "7000****5280 (VND)",
        currency: "VND",
        status: "inactive",
        lastUpdated: "30-10-2024, Krong",
        outBankCd: "970424",
        wdrlActNo: "700005285280",
    },
    {
        id: "970424-700022964690",
        bank: "shinhan",
        bankName: "SHINHAN BANK",
        accountNumber: "7000****4690 (VND)",
        currency: "VND",
        status: "active",
        lastUpdated: "30-10-2024, Krong",
        outBankCd: "970424",
        wdrlActNo: "700022964690",
    },
];
