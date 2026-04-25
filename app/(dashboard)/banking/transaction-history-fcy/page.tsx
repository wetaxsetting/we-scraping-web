import { redirect } from "next/navigation";

import {
    FCY_ACCOUNTS,
    accountHref,
} from "@/components/banking/transaction-history/accounts";

/**
 * FCY counterpart to the VND Transaction History index — redirects to
 * the first FCY account so the sidebar child rows are the only real
 * entry points.
 */
export default function BankingTransactionHistoryFcyIndexPage() {
    const first = FCY_ACCOUNTS[0];
    redirect(accountHref("FCY", first.id));
}
