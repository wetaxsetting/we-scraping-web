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
}

/** One bank option — mapped from ApiExchangeRateBankItem. */
export interface ExchangeRateBankOption {
    bankCd: string;
    bankNm: string;
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
