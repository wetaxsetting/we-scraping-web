import type { AccountInquiryRow } from "@/components/shared/AccountInquiryPage";
import type {
    OperationCompanyRow,
    OperationStatusCode,
} from "@/components/addon/operation-status/types";
import type {
    EInvoiceCurrencyTotal,
    EInvoiceRow,
} from "@/components/addon/sales-einvoices/types";
import type {
    OwnAccountRow,
    OwnAccountTotals,
    TransferHistoryTotal,
    TransferRow as FrontTransferRow,
    TransferStatus,
} from "@/components/banking/internal-transfer/types";
import type {
    TransactionRow as FrontTxnRow,
    TransactionTotals,
} from "@/components/banking/transaction-history/types";
import type {
    CashFlowGroup as FrontCashFlowGroup,
    CashFlowReport as FrontCashFlowReport,
    CashFlowSubgroup as FrontCashFlowSubgroup,
    CashFlowDetailRow as FrontCashFlowDetail,
} from "@/components/banking/reports/cash-flow/types";
import type {
    DailyCashAccountRow,
    DailyCashHoldingRow,
    DailyCashSummaryRow,
} from "@/components/banking/reports/daily-cash/types";
import type {
    CurrentAccountRow,
    FinancialStatus,
} from "@/components/banking/reports/daily-financial/types";
import type {
    ApiAccountRow,
    ApiCashFlowGroup,
    ApiCashFlowReport,
    ApiCurrencyTotal,
    ApiCurrentAccountRow,
    ApiDailyCashAccountLedgerRow,
    ApiDailyCashHoldingRow,
    ApiDailyCashSummaryRow,
    ApiEInvoiceRow,
    ApiFinancialStatusRow,
    ApiHsLedgerRow,
    ApiOperationStatusRow,
    ApiTransactionRow,
    ApiTransferRow,
} from "@/lib/types/api";

/**
 * Mappers — UPPER_SNAKE backend DTOs → camelCase frontend row types.
 *
 * The frontend components were built first (static UI) with their own
 * camelCase shapes; rather than rename them everywhere we keep the wire
 * contract UPPER_SNAKE (per project rule) and translate at the boundary.
 *
 * When a backend value doesn't fit a stricter frontend type (e.g.
 * `bankType` is `"Current" | "Savings" | "Fixed"` but DEV emits raw
 * legacy codes), the mapper picks a safe default rather than fail.
 */

// ---------------------------------------------------------------------------
// Banking — Accounts
// ---------------------------------------------------------------------------

const BANK_TYPE_FALLBACK: AccountInquiryRow["bankType"] = "Current";

/**
 * Coerce the backend `ACCT_TYPE_NM` to the strict frontend enum used by
 * legacy callers that branch on the narrow type. The BankCdResolver
 * maps codes (per legacy `wabooks.enums.AcctTypeCd`) to:
 * `Fixed` (02), `Current` (03), `Foreign Current` (04), `Savings` (05),
 * `Foreign Savings` (06), `Current Accounts` (07), `Saving Accounts` (08).
 * We collapse all variants to one of `Current` / `Savings` / `Fixed`
 * so the strict-typed `bankType` field never renders an unknown value.
 *
 * The full label (e.g. `Foreign Current`, `Current Accounts`) is
 * preserved separately on `currencyLabel` so the chip on the FCY page
 * can show the legacy distinction without changing the narrow enum.
 */
function coerceBankType(acctTypeNm: string | undefined): AccountInquiryRow["bankType"] {
    if (!acctTypeNm) return BANK_TYPE_FALLBACK;
    const lower = acctTypeNm.toLowerCase();
    if (lower.includes("fixed") || lower.includes("time deposit") || lower.includes("deposit")) return "Fixed";
    if (lower.includes("saving")) return "Savings";
    if (lower.includes("current")) return "Current";
    return BANK_TYPE_FALLBACK;
}

