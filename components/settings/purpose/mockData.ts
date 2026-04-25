import type { PurposeRow, PurposeTabKey } from "./types";

/**
 * Static mock rows for the Purpose panel. Values match the JEX live system
 * screenshot — this is presentation-only data until the settings API lands.
 */
export const mockPurposeRows: Record<PurposeTabKey, PurposeRow[]> = {
    deposit: [
        { id: "dep-1", code: "31", account: "Loan", description: "d", enabled: true },
        { id: "dep-2", code: "", account: "Card Sales Received", description: "d", enabled: false },
        {
            id: "dep-3",
            code: "004",
            account: "A/R Received",
            description: "Received payments that require to match with Contacts or Proofs | e.g.) Matching with Tax Invoices",
            enabled: false,
        },
        {
            id: "dep-4",
            code: "30",
            account: "Other Income",
            description: "Non-operating other incomes | e.g.) Income from the sales of recycled goods, income from outdoor",
            enabled: true,
        },
        { id: "dep-5", code: "34", account: "VAT Refund", description: "", enabled: true },
        { id: "dep-6", code: "32", account: "Financial Investment", description: "", enabled: true },
        { id: "dep-7", code: "33", account: "Advance Payment Received", description: "", enabled: true },
        { id: "dep-8", code: "35", account: "Interest Income", description: "", enabled: true },
        { id: "dep-9", code: "36", account: "Refund from Supplier", description: "", enabled: false },
        { id: "dep-10", code: "37", account: "Insurance Claim", description: "", enabled: false },
    ],
    withdrawal: [
        { id: "w-1", code: "41", account: "A/P Paid", description: "", enabled: true },
        { id: "w-2", code: "42", account: "Salary Payment", description: "Monthly payroll transfers", enabled: true },
        { id: "w-3", code: "43", account: "Tax Payment", description: "", enabled: true },
        { id: "w-4", code: "44", account: "Loan Repayment", description: "", enabled: false },
    ],
    deleted: [
        { id: "del-1", code: "99", account: "Legacy Code", description: "Removed 2024", enabled: false },
    ],
};
