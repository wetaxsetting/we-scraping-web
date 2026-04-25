import type { ResultStatus } from "./types";

/**
 * Mock sub-transaction shape used on every Payment detail page. The same
 * row shape powers both Scheduled and Result detail tables — the Result
 * variant additionally renders the `result` column. Static-UI placeholder
 * until the real per-feature endpoints land.
 */
export type DetailTransaction = {
    id: string;
    /** Two-line "{date}\n{time}" stamp — request submission time
     *  (Result detail: row's first column). */
    dateTime?: string;
    /** Two-line "{date}\n{time}" stamp — bank's result timestamp
     *  (Result detail: separate column from `dateTime`). */
    resultDateTime?: string;
    /** Single-line "{accountPrefix} - {bankName}" — kept for legacy
     *  Scheduled detail rendering. New rows should populate the
     *  `depositBank{Code,Name,Currency}` triple instead. */
    depositBank: string;
    /** Multi-line bank label: bank/account code (e.g. "970458"). */
    depositBankCode?: string;
    /** Multi-line bank label: bank short name (e.g. "SHINHAN"). */
    depositBankName?: string;
    /** Multi-line bank label: 3-letter currency code shown after the
     *  bank glyph (e.g. "USD"). */
    depositBankCurrency?: string;
    accountNo: string;
    recipientName: string;
    transferAmount: string;
    remark: string;
    /** When true, renders "Select Account ↓" in brand color instead of the account value. */
    reportingAccountUnassigned?: boolean;
    reportingAccount: string;
    /** Sub-text under the reporting account label, e.g. "Revenue > Sales". */
    reportingAccountBreadcrumb?: string;
    description: string;
    /** Approval/document reference, e.g. "VO_241030_002". */
    documentNo?: string;
    /** Banking system transaction ID, e.g. "20260205_HJWT". */
    bankingTxnId?: string;
    /** Result-only — outcome reported by the bank. */
    result?: ResultStatus;
};

const banks = [
    { name: "MegaBank", account: "192837465", currency: "VND" },
    { name: "BIDV", account: "0569123456", currency: "VND" },
    { name: "Vietcombank", account: "8210456789", currency: "VND" },
    { name: "Shinhan VN", account: "700022964690", currency: "USD" },
];

const recipients = [
    "Huyen Thao",
    "Saigon Tower JSC",
    "AWS Vietnam Co., Ltd.",
    "Webcash Global Co., Ltd.",
];

const remarks = [
    "MUA KRW THANH TOAN DICH VU CHO WEB",
    "PAYMENT FOR INVOICE 2025-001",
    "MONTHLY SERVICE FEE",
    "OFFICE LEASE - JAN 2025",
];

const reportingAccounts = [
    "2001001 - Payment K1 (BLU)",
    "3001002 - Vendor Payable",
    "4002001 - Operating Expense",
    "5003001 - Payroll Clearing",
];

const reportingBreadcrumbs = [
    "Revenue > Sales",
    "Expenses > Operations",
    "Assets > Fixed",
    "Liabilities > Payroll",
];

const descriptions = [
    "VEHICLE FEE",
    "INFRASTRUCTURE",
    "RENT",
    "PROFESSIONAL SERVICES",
];

const txnIdPrefixes = ["20260205", "20260206", "20260207", "20260208"];
const txnIdSuffixes = ["HJWT", "24CB", "X9KL", "P3MN"];

/**
 * Generates a deterministic list of sub-transactions for a parent row id.
 * Same id always produces the same rows so the static UI looks stable
 * across reloads — uses the id as a seed offset into the static arrays.
 */
export function buildDetailTransactions(
    parentId: string,
    count = 3,
    options: { withResult?: boolean; documentNoPrefix?: string } = {},
): DetailTransaction[] {
    const seed = parseInt(parentId, 10) || 1;
    const results: ResultStatus[] = ["success", "success", "failed", "pending", "cancelled"];
    const docPrefix = options.documentNoPrefix ?? `VO_2502${seed.toString().padStart(2, "0")}_001`;

    return Array.from({ length: count }, (_, i) => {
        const idx = (seed + i) % banks.length;
        const bank = banks[idx];
        // Alternate: even index rows are unassigned (Select Account), odd rows are assigned
        const isUnassigned = i % 2 === 0;
        return {
            id: `${parentId}-${i + 1}`,
            dateTime: options.withResult
                ? `25-Jan-2025 ${(9 + i).toString().padStart(2, "0")}:${((seed * 13 + i * 7) % 60).toString().padStart(2, "0")}`
                : undefined,
            depositBank: `${bank.account.slice(0, 8)} - ${bank.name}`,
            accountNo: bank.account,
            recipientName: recipients[(seed + i) % recipients.length],
            transferAmount:
                bank.currency === "USD"
                    ? `${(1200 + (seed * 100 + i * 50) % 5000).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : `${(800000 * (i + 1)).toLocaleString("de-DE")}`,
            remark: remarks[(seed + i) % remarks.length],
            reportingAccountUnassigned: isUnassigned,
            reportingAccount: isUnassigned ? "" : reportingAccounts[(seed + i) % reportingAccounts.length],
            reportingAccountBreadcrumb: isUnassigned ? undefined : reportingBreadcrumbs[(seed + i) % reportingBreadcrumbs.length],
            description: descriptions[(seed + i) % descriptions.length],
            documentNo: docPrefix,
            // Only first two rows have a banking transaction ID (matches Figma 8:599 pattern)
            bankingTxnId: i < 2
                ? `${txnIdPrefixes[(seed + i) % txnIdPrefixes.length]}_${txnIdSuffixes[(seed + i) % txnIdSuffixes.length]}`
                : undefined,
            result: options.withResult
                ? results[(seed + i) % results.length]
                : undefined,
        };
    });
}
