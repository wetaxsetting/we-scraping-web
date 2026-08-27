import { formatAmount as formatCurrencyAmount } from "@/lib/currency";
import { recordedTransferNeedsBankApproval } from "@/components/banking/own-account-transfer/bank-profiles";
import type { AccountInquiryRow } from "@/components/shared/AccountInquiryPage";
import type {
    ExchangeRateListResult,
    ExchangeRateRow,
} from "@/components/payment/overseas-payment/types";
import type {
    OperationCompanyRow,
    OperationStatusCode,
} from "@/components/addon/operation-status/types";
import type {
    ErpDirection,
    ErpTransactionHistoryRow,
} from "@/components/settings/erp-transaction-history/types";
import type {
    FirmBankingHistoryRow,
    FirmBankingResult,
    FirmBankingServiceType,
} from "@/components/settings/firm-banking-history/types";
import type {
    AccountLookupOption,
    BankBrand,
    FirmBankingAuditLogRow,
    FirmBankingLinkedAccount,
} from "@/components/settings/firm-banking-settings/types";
import type {
    EInvoiceCurrencyTotal,
    EInvoiceRow,
} from "@/components/addon/sales-einvoices/types";
import type {
    EInvoiceDetail,
    EInvoiceParty,
} from "@/components/addon/einvoices/detailTypes";
import type { NotificationRow } from "@/components/layout/notifications/types";
import type { TaxFilingRow, TaxFilingStatus } from "@/components/addon/tax-filing/types";
import type { ApiVatDeclarationRow, ApiAnnexListResponse, ApiAnnexGroup, ApiAnnexLine, ApiAnnexInvoiceRow, ApiAnnexInvoiceListResponse, ApiAnnexTaxGroup } from "@/lib/types/api";
import type { AnnexListResult, AnnexGroup, AnnexLine, AnnexInvoiceRow, AnnexInvoicePage, AnnexTaxGroup } from "@/components/addon/tax-filing/types";
import type { ApiNotificationRow } from "@/lib/types/api";
import type {
    OwnAccountRow,
    OwnAccountTotals,
    TransferHistoryTotal,
    TransferRow as FrontTransferRow,
    TransferStatus,
} from "@/components/banking/internal-transfer/types";
import type {
    MatchCandidate as FrontMatchCandidate,
    TransactionDetail as FrontTxnDetail,
    TransactionRow as FrontTxnRow,
    TransactionSummary as FrontTxnSummary,
    TransactionTotals,
} from "@/components/banking/transaction-history/types";
import type {
    CashFlowMonthlyAmounts as FrontCashFlowMonthly,
    CashFlowReport as FrontCashFlowReport,
    CashFlowRow as FrontCashFlowRow,
} from "@/components/banking/reports/cash-flow/types";
import type {
    DailyCashAccountRow,
    DailyCashHoldingRow,
    DailyCashSummaryRow,
} from "@/components/banking/reports/daily-cash/types";
import type {
    CurrentAccountRow,
    FinancialStatus,
    TransactionDetailRow,
    TxHistoryResponse,
} from "@/components/banking/reports/daily-financial/types";
import type {
    ApiAccountLookupRow,
    ApiAccountRow,
    ApiCashFlowMonthlyAmounts,
    ApiCashFlowReport,
    ApiCashFlowRow,
    ApiCurrencyTotal,
    ApiCurrentAccountRow,
    ApiDailyFinancialTransactionsReport,
    ApiTransactionDetailRow,
    ApiDailyCashAccountLedgerRow,
    ApiDailyCashHoldingRow,
    ApiDailyCashSummaryRow,
    ApiEInvoiceCurrencyTotal,
    ApiEInvoiceDetailResponse,
    ApiEInvoiceParty,
    ApiEInvoiceRow,
    ApiErpTransactionHistoryRow,
    ApiExchangeRateListResponse,
    ApiExchangeRateRow,
    ApiFinancialStatusRow,
    ApiFirmBankingAuditEntry,
    ApiFirmBankingHistoryRow,
    ApiFirmBankingSettingRow,
    ApiHsLedgerRow,
    ApiMatchCandidateRow,
    ApiOperationStatusRow,
    ApiTransactionDetailResponse,
    ApiTransactionRow,
    ApiTransactionSummaryResponse,
    ApiTransferHistoryResponse,
    ApiTransferHistoryRow,
} from "@/lib/types/api";
import { formatLegacyDtmInDisplayTz } from "@/lib/datetime";

/**
 * Mappers — lowercase snake_case backend DTOs → camelCase frontend row types.
 *
 * The frontend components were built first (static UI) with their own
 * camelCase shapes; the wire contract is lowercase snake_case (CTO directive
 * 2026-05-08, global Jackson SNAKE_CASE strategy) and we translate at the
 * boundary here. A small set of deprecated legacy DTOs (Transfer History)
 * remain UPPER_SNAKE pending retirement.
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
    // Selectable-row derivation mirrors legacy `fnsh_0005_001.ts:701-720`.
    // Manual wins over disconnected (the legacy code branches on
    // `hand_reg_yn` first, falls through to the cert check only when
    // not manual). When the wire flags are absent (older mock seeds or
    // an unmigrated backend), the row stays selectable — backwards
    // compatible.
    const isManual = api.hand_reg_yn === "Y";
    const isDisconnected = api.cert_conn_yn === "N";
    const selectable = !isManual && !isDisconnected;
    const disabledReasonKey: AccountInquiryRow["disabledReasonKey"] = isManual
        ? "account_inquiry.disabled.manual"
        : isDisconnected
            ? "account_inquiry.disabled.disconnected"
            : undefined;
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
        // Scrape-window source for the Bank Transaction Sync popup — NOT
        // the displayed "Last Update". Legacy getInitStartDate() reads
        // TRN_LST_SUC_DTM off fnsh_0001_001_r001.
        trnLastSuccess: api.trn_lst_suc_dtm ?? "",
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
        selectable,
        disabledReasonKey,
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
    const confirmed = api.conf_yn === "Y";
    return {
        id: `${api.acct_seq_no}-${api.trsc_dt}-${api.trsc_tm}-${idx}`,
        trnsSeqNo: api.acct_seq_no,
        date: formatLegacyDate(api.trsc_dt),
        // Raw YYYYMMDD kept so the Date/Time cell re-formats per active
        // locale at render (legacy `fnsh_0002_001` per-language date rule).
        dateRaw: api.trsc_dt,
        time: formatLegacyTime(api.trsc_tm),
        deposit: api.deposit_amt && api.deposit_amt !== "0" ? api.deposit_amt : undefined,
        withdraw: api.withdraw_amt && api.withdraw_amt !== "0" ? api.withdraw_amt : undefined,
        balance: api.bal ?? "0",
        remarks: api.rmrk ?? "",
        confirmed,
        // The backend doesn't expose a discrete purpose/VAS/contact yet —
        // those columns stay empty until Sprint 2 ports the matching panel.
        purpose: undefined,
        vasAccount: undefined,
        contactsName: undefined,
        confirmedBy: confirmed && api.confirmed_by
            ? { name: api.confirmed_by, date: formatLegacyDate(api.confirmed_dtm) }
            : undefined,
        // Raw UTC confirm timestamp for the locale-aware Matched Date fallback.
        confirmedDtmRaw: api.confirmed_dtm || undefined,
        // Transaction ID + Matched file/date/by columns — backend now ships
        // these on the list row (audit BUG-2); previously the grid rendered
        // them blank because the DTO omitted the fields.
        transactionId: api.bank_trns_short_id ?? undefined,
        fileName: api.pay_org_file_nm ?? undefined,
        matchedDate: api.matched_at ? formatLegacyDate(api.matched_at) : undefined,
        // Raw UTC match timestamp — the render formats it per locale + shifts
        // UTC→Vietnam-local (the `matchedDate` slice above is unshifted +
        // locale-blind and is no longer read by the Matched Date cell).
        matchedAtRaw: api.matched_at || undefined,
        matchedBy: api.matched_by ?? undefined,
        linkMatchYn: api.link_match_yn,
        chartAcctSeqNo:           api.chart_acct_seq_no ?? null,
        reportingAccountCode:     api.chart_acct_cd ?? null,
        // Name + breadcrumb are filled in at the page layer by joining
        // against the loaded chart-of-accounts option list — the
        // transaction list endpoint only returns the code + seq_no
        // pair (legacy parity; legacy `fnsh_0200_001` reads the name +
        // level-name from a separate join already cached client-side).
        reportingAccountName:     null,
        reportingAccountBreadcrumb: null,
        useUsagCd:                api.use_usag_cd ?? null,
        // Same client-side join pattern as Reporting Account — the
        // page layer enriches with `purposeCode` / `purposeName` from
        // the loaded purpose list.
        purposeCode:              null,
        purposeName:              null,
        vasAcctCd:                api.vas_acct_cd ?? null,
        // Filled at page layer by joining `vasAcctCd` against the
        // loaded VAS Account option list.
        vasAcctName:              null,
        // Contact snapshot — both the key and the name come straight
        // from the wire (legacy pattern: name is stamped at pick time
        // so the row reads correctly even if the master is renamed).
        rcvPayTrcoKey:            api.rcv_pay_trco_key ?? null,
        rcvPayTrcoNm:             api.rcv_pay_trco_nm ?? null,
        // Row-level memo icon (grid) — count + newest color from MEMO_INFM.
        // Returned for every row; the table renders the icon only on
        // confirmed rows (legacy fnsh_0002_001_osmc_VN runtime parity).
        memoColor:                api.memo_color ?? null,
        memoCount:                api.memo_count ?? 0,
    };
}

export function mapTransactionTotals(
    rows: FrontTxnRow[],
    api: { deposit_total?: string; withdraw_total?: string; total_count?: number },
): TransactionTotals {
    return {
        count: api.total_count ?? rows.length,
        depositTotal: api.deposit_total ?? "0",
        withdrawTotal: api.withdraw_total ?? "0",
    };
}

export function mapTransactionSummary(
    api: ApiTransactionSummaryResponse,
): FrontTxnSummary {
    return {
        totalCount: api.total_count ?? 0,
        confirmedCount: api.confirmed_count ?? 0,
        unconfirmedCount: api.unconfirmed_count ?? 0,
        depositTotal: api.deposit_total ?? "0",
        withdrawTotal: api.withdraw_total ?? "0",
    };
}

export function mapTransactionDetail(
    api: ApiTransactionDetailResponse,
): FrontTxnDetail {
    const confirmed = api.conf_yn === "Y";
    const deposit = api.deposit_amt && api.deposit_amt !== "0" ? api.deposit_amt : undefined;
    const withdraw = api.withdraw_amt && api.withdraw_amt !== "0" ? api.withdraw_amt : undefined;
    return {
        id: `${api.acct_seq_no}-${api.trsc_dt}-${api.trsc_tm}`,
        trnsSeqNo: api.acct_seq_no,
        date: formatLegacyDate(api.trsc_dt),
        time: formatLegacyTime(api.trsc_tm),
        deposit,
        withdraw,
        balance: api.bal ?? "0",
        remarks: api.rmrk ?? "",
        remarks2: api.rmrk2 ?? "",
        bankRefNo: api.bank_ref_no ?? undefined,
        currency: api.ccy_cd ?? undefined,
        confirmed,
        contactsKey: api.rcv_pay_trco_key ?? undefined,
        contactsName: api.rcv_pay_trco_nm ?? undefined,
        purpose: api.rcv_pay_usag_cd ?? undefined,
        vasAccount: api.vas_acct_cd ?? undefined,
        confirmedBy: confirmed && api.confirmed_by_nm
            ? {
                name: api.confirmed_by_nm,
                date: formatLegacyDate(api.confirmed_dtm ?? ""),
            }
            : undefined,
    };
}

/**
 * Smart Organizer candidate row — wire (snake_case) → in-memory camelCase.
 * Keeps `SmartOrganizerDialog` free of raw wire-key reads.
 */
