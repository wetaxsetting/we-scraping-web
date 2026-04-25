import { redirect } from "next/navigation";

import {
    VND_ACCOUNTS,
    accountHref,
} from "@/components/banking/transaction-history/accounts";

/**
 * The Transaction History parent URL always resolves to the first VND
 * account — the sidebar's Transaction History parent is a toggle (no
 * navigation of its own), so this route exists only to keep the old
 * href from breaking. When a real "overview" screen is designed, swap
 * the redirect for that page.
 */
export default function BankingTransactionHistoryIndexPage() {
    const first = VND_ACCOUNTS[0];
    redirect(accountHref("VND", first.id));
}