/**
 * Inquiry-status codes the legacy JEX system treats as success — see
 * `fnsh_0001_001_api_osmc.ts` line 758 (`'00000000'` = "정상처리되었습니다.",
 * `'42110000'` = legacy history-inquiry alt success). Any other non-empty
 * code is a real failure and surfaces the "Error" tag in the Last Update
 * column. NULL / empty means the account has never been inquired against
 * the bank engine — that is NOT an error, just an empty cell.
 */
const SUCCESS_INQ_CODES: ReadonlySet<string> = new Set([
    "00000000",
    "42110000",
]);

function isInquiryError(status: string | null | undefined): boolean {
    if (!status) return false;
    const trimmed = status.trim();
    if (!trimmed) return false;
    return !SUCCESS_INQ_CODES.has(trimmed);
}

export function mapAccountRow(api: ApiAccountRow): AccountInquiryRow {
    const bankType = coerceBankType(api.ACCT_TYPE_NM);
    const ccy = api.CCY_CD?.trim() ?? "VND";
    return {
        id: api.ACCT_SEQ_NO,
        // Legacy BANK_CD — drives the server-side bank filter dropdown.
        // The popover renders bankName as the label but stores bankCd
        // as the option key passed back to `serverPaging.onBankCdChange`.
        bankCd: api.BANK_CD ?? "",
        bankName: api.BANK_NM ?? api.BANK_CD ?? "",
        bankType,
        accountNo: api.ACCT_NO ?? "",
        nickname: api.ACCT_NICK_NM ?? api.BANK_NM ?? "",
        balance: api.BAL ?? "0",
        available: api.REAL_AMT ?? api.BAL ?? "0",
        lastUpdate: api.ACCT_BAL_UPD_DTM ?? "",
        error: isInquiryError(api.ACCT_BAL_INQ_STTS),
        // Currency code drives the row's `formatAmount(...)` call in the page.
        currencyCd: ccy,
        // FCY rows show the FULL backend `ACCT_TYPE_NM` (e.g.
        // "USD • Foreign Current", "KRW • Current Accounts") rather than
        // the narrowed `bankType` so the legacy distinction between local
        // and foreign account types stays visible on the chip. Falls back
        // to the narrow type when the backend hasn't supplied a label.
        // VND rows fall through to the page's default `VND • {bankType}` chip.
        currencyLabel:
            ccy === "VND"
                ? undefined
                : `${ccy} • ${api.ACCT_TYPE_NM?.trim() || bankType}`,
    };
}

const STRICT_CCY_SET: ReadonlySet<OwnAccountRow["currency"]> = new Set([
    "VND",
    "USD",
    "EUR",
    "KRW",
    "JPY",
]);

function coerceCurrency(ccy: string | undefined): OwnAccountRow["currency"] {
    const value = ccy?.trim().toUpperCase() ?? "VND";
    if (STRICT_CCY_SET.has(value as OwnAccountRow["currency"])) {
        return value as OwnAccountRow["currency"];
    }
    return "VND";
}

export function mapOwnAccountRow(api: ApiAccountRow): OwnAccountRow {
    const bankType = coerceBankType(api.ACCT_TYPE_NM);
    return {
        id: api.ACCT_SEQ_NO,
        bankName: api.BANK_NM ?? api.BANK_CD ?? "",
        bankType,
        accountNo: api.ACCT_NO ?? "",
        nickname: api.ACCT_NICK_NM ?? api.BANK_NM ?? "",
        balance: api.BAL ?? "0",
        available: api.REAL_AMT ?? api.BAL ?? "0",
        lastUpdate: api.ACCT_BAL_UPD_DTM ?? "",
        currency: coerceCurrency(api.CCY_CD),
        error: api.ACCT_BAL_INQ_STTS === "ERR" || api.ACCT_BAL_INQ_STTS === "ERROR",
    };
}

// ---------------------------------------------------------------------------
// Banking — Transactions
// ---------------------------------------------------------------------------

