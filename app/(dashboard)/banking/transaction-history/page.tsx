import TransactionHistoryIndexRedirect from "@/components/banking/transaction-history/TransactionHistoryIndexRedirect";

export const metadata = {
    title: "Transaction History (VND) — WeCMS",
};

/**
 * The Transaction History parent URL resolves to the first account in
 * the user's tenant. The redirect can't happen server-side anymore —
 * the live `/accounts` endpoint is JWT-protected — so a thin client
 * wrapper handles fetch + `router.replace`.
 */
export default function BankingTransactionHistoryIndexPage() {
    return <TransactionHistoryIndexRedirect scope="VND" />;
}
