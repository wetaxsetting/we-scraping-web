"use client";

import { useMemo } from "react";

import DailyFinancialPage from "./DailyFinancialPage";
import { fetchDailyFinancial } from "@/lib/api/banking";
import {
    mapCurrentAccountRow,
    mapFinancialStatus,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";

/**
 * Client wrapper that pulls live data from
 * `GET /api/v1/banking/reports/daily-financial` and feeds it to the
 * static `<DailyFinancialPage>`. Falls back to the mock seed for
 * sections the backend does not yet populate.
 */
export default function DailyFinancialClient() {
    const { data } = useApiData(() => fetchDailyFinancial(), []);

    const financialStatus = useMemo(
        () => data?.FINANCIAL_STATUS?.map(mapFinancialStatus),
        [data],
    );
    const currentAccounts = useMemo(
        () => data?.CURRENT_ACCOUNTS?.map(mapCurrentAccountRow),
        [data],
    );

    return (
        <DailyFinancialPage
            financialStatus={financialStatus}
            currentAccounts={currentAccounts}
        />
    );
}