export function mapTransactionRow(api: ApiTransactionRow, idx: number): FrontTxnRow {
    const confirmed = api.CONF_YN === "Y";
    return {
        id: `${api.ACCT_SEQ_NO}-${api.TRSC_DT}-${api.TRSC_TM}-${idx}`,
        date: formatLegacyDate(api.TRSC_DT),
        time: formatLegacyTime(api.TRSC_TM),
        deposit: api.DEPOSIT_AMT && api.DEPOSIT_AMT !== "0" ? api.DEPOSIT_AMT : undefined,
        withdraw: api.WITHDRAW_AMT && api.WITHDRAW_AMT !== "0" ? api.WITHDRAW_AMT : undefined,
        balance: api.BAL ?? "0",
        remarks: api.RMRK ?? "",
        confirmed,
        // The backend doesn't expose a discrete purpose/VAS/contact yet —
        // those columns stay empty until Sprint 2 ports the matching panel.
        purpose: undefined,
        vasAccount: undefined,
        contactsName: undefined,
        confirmedBy: confirmed && api.CONFIRMED_BY
            ? { name: api.CONFIRMED_BY, date: formatLegacyDate(api.CONFIRMED_DTM) }
            : undefined,
    };
}

export function mapTransactionTotals(
    rows: FrontTxnRow[],
    api: { DEPOSIT_TOTAL?: string; WITHDRAW_TOTAL?: string; TOTAL_COUNT?: number },
): TransactionTotals {
    return {
        count: api.TOTAL_COUNT ?? rows.length,
        depositTotal: api.DEPOSIT_TOTAL ?? "0",
        withdrawTotal: api.WITHDRAW_TOTAL ?? "0",
    };
}

/** "20250318" → "18-03-2025". Empty/short input passes through unchanged. */
export function formatLegacyDate(value: string | undefined): string {
    if (!value || value.length < 8) return value ?? "";
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return `${d}-${m}-${y}`;
}

