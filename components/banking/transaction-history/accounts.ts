/**
 * Transaction History account types + URL helpers.
 *
 * Migrated 2026-05-16: the static `VND_ACCOUNTS` / `FCY_ACCOUNTS` lists
 * are retired. Every consumer now reads accounts from the live
 * `/api/v1/banking/accounts?currency=…` endpoint via
 * {@link useTransactionHistoryAccounts}. The URL slug equals the
 * backend's synthetic `acct_seq_no` (`BANK_CD + "_" + ACCT_NO`), so
 * the page wrapper passes the slug straight to the transactions
 * endpoint without any name-prefix bridging.
 */

import { useMemo } from "react";

import { fetchAccounts } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";

export type TransactionAccount = {
    /** URL slug — equal to the backend's `acct_seq_no` (`BANK_CD_ACCT_NO`). */
    id: string;
    /** Display label, e.g. `"BIDV 0569"`. Composed from bank name + last
     *  4 digits of the account number so it matches the live JEX
     *  sidebar convention. */
    bankName: string;
    /** Currency for the side badge + page title parens, e.g. `"VND"`,
     *  `"USD"`, `"THB"`. */
    currency: string;
};

/** URL for a given account slug — used by the sidebar and redirect stubs. */
export function accountHref(
    scope: "VND" | "FCY",
    id: string,
): string {
    return scope === "VND"
        ? `/banking/transaction-history/${encodeURIComponent(id)}`
        : `/banking/transaction-history-fcy/${encodeURIComponent(id)}`;
}

/**
 * Convert an Account Inquiry row into the slug used by the Transaction
 * History route. The row's `id` already equals the backend
 * `acct_seq_no`, so the BalancePopover deep-link can route through
 * here without consulting any account list.
 */
export function accountIdToSlug(acctSeqNo: string): string {
    return acctSeqNo;
}

/**
 * Compose the human-readable bank label the sidebar + page title use
 * for a single account. Pattern is `<BANK_NAME_PREFIX> <LAST_4>` —
 * e.g. `"BIDV 0569"`, `"Woori 5184"` — matching the legacy JEX sidebar.
 * Falls back to the full bank name when the account number has fewer
 * than four digits.
 */
export function composeAccountLabel(bankNm: string, acctNo: string): string {
    const digits = (acctNo ?? "").replace(/\D/g, "");
    const last4 = digits.length >= 4 ? digits.slice(-4) : digits;
    const prefix = (bankNm ?? "").trim();
    if (!prefix) return last4;
    if (!last4) return prefix;
    return `${prefix} ${last4}`;
}

/**
 * Hook that hydrates the per-scope account list. Wraps
 * {@link fetchAccounts} via {@link useApiData} so callers get a stable
 * `(loading, error, accounts)` shape. Pass `"VND"` for the VND sidebar
 * group, `"FCY"` for the FCY group.
 *
 * The hook does NOT cache across sibling consumers — every call site
 * fires its own request. That is fine for Sprint 2 (sidebar + page
 * wrapper mount once per session); when a cross-component cache lands
 * (React Query / SWR / a dedicated banking store), funnel both
 * consumers through it.
 */
export function useTransactionHistoryAccounts(
    scope: "VND" | "FCY",
): { accounts: TransactionAccount[]; loading: boolean; error: Error | null } {
    const state = useApiData(() => fetchAccounts(scope), [scope]);
    const accounts = useMemo<TransactionAccount[]>(() => {
        const rows = state.data?.accounts ?? [];
        return rows.map((r) => ({
            id: r.acct_seq_no,
            bankName: composeAccountLabel(r.bank_nm, r.acct_no),
            currency: r.ccy_cd,
        }));
    }, [state.data]);
    return { accounts, loading: state.loading, error: state.error };
}
