"use client";

import { useMemo } from "react";

import TransferHistoryPage from "./TransferHistoryPage";
import { fetchTransferHistory } from "@/lib/api/banking";
import { mapTransferRow, mapTransferTotals } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";

/**
 * Client wrapper around `<TransferHistoryPage>` — fetches NAPAS transfer
 * history from `GET /api/v1/banking/transfers/history` on mount. The
 * backend response contains a multi-currency totals array; the static UI
 * footer only renders one currency bucket today, so the mapper collapses
 * them to the first row (typically VND for the local tenant). Multi-row
 * totals support is a Sprint 2 follow-up.
 */
export default function TransferHistoryClient() {
    const { data } = useApiData(() => fetchTransferHistory(), []);

    const rows = useMemo(() => data?.ROWS?.map(mapTransferRow), [data]);
    const total = useMemo(
        () => (data ? mapTransferTotals(data.TOTALS) : undefined),
        [data],
    );

    return <TransferHistoryPage rows={rows} total={total} />;
}