/** "021209" → "02:12:09". Empty/short input passes through unchanged. */
export function formatLegacyTime(value: string | undefined): string {
    if (!value || value.length < 6) return value ?? "";
    const hh = value.slice(0, 2);
    const mm = value.slice(2, 4);
    const ss = value.slice(4, 6);
    return `${hh}:${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Banking — Transfer
// ---------------------------------------------------------------------------

export function mapOwnAccountTotals(
    api: { BAL_TOTAL?: string; AVAIL_TOTAL?: string; TOTAL_COUNT?: number },
): OwnAccountTotals {
    return {
        count: api.TOTAL_COUNT ?? 0,
        balance: api.BAL_TOTAL ?? "0",
        available: api.AVAIL_TOTAL ?? "0",
    };
}

const TRANSFER_STATUS: ReadonlyMap<string, TransferStatus> = new Map([
    ["SUCCESS", "success"],
    ["FAIL", "failed"],
    ["FAILED", "failed"],
]);

export function mapTransferRow(api: ApiTransferRow): FrontTransferRow {
    const status = TRANSFER_STATUS.get((api.STATUS ?? "").toUpperCase()) ?? "success";
    return {
        id: api.SEQ_NO,
        date: formatLegacyDate(api.REG_DT),
        time: formatLegacyTime(api.REG_TM),
        fromBank: api.OUT_BANK_NM ?? api.OUT_BANK_CD ?? "",
        fromCurrency: coerceCurrency(api.OUT_CCY_CD),
        fromAccount: api.OUT_ACCT_NO ?? "",
        toBank: api.IN_BANK_NM ?? api.IN_BANK_CD ?? "",
        toCurrency: coerceCurrency(api.IN_CCY_CD),
        toAccount: api.IN_ACCT_NO ?? "",
        amount: api.TRSC_AMT ?? "0",
        remarks: api.RMRK ?? "",
        lastUpdate: "",
        status,
    };
}

export function mapTransferTotals(
    api: ApiCurrencyTotal[] | undefined,
): TransferHistoryTotal {
    // The frontend footer renders a single TransferHistoryTotal — we collapse
    // the multi-currency totals into the first bucket (typically VND for the
    // local tenant). Multi-currency footer support is a Sprint 2 task.
    const first = api?.[0];
    return {
        currency: first?.CCY_CD ?? "VND",
        count: first?.COUNT ?? 0,
        total: first?.AMOUNT ?? "0",
    };
}

// ---------------------------------------------------------------------------
// Reports — Daily Cash
// ---------------------------------------------------------------------------

export function mapDailyCashSummaryRow(api: ApiDailyCashSummaryRow): DailyCashSummaryRow {
    return {
        currencyLabel: api.CCY_CD ?? "",
        cash: api.CASH ?? "0",
        current: api.CURRENT ?? "0",
        savings: api.SAVINGS ?? "0",
        timeDeposit: api.TIME_DEPOSIT ?? "0",
        available: api.AVAILABLE ?? "0",
    };
}

export function mapDailyCashHoldingRow(api: ApiDailyCashHoldingRow): DailyCashHoldingRow {
    return {
        id: api.ID,
        type: api.TYPE,
        currency: api.CCY_CD,
        openingBalance: api.OPENING_BAL ?? "0",
        numDebits: api.NUM_DEBITS ?? 0,
        debit: api.DEBIT ?? "0",
        numCredits: api.NUM_CREDITS ?? 0,
        credit: api.CREDIT ?? "0",
        balance: api.BAL ?? "0",
    };
}

export function mapDailyCashAccountRow(api: ApiDailyCashAccountLedgerRow): DailyCashAccountRow {
    return {
        id: api.ID,
        bank: api.BANK,
        accountNo: api.ACCT_NO,
        currency: api.CCY_CD,
        numDebits: api.NUM_DEBITS ?? 0,
        debit: api.DEBIT ?? "0",
        numCredits: api.NUM_CREDITS ?? 0,
        credit: api.CREDIT ?? "0",
        balance: api.BAL ?? "0",
    };
}

// ---------------------------------------------------------------------------
// Reports — Daily Financial CMC
// ---------------------------------------------------------------------------

export function mapFinancialStatus(api: ApiFinancialStatusRow): FinancialStatus {
    return {
        currency: api.CCY_CD,
        total: api.TOTAL ?? "0",
        currentAccounts: api.CURRENT_ACCOUNTS ?? "0",
        savingAccounts: api.SAVING_ACCOUNTS ?? "0",
    };
}

export function mapCurrentAccountRow(api: ApiCurrentAccountRow): CurrentAccountRow {
    return {
        id: api.ID,
        bank: api.BANK,
        accountNo: api.ACCT_NO,
        accountNickname: api.ACCT_NICK_NM ?? api.BANK,
        currency: api.CCY_CD,
        numDebits: api.NUM_DEBITS ?? 0,
        debit: api.DEBIT ?? "0",
        numInternalDebits: api.NUM_INTERNAL_DEBITS ?? 0,
        internalDebit: api.INTERNAL_DEBIT ?? "0",
        numCredits: api.NUM_CREDITS ?? 0,
        credit: api.CREDIT ?? "0",
        numInternalCredits: api.NUM_INTERNAL_CREDITS ?? 0,
        internalCredit: api.INTERNAL_CREDIT ?? "0",
        balance: api.BAL ?? "0",
    };
}

// ---------------------------------------------------------------------------
// Reports — Daily Financial HS (STUB backend; the frontend uses a richer
// row shape than what the backend currently returns. Full mapping lands
// when the real ledger query is ported in Sprint 2.)
// ---------------------------------------------------------------------------

/**
 * Best-effort projection of the stub HS payload onto the rich frontend
 * `BankGroup` shape. Sprint 1 backend returns a flat row list (DETAIL /
 * SUBTOTAL / TOTAL); the static UI needs grouped sections with subtotals.
 * Returning `null` tells the page wrapper to fall back to its mock data.
 */
export function mapDailyFinancialHsRows(rows: ApiHsLedgerRow[] | undefined): null {
    void rows;
    return null;
}

// ---------------------------------------------------------------------------
// Reports — Cash Flow
// ---------------------------------------------------------------------------

function mapCashFlowGroup(api: ApiCashFlowGroup): FrontCashFlowGroup {
    return {
        id: api.ID,
        labelKo: api.LABEL_KO ?? "",
        labelEn: api.LABEL_EN ?? "",
        subgroups: (api.SUBGROUPS ?? []).map<FrontCashFlowSubgroup>((sg) => ({
            id: sg.ID,
            labelKo: sg.LABEL_KO ?? "",
            labelEn: sg.LABEL_EN ?? "",
            details: (sg.DETAILS ?? []).map<FrontCashFlowDetail>((d) => ({
                id: d.ID,
                itemCode: d.ITEM_CD ?? "",
                itemName: d.ITEM_NM ?? "",
                months: d.MONTHS ?? [],
            })),
        })),
        subTotals: api.SUB_TOTALS ?? [],
    };
}

export function mapCashFlowReport(api: ApiCashFlowReport): FrontCashFlowReport {
    return {
        months: api.MONTHS ?? [],
        openingBalance: api.OPENING_BAL ?? [],
        groups: (api.GROUPS ?? []).map(mapCashFlowGroup),
        salesProfit: api.SALES_PROFIT ?? [],
        nonSalesProfit: api.NON_SALES_PROFIT ?? [],
        endBalance: api.END_BAL ?? [],
    };
}

// ---------------------------------------------------------------------------
// Add-on — e-Invoices
// ---------------------------------------------------------------------------

const STRICT_INVOICE_CCY: ReadonlySet<EInvoiceRow["currency"]> = new Set([
    "VND",
    "USD",
    "KRW",
]);

function coerceInvoiceCurrency(ccy: string | undefined): EInvoiceRow["currency"] {
    const value = ccy?.trim().toUpperCase() ?? "VND";
    if (STRICT_INVOICE_CCY.has(value as EInvoiceRow["currency"])) {
        return value as EInvoiceRow["currency"];
    }
    return "VND";
}

export function mapEInvoiceRow(api: ApiEInvoiceRow): EInvoiceRow {
    return {
        id: api.DOC_ID,
        date: formatLegacyDate(api.ISSU_DT),
        time: formatLegacyTime(api.ISSU_TM),
        invoiceNo: api.EINV_INVOICESYMBOL ?? api.DOC_ID ?? "",
        invoiceType: api.INV_TYPE ?? "",
        buyerName: api.TRCO_CMNM ?? "",
        mstCode: api.TRCO_TAX_ID ?? "",
        buyerStatus: "",
        currency: coerceInvoiceCurrency(api.TRCO_TRSC_CCY_CD),
        totalAmount: api.TOTL_AMT ?? "0",
        invoiceStatus: api.EINV_INVOICESTATUS ?? "",
        taxAmount: api.TAX_AMT_SUM ?? "0",
        amountBeforeTax: api.SPLY_AMT_SUM ?? "0",
    };
}

export function mapEInvoiceTotal(api: ApiCurrencyTotal): EInvoiceCurrencyTotal {
    return {
        currency: coerceInvoiceCurrency(api.CCY_CD),
        count: api.COUNT ?? 0,
        total: api.AMOUNT ?? "0",
    };
}

// ---------------------------------------------------------------------------
// Add-on — Operation Status
// ---------------------------------------------------------------------------

const OP_STATUS_MAP: ReadonlyMap<string, OperationStatusCode> = new Map([
    ["active_certificate_issued", "active_certificate_issued"],
    ["suspended", "suspended"],
    ["not_registered", "not_registered"],
]);

function coerceOpStatus(value: string | undefined): OperationStatusCode {
    if (!value) return "active_certificate_issued";
    const direct = OP_STATUS_MAP.get(value);
    if (direct) return direct;
    const lower = value.toLowerCase();
    if (lower.includes("suspend") || lower.includes("ngừng")) return "suspended";
    if (lower.includes("not") || lower.includes("chưa")) return "not_registered";
    return "active_certificate_issued";
}

export function mapOperationCompanyRow(api: ApiOperationStatusRow): OperationCompanyRow {
    return {
        id: api.TAXCODE,
        companyName: api.COMPANY_NM ?? "",
        taxCode: api.TAXCODE ?? "",
        address: api.OFFICE_ADD ?? "",
        status: coerceOpStatus(api.STATUS_CD),
        lastUpdate: api.LAST_UPDATE ?? "",
    };
}
