import type { ApiCurrencyTotal } from "@/lib/types/api";

/**
 * Per-currency aggregation entry — camelCase view of the wire shape.
 * Used by the Account Inquiry page to render one summary tile per
 * currency group without doing decimal arithmetic in JS.
 */
export type CurrencyTotal = {
    /** ISO 4217 currency code (`VND`, `USD`, `KRW`, …). */
    ccy: string;
    /** Number of accounts in this currency group. */
    count: number;
    /** Total balance — wire decimal string. Format with
     *  {@code formatAmount(value, ccy, true)} at render time. */
    balance: string;
    /** Total available balance — wire decimal string. Format with
     *  {@code formatAmount(value, ccy, true)} at render time. */
    available: string;
};

export function mapCurrencyTotal(api: ApiCurrencyTotal): CurrencyTotal {
    return {
        ccy: api.ccy_cd?.trim() || "",
        count: api.count ?? 0,
        balance: api.balance ?? "0",
        available: api.available_bal ?? "0",
    };
}
