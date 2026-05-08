"use client";

import { useMemo } from "react";

import DailyCashPage from "./DailyCashPage";
import { fetchDailyCash } from "@/lib/api/banking";
import {
    mapDailyCashAccountRow,
    mapDailyCashHoldingRow,
    mapDailyCashSummaryRow,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";

/**
 * Client wrapper that pulls live data from `GET /api/v1/banking/reports/daily-cash`
 * and feeds it to the static `<DailyCashPage>`. Fetches once on mount with
 * no params (backend uses sensible defaults). Sprint 2 should add the
 * date picker + currency-scope toggle interactions to refetch with
 * different `asOf` / `currencyScope` params.
 *
 * Falls back to the static mock seed for any section the backend does not
 * yet populate (e.g. `holdings` is empty in the local dataset).
 */
export default function DailyCashClient() {
    const { data } = useApiData(() => fetchDailyCash(), []);

    const summary = useMemo(
        () => data?.SUMMARY?.map(mapDailyCashSummaryRow),
        [data],
    );
    const holdings = useMemo(
        () => data?.HOLDINGS?.map(mapDailyCashHoldingRow),
        [data],
    );
    const accounts = useMemo(
        () => data?.ACCOUNTS?.map(mapDailyCashAccountRow),
        [data],
    );

    return (
        <DailyCashPage
            summary={summary}
            holdings={holdings}
            accounts={accounts}
        />
    );
}
