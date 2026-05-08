import { notFound } from "next/navigation";

import TransactionHistoryClient from "@/components/banking/transaction-history/TransactionHistoryClient";
import { findAccount } from "@/components/banking/transaction-history/accounts";

export const metadata = {
    title: "Transaction History (VND) — WeCMS",
};

/**
 * VND per-account page. The sidebar expands the Transaction History
 * parent into a nested account list — each child links here. The page
 * is shared between VND and FCY scopes; only the `accounts` lookup
 * differs per route.
 */
export default async function BankingTransactionHistoryAccountPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    const account = findAccount("VND", accountId);
    if (!account) notFound();
    return <TransactionHistoryClient account={account} scope="VND" />;
}
