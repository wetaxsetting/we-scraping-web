import { notFound } from "next/navigation";

import TransactionHistoryPage from "@/components/banking/transaction-history/TransactionHistoryPage";
import { findAccount } from "@/components/banking/transaction-history/accounts";

export const metadata = {
    title: "Transaction History (FCY) — WeCMS",
};

/**
 * FCY per-account page — the sibling of the VND `[accountId]` route.
 * Same shared component, different accounts list.
 */
export default async function BankingTransactionHistoryFcyAccountPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    const account = findAccount("FCY", accountId);
    if (!account) notFound();
    return <TransactionHistoryPage account={account} />;
}
