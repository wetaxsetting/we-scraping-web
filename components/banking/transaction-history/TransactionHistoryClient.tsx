"use client";

import { useMemo } from "react";

import TransactionHistoryPage from "./TransactionHistoryPage";
import type { TransactionAccount } from "./accounts";
import { fetchAccounts, fetchTransactions } from "@/lib/api/banking";
import { mapTransactionRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";

type Props = {
    /** Static account from `accounts.ts` — drives the breadcrumb. */
    account: TransactionAccount;
    /** "VND" / "FCY" — passed to `/accounts?currency=` to find the
     *  matching real `ACCT_SEQ_NO` for the transactions query. */
    scope: "VND" | "FCY";
};

/**
 * KNOWN MISMATCH (documented for Sprint 2 cleanup):
 *
 *   The frontend sidebar uses static account slugs ("bidv-0569", "vcb-8210",
 *   …) under `components/banking/transaction-history/accounts.ts`. The
 *   backend transactions endpoint expects the synthetic
 *   `ACCT_SEQ_NO = BANK_CD + "_" + ACCT_NO` returned by `/accounts`.
 *
 *   This wrapper bridges the gap: it loads the live accounts list, picks
 *   the first account whose bank name contains the static slug's bank label
 *   (e.g. "BIDV 0569" → first account whose `BANK_NM` contains "BIDV"), and
 *   uses that real `ACCT_SEQ_NO` for the transactions request.
 *
 *   Sprint 1 stabilization: when the API returns no rows (no match, no
 *   accounts, or in flight) the page renders an empty table — no mock
 *   seed.
 *
 *   Sprint 2: replace the static slug list with an API-driven account
 *   list, so the URL slug *is* the real `ACCT_SEQ_NO`.
 */
export default function TransactionHistoryClient({ account, scope }: Props) {
    const accountsState = useApiData(() => fetchAccounts(scope), [scope]);

    // Find the matching real acct_seq_no by bank-name prefix match.
    const realAcctSeqNo = useMemo(() => {
        const accounts = accountsState.data?.accounts ?? [];
        if (accounts.length === 0) return null;
        // The static label is "BIDV 0569" / "VCB 8210" / "WOORI 2308" — strip
        // the trailing 4-digit fragment and match on the bank name prefix.
        const prefix = account.bankName.split(" ")[0]?.toUpperCase();
        if (!prefix) return null;
        const match = accounts.find((a) =>
            (a.bank_nm ?? a.bank_cd ?? "").toUpperCase().includes(prefix),
        );
        return match?.acct_seq_no ?? null;
    }, [accountsState.data, account.bankName]);

    const txnState = useApiData(
        () => (realAcctSeqNo ? fetchTransactions(realAcctSeqNo) : Promise.resolve(null)),
        [realAcctSeqNo],
    );

    const rows = useMemo(() => {
        const raw = txnState.data?.ROWS;
        return raw ? raw.map(mapTransactionRow) : [];
    }, [txnState.data]);

    return <TransactionHistoryPage account={account} rows={rows} />;
}
