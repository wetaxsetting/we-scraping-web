import TransactionHistoryClient from "@/components/banking/transaction-history/TransactionHistoryClient";

export const metadata = {
    title: "Transaction History (FCY) — WeCMS",
};

/**
 * FCY per-account page. Mirror of the VND route — the client wrapper
 * fetches `/accounts?currency=FCY` to resolve the breadcrumb account
 * for the slug.
 */
export default async function BankingTransactionHistoryFcyAccountPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    return <TransactionHistoryClient acctSeqNo={accountId} scope="FCY" />;
}