export function mapMatchCandidateRow(api: ApiMatchCandidateRow): FrontMatchCandidate {
    return {
        payTrnsId: api.pay_trns_id,
        payTypeCd: api.pay_type_cd,
        scdulPymnNo: api.scdul_pymn_no,
        scdulPymnDetlNo: api.scdul_pymn_detl_no,
        scdulPymnTypeCd: api.scdul_pymn_type_cd,
        trnfDt: api.trnf_dt,
        trnfDtm: api.trnf_dtm,
        tranAmt: api.tran_amt,
        trnfCcyCd: api.trnf_ccy_cd,
        rcptNm: api.rcpt_nm,
        bnfcBankCd: api.bnfc_bank_cd,
        bnfcBankNm: api.bnfc_bank_nm,
        bnfcAcctNo: api.bnfc_acct_no,
        tranUsag: api.tran_usag,
        titl: api.titl,
        ovrsPymnNo: api.ovrs_pymn_no ?? null,
        ovrsPymnDetlNo: api.ovrs_pymn_detl_no ?? null,
        ovrsPymnTypeCd: api.ovrs_pymn_type_cd ?? null,
        memo: api.memo ?? null,
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

/** Coocon engine "success" sentinel — anything else is a failure code
 *  (engine-specific catalogue echoed verbatim by the backend). Mirrors
 *  `trns_0003_001.ts:326` and `TransferHistoryQueryService.STATUS_SUCCESS`. */
const TRNS_STTS_SUCCESS = "00000000";

/** Format a legacy `YYYYMMDD` token as the Vietnamese `DD-MM-YYYY`
 *  chip used by the Transfer History table per
 *  `trns_0003_001_view.jsp:186`. */
function formatTrnsDate(yyyymmdd: string | undefined): string {
    if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd ?? "";
    return `${yyyymmdd.slice(6, 8)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(0, 4)}`;
}

/** Format a legacy `HHmm` token as `HH:mm`. Pass-through for shorter
 *  inputs (defensive — the backend always emits 4 chars). */
function formatTrnsTime(hhmm: string | undefined): string {
    if (!hhmm || hhmm.length < 4) return hhmm ?? "";
    return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

/** Frontend's `lastUpdate` cell renders an absolute timestamp string —
 *  legacy `trns_0003_001.ts:316-339` builds either `momentObject.fromNow()`
 *  (same day) or `"YYYY/MM/DD HH:mm"` (everything else). The mapper picks
 *  the absolute form so SSR / unit tests are deterministic; the table can
 *  swap in a "X minutes ago" decoration in a future MR without changing
 *  the wire surface. */
function formatLastUpdate(yyyymmdd: string, hhmm: string): string {
    const d = formatTrnsDate(yyyymmdd);
    const t = formatTrnsTime(hhmm);
    if (!d && !t) return "";
    if (!t) return d;
    return `${d} ${t}`;
}

export function mapTransferHistoryRow(api: ApiTransferHistoryRow): FrontTransferRow {
    const status: TransferStatus =
        api.trns_stts === TRNS_STTS_SUCCESS ? "success" : "failed";
    const ccy = coerceCurrency(api.ccy_cd);
    return {
        id: String(api.seq_no),
        date: formatTrnsDate(api.trns_dt),
        time: formatTrnsTime(api.trns_tm),
        fromBank: api.out_bank_nm || api.out_bank_code || "",
        fromCurrency: ccy,
        fromAccount: api.out_acct_no ?? "",
        toBank: api.in_bank_nm || api.in_bank_code || "",
        toCurrency: ccy,
        toAccount: api.in_acct_no ?? "",
        // G3 parity: legacy renders `formatAmount(TRSC_AMT, CCY_CD, false)`
        // (locale separators, no symbol — `trns_0003_001.ts:316`). The wire
        // ships a raw decimal string; format it here at the boundary.
        amount: formatCurrencyAmount(api.trsc_amt, ccy, false),
        remarks: api.rmrk ?? "",
        lastUpdate: formatLastUpdate(api.trns_dt, api.trns_tm),
        status,
        // G8 parity: legacy surfaces TRNS_MSG as the status-cell hover
        // tooltip (`trns_0003_001.ts:127-133`).
        statusMessage: api.trns_msg ?? "",
        // A `_ML` job only REGISTERS the transfer — the bank still needs
        // someone to approve it in internet banking. The history table
        // reuses the same Results-cell tooltip to say so. Only meaningful
        // on a success row; a failed transfer needs no approval.
        needsBankApproval:
            status === "success" &&
            recordedTransferNeedsBankApproval(api.out_bank_code, api.in_bank_code),
    };
}

/**
 * Collapse the response-level totals into the single VND bucket the
 * footer renders today. OQ-5 (feature spec §10) — refactor renders the
 * VND total only, matching legacy `trns_0003_001.ts:243-258`. USD
 * totals ride on the wire (`total_usd_amount` / `total_usd_count`) so a
 * future Figma frame can surface a second footer row without a
 * backend change; consumers can read `api.total_usd_*` directly when
 * that lands.
 */
export function mapTransferHistoryTotals(
    api: ApiTransferHistoryResponse | undefined,
): TransferHistoryTotal {
    return {
        currency: "VND",
        count: Number(api?.total_vnd_count ?? 0),
        // G3 parity: legacy footer renders `formatAmount(TOT_VND_AMT, "VND")`
        // (locale separators + ₫ symbol — `trns_0003_001.ts:251`).
        total: formatCurrencyAmount(api?.total_vnd_amount ?? "0", "VND"),
    };
}

// ---------------------------------------------------------------------------
// Reports — Daily Cash
// ---------------------------------------------------------------------------

export function mapDailyCashSummaryRow(api: ApiDailyCashSummaryRow): DailyCashSummaryRow {
    return {
        currencyLabel: api.ccy_cd ?? "",
        cash: api.cash ?? "0",
        current: api.current ?? "0",
        savings: api.savings ?? "0",
        timeDeposit: api.time_deposit ?? "0",
        available: api.available ?? "0",
    };
}

export function mapDailyCashHoldingRow(api: ApiDailyCashHoldingRow): DailyCashHoldingRow {
    return {
        id: api.id,
        type: api.type,
        currency: api.ccy_cd,
        openingBalance: api.opening_balance ?? "0",
        numDebits: api.num_debits ?? 0,
        debit: api.debit ?? "0",
        numCredits: api.num_credits ?? 0,
        credit: api.credit ?? "0",
        balance: api.balance ?? "0",
    };
}

export function mapDailyCashAccountRow(api: ApiDailyCashAccountLedgerRow): DailyCashAccountRow {
    return {
        id: api.id,
        bank: api.bank,
        accountNo: api.acct_no,
        currency: api.ccy_cd,
        numDebits: api.num_debits ?? 0,
        debit: api.debit ?? "0",
        numCredits: api.num_credits ?? 0,
        credit: api.credit ?? "0",
        balance: api.balance ?? "0",
    };
}

// ---------------------------------------------------------------------------
// Reports — Daily Financial CMC
// ---------------------------------------------------------------------------

export function mapFinancialStatus(api: ApiFinancialStatusRow): FinancialStatus {
    return {
        currency: api.ccy_cd,
        total: api.total ?? "0",
        currentAccounts: api.current_accounts ?? "0",
        savingAccounts: api.saving_accounts ?? "0",
    };
}

export function mapCurrentAccountRow(api: ApiCurrentAccountRow): CurrentAccountRow {
    return {
        id: api.id,
        bank: api.bank,
        bankCd: api.bank_cd ?? "",
        accountNo: api.acct_no,
        accountNickname: api.acct_nickname ?? api.bank,
        currency: api.ccy_cd,
        accountTypeCd: api.acct_type_cd ?? "",
        activeYn: api.actv_yn ?? "Y",
        numDebits: api.num_debits ?? 0,
        debit: api.debit ?? "0",
        numInternalDebits: api.num_internal_debits ?? 0,
        internalDebit: api.internal_debit ?? "0",
        numCredits: api.num_credits ?? 0,
        credit: api.credit ?? "0",
        numInternalCredits: api.num_internal_credits ?? 0,
        internalCredit: api.internal_credit ?? "0",
        balance: api.balance ?? "0",
        transactions: (api.transactions ?? []).map(mapTransactionDetailRow),
    };
}

export function mapTransactionDetailRow(api: ApiTransactionDetailRow): TransactionDetailRow {
    return {
        accountSeqNo: api.acct_seq_no ?? "",
        transactionTime: api.transaction_time ?? "",
        amount: api.amount ?? "0",
        balanceAfter: api.balance_after ?? "0",
        inOutDiv: api.in_out_div ?? "",
        remark: api.remark ?? "",
        rcvPayUsageCd: api.rcv_pay_usage_cd ?? "",
        rcvPayUsageNm: api.rcv_pay_usage_nm ?? "",
    };
}

/**
 * Wire → in-memory translation for the Daily Financial "Transaction
 * History Details" popup. Mirrors legacy `rept_0015_002_r001` response
 * shape; the popup component renders {@link TxHistoryRow} entries
 * directly.
 */
export function mapDailyFinancialTransactionsResponse(
    api: ApiDailyFinancialTransactionsReport,
): TxHistoryResponse {
    return {
        totalCount: api.tot_cnt ?? 0,
        totalIn: api.tot_in_amt ?? "0",
        totalOut: api.tot_out_amt ?? "0",
        closingBalance: api.tot_bal ?? "0",
        pageNo: api.page_no ?? 1,
        pageSize: api.page_per_cnt ?? 15,
        rows: (api.rec ?? []).map((r) => ({
            transactionTime: r.trsc_tm ?? "",
            currency: r.ccy_cd ?? "",
            amount: r.trsc_amt ?? "0",
            balanceAfter: r.bal ?? "0",
            inOutDiv: r.inout_dv ?? "",
            remark: r.rmrk ?? "",
        })),
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

function toStr(v: string | number | null | undefined): string {
    if (v === null || v === undefined) return "";
    return typeof v === "number" ? String(v) : v;
}

function mapCashFlowMonthly(api: ApiCashFlowMonthlyAmounts | undefined): FrontCashFlowMonthly {
    const a = api ?? ({} as ApiCashFlowMonthlyAmounts);
    return {
        jan: toStr(a.jan), feb: toStr(a.feb), mar: toStr(a.mar),
        apr: toStr(a.apr), may: toStr(a.may), jun: toStr(a.jun),
        jul: toStr(a.jul), aug: toStr(a.aug), sep: toStr(a.sep),
        oct: toStr(a.oct), nov: toStr(a.nov), dec: toStr(a.dec),
    };
}

function mapCashFlowRow(api: ApiCashFlowRow): FrontCashFlowRow {
    return {
        displayOrder: api.display_order ?? "",
        displayCd: api.display_cd ?? "",
        displayNm: api.display_nm ?? "",
        itemCd: api.item_cd ?? "",
        itemNm: api.item_nm ?? "",
        rowType: api.row_type ?? "",
        groupCd: api.group_cd ?? "",
        parentL2Cd: api.parent_l2_cd ?? "",
        displayCurrency: api.display_currency ?? "",
        monthly: mapCashFlowMonthly(api.monthly),
        annualTotal: toStr(api.annual_total),
    };
}

export function mapCashFlowReport(api: ApiCashFlowReport): FrontCashFlowReport {
    return {
        year: api.year,
        quarter: api.quarter,
        baseCurrency: api.base_currency ?? "VND",
        usdRate: toStr(api.usd_rate),
        krwRate: toStr(api.krw_rate),
        rows: (api.rows ?? []).map(mapCashFlowRow),
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
        // Keep the RAW wire values — the table / print render them
        // locale-aware at display time (EN DD-MMM-YYYY / KO YYYY-MM-DD /
        // VI DD-MM-YYYY) via `formatLocalDtmByLanguage`. `issu_dt` is the
        // legacy ISSU_DT calendar date (date-only, zone-free → no TZ
        // shift); `issu_tm` is the REG_DTM[8..14] time proxy rendered as
        // a wall-clock HH:mm:ss. Pre-formatting here would freeze the
        // date into one locale's layout (the DD-MM-YYYY bug).
        date: api.issu_dt?.trim() ?? "",
        time: api.issu_tm?.trim() ?? "",
        // Full display invoice number (legacy "1C26TWV-240" = DISP_DOC_ID),
        // NOT the bare serial symbol. Falls back to the symbol then the raw
        // doc id when DISP_DOC_ID is blank (hand-registered / legacy rows).
        // Mirrors the backend export INVOICE_NO = firstNonBlank(dispDocId, symbol).
        invoiceNo:
            api.disp_doc_id?.trim() ||
            api.einv_invoicesymbol?.trim() ||
            api.doc_id ||
            "",
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

/**
 * "View e-Invoice Details" popup — wire → in-memory. Values stay RAW
 * (dates = legacy `YYYYMMDD` / `HHmmss`; amounts = decimal strings); the
 * modal formats them at display time (same rule the list rows follow).
 * Seller / buyer already come resolved from the backend (identity swapped
 * by doc type; bank + sign columns not swapped).
 */
export function mapEInvoiceDetail(api: ApiEInvoiceDetailResponse): EInvoiceDetail {
    return {
        docId: api.doc_id ?? "",
        docType: api.doc_type ?? "",
        invoiceTitle: nz(api.invoice_title),
        numericSymbol: nz(api.numeric_symbol),
        invoiceSymbol: nz(api.invoice_symbol),
        handDocId: nz(api.hand_doc_id),
        invoiceStatus: nz(api.invoice_status),
        mccqt: nz(api.mccqt),
        qrcode: nz(api.qrcode),
        originalInvoice: nz(api.original_invoice),
        issuDt: nz(api.issu_dt),
        currencyCd: nz(api.currency_cd),
        rate: nz(api.rate),
        listNumber: nz(api.list_number),
        listDate: nz(api.list_date),
        paymentType: nz(api.payment_type),
        testResult: nz(api.test_result),
        seller: mapEInvoiceParty(api.seller),
        buyer: mapEInvoiceParty(api.buyer),
        items: (api.items ?? []).map((it) => ({
            dispOrd: it.disp_ord ?? null,
            itemNm: nz(it.item_nm),
            productName: nz(it.product_name),
            itemSpec: nz(it.item_spec),
            itemQunt: nz(it.item_qunt),
            itemUnitAmt: nz(it.item_unit_amt),
            dcAmt: nz(it.dc_amt),
            taxRate: nz(it.tax_rate),
            splyAmt: nz(it.sply_amt),
        })),
        fees: (api.fees ?? []).map((f) => ({
            dispOrd: f.disp_ord ?? null,
            feeName: nz(f.fee_name),
            fee: nz(f.fee),
        })),
        taxes: (api.taxes ?? []).map((tx) => ({
            taxRate: nz(tx.tax_rate),
            amt: nz(tx.amt),
            taxAmt: nz(tx.tax_amt),
        })),
        totals: {
            splyAmtSum: nz(api.totals?.sply_amt_sum),
            taxAmtSum: nz(api.totals?.tax_amt_sum),
            totlFeeAmt: nz(api.totals?.totl_fee_amt),
            totlDisAmt: nz(api.totals?.totl_dis_amt),
            totlAmt: nz(api.totals?.totl_amt),
            totalAmtInLetter: nz(api.totals?.total_amt_in_letter),
        },
    };
}

function mapEInvoiceParty(api: ApiEInvoiceParty | null | undefined): EInvoiceParty {
    return {
        name: nz(api?.name),
        taxId: nz(api?.tax_id),
        address: nz(api?.address),
        phone: nz(api?.phone),
        fullName: nz(api?.full_name),
        citizenId: nz(api?.citizen_id),
        bankAcc: nz(api?.bank_acc),
        bankName: nz(api?.bank_name),
        signBy: nz(api?.sign_by),
        signDate: nz(api?.sign_date),
        signTime: nz(api?.sign_time),
    };
}

/** null/undefined → "" (matches the legacy `common.app.null2void`). */
function nz(v: string | null | undefined): string {
    return v == null ? "" : v;
}

// ---------------------------------------------------------------------------
// Add-on — Operation Status
// ---------------------------------------------------------------------------

// Stable code set the backend `OperationStatusService.resolveStatusCd`
// emits — the legacy `aosv_0001_001.companyStatus` map 1:1. Unrecognised /
// blank → "unknown" (frontend renders the raw GDT string verbatim, legacy
// `status:""` fallback). Never defaults to "active" — the retired 3-state
// model (active / suspended / not_registered) is gone.
const OP_STATUS_CODES: ReadonlySet<OperationStatusCode> = new Set<OperationStatusCode>([
    "active",
    "active_certificate_issued",
    "active_tax_notice_issued",
    "address_mismatch",
    "bankruptcy_in_progress",
    "closed",
    "mst_terminated",
    "on_closing",
    "pending_address_verification",
    "pending_personal_id_update",
    "tax_code_issued",
    "tax_office_changed",
    "temporarily_closed",
    "unknown",
]);

function coerceOpStatus(value: string | undefined): OperationStatusCode {
    if (value && OP_STATUS_CODES.has(value as OperationStatusCode)) {
        return value as OperationStatusCode;
    }
    return "unknown";
}

export function mapOperationCompanyRow(api: ApiOperationStatusRow): OperationCompanyRow {
    return {
        id: api.taxcode,
        companyName: api.company_nm ?? "",
        taxCode: api.taxcode ?? "",
        address: api.office_add ?? "",
        status: coerceOpStatus(api.status_cd),
        companyStatusRaw: api.company_status ?? "",
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
 * Map raw {@code rslt_cd} to the panel's {@link FirmBankingResult}.
 *
 * <p><b>GAP-2 parity fix (2026-06-05).</b> Legacy
 * {@code comm_0221_001.ts:298-302} is binary: {@code rslt_cd ∈
 * {00000000, 0000}} ⇒ green Success, <b>everything else — including
 * null / blank — ⇒ red Failed</b>. A previous revision mapped
 * null / blank to yellow "In Progress", which the legacy screen never
 * produces (verified against 8 real rows with null {@code rslt_cd}:
 * 7 F-leg + 1 S-leg). Null / blank now coerces to {@code failed} to
 * match the live system. The {@code in_progress} state is retained in
 * the {@link FirmBankingResult} union for the status-pill styling but
 * is no longer produced from the wire.
 */
function coerceFirmBankingResult(rsltCd: string | undefined): FirmBankingResult {
    if (rsltCd === undefined || rsltCd === null) return "failed";
    const trimmed = rsltCd.trim();
    if (trimmed === "") return "failed";
    return FBH_SUCCESS_CODES.has(trimmed) ? "success" : "failed";
}

// (No date formatting happens here for firm-banking-history: `tarn_dtm`
//  is ALREADY Vietnam local wall-clock for every leg — the
//  FirmBankingHistoryView normalizes each leg to VN: `kr_to_vn_time(...)`
//  for the F leg (KR→VN) and a UTC→VN conversion of the UTC-stored
//  `REG_DTM` for the S/G/B legs (FirmBankingHistoryView.java "VN-localized
//  timestamp"). The 14-char value is passed through to the row and
//  formatted at render time via `formatLocalDtmByLanguage` — NO timezone
//  shift, locale-aware date layout. The earlier `formatLegacyDtmInDisplayTz`
//  call double-shifted it by +7h, which was wrong.)

/**
 * Translate the wire {@link ApiFirmBankingHistoryRow} to the panel's
 * camelCase {@link FirmBankingHistoryRow}. The {@code id} synthesises
 * the per-leg natural identity from
 * {@code (svc_type, job, seq_no, tarn_dtm)} — the wire does not expose
 * a single surrogate key, and the {@code (svc_type, seq_no)} pair is
 * NOT unique on its own: the scraping_transfer (S) leg in particular
 * spawns multiple sub-jobs (TRANSFER / BALANCE / TRANSACTION /
 * CARD_USING) that can share a {@code seq_no}, which crashed React
 * with a duplicate-key warning. Adding {@code job} disambiguates
 * sub-calls within the same leg; adding {@code tarn_dtm} covers
 * retries of the same (svc_type, job, seq_no) tuple across calls.
 */
export function mapFirmBankingHistoryRow(api: ApiFirmBankingHistoryRow): FirmBankingHistoryRow {
    return {
        id: `${api.svc_type ?? ""}-${api.job ?? ""}-${api.seq_no ?? ""}-${api.tarn_dtm ?? ""}`,
        // VN-local wall-clock — passed through raw; the panel formats it
        // per the active language with NO timezone shift.
        tarnDtm: api.tarn_dtm ?? "",
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

// =====================================================================
//  Settings — Firm Banking Settings (Phase 3 read-only slice — Path A)
// =====================================================================

/**
 * Mirror of the Java {@code com.kosign.wecms.common.security.LogMask#acct}
 * helper — reveals the first 4 and last 4 digits with the middle
 * replaced by a fixed-width run of asterisks. Short values
 * (≤ 8 chars) fully masked. {@code null} / blank → fixed mask.
 *
 * <p>The mask is presentation-layer only: it is applied to the row's
 * displayed account number, NOT to the {@code wdrlActNo} PK field
 * that drives Detail / Update / Delete / Audit reads. The PK must
 * stay cleartext — the backend's
 * {@code @Pattern("^[A-Za-z0-9-]{1,100}$")} guard rejects asterisks.
 *
 * <p>Earlier revisions masked server-side and let the frontend echo
 * the wire value, but that broke every write flow because the FE
 * lost access to the cleartext PK. Masking is now FE-only and
 * confined to the displayed string.
 */
function maskAccountNumber(raw: string | null | undefined): string {
    if (raw == null) return "";
    const s = raw.trim();
    if (s.length === 0 || s.length <= 8) return "***";
    const first = s.slice(0, 4);
    const last = s.slice(-4);
    const mid = "*".repeat(s.length - 8);
    return `${first}${mid}${last}`;
}

/**
 * NAPAS bank-code → static-UI {@link BankBrand} mapping. Mirrors the
 * three banks DEV verified on 2026-05-09 (OQ-8). Codes outside this
 * map fall back to the initial-letter `<BankLogo>` rendering — no
 * exception thrown, since OQ-8a's resolution will determine if such
 * codes are even creatable in v1; Path A is read-only.
 */
const NAPAS_TO_BRAND: Record<string, BankBrand> = {
    "970424": "shinhan",
    "970436": "vcb",
    "970457": "woori",
};

/**
 * NAPAS bank-code → short English display name shown in the Linked
 * Accounts list. Mirrors the legacy hardcoded TS map in
 * {@code WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/comm/comm_0220_001.ts:260-270}
 * — the live system resolves these strings client-side, NOT from the
 * API wire. Neither {@code TB_FIRM_BANK_CODE.BANK_NM} (long Vietnamese
 * legal name like "Ngân hàng TNHH MTV Shinhan Việt Nam") nor
 * {@code BANK_ENG_NM} (verbose for Vietcombank: "Joint Stock
 * Commercial Bank for Foreign Trade of Vietnam") matches the legacy
 * display, so the refactor keeps the same client-side resolver.
 *
 * <p>Codes outside this map fall back to the wire {@code bank_nm}
 * (which today is the long Vietnamese legal name; defence in depth in
 * case OQ-8a expands the bounded-bank set later).
 */
const NAPAS_TO_SHORT_NAME: Record<string, string> = {
    "970424": "Shinhan Bank",
    "970436": "Vietcom Bank",
    "970457": "Woori Bank",
};

/**
 * Wire {@code (mod_dttm | reg_dttm, last_edtr)} → "DD-MM-YYYY, &lt;name&gt;"
 * display string mirroring the Figma row layout
 * ({@code 30-10-2024, Krong}). Used by the linked-accounts list. Falls
 * back gracefully when either input is missing so the row never shows
 * the literal string "undefined".
 *
 * <p>The 14-char wire value is UTC per the backend convention (see
 * `wecms-api/.../FirmBankingSettingsService.java:319`). Convert
 * once via the shared {@link formatLegacyDtmInDisplayTz} so the row
 * shows the date the user observed locally — a UTC instant late in
 * the day (e.g. 23:30 UTC) is the next calendar day in Asia/Ho_Chi_Minh,
 * and the legacy substring split would have shown the wrong day.
 */
function formatLastUpdated(timestamp: string | null, editor: string | null): string {
    const { date: datePart } = formatLegacyDtmInDisplayTz(timestamp);
    const editorPart = (editor ?? "").trim();
    if (datePart && editorPart) return `${datePart}, ${editorPart}`;
    return datePart || editorPart;
}

// (Previously a local `splitRegDtm` helper lived here; replaced by the
//  shared `formatLegacyDtmInDisplayTz` from `@/lib/datetime` so the
//  audit-log row interprets `reg_dtm` as UTC and renders in
//  Asia/Ho_Chi_Minh, matching what the user actually saw on the
//  clock when the audit row was written.)

/**
 * Translate the wire {@link ApiFirmBankingSettingRow} to the panel's
 * camelCase {@link FirmBankingLinkedAccount}. The {@code id} synthesises
 * the natural PK ({@code out_bank_cd + wdrl_act_no}); the
 * {@code biz_key} component is implicit (every row in the response is
 * already scoped to the caller's tenant).
 *
 * <p><b>Masking — split-shape rule.</b> The wire ships cleartext
 * {@code wdrl_act_no} as the row PK (the frontend addresses it for
 * Delete / Update / Detail / Audit reads — the backend's
 * {@code @Pattern("^[A-Za-z0-9-]{1,100}$")} guard rejects masked
 * characters). The mapper produces TWO output fields from the same
 * wire value:
 * <ul>
 *   <li>{@code wdrlActNo} = the wire cleartext value, used as the PK
 *       for every API call originating from this row;</li>
 *   <li>{@code accountNumber} = the displayed string, masked via
 *       {@link maskAccountNumber} and decorated with currency suffix
 *       ({@code "7000****5280 (VND)"}) — used by the row body, kebab
 *       row, and detail dialog "loading" placeholder. NEVER passed
 *       into an API call.</li>
 * </ul>
 *
 * <p>This split is the fix for the Phase-3 delete bug where the
 * masked value was reaching {@code DELETE /…/{wdrl_act_no}} and being
 * 400'd by the backend's character-class regex.
 *
 * <p>{@code status} maps {@code org_stat = "1"} (AVAILABLE) → "active";
 * every other discriminator → "inactive". Mirrors the JEX semantic
 * where AVAILABLE is the operational status. No FSM (V22) so the
 * mapping has no transition logic.
 */
export function mapFirmBankingSettingRow(api: ApiFirmBankingSettingRow): FirmBankingLinkedAccount {
    const brand: BankBrand = NAPAS_TO_BRAND[api.out_bank_cd] ?? "vcb";
    // Bank display name mirrors legacy comm_0220_001.ts:260-270 — a
    // frontend-side resolver keyed by NAPAS code. The wire's `bank_nm`
    // (V_FIRM_BANKING_SETTING.BANK_NM, COALESCE(BUSI, ENG)) is only
    // used as a defensive fallback for codes outside the bounded set;
    // for the supported 3 banks the short English label always wins.
    const shortName = NAPAS_TO_SHORT_NAME[api.out_bank_cd];
    const bankName = (shortName ?? api.bank_nm ?? api.out_bank_cd).trim();
    // Cleartext PK from the wire — never display this value, never
    // log it without `LogMask`. ONLY use it as the PK in API paths.
    const wdrlActNoPk = api.wdrl_act_no ?? "";
    // Masked display — frontend-side, presentation only. Currency
    // suffix appended when ccy_cd is present (LEFT JOIN to ACCT_MSTR
    // hit) so the row reads "7000****5280 (VND)".
    const masked = maskAccountNumber(wdrlActNoPk);
    const accountNumber = api.ccy_cd ? `${masked} (${api.ccy_cd})` : masked;
    return {
        id: `${api.out_bank_cd}-${wdrlActNoPk}`,
        bank: brand,
        bankName,
        accountNumber,
        currency: api.ccy_cd,
        status: api.org_stat === "1" ? "active" : "inactive",
        lastUpdated: formatLastUpdated(api.mod_dttm ?? api.reg_dttm, api.last_edtr),
        // Raw UTC timestamp + editor — the dialog re-formats per the
        // active language (the pre-formatted `lastUpdated` is the fallback).
        lastUpdatedDtm: api.mod_dttm ?? api.reg_dttm,
        lastUpdatedEditor: api.last_edtr,
        outBankCd: api.out_bank_cd,
        wdrlActNo: wdrlActNoPk,
    };
}

/**
 * Translate the wire {@link ApiFirmBankingAuditEntry} to the audit
 * dialog's display row. {@code reg_dtm} (yyyyMMddHHmmss) splits into
 * {@code date} / {@code time}; {@code audit_logs_actv_dtl} is rendered
 * verbatim (the backend writes one row per locale and the read filter
 * picks the caller's, so the string is already in the right language).
 */
export function mapFirmBankingAuditEntry(api: ApiFirmBankingAuditEntry): FirmBankingAuditLogRow {
    // reg_dtm is a UTC instant; the dialog shifts it to VN + renders per
    // active language. Keep the pre-split date/time as a fallback.
    const { date, time } = formatLegacyDtmInDisplayTz(api.reg_dtm);
    return {
        id: `${api.reg_dtm}-${api.reg_id}`,
        dtm: api.reg_dtm,
        date,
        time,
        user: api.reg_nm,
        activityDetail: api.audit_logs_actv_dtl,
    };
}

/**
 * Translate one wire `ApiAccountLookupRow` into the in-memory
 * autocomplete option consumed by `NewFirmBankingDialog`.
 *
 * Composes the display label client-side: `<masked> (<ccy>)` when
 * the wire ships a currency, falling back to the masked digits
 * alone when `ccy_cd` is empty. Mirrors legacy `comm_0220_002.ts`
 * which renders `formatAccountNo(rawAcctNo) + " (" + ccyCd + ")"`
 * for every row in the dropdown. The backend supplies
 * `acct_no_masked` already in the legacy mask shape so the dialog
 * never re-implements `LogMask.acct`.
 */
export function mapAccountLookupOption(api: ApiAccountLookupRow): AccountLookupOption {
    const masked = api.acct_no_masked || api.acct_no;
    const ccy = (api.ccy_cd ?? "").trim();
    const displayLabel = ccy ? `${masked} (${ccy})` : masked;
    return {
        acctNo: api.acct_no,
        acctNoMasked: masked,
        displayLabel,
        ccyCd: api.ccy_cd ?? "",
        acctNickNm: api.acct_nick_nm,
        acctNm: api.acct_nm,
    };
}

/**
 * Translate the wire {@link ApiErpTransactionHistoryRow} to the panel's
 * camelCase {@link ErpTransactionHistoryRow}. The wire carries both raw
 * legacy codes ({@code erp_type}, {@code trns_type_cd}) and server-
 * resolved i18n keys ({@code erp_type_key}, {@code trns_type_key}) per
 * the {@code wecms-api/CLAUDE.md §"Domain enums"} contract — the
 * frontend renders the localised string via {@code t(key)} and falls
 * back to the raw code only when the key is null.
 *
 * <p>{@code erp_type} is constrained to the closed {@link ErpDirection}
 * set via narrowing — the mapper drops any out-of-set value to {@code "D"}
 * (the safest fallback: every legacy row with a known-bad direction is
 * implicitly a deleted record from the operator's point of view). This
 * defensive narrowing exists for type-safety only; backend validation
 * already rejects unknown direction codes server-side.
 */
export function mapErpTransactionHistoryRow(
    api: ApiErpTransactionHistoryRow,
): ErpTransactionHistoryRow {
    const erpType: ErpDirection =
        api.erp_type === "W" || api.erp_type === "E" || api.erp_type === "D"
            ? api.erp_type
            : "D";
    return {
        seqNo: api.seq_no,
        orgFileNm: api.org_file_nm,
        saveFileNm: api.save_file_nm,
        fileSize: api.file_size,
        erpType,
        erpTypeKey: api.erp_type_key,
        trnsTypeCd: api.trns_type_cd,
        trnsTypeKey: api.trns_type_key,
        regDtm: api.reg_dtm,
        regId: api.reg_id,
        userNm: api.user_nm,
    };
}

// ---------------------------------------------------------------------------
// Payment — Approval Box
// ---------------------------------------------------------------------------

import type {
    ApiApprovalBoxApprover,
    ApiApprovalBoxListResponse,
    ApiApprovalBoxRow,
    ApiApprovalBoxTabCounts
} from "@/lib/types/api";
import type {
    ApprovalApprover,
    ApprovalRow,
    ApprovalStatus,
    ApprovalType,
    ApproverStatus,
    CurrencyTotal,
    TabCounts
} from "@/components/payment/approval-box/types";

const APPR_STTS_TO_STATUS: Record<"P" | "I" | "C" | "R" | "A" | "X", ApprovalStatus> = {
    P: "pending",
    I: "in_progress",
    C: "approved",
    A: "approved",
    R: "rejected",
    X: "rejected",
};

const TYPE_SLUGS: ReadonlySet<ApprovalType> = new Set([
    "payroll",
    "vendor",
    "expense",
    "corporate_card",
    "overseas",
    "internal_transfer",
]);

function coerceTypeKey(slug: string | null): ApprovalType | null {
    if (!slug) return null;
    return TYPE_SLUGS.has(slug as ApprovalType) ? (slug as ApprovalType) : null;
}

function coerceApprovalCurrency(code: string): "VND" | "USD" | "KRW" {
    return code === "USD" || code === "KRW" ? code : "VND";
}

/** Format `yyyyMMddHHmmss` → `dd-MM-yyyy HH:mm:ss` for the approver hover-card timestamp.
 *  Exported as the single shared approver acted-at formatter — the Approval
 *  Details dialog's `chainToDialogApprovers` (Scheduled Payment entry points)
 *  delegates here so Approval Box and Vendor / Expense render the approver
 *  timestamp in one identical format (with seconds). */
export function formatActedAt(dtm: string | null): string | null {
    if (!dtm || dtm.length !== 14) return null;
    return `${dtm.slice(6, 8)}-${dtm.slice(4, 6)}-${dtm.slice(0, 4)} ${dtm.slice(8, 10)}:${dtm.slice(10, 12)}:${dtm.slice(12, 14)}`;
}

/** Format `yyyyMMddHHmmss` → `dd-MMM-yyyy` for the list row's Date cell. */
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatRegDate(dtm: string): string {
    if (!dtm || dtm.length < 8) return dtm;
    const day = dtm.slice(6, 8);
    const monthIdx = Number(dtm.slice(4, 6)) - 1;
    const year = dtm.slice(0, 4);
    if (monthIdx < 0 || monthIdx > 11) return dtm;
    return `${day}-${MONTH_ABBR[monthIdx]}-${year}`;
}

/** `YYYYMMDD` → `DD-MM-YYYY`. */
function formatScheduledDate(d: string | null): string | undefined {
    if (!d || d.length !== 8) return undefined;
    return `${d.slice(6, 8)}-${d.slice(4, 6)}-${d.slice(0, 4)}`;
}


export function mapApprovalBoxApprover(api: ApiApprovalBoxApprover): ApprovalApprover {
    const status: ApproverStatus =
        api.apprvr_stts === "P" || api.apprvr_stts === "A" || api.apprvr_stts === "R" ||
        api.apprvr_stts === "W" || api.apprvr_stts === "S"
            ? api.apprvr_stts
            : "P";
    return {
        lineNo: api.apprvr_line_no,
        userId: api.apprvr_id,
        userName: api.apprvr_nm,
        userImgUrl: api.user_img_url,
        status,
        actedAt: formatActedAt(api.appr_dtm),
        // Raw UTC APPR_DTM — the shared chip formats it locale + timezone
        // aware (VN local) so it matches the Approval Details popup.
        actedAtRaw: api.appr_dtm ?? null,
    };
}

export function mapApprovalBoxRow(api: ApiApprovalBoxRow, currentUserId: string | null): ApprovalRow {
    const approvers = api.approvers.map(mapApprovalBoxApprover);
    const status = APPR_STTS_TO_STATUS[api.appr_stts] ?? "pending";
    const statusStep =
        api.appr_stts === "I" || api.appr_stts === "C" || api.appr_stts === "A" || api.appr_stts === "R" || api.appr_stts === "X"
            ? `${api.apprvr_appr_tot_cnt}/${api.apprvr_tot_cnt}`
            : undefined;
    const mine = currentUserId
        ? approvers.find((a) => a.userId === currentUserId)
        : undefined;
    return {
        id: api.appr_seq_no,
        apprSeqNo: api.appr_seq_no,
        date: formatRegDate(api.reg_dtm),
        dateRaw: api.reg_dtm ?? undefined,
        payDateRaw: api.pay_date ?? undefined,
        type: "", // resolved at render time via t(`approval.type.${typeKey}`)
        typeKey: coerceTypeKey(api.type_label),
        documentNo: api.doc_no,
        title: api.title,
        cont: api.cont,
        fileName: api.file_name ?? "", // COALESCE(SCDUL.TITL, OVRS.TITL), resolved server-side
        currency: coerceApprovalCurrency(api.currency),
        amount: api.tot_pay_amt ?? "0",
        status,
        statusStep,
        scheduledDate: formatScheduledDate(api.pay_date),
        requestor: api.draft_user_nm,
        approver: approvers[0]?.userName ?? "",
        // Legacy `comm_0195_001.ts:535` count math: X = approvers with
        // APPRVR_STTS='A', Y = total approvers in the chain.
        // The wire already carries both as integers — use them verbatim
        // so a fresh request reads "0/N" instead of just "N".
        approverCount: api.apprvr_tot_cnt > 0
            ? `${api.apprvr_appr_tot_cnt}/${api.apprvr_tot_cnt}`
            : undefined,
        approvers,
        actionable: mine?.status === "P",
        payEndYn: api.pay_end_yn,
    };
}

export type MappedApprovalBoxList = {
    rows: ApprovalRow[];
    totalCount: number;
    tabCounts: TabCounts;
    /** Footer document count — TAB-UNFILTERED, full result set (legacy
     *  `resl_0001_001` footer). Distinct from {@link totalCount}, which is
     *  the tab-filtered count driving pagination. */
    footerDocumentCount: number;
    /** Footer currency totals (USD / VND / KRW), server-computed over the
     *  full tab-unfiltered result set — always all three, in order. */
    footerCurrencyTotals: CurrencyTotal[];
    pageNumber: number;
    pageSize: number;
    totalPages: number;
};

export function mapApprovalBoxList(
    api: ApiApprovalBoxListResponse,
    currentUserId: string | null,
): MappedApprovalBoxList {
    const tabCounts = mapTabCounts(api.tab_counts, api.total_count);
    const footer = mapApprovalBoxFooterTotals(api.footer_totals);
    return {
        rows: api.list.map((row) => mapApprovalBoxRow(row, currentUserId)),
        totalCount: api.total_count,
        tabCounts,
        footerDocumentCount: footer.documentCount,
        footerCurrencyTotals: footer.totals,
        pageNumber: api.page_number,
        pageSize: api.page_size,
        totalPages: api.total_pages,
    };
}

function mapTabCounts(api: ApiApprovalBoxTabCounts, _total: number): TabCounts {
    // `draft` is preserved on the frontend tab model for static-UI parity
    // but the backend does not emit a count for it (see discovery.md §10
    // OQ-1) — always renders 0 until the PO confirms a real draft tab.
    //
    // `all` is the SUM of the per-status counts, NOT the response's
    // `total_count` field. `total_count` is the filtered row count and
    // changes every time the user clicks a status tab; the All tab must
    // stay stable so the user can see the overall total at a glance
    // regardless of which status filter is currently active. The backend
    // emits `tab_counts` as full per-status counts independent of the
    // active filter, so summing them gives the canonical total.
    const pending     = api.pending     ?? 0;
    const in_progress = api.in_progress ?? 0;
    const approved    = api.approved    ?? 0;
    const rejected    = api.rejected    ?? 0;
    return {
        all: pending + in_progress + approved + rejected,
        draft: 0,
        pending,
        in_progress,
        approved,
        rejected,
    };
}

/**
 * Map the server-computed footer totals (document count + per-currency
 * amount sums) into the shape the footer renders. Totals are TAB-UNFILTERED
 * and span the full result set — they replace the former page-slice
 * client calculation so the footer is correct across pages and tabs
 * (matches legacy `resl_0001_001`). Always emits USD / VND / KRW in order,
 * even when a currency has no rows.
 */
function mapApprovalBoxFooterTotals(
    api: ApiApprovalBoxListResponse["footer_totals"] | undefined,
): { documentCount: number; totals: CurrencyTotal[] } {
    const amountByCcy: Record<CurrencyTotal["currency"], number> = {
        USD: Number(api?.total_usd_amount ?? 0),
        VND: Number(api?.total_vnd_amount ?? 0),
        KRW: Number(api?.total_krw_amount ?? 0),
    };
    const order: CurrencyTotal["currency"][] = ["USD", "VND", "KRW"];
    return {
        documentCount: api?.total_document_count ?? 0,
        totals: order.map((currency) => {
            const amount = amountByCcy[currency];
            return {
                currency,
                total: formatCurrencyAmount(
                    Number.isFinite(amount) ? amount : 0,
                    currency,
                    false,
                ),
            };
        }),
    };
}

/* ----------------------------------------------------------------------------
 *  Internal Transfer mappers
 *
 *  Translate the Phase A backend wire (`lib/types/api.ts` Api*Internal*
 *  + Api*Transfer*) into camelCase semantic types pages consume. The
 *  in-memory shapes are declared inline here so a future feature MR can
 *  promote them to `lib/types/internalTransfer.ts` once a second consumer
 *  materialises — single consumer today is the rewired Scheduled
 *  Transfer / Transfer Result pages (Phase B follow-up).
 *
 *  Decimal strings from the wire stay as strings on the in-memory shape
 *  — `formatAmount(...)` from `lib/currency.ts` is the only sanctioned
 *  way to render them for display.
 * -------------------------------------------------------------------------- */

import type {
    ApiInternalTransferCurrencyTotal,
    ApiScheduledTransferDetailResponse,
    ApiScheduledTransferListResponse,
    ApiScheduledTransferRow,
    ApiTransferLineDetail,
    ApiTransferResultDetailResponse,
    ApiTransferResultLine,
    ApiTransferResultListResponse,
    ApiTransferResultRow
} from "@/lib/types/api";

export interface InternalTransferCurrencyTotal {
    totalAmount: string;
    totalCount: number;
    ccyCd: string;
    totalTransactionCount: number;
}

export interface ScheduledTransferRow {
    scdulPymnNo: string;
    scdulPymnTypeCd: string;
    ccyCd: string;
    titl: string;
    apprSeqNo: string | null;
    totalTranAmt: string;
    totTrnsCnt: string;
    regDtm: string;
    regId: string;
    /** Requester display name (legacy `EXPT_RESOL_MSTR.DRAFT_USER_NM`); null →
     *  the Requestor column falls back to `regId`. */
    draftUserNm: string | null;
    /** Phase B — null until EXPT_RESOL_MSTR join lands. */
    apprStts: string | null;
    apprSttsKey: string | null;
    trnfStts: string | null;
    trnfYn: "Y" | "N";
    outBankCd: string;
    wdrlActNo: string;
    payDate: string | null;
    fileNm: string | null;
    docNo: string | null;
    wdrlCcyCd: string | null;
    /** First approver's display name (legacy `APPRVR_NM`); null when the
     *  batch has no approval request yet. */
    approver: string | null;
    /** Total approvers in the chain (legacy "[N]" badge); null pre-approval. */
    approverCount: number | null;
    /** Full approval chain for the click popup (Phase 2); empty pre-approval. */
    approvers: ScheduledTransferApprover[];
}

/** One approver row for the Scheduled Transfer approver popup. */
export interface ScheduledTransferApprover {
    /** Approver display name. */
    name: string;
    /** Single-letter status code (P/A/R/W/S) → `approval.approver_status.*`. */
    status: string;
    /** Pre-formatted `dd-MM-yyyy HH:mm:ss`, or null when not yet acted ("-").
     *  Legacy fallback — prefer {@link actedAtRaw}. */
    actedAt: string | null;
    /** Raw legacy 14-char UTC `APPR_DTM` wire value. Drives the locale +
     *  timezone-aware acted-at in the shared approver chip. */
    actedAtRaw?: string | null;
}

export interface ScheduledTransferList {
    totalCount: number;
    page: number;
    size: number;
    currencyTotals: InternalTransferCurrencyTotal[];
    rows: ScheduledTransferRow[];
}

export interface TransferLineDetail {
    scdulPymnDetlNo: string;
    antDivCd: string | null;
    rcptNm: string | null;
    tarBankCd: string | null;
    /** Server-resolved human-readable bank name (legacy
     *  `wb_get_napas_bank_nm_or_citad_bank_nm`). Null when the lookup
     *  misses — the Deposit Bank cell falls back to the code alone. */
    tarBankNm: string | null;
    fincMdaNo: string;
    tranUsag: string | null;
    tranAmt: string;
    ccyCd: string;
    trcoKey: string | null;
    handTrcoKey: string | null;
    docNo: string | null;
    note: string | null;
    citadBankCd: string | null;
    chartAcctCd: string | null;
    chartAcctSeqNo: string | null;
    /** Ancestor breadcrumb for the chart-of-accounts code (e.g.
     *  `"EXPENSES > PAYMENT"`). Server-built; null when the row has no
     *  chart account or the chain misses. */
    chartAcctBreadcrumb: string | null;
    depoCcyCd: string | null;
    bankTrnsShortId: string | null;
}

export interface ScheduledTransferDetail {
    scdulPymnNo: string;
    scdulPymnTypeCd: string;
    outBankCd: string;
    /** Resolved withdrawal-bank name (legacy `OUT_BANK_NM`); null → fall back
     *  to `outBankCd`. */
    outBankNm: string | null;
    wdrlActNo: string;
    titl: string;
    totalTranAmt: string;
    totTrnsCnt: string;
    docNo: string | null;
    regId: string;
    /** `yyyyMMddHHmmss` registration timestamp of the batch (legacy
     *  `REG_DTM`). The canonical "Requested by … on …" source for the
     *  Approval Details footer — formatted identically from every entry
     *  point so the same document reads the same requested-at value. */
    regDtm: string;
    /** Requester display name (legacy `EXPT_RESOL_MSTR.DRAFT_USER_NM`); null →
     *  fall back to `regId`. */
    requestor: string | null;
    apprSeqNo: string | null;
    apprStts: string | null;
    apprSttsKey: string | null;
    trnfYn: "Y" | "N";
    trnfDtm: string | null;
    ccyCd: string;
    wdrlCcyCd: string | null;
    orgFileNm: string | null;
    fileSize: string | null;
    rows: TransferLineDetail[];
    /** User-supplied attachments persisted at Request Approval submit
     *  time. Empty when the batch has not been submitted yet or when
     *  the user submitted with zero files. */
    attachments: ApprovalAttachment[];
    /** Payroll Type code (`EXPT_RESOL_MSTR.APPR_FUND_TP`) — `"0"`=Salary,
     *  `"1"`=Bonus, `"9"`=Other; null for non-payroll batches. Resolved to a
     *  label by `resolvePayrollTypeLabel` at the Approval Box call site. */
    apprFundTp: string | null;
}

/** Frontend-side projection of one row in
 *  `ApiScheduledTransferDetailResponse.attachments`. */
export interface ApprovalAttachment {
    fileId:    string;
    orgFileNm: string;
    /** Decimal byte count (string-typed for legacy parity); null when
     *  the upload had no Content-Length. */
    fileSize:  string | null;
    /** Display name of the user who attached the file. */
    regNm:     string;
    /** `yyyyMMddHHmmss`. */
    regDtm:    string;
    /** Source legacy table — `EXPT_RESOL_FILE` or `EXPT_RESOL_PAY_EVID_FILE`
     *  (GAP-ATT-1). Defaults to `EXPT_RESOL_FILE` when absent on the wire so
     *  a download routes to the original table. */
    fileType:  string;
}

export interface TransferResultRow {
    scdulPymnNo: string;
    scdulPymnTypeCd: string;
    ccyCd: string;
    titl: string;
    /** Original Excel name from the master row — populated from
     *  `ScdulPymnSumr.orgFileNm` by the backend mapper. Used by the
     *  "File Name" column on the legacy pymn_0010_001 view. */
    fileNm: string | null;
    totalTranAmt: string;
    totTrnsCnt: string;
    totTrnsSuccCnt: string | null;
    totTrnsErrorCnt: string | null;
    trnfStts: string | null;
    regDtm: string;
    apprSeqNo: string | null;
    docNo: string | null;
}

export interface TransferResultList {
    totalCount: number;
    page: number;
    size: number;
    currencyTotals: InternalTransferCurrencyTotal[];
    rows: TransferResultRow[];
}

export interface TransferResultLine {
    scdulPymnDetlNo: string;
    tranAmt: string;
    antDivCd: string | null;
    rcptNm: string | null;
    tarBankCd: string | null;
    tarBankNm: string | null;
    fincMdaNo: string;
    tranUsag: string | null;
    ccyCd: string;
    trnfCcyCd: string | null;
    depoCcyCd: string | null;
    note: string | null;
    docNo: string | null;
    chartAcctCd: string | null;
    chartAcctSeqNo: string | null;
    bankTrnsShortId: string | null;
    /** Per-line banking-match state (G21b read path). */
    linkMatchYn: string | null;
    acctSeqNo: string | null;
    bankTrnsFullId: string | null;
    procStat: string | null;
    procStatKey: string | null;
    procDttm: string | null;
    rsltDttm: string | null;
    rsCd: string | null;
    rsMsg: string | null;
}

export interface TransferResultDetail {
    scdulPymnNo: string;
    outBankCd: string;
    /** Resolved withdrawal-bank name (legacy `OUT_BANK_NM`); null → fall back
     *  to `outBankCd`. */
    outBankNm: string | null;
    wdrlActNo: string;
    titl: string;
    totalTranAmt: string;
    totTrnsCnt: string;
    apprSeqNo: string | null;
    docNo: string | null;
    ccyCd: string;
    wdrlCcyCd: string | null;
    trnfYn: "Y" | "N";
    trnfDtm: string | null;
    orgFileNm: string | null;
    fileSize: string | null;
    /** Creator login id (legacy `REG_ID`); fallback for the Requestor row when
     *  `requestor` (draft user name) is null. */
    regId: string | null;
    /** Requester display name (legacy `EXPT_RESOL_MSTR.DRAFT_USER_NM`); null →
     *  fall back to `regId`. */
    requestor: string | null;
    sucCnt: string | null;
    errCnt: string | null;
    prcCnt: string | null;
    rows: TransferResultLine[];
}

export function mapInternalTransferCurrencyTotal(
    api: ApiInternalTransferCurrencyTotal,
): InternalTransferCurrencyTotal {
    return {
        totalAmount:           api.total_amount,
        totalCount:            api.total_count,
        ccyCd:                 api.ccy_cd,
        totalTransactionCount: api.total_transaction_count,
    };
}

export function mapScheduledTransferRow(api: ApiScheduledTransferRow): ScheduledTransferRow {
    return {
        scdulPymnNo:     api.scdul_pymn_no,
        scdulPymnTypeCd: api.scdul_pymn_type_cd,
        ccyCd:           api.ccy_cd,
        titl:            api.titl,
        apprSeqNo:       api.appr_seq_no,
        totalTranAmt:    api.total_tran_amt,
        totTrnsCnt:      api.tot_trns_cnt,
        regDtm:          api.reg_dtm,
        regId:           api.reg_id,
        draftUserNm:     api.draft_user_nm ?? null,
        apprStts:        api.appr_stts,
        apprSttsKey:     api.appr_stts_key,
        trnfStts:        api.trnf_stts,
        trnfYn:          api.trnf_yn,
        outBankCd:       api.out_bank_cd,
        wdrlActNo:       api.wdrl_act_no,
        payDate:         api.pay_date,
        fileNm:          api.file_nm,
        docNo:           api.doc_no,
        wdrlCcyCd:       api.wdrl_ccy_cd,
        approver:        api.approver ?? null,
        approverCount:   api.approver_count ?? null,
        approvers:       (api.approvers ?? []).map((a) => ({
            name:    a.apprvr_nm ?? "",
            status:  a.apprvr_stts ?? "",
            actedAt: formatActedAt(a.appr_dtm ?? null),
            // Raw UTC APPR_DTM — shared chip formats it locale + timezone aware.
            actedAtRaw: a.appr_dtm ?? null,
            userImgUrl: a.user_img_url ?? null,
        })),
    };
}

export function mapScheduledTransferList(
    api: ApiScheduledTransferListResponse,
): ScheduledTransferList {
    return {
        totalCount:     api.total_count,
        page:           api.page,
        size:           api.size,
        currencyTotals: (api.currency_totals ?? []).map(mapInternalTransferCurrencyTotal),
        rows:           (api.rows ?? []).map(mapScheduledTransferRow),
    };
}

export function mapTransferLineDetail(api: ApiTransferLineDetail): TransferLineDetail {
    return {
        scdulPymnDetlNo:     api.scdul_pymn_detl_no,
        antDivCd:            api.ant_div_cd,
        rcptNm:              api.rcpt_nm,
        tarBankCd:           api.tar_bank_cd,
        tarBankNm:           api.tar_bank_nm,
        fincMdaNo:           api.finc_mda_no,
        tranUsag:            api.tran_usag,
        tranAmt:             api.tran_amt,
        ccyCd:               api.ccy_cd,
        trcoKey:             api.trco_key,
        handTrcoKey:         api.hand_trco_key,
        docNo:               api.doc_no,
        note:                api.note,
        citadBankCd:         api.citad_bank_cd,
        chartAcctCd:         api.chart_acct_cd,
        chartAcctSeqNo:      api.chart_acct_seq_no,
        chartAcctBreadcrumb: api.chart_acct_breadcrumb,
        depoCcyCd:           api.depo_ccy_cd,
        bankTrnsShortId:     api.bank_trns_short_id,
    };
}

export function mapScheduledTransferDetail(
    api: ApiScheduledTransferDetailResponse,
): ScheduledTransferDetail {
    return {
        scdulPymnNo:     api.scdul_pymn_no,
        scdulPymnTypeCd: api.scdul_pymn_type_cd,
        outBankCd:       api.out_bank_cd,
        outBankNm:       api.out_bank_nm,
        wdrlActNo:       api.wdrl_act_no,
        titl:            api.titl,
        totalTranAmt:    api.total_tran_amt,
        totTrnsCnt:      api.tot_trns_cnt,
        docNo:           api.doc_no,
        regId:           api.reg_id,
        regDtm:          api.reg_dtm,
        requestor:       api.requestor,
        apprSeqNo:       api.appr_seq_no,
        apprStts:        api.appr_stts,
        apprSttsKey:     api.appr_stts_key,
        trnfYn:          api.trnf_yn,
        trnfDtm:         api.trnf_dtm,
        ccyCd:           api.ccy_cd,
        wdrlCcyCd:       api.wdrl_ccy_cd,
        orgFileNm:       api.org_file_nm,
        fileSize:        api.file_size,
        rows:            (api.rows ?? []).map(mapTransferLineDetail),
        attachments:     (api.attachments ?? []).map((a) => ({
            fileId:    a.file_id,
            orgFileNm: a.org_file_nm,
            fileSize:  a.file_size,
            regNm:     a.reg_nm,
            regDtm:    a.reg_dtm,
            fileType:  a.file_type ?? "EXPT_RESOL_FILE",
        })),
        apprFundTp:      api.appr_fund_tp ?? null,
    };
}

export function mapTransferResultRow(api: ApiTransferResultRow): TransferResultRow {
    return {
        scdulPymnNo:     api.scdul_pymn_no,
        scdulPymnTypeCd: api.scdul_pymn_type_cd,
        ccyCd:           api.ccy_cd,
        titl:            api.titl,
        fileNm:          api.file_nm,
        totalTranAmt:    api.total_tran_amt,
        totTrnsCnt:      api.tot_trns_cnt,
        totTrnsSuccCnt:  api.tot_trns_succ_cnt,
        totTrnsErrorCnt: api.tot_trns_error_cnt,
        trnfStts:        api.trnf_stts,
        regDtm:          api.reg_dtm,
        apprSeqNo:       api.appr_seq_no,
        docNo:           api.doc_no,
    };
}

export function mapTransferResultList(
    api: ApiTransferResultListResponse,
): TransferResultList {
    return {
        totalCount:     api.total_count,
        page:           api.page,
        size:           api.size,
        currencyTotals: (api.currency_totals ?? []).map(mapInternalTransferCurrencyTotal),
        rows:           (api.rows ?? []).map(mapTransferResultRow),
    };
}

export function mapTransferResultLine(api: ApiTransferResultLine): TransferResultLine {
    return {
        scdulPymnDetlNo: api.scdul_pymn_detl_no,
        tranAmt:         api.tran_amt,
        antDivCd:        api.ant_div_cd,
        rcptNm:          api.rcpt_nm,
        tarBankCd:       api.tar_bank_cd,
        tarBankNm:       api.tar_bank_nm,
        fincMdaNo:       api.finc_mda_no,
        tranUsag:        api.tran_usag,
        ccyCd:           api.ccy_cd,
        trnfCcyCd:       api.trnf_ccy_cd,
        depoCcyCd:       api.depo_ccy_cd,
        note:            api.note,
        docNo:           api.doc_no,
        chartAcctCd:     api.chart_acct_cd,
        chartAcctSeqNo:  api.chart_acct_seq_no,
        bankTrnsShortId: api.bank_trns_short_id,
        // Per-line banking-match state (G21b read path).
        linkMatchYn:     api.link_match_yn,
        acctSeqNo:       api.acct_seq_no,
        bankTrnsFullId:  api.bank_trns_full_id,
        procStat:        api.proc_stat,
        procStatKey:     api.proc_stat_key,
        procDttm:        api.proc_dttm,
        rsltDttm:        api.rslt_dttm,
        rsCd:            api.rs_cd,
        rsMsg:           api.rs_msg,
    };
}

export function mapTransferResultDetail(
    api: ApiTransferResultDetailResponse,
): TransferResultDetail {
    return {
        scdulPymnNo:  api.scdul_pymn_no,
        outBankCd:    api.out_bank_cd,
        outBankNm:    api.out_bank_nm,
        wdrlActNo:    api.wdrl_act_no,
        titl:         api.titl,
        totalTranAmt: api.total_tran_amt,
        totTrnsCnt:   api.tot_trns_cnt,
        apprSeqNo:    api.appr_seq_no,
        docNo:        api.doc_no,
        ccyCd:        api.ccy_cd,
        wdrlCcyCd:    api.wdrl_ccy_cd,
        trnfYn:       api.trnf_yn,
        trnfDtm:      api.trnf_dtm,
        orgFileNm:    api.org_file_nm,
        fileSize:     api.file_size,
        regId:        api.reg_id,
        requestor:    api.requestor,
        sucCnt:       api.suc_cnt,
        errCnt:       api.err_cnt,
        prcCnt:       api.prc_cnt,
        rows:         (api.rows ?? []).map(mapTransferResultLine),
    };
}

// ---------------------------------------------------------------------------
// Banking — Exchange Rate Inquiry
// ---------------------------------------------------------------------------

/** Map one wire rate row → camelCase in-memory shape. */
export function toExchangeRateRow(wire: ApiExchangeRateRow): ExchangeRateRow {
    return {
        ccyCd: wire.ccy_cd,
        refCcyCd: wire.ref_ccy_cd,
        basicRate: wire.basic_rate,
        basicTran: wire.basic_tran,
        buyAmt: wire.buy_amt,
        sellAmt: wire.sell_amt,
        tranBuyAmt: wire.tran_buy_amt,
        tranSellAmt: wire.tran_sell_amt,
        standPoint: wire.stand_point,
        lastUpdateDate: wire.last_update_date,
        lastUpdateTime: wire.last_update_time,
        exchRateRegDtm: wire.exch_rate_reg_dtm,
    };
}

/** Map the full exchange rate list response → camelCase envelope. */
export function toExchangeRateListResult(wire: ApiExchangeRateListResponse): ExchangeRateListResult {
    return {
        refDate: wire.ref_date,
        bankCd: wire.bank_cd,
        bankNm: wire.bank_nm,
        rates: wire.rates.map(toExchangeRateRow),
        rounds: wire.rounds ? wire.rounds.map((r) => ({
            seqNo: r.seq_no,
            lastUpdateTime: r.last_update_time,
        })) : [],
    };
}

// ---------------------------------------------------------------------------
// Settings — Login Credentials (slug "login-credentials")
//
// Maps the wire shape from /api/v1/login-credentials onto the existing
// `LoginCredentialRow` panel type so the table + popups stay
// untouched. Two notable translations:
//
//   1. Wire `type` is "BANK" | "GDT"; the panel's `type` enum is
//      "corporate_banking" | "e_invoices". The mapping is fixed —
//      BANK → corporate_banking, GDT → e_invoices.
//   2. The wire `accounts[].login_id` is the plaintext username; the
//      panel's `LoginCredentialAccount.password` is purely a UI seed
//      (the real password is fetched on-demand via the /reveal
//      endpoint, which only fires AFTER the user re-authenticates).
//      Map to a masked placeholder so the popover renders dots
//      regardless of state — the reveal flow overwrites this with
//      the decrypted value when called.
//   3. The legacy panel keys row state by `row.id` (string). We
//      synthesise an id from `type + bank_cd` so re-fetching the
//      list keeps React's keyed identity stable; this matches the
//      shape `<LoginCredentialsTable>` already expects.
// ---------------------------------------------------------------------------
import type {
    ApiLoginCredentialAccount,
    ApiLoginCredentialAuditResponse,
    ApiLoginCredentialAuditRow,
    ApiLoginCredentialGroup,
    ApiLoginCredentialListResponse,
} from "@/lib/types/api";
import type {
    LoginCredentialRow,
    LoginCredentialType,
} from "@/components/settings/login-credentials/types";
import type { LoginCredentialAuditLogRow } from "@/components/settings/login-credentials/auditLogs";

/** Placeholder shown in the popover until the user explicitly reveals
 *  the password via the /reveal endpoint. The real plaintext is
 *  never delivered by the list endpoint. */
const MASKED_PASSWORD_PLACEHOLDER = "**********";

const WIRE_TYPE_TO_PANEL_TYPE: Record<
    ApiLoginCredentialGroup["type"],
    LoginCredentialType
> = {
    BANK: "corporate_banking",
    GDT:  "e_invoices",
};

/** Map the wire `account` shape into the panel's account model. */
function mapLoginCredentialAccount(wire: ApiLoginCredentialAccount): {
    loginId:   string;
    password:  string;
    /** Server-side seq_no — needed by the panel when wiring
     *  Delete / Reveal / Audit Logs (single-row PK). */
    seqNo:     number;
    /** Sub-type label projected from `CERT_INFO_DETL_CON3`. Normalised
     *  to `null` when missing or whitespace-only so the popover's
     *  conditional render path is a simple truthy check. */
    loginType: string | null;
} {
    const rawType = wire.login_type;
    const trimmed = typeof rawType === "string" ? rawType.trim() : "";
    return {
        loginId:   wire.login_id ?? "",
        password:  MASKED_PASSWORD_PLACEHOLDER,
        seqNo:     wire.seq_no,
        loginType: trimmed.length > 0 ? trimmed : null,
    };
}

/** Map one wire group → one panel row. */
export function mapLoginCredentialGroup(
    wire: ApiLoginCredentialGroup,
): LoginCredentialRow & {
    /** Discriminator the panel needs when firing Delete / Reveal —
     *  drives the {type}/{seqNo} path segment. The panel's own enum
     *  is locale-friendly UI vocabulary; this one is wire vocabulary. */
    apiType:  "bank" | "gdt";
    /** Seq_no the audit-logs popup needs to fetch history for a
     *  specific row. The popup operates on the FIRST account today
     *  (parity with legacy `comm_0218_001.ts:175`). */
    apiSeqNo: number;
    /** Original BANK_CD for BANK rows — needed when the Registered
     *  chain opens "Add Login" against an existing bank so the new
     *  credential POST targets the same group. Null for GDT. */
    bankCd:   string | null;
} {
    // Accounts come back ordered by SEQ_NO ASC; the first one is the
    // canonical row for Audit Logs (and the only one for GDT).
    const accounts = wire.accounts.map(mapLoginCredentialAccount);
    const first = accounts[0];

    // Synthesise a deterministic React key so re-fetches keep row
    // identity stable. BANK groups key on bank_cd; GDT is a singleton.
    const idSeed = wire.type === "BANK"
        ? `bank-${wire.bank_cd ?? "unknown"}`
        : "gdt";

    // The static panel's `auditLogActor` / `auditLogDate` cells render
    // "{modifiedBy}, {action}" + a date. Backend ships `modified_by` +
    // `modified_at` (yyyyMMddHHmmss). We project the same fields, but
    // leave the action label off — the panel doesn't show it for
    // backend-sourced rows. The date string is the raw 14-char value;
    // the table cell already formats it via the panel's existing
    // helper, so we pass YYYYMMDD only.
    const auditDate = wire.modified_at
        ? formatAuditDate(wire.modified_at)
        : "";

    // Linked bank accounts (per-BANK_CD) → drives the Registered popup's
    // "Bank Account" column + `+N` badge. Null-safe: GDT rows and any
    // legacy wire without the field collapse to an empty list.
    const bankAccounts = (wire.bank_accounts ?? []).map((a) => ({
        bankCd:     a.bank_cd,
        acctNo:     a.acct_no,
        acctNickNm: a.acct_nick_nm,
    }));

    return {
        id:            idSeed,
        institution:   wire.institution,
        type:          WIRE_TYPE_TO_PANEL_TYPE[wire.type],
        accounts,
        bankAccounts,
        auditLogActor: wire.modified_by ?? "",
        // Raw UTC instant — the table shifts to VN + renders per active
        // language. `auditLogDate` kept as a non-locale fallback.
        auditLogDtm:   wire.modified_at ?? "",
        auditLogDate:  auditDate,
        apiType:       wire.type === "BANK" ? "bank" : "gdt",
        apiSeqNo:      first?.seqNo ?? 0,
        bankCd:        wire.bank_cd,
    };
}

/** Format `yyyyMMddHHmmss` → `DD-MM-YYYY`. Matches the table cell's
 *  rendered date format (`auditLogs.ts`). */
function formatAuditDate(legacy14: string): string {
    if (legacy14.length < 8) return legacy14;
    const yyyy = legacy14.slice(0, 4);
    const mm   = legacy14.slice(4, 6);
    const dd   = legacy14.slice(6, 8);
    return `${dd}-${mm}-${yyyy}`;
}

/** Map the wire list response into an array of panel rows ready to
 *  feed `<LoginCredentialsTable rows={...} />`. */
export function mapLoginCredentialList(
    wire: ApiLoginCredentialListResponse,
): Array<ReturnType<typeof mapLoginCredentialGroup>> {
    return wire.items.map(mapLoginCredentialGroup);
}

/** Map one wire audit row → the panel's existing audit-log type. */
export function mapLoginCredentialAuditRow(
    wire: ApiLoginCredentialAuditRow,
): LoginCredentialAuditLogRow {
    // Split `yyyyMMddHHmmss` into the date / time pair the panel
    // dialog renders. Mirrors `mockLoginCredentialAuditLogs` shape.
    const raw = wire.reg_dtm ?? "";
    // REG_DTM is a UTC instant; the shared dialog shifts it to VN +
    // renders per active language. date/time kept as a fallback.
    const date = raw.length >= 8 ? formatAuditDate(raw) : "";
    const time = raw.length >= 14
        ? `${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`
        : "";
    return {
        id:       `lc-log-${wire.audit_logs_seq_no}`,
        dtm:      raw,
        date,
        time,
        user:     wire.reg_nm ?? wire.reg_id ?? "",
        // Legacy `comm_0218_005_view.jsp:81-85` renders the per-row
        // AUDIT_LOGS_ACTV value verbatim (it varies per activity type —
        // "Login Credentials", "Login ID/PW - Changes password", …).
        // Backend ships it pre-localised, so pass it through unchanged —
        // same pattern as `mapFirmBankingAuditEntry` above. (The old
        // hardcoded "login_credentials" constant made every row show one
        // identical label.)
        activity: wire.audit_logs_actv ?? "",
        details:  wire.audit_logs_actv_dtl ?? "",
    };
}

export function mapLoginCredentialAuditList(
    wire: ApiLoginCredentialAuditResponse,
): LoginCredentialAuditLogRow[] {
    return wire.items.map(mapLoginCredentialAuditRow);
}

/* -----------------------------------------------------------------
 *  Settings > Bank Account — wire → panel row
 * ----------------------------------------------------------------- */

import type {
    ApiBankAccountAuditResponse,
    ApiBankAccountListResponse,
    ApiBankAccountRow,
} from "@/lib/types/api";
import type {
    BankAccountRow,
    BankAccountType,
} from "@/components/settings/bank-account/types";
import type { AuditLogRow } from "@/components/shared/popups/AuditLogsDialog";

/** Map legacy `ACCT_TYPE_CD` → the UI's semantic `accountType`, per the
 *  authoritative `AcctTypeCd` enum mirrored above:
 *    `02` → Fixed Deposit · `05`/`06`/`08` → Saving ·
 *    `03`/`04`/`07` (and null/unknown) → Current.
 *  (The earlier `04 → saving` mapping was wrong — `04` is Foreign
 *  Current per `AcctTypeCd`; `05`/`06`/`08` are the saving codes.) */
function mapAccountType(code: string | null | undefined): BankAccountType {
    if (code === "02") return "fixed";
    if (code === "05" || code === "06" || code === "08") return "saving";
    return "current";
}

/** Narrow the wire `currency` (any string) to the union the panel
 *  type carries. Defaults to VND when the backend ships null/blank
 *  or an unsupported currency — Bank Account today only renders the
 *  three currencies the master table actually carries. */
function coerceBankAccountCurrency(
    raw: string | null | undefined,
): BankAccountRow["currency"] {
    if (raw === "USD" || raw === "KRW" || raw === "VND") return raw;
    return "VND";
}

export function mapBankAccountRow(wire: ApiBankAccountRow): BankAccountRow {
    const id = `${wire.bank_cd}-${wire.acct_no}`;
    return {
        id,
        bankCd:                    wire.bank_cd,
        bankName:                  wire.bank_name ?? wire.bank_cd,
        accountNumber:             wire.acct_no,
        currency:                  coerceBankAccountCurrency(wire.currency),
        nickname:                  wire.nickname ?? "",
        description:               wire.description ?? "",
        accountType:               mapAccountType(wire.account_type_cd),
        accountTypeCd:             wire.account_type_cd ?? "",
        maturityDate:              wire.maturity_date ?? "",
        // VAS triple — FK + short code + display name. Mirrors legacy
        // `comm_0183_001.ts:772/782`:
        //   VAS Code column        = VAS_ACCT_CD     (e.g. `333`)
        //   VAS Account Name column = VAS_ACCT_NM    (e.g. `Test`)
        // The backend's `vas_account_bank` is the compact one-line
        // `Test(VND)` rendering used when a single label is needed.
        vasAcctSeqNo:              wire.vas_acct_seq_no ?? 0,
        vasCode:                   wire.vas_acct_cd ?? "",
        vasAccountName:            wire.vas_acct_nm ?? "",
        vasAccountBank:            wire.vas_account_bank ?? "",
        // Permission row labels — server-composed "first grantee + N more"
        // (or null when no active grantee). Frontend renders the
        // placeholder text "View Permission" / "Withdrawal Permission"
        // when the field is null/empty, otherwise displays verbatim.
        viewPermissionLabel:       wire.view_permission_label ?? "",
        withdrawalPermissionLabel: wire.withdrawal_permission_label ?? "",
        auditLogActor:             wire.last_modified_by ?? "",
        // Raw UTC instant — the table shifts to VN + renders per active
        // language. `auditLogDate` kept as a non-locale fallback.
        auditLogDtm:               wire.last_modified_at ?? "",
        auditLogDate:              formatAuditDate(wire.last_modified_at ?? ""),
    };
}

export function mapBankAccountList(
    wire: ApiBankAccountListResponse,
): BankAccountRow[] {
    return wire.items.map(mapBankAccountRow);
}

/**
 * Map the Settings > Bank Account audit-logs wire response to the shared
 * `AuditLogRow` shape the popup renders. Mirrors `mapLoginCredentialAuditRow`:
 * split `reg_dtm` (`yyyyMMddHHmmss`) into the date / time lines, take the actor
 * from `reg_nm` (fallback `reg_id`), and pass the server-localised
 * `audit_logs_actv` / `audit_logs_actv_dtl` through verbatim (legacy
 * `comm_0183_004` returns the activity + detail already localised).
 */
export function mapBankAccountAuditList(
    wire: ApiBankAccountAuditResponse,
): AuditLogRow[] {
    return (wire.items ?? []).map((row) => {
        const raw = row.reg_dtm ?? "";
        // REG_DTM is a UTC instant (AuditLogService writes OffsetDateTime
        // .now(UTC)); the shared dialog shifts it to VN + renders it
        // per the active language. Keep the pre-split date/time as a
        // non-locale fallback.
        const date = raw.length >= 8 ? formatAuditDate(raw) : "";
        const time = raw.length >= 14
            ? `${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`
            : "";
        // Display name first (REG_NM), then the login id (REG_ID), then a
        // dash — never blank, and never an e-mail when a name exists.
        const user = (row.reg_nm && row.reg_nm.trim())
            || (row.reg_id && row.reg_id.trim())
            || "-";
        return {
            id:       `ba-log-${row.audit_logs_seq_no}`,
            dtm:      raw,
            date,
            time,
            user,
            activity: row.audit_logs_actv ?? "",
            details:  row.audit_logs_actv_dtl ?? "",
        };
    });
}

/**
 * Translate the wire {@link ApiNotificationRow} to the header bell's
 * camelCase {@link NotificationRow}. The backend ships the rendered
 * `title` / `content` (per-language strings from `BLTB_NOTI_CONT_INFM`), so
 * the visible message is taken verbatim — no i18n message-code resolution.
 *
 * <p>Read state is the server-derived `read` flag, falling back to
 * `actv_yn === 'Y'` for safety. The display timestamp is carried RAW as
 * `reg_dtm` (the creation instant), with `mod_dtm` only as a fallback when
 * `reg_dtm` is absent; both are `yyyyMMddHHmmss` UTC. The mapper does NOT
 * format it — the row is rendered per the active locale at render time via
 * {@link formatUtcDtmByLanguage} (raw-value-at-render, matching Payment /
 * Add-on / Settings / Banking). Sender name comes from `snd_name`, falling
 * back to `snd_id` when absent.
 */
// ── VAT Declarations ─────────────────────────────────────────────────────────

function toTaxFilingStatus(status: string): TaxFilingStatus {
    switch (status.toUpperCase()) {
        case "CONFIRMED":
        case "LOCKED":    return "confirmed";
        case "SUBMITTED": return "submitted";
        case "CANCELLED": return "cancelled";
        default:          return "draft";
    }
}

export function toTaxFilingRow(wire: ApiVatDeclarationRow): TaxFilingRow {
    return {
        id: String(wire.sid),
        declId: wire.sid,
        filingPeriod: wire.period_label,
        status: toTaxFilingStatus(wire.status),
        taxPayable: wire.tax_amount != null ? Number(wire.tax_amount) : 0,
        prevPeriodCredit: wire.prev_credit != null ? Number(wire.prev_credit) : 0,
        carriedForward: wire.carried_forward != null ? Number(wire.carried_forward) : 0,
        periodType: wire.period_type,
        periodValue: wire.period_value,
        declYear: wire.decl_year,
        supplNo: wire.suppl_no,
        declType: wire.decl_type,
        declTypeName: wire.decl_type_name,
        applicableCircular: wire.applicable_circular ?? null,
        etaxCode: wire.etax_code ?? null,
        modDtm: wire.mod_dtm ?? null,
    };
}

export function mapNotificationRow(api: ApiNotificationRow): NotificationRow {
    return {
        id: String(api.notification_id),
        notificationId: api.notification_id,
        bltbCd: api.bltb_cd,
        notiSeqNo: api.noti_seq_no,
        title: (api.title ?? "").trim(),
        content: (api.content ?? "").trim(),
        senderName: (api.snd_name ?? "").trim() || (api.snd_id ?? "").trim(),
        senderId: api.snd_id,
        notiJson: api.noti_json,
        notiWsvc: api.noti_wsvc,
        deleted: api.del_yn === "Y",
        read: api.read ?? api.actv_yn === "Y",
        dateTimeRaw: api.reg_dtm || api.mod_dtm || null,
        userImgUrl: api.user_img_url,
    };
}

// ─── VAT Declaration Annex Lines ─────────────────────────────────────────────

function fmtInvDt(raw: string): string {
    // yyyyMMdd → dd/MM/yyyy
    if (raw.length !== 8) return raw;
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
}

function toAnnexLine(wire: ApiAnnexLine): AnnexLine {
    return {
        id:          wire.id,
        ioDv:        wire.io_dv,
        invNo:       wire.inv_no,
        invSymbol:   wire.inv_symbol,
        invDt:       fmtInvDt(wire.inv_dt),
        trcoTaxCode: wire.trco_tax_code,
        trcoNm:      wire.trco_nm,
        prodNm:      wire.prod_nm ?? "",
        splyAmt:     Number(wire.sply_amt),
        vatRate:     wire.vat_rate,
        vatAmt:      Number(wire.vat_amt),
        reducedAmt:  Number(wire.reduced_amt),
        allocRatio:  wire.alloc_ratio ?? null,
        handRegYn:   wire.hand_reg_yn === "Y",
    };
}

function toAnnexGroup(wire: ApiAnnexGroup): AnnexGroup {
    return {
        prodNm:           wire.prod_nm ?? "",
        rowCount:         wire.row_count,
        totalSplyAmt:     Number(wire.total_sply_amt),
        totalReducedAmt:  Number(wire.total_reduced_amt),
        rows:             wire.rows.map(toAnnexLine),
    };
}

export function toAnnexListResult(wire: ApiAnnexListResponse): AnnexListResult {
    return {
        groups:                 wire.groups.map(toAnnexGroup),
        totalCount:             wire.total_count,
        grandTotalReducedAmt:   Number(wire.grand_total_reduced_amt),
    };
}

function toAnnexInvoiceRow(wire: ApiAnnexInvoiceRow): AnnexInvoiceRow {
    return {
        id:            wire.id,
        ioDv:          wire.io_dv,
        srcDocId:      wire.src_doc_id,
        invNo:         wire.inv_no,
        invSymbol:     wire.inv_symbol,
        invDt:         fmtInvDt(wire.inv_dt),
        trcoTaxCode:   wire.trco_tax_code,
        trcoNm:        wire.trco_nm,
        prodNm:        wire.prod_nm ?? "",
        splyAmt:       Number(wire.sply_amt),
        vatRate:       wire.vat_rate,
        vatAmt:        Number(wire.vat_amt),
        reducedAmt:    Number(wire.reduced_amt),
        allocRatio:    wire.alloc_ratio ?? null,
        handRegYn:     wire.hand_reg_yn === "Y",
        vatRateOrder:  wire.vat_rate_order,
        vatDeclProcYn: wire.vat_decl_proc_yn === "Y",
        vatDeclSid:    wire.vat_decl_sid,
    };
}

function toAnnexTaxGroup(wire: ApiAnnexTaxGroup): AnnexTaxGroup {
    return {
        groupCd:          wire.group_cd,
        taxRateLabel:     wire.tax_rate_label ?? null,
        rowCount:         wire.row_count,
        totalSplyAmt:     Number(wire.total_sply_amt),
        totalReducedAmt:  Number(wire.total_reduced_amt),
        totalVatAmt:      Number(wire.total_vat_amt),
    };
}

export function toAnnexInvoicePage(wire: ApiAnnexInvoiceListResponse): AnnexInvoicePage {
    return {
        rows:        wire.rows.map(toAnnexInvoiceRow),
        totalCount:  wire.total_count,
        totalPages:  wire.total_pages,
        pageNumber:  wire.page_number,
        pageSize:    wire.page_size,
        taxGroups:   (wire.tax_groups ?? []).map(toAnnexTaxGroup),
        grandTotal:  wire.grand_total ? toAnnexTaxGroup(wire.grand_total) : null,
    };
}
