import type { LoginCredentialRow } from "./types";

/**
 * Static mock rows for the Login Credentials panel. Mirrors Figma 999:21715
 * — six institutions, five Corporate Banking + one e-Invoices, with a
 * couple of multi-account rows so the `+N` badge + popover are visible in
 * the static handoff.
 */
export const mockLoginCredentialRows: LoginCredentialRow[] = [
    {
        id: "lc-1",
        institution: "BIDV",
        type: "corporate_banking",
        accounts: [
            { loginId: "honggildong", password: "honggildong-pw-1!" },
            { loginId: "donghonggil", password: "donghonggil-pw-2@" },
            { loginId: "gilhongdong", password: "gilhongdong-pw-3#" },
        ],
        auditLogActor: "김세명, 비번수정",
        auditLogDate: "20-09-2024",
    },
    {
        id: "lc-2",
        institution: "AGRIBANK",
        type: "corporate_banking",
        accounts: [{ loginId: "honggildong", password: "honggildong-pw-1!" }],
        auditLogActor: "김세명, 비번수정",
        auditLogDate: "20-09-2024",
    },
    {
        id: "lc-3",
        institution: "VIETIN BANK",
        type: "corporate_banking",
        accounts: [{ loginId: "honggildong", password: "honggildong-pw-1!" }],
        auditLogActor: "김세명, 비번수정",
        auditLogDate: "20-09-2024",
    },
    {
        id: "lc-4",
        institution: "기업은행",
        type: "corporate_banking",
        accounts: [{ loginId: "honggildong", password: "honggildong-pw-1!" }],
        auditLogActor: "김세명, 비번수정",
        auditLogDate: "20-09-2024",
    },
    {
        id: "lc-5",
        institution: "우리은행",
        type: "corporate_banking",
        accounts: [
            { loginId: "donghonggil", password: "donghonggil-pw-2@" },
            { loginId: "honggildong", password: "honggildong-pw-1!" },
            { loginId: "gilhongdong", password: "gilhongdong-pw-3#" },
            { loginId: "donghongil", password: "donghongil-pw-4$" },
        ],
        auditLogActor: "김세명, 비번수정",
        auditLogDate: "20-09-2024",
    },
    {
        id: "lc-6",
        institution: "GDT",
        type: "e_invoices",
        accounts: [{ loginId: "donggilhong", password: "donggilhong-pw-5%" }],
        auditLogActor: "김세명, 비번수정",
        auditLogDate: "20-09-2024",
    },
];
