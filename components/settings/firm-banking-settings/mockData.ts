import type {
    FirmBankingAutomationSetting,
    FirmBankingLinkedAccount,
} from "./types";

/**
 * Static mock for the Firm Banking Settings panel — values mirror the
 * Figma frame (134:17061). Replace with the real
 * `/api/v1/settings/firm-banking` calls when the backend lands; the row
 * shape already tracks the expected UPPER_SNAKE → camelCase mapping.
 */
export const mockAutomationSettings: FirmBankingAutomationSetting[] = [
    {
        key: "match_payment_after_history",
        labelKey: "settings.firm_banking_settings.automation.match_payment_after_history",
        enabled: true,
    },
    {
        key: "transfer_after_full_approval",
        labelKey: "settings.firm_banking_settings.automation.transfer_after_full_approval",
        enabled: true,
    },
];

export const mockLinkedAccounts: FirmBankingLinkedAccount[] = [
    {
        id: "fbs-1",
        bank: "woori",
        bankName: "WOORI BANK",
        accountNumber: "0001-000000561-14 (USD)",
        currency: "USD",
        status: "active",
        lastUpdated: "30-10-2024, Krong",
    },
    {
        id: "fbs-2",
        bank: "shinhan",
        bankName: "SHINHAN BANK",
        accountNumber: "0001-031000561-14 (VND)",
        currency: "VND",
        status: "inactive",
        lastUpdated: "30-10-2024, Krong",
    },
    {
        id: "fbs-3",
        bank: "shinhan",
        bankName: "SHINHAN BANK",
        accountNumber: "0001-031000561-14 (VND)",
        currency: "VND",
        status: "active",
        lastUpdated: "30-10-2024, Krong",
    },
];
