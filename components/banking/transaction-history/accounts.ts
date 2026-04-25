/**
 * Transaction History account config — the single source of truth for both
 * the sidebar's nested account list and the per-account route pages. The
 * sidebar expands the Transaction History parent into these children; each
 * child's `href` maps to the dynamic `/banking/transaction-history/[id]`
 * (VND) or `/banking/transaction-history-fcy/[id]` (FCY) route.
 *
 * When the backend endpoint for "my accounts" lands, replace this static
 * list with a hook that hydrates from `/api/v1/accounts?currency=VND|FCY`.
 * The shape below is intentionally the minimum every consumer needs:
 *   - `id`        — URL slug
 *   - `bankName`  — "WOORI 2306", "BIDV 0569" (what users see in titles)
 *   - `currency`  — shown in the sidebar badge and the page title parens
 */

export type TransactionAccount = {
    id: string;
    bankName: string;
    currency: string;
};

export const VND_ACCOUNTS: TransactionAccount[] = [
    { id: "bidv-0569", bankName: "BIDV 0569", currency: "VND" },
    { id: "vcb-8210", bankName: "VCB 8210", currency: "VND" },
    { id: "hdbank-0442", bankName: "HD BANK 0442", currency: "VND" },
];

export const FCY_ACCOUNTS: TransactionAccount[] = [
    { id: "woori-2308", bankName: "WOORI 2308", currency: "THB" },
    { id: "bidv-2913", bankName: "BIDV 2913", currency: "USD" },
    { id: "shinhan-6946", bankName: "SHINHAN 6946", currency: "THB" },
];

export function findAccount(
    scope: "VND" | "FCY",
    id: string,
): TransactionAccount | undefined {
    const list = scope === "VND" ? VND_ACCOUNTS : FCY_ACCOUNTS;
    return list.find((a) => a.id === id);
}

/** URL for a given account slug — used by the sidebar and redirect stubs. */
export function accountHref(
    scope: "VND" | "FCY",
    id: string,
): string {
    return scope === "VND"
        ? `/banking/transaction-history/${id}`
        : `/banking/transaction-history-fcy/${id}`;
}
