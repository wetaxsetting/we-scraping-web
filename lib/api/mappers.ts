import type { AccountInquiryRow } from "@/components/shared/AccountInquiryPage";
import type {
    OperationCompanyRow,
    OperationStatusCode,
} from "@/components/addon/operation-status/types";
import type {
    FirmBankingHistoryRow,
    FirmBankingResult,
    FirmBankingServiceType,
} from "@/components/settings/firm-banking-history/types";
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
    ApiEInvoiceCurrencyTotal,
    ApiEInvoiceRow,
    ApiFinancialStatusRow,
    ApiFirmBankingHistoryRow,
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
 * The chip rendered on every row (VND and FCY) uses this narrowed
 * vocabulary verbatim — `currencyLabel` is built from `bankType`, not
 * from the raw backend label, so `Foreign Current` / `Current Accounts`
 * / `Saving Accounts` collapse to `Current` / `Savings` on screen.
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

/**
 * Translate a backend {@code AccountRow} DTO to the camelCase frontend
 * shape. {@code fallbackCcy} is used when the backend row omits
 * `ccy_cd` (defensive — the live service always echoes it).
 * Callers should pass the page's {@code wireCurrency} so a missing
 * `ccy_cd` on the FCY page does not silently render as VND.
 */
export function mapAccountRow(
    api: ApiAccountRow,
    fallbackCcy: string = "VND",
): AccountInquiryRow {
    const bankType = coerceBankType(api.acct_type_nm);
    const ccy = api.ccy_cd?.trim() || fallbackCcy;
    return {
        id: api.acct_seq_no,
        // Legacy bank_cd — drives the server-side bank filter dropdown.
        // The popover renders bankName as the label but stores bankCd
        // as the option key passed back to `serverPaging.onBankCdChange`.
        bankCd: api.bank_cd ?? "",
        bankName: api.bank_nm ?? api.bank_cd ?? "",
        bankType,
        accountNo: api.acct_no ?? "",
        nickname: api.acct_nick_nm ?? api.bank_nm ?? "",
        balance: api.bal ?? "0",
        available: api.real_amt ?? api.bal ?? "0",
        lastUpdate: api.acct_bal_upd_dtm ?? "",
        error: isInquiryError(api.acct_bal_inq_stts),
        // Currency code drives the row's `formatAmount(...)` call in the page.
        currencyCd: ccy,
        // Non-VND rows render `${ccy} • ${bankType}` (e.g. "USD • Current",
        // "KRW • Savings") using the narrowed type from `coerceBankType` so
        // the chip vocabulary is identical to VND rows — only Fixed /
        // Current / Savings ever appear on screen, regardless of whether
        // the backend emitted "Foreign Current", "Current Accounts", etc.
        // VND rows leave this undefined and the page falls back to its
        // default `VND • {bankType}` chip.
        currencyLabel:
            ccy === "VND"
                ? undefined
                : `${ccy} • ${bankType}`,
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
    const bankType = coerceBankType(api.acct_type_nm);
    return {
        id: api.acct_seq_no,
        bankName: api.bank_nm ?? api.bank_cd ?? "",
        bankType,
        accountNo: api.acct_no ?? "",
        nickname: api.acct_nick_nm ?? api.bank_nm ?? "",
        balance: api.bal ?? "0",
        available: api.real_amt ?? api.bal ?? "0",
        lastUpdate: api.acct_bal_upd_dtm ?? "",
        currency: coerceCurrency(api.ccy_cd),
        error: api.acct_bal_inq_stts === "ERR" || api.acct_bal_inq_stts === "ERROR",
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
    api: { bal_total?: string; avail_total?: string; total_count?: number },
): OwnAccountTotals {
    return {
        count: api.total_count ?? 0,
        balance: api.bal_total ?? "0",
        available: api.avail_total ?? "0",
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
    // IR-7 — backend dropped `INV_TYPE` from the wire. The static UI's
    // `invoiceType` sub-line under the invoice serial was always carrying
    // an `einv_invoicestatus` value (Original / Replacement / …); we
    // continue to populate `invoiceType` from `einv_invoicestatus` so the
    // existing table cell renders identically while the field rename
    // settles in a follow-up MR.
    const status = api.einv_invoicestatus ?? "";
    return {
        id: api.doc_id,
        date: formatLegacyDate(api.issu_dt),
        time: formatLegacyTime(api.issu_tm),
        invoiceNo: api.einv_invoicesymbol ?? api.doc_id ?? "",
        invoiceType: status,
        buyerName: api.trco_cmnm ?? "",
        mstCode: api.trco_tax_id ?? "",
        buyerStatus: "",
        currency: coerceInvoiceCurrency(api.trco_trsc_ccy_cd),
        totalAmount: api.totl_amt ?? "0",
        invoiceStatus: status,
        taxAmount: api.tax_amt_sum ?? "0",
        amountBeforeTax: api.sply_amt_sum ?? "0",
    };
}

export function mapEInvoiceTotal(
    api: ApiEInvoiceCurrencyTotal,
): EInvoiceCurrencyTotal {
    // Preserve the backend bucket key verbatim. Coercing NULL → 'VND'
    // here collapses the NULL bucket onto the real VND bucket, which
    // collides as a duplicate React key in <EInvoiceTableFooter> and
    // double-counts the totals row.
    return {
        currency: api.ccy_cd?.trim() ?? "",
        count: api.count ?? 0,
        total: api.amount ?? "0",
        taxAmount: api.tax_amount ?? "0",
        pretaxAmount: api.pretax_amount ?? "0",
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
        id: api.taxcode,
        companyName: api.company_nm ?? "",
        taxCode: api.taxcode ?? "",
        address: api.office_add ?? "",
        status: coerceOpStatus(api.status_cd),
        lastUpdate: api.last_update ?? "",
    };
}

// ---------------------------------------------------------------------------
// Settings — Firm Banking History
// ---------------------------------------------------------------------------

/**
 * Pre-validated set of the four semantic suffixes the backend's
 * {@code FirmBankingSvcType} enum can ship under {@code svc_type_key}.
 * Used by {@link extractFirmBankingServiceType} to pull the suffix out
 * of a wire i18n key like {@code settings.firm_banking_history.service_type.firm_banking_transaction}
 * and verify it against the {@link FirmBankingServiceType} union.
 *
 * <p>Lifted from the retired {@code coerceFirmBankingServiceType}
 * switch (2026-05-08). The translation from {@code F}/{@code S}/{@code G}/
 * {@code B} → semantic suffix now lives in the backend
 * {@code FirmBankingSvcType} enum. Frontend only validates the
 * already-resolved key.
 */
const FIRM_BANKING_SVC_TYPE_KEY_PREFIX =
    "settings.firm_banking_history.service_type.";
const FIRM_BANKING_SVC_TYPES: ReadonlySet<FirmBankingServiceType> = new Set<
    FirmBankingServiceType
>([
    "firm_banking_transaction",
    "scraping_transfer",
    "vietnam_gdt_inquiry",
    "vietnam_business_inquiry",
]);

/**
 * Translate the wire {@code svc_type_key} (e.g.
 * {@code settings.firm_banking_history.service_type.firm_banking_transaction})
 * into the {@link FirmBankingServiceType} union the panel consumes.
 *
 * <p>Unknown / null keys fall back to {@code firm_banking_transaction}
 * — same default behaviour as the retired
 * {@code coerceFirmBankingServiceType} switch, so the UI never renders
 * an empty service-type cell when the backend ships a code outside the
 * four known legs.
 */
function extractFirmBankingServiceType(
    svcTypeKey: string | null | undefined,
): FirmBankingServiceType {
    if (!svcTypeKey) return "firm_banking_transaction";
    if (!svcTypeKey.startsWith(FIRM_BANKING_SVC_TYPE_KEY_PREFIX)) {
        return "firm_banking_transaction";
    }
    const suffix = svcTypeKey.slice(FIRM_BANKING_SVC_TYPE_KEY_PREFIX.length);
    return FIRM_BANKING_SVC_TYPES.has(suffix as FirmBankingServiceType)
        ? (suffix as FirmBankingServiceType)
        : "firm_banking_transaction";
}

/**
 * Result-code success set — mirrors legacy {@code comm_0221_001.ts:298}
 * exactly. The Firm Banking gateway returns {@code 00000000} on success;
 * NAPAS / EXT_TRAN returns {@code 0000}. Anything else (including
 * {@code 42110000} which is the e-Invoice "no transaction results"
 * code — legacy-treated as failure here) renders as failed.
 */
const FBH_SUCCESS_CODES: ReadonlySet<string> = new Set(["00000000", "0000"]);

/**
 * Map raw {@code rslt_cd} to the panel's 3-state {@link FirmBankingResult}.
 *
 * <p>Empty / null → {@code in_progress} — matches the static UI's
 * yellow "in progress" badge for pending integrations and avoids
 * misclassifying a still-running call as failed.
 */
function coerceFirmBankingResult(rsltCd: string | undefined): FirmBankingResult {
    if (rsltCd === undefined || rsltCd === null) return "in_progress";
    const trimmed = rsltCd.trim();
    if (trimmed === "") return "in_progress";
    return FBH_SUCCESS_CODES.has(trimmed) ? "success" : "failed";
}

/**
 * Slice a 14-char {@code YYYYMMDDHHmmss} legacy timestamp into the
 * existing panel row's {@code date} ({@code YYYY-MM-DD}) and
 * {@code time} ({@code HH:mm:ss}) fields. Pads / truncates defensively
 * so a malformed wire value never throws — mirrors the legacy
 * {@code common.app.formatDateTimeForView} guard.
 */
function splitTarnDtm(tarnDtm: string | undefined): { date: string; time: string } {
    if (!tarnDtm) return { date: "", time: "" };
    const t = tarnDtm.trim();
    if (t.length < 8) return { date: t, time: "" };
    const date = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
    const time = t.length >= 14
        ? `${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`
        : "";
    return { date, time };
}

/**
 * Translate the wire {@link ApiFirmBankingHistoryRow} to the panel's
 * camelCase {@link FirmBankingHistoryRow}. The {@code id} synthesises
 * the per-leg natural identity ({@code svc_type + seq_no}) — the wire
 * does not expose a single surrogate key, but {@code (svc_type, seq_no)}
 * is unique within a tenant per the V_FIRM_BANKING_HISTORY view's PK
 * tuple.
 */
export function mapFirmBankingHistoryRow(api: ApiFirmBankingHistoryRow): FirmBankingHistoryRow {
    const { date, time } = splitTarnDtm(api.tarn_dtm);
    return {
        id: `${api.svc_type ?? ""}-${api.seq_no ?? ""}`,
        date,
        time,
        // serviceType is derived from the server-resolved
        // svc_type_key (settings.firm_banking_history.service_type.*).
        // The backend FirmBankingSvcType enum (common/enums/) is the
        // single source of truth for the F/S/G/B → semantic mapping;
        // the frontend just extracts the suffix and validates it
        // against the FirmBankingServiceType union.
        serviceType: extractFirmBankingServiceType(api.svc_type_key),
        // svc_nm carries the raw legacy value (e.g. "201" for the F
        // leg, "Vietnam Business Inquiry" for B). The panel renders it
        // via t(serviceNameKey) when present, falling back to this raw
        // string when the resolver returned null on the backend.
        serviceName: api.svc_nm ?? "",
        // Server-resolved i18n key — see ApiFirmBankingHistoryRow's
        // Javadoc for the resolver semantics. Pass through verbatim.
        serviceNameKey: api.svc_name_key ?? null,
        seqNo: api.seq_no ?? "",
        instCode: api.dep_bank_cd ?? "",
        result: coerceFirmBankingResult(api.rslt_cd),
        rsltCd: api.rslt_cd ?? "",
        rsltMsg: api.rslt_msg ?? "",
        job: api.job ?? "",
        reqData: api.req_data,
        vanOrgCd: api.van_org_cd,
    };
}
