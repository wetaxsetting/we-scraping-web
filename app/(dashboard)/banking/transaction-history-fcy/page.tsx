import TransactionHistoryIndexRedirect from "@/components/banking/transaction-history/TransactionHistoryIndexRedirect";

export const metadata = {
    title: "Transaction History (FCY) — WeCMS",
};

/**
 * FCY counterpart to the VND Transaction History index — fetches the
 * live FCY accounts and redirects to the first one.
 */
export default function BankingTransactionHistoryFcyIndexPage() {
    return <TransactionHistoryIndexRedirect scope="FCY" />;
}
