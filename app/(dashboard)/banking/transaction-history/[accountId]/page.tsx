import TransactionHistoryClient from "@/components/banking/transaction-history/TransactionHistoryClient";

export const metadata = {
    title: "Transaction History (VND) — WeCMS",
};

/**
 * VND per-account page. The slug equals the backend `acct_seq_no`
 * (`BANK_CD + "_" + ACCT_NO`). Validation + account lookup happen on
 * the client (the live `/accounts` endpoint is JWT-protected), so the
 * route component just forwards the raw slug.
 */
export default async function BankingTransactionHistoryAccountPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    return <TransactionHistoryClient acctSeqNo={accountId} scope="VND" />;
}
