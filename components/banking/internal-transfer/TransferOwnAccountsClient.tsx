"use client";

import { useMemo } from "react";

import TransferOwnAccountsPage from "./TransferOwnAccountsPage";
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
    const { data } = useApiData(() => fetchOwnAccounts(), []);

    const rows = useMemo(
        () => data?.accounts?.map(mapOwnAccountRow),
        [data],
    );
    const totals = useMemo(
        () => (data ? mapOwnAccountTotals(data) : undefined),
        [data],
    );

    return <TransferOwnAccountsPage rows={rows} totals={totals} />;
}
