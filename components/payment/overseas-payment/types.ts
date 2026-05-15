import type { ApprovalStatus } from "@/components/payment/approval-box/types";
import type {
    PaymentResultBatchRow,
    PaymentResultBatchRowStatus,
} from "@/components/payment/shared/PaymentResultBatchListPage";
import type {
    PaymentScheduledBatchRow,
    ScheduledBatchAction,
    ScheduledBatchRowHighlight,
} from "@/components/payment/shared/PaymentScheduledBatchListPage";

/**
 * Overseas Scheduled Payment row — Figma 29:14947. Mirrors the Internal
 * Transfer batch-file shape; Overseas adds `scheduleDate` via the shared
 * `<PaymentScheduledBatchListPage>`'s `extraColumn` slot.
 */
export type OverseasScheduledRow = PaymentScheduledBatchRow & {
    scheduleDate: string;
    fromBank: string;
    fromAccount?: string;
    fileSize?: string;
    detailRequestor?: string;
};

/**
 * Overseas Payment Result row — Figma 29:16738.
 */
export type OverseasResultRow = PaymentResultBatchRow & {
    fromBank: string;
    fromAccount?: string;
    fromCurrency?: string;
    totalTransferAmount?: string;
    requestor?: string;
    fileSize?: string;
    paymentRef?: string;
};

export type OverseasScheduledStatus   = ApprovalStatus;
export type OverseasResultStatus      = PaymentResultBatchRowStatus;
export type OverseasScheduledAction   = ScheduledBatchAction;
export type OverseasScheduledRowHighlight = ScheduledBatchRowHighlight;

/**
 * Frontend in-memory types for Exchange Rate Inquiry (camelCase semantic).
 *
 * Wire types (snake_case) live in lib/types/api.ts.
 * Translation happens once at the API boundary in lib/api/mappers.ts.
 */

/** One exchange rate row — camelCase semantic shape used by components. */
export interface ExchangeRateRow {
    ccyCd: string;
    refCcyCd: string;
    basicRate: number | null;
    basicTran: number | null;
    buyAmt: number | null;
    sellAmt: number | null;
    tranBuyAmt: number | null;
    tranSellAmt: number | null;
    standPoint: string | null;
    lastUpdateDate: string | null;
    lastUpdateTime: string | null;
    exchRateRegDtm: string | null;
}

/** Mapped response envelope for GET /api/v1/banking/exchange-rates. */
export interface ExchangeRateListResult {
    refDate: string;
    bankCd: string;
    bankNm: string;
    rates: ExchangeRateRow[];
    rounds: { seqNo: string; lastUpdateTime: string | null }[];
}

/** One bank option — mapped from ApiExchangeRateBankItem. */
export interface ExchangeRateBankOption {
    bankCd: string;
    bankNm: string;
    logo?: string;
}

/**
 * Pre-formatted display row for the currency × rate-type matrix table.
 * All rate fields are already formatted strings (e.g. "25,890.00" or "—").
 */
export type ExchangeRateDisplayRow = {
    currency: string;
    flag: string;
    cashBuy: string;
    cashSell: string;
    ttBuy: string;
    ttSell: string;
};
