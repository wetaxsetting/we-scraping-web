"use client";

import { useMemo, useState } from "react";

import TransferOwnAccountsPage from "./TransferOwnAccountsPage";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { fetchOwnAccounts } from "@/lib/api/banking";
import { mapOwnAccountRow, mapOwnAccountTotals } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";

/**
 * Client wrapper around `<TransferOwnAccountsPage>` — fetches the user's
 * own accounts from `GET /api/v1/banking/transfers/own-accounts`. The
 * backend reuses the `ApiAccountRow` shape, so this wrapper maps each row
 * to the frontend `OwnAccountRow` and the BAL_TOTAL/AVAIL_TOTAL summary to
 * `OwnAccountTotals`. Falls back to the static mock seed while loading or
 * on error.
 *
 * Transfer execution is intentionally out of Sprint 1 scope — see the
 * comment at the top of `TransferController` and the `TransferDialog`
 * mock-only flow in this folder. This wrapper only feeds the read-side.
 */
export default function TransferOwnAccountsClient() {
    const { data, loading } = useApiData(() => fetchOwnAccounts(), []);

    /* Latch the latest non-null response so any future refetch (e.g.
     * post-transfer reload) keeps the previous rows visible across
     * the await window. Mirrors the AccountInquiry pattern. */
    const [stableData, setStableData] = useState(data);
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
        setPrevData(data);
        if (data) setStableData(data);
    }

    const rows = useMemo(
        () => stableData?.accounts?.map(mapOwnAccountRow),
        [stableData],
    );
    const totals = useMemo(
        () => (stableData ? mapOwnAccountTotals(stableData) : undefined),
        [stableData],
    );

    /* Sticky-wrap the initial-fetch gate so the centered "Loading…"
     * message holds for the minimum-visibility window on first paint;
     * once `stableData` lights up, subsequent refetches stay invisible
     * because the previous rows are still on screen. */
    const stickyInitialLoading = useStickyLoading(loading && !stableData);

    return (
        <TransferOwnAccountsPage
            rows={rows}
            totals={totals}
            loading={stickyInitialLoading}
        />
    );
}
