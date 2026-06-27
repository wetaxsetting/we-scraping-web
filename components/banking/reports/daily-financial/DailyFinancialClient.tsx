"use client";

import { useCallback, useMemo, useState } from "react";

import DailyFinancialPage from "./DailyFinancialPage";
import { fetchDailyFinancial } from "@/lib/api/banking";
import {
    mapCurrentAccountRow,
    mapFinancialStatus,
} from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { todayLocalIso } from "@/lib/datetime";
import type { CurrencyScope } from "@/components/shared/CurrencyScopeToggle";

/**
 * Client wrapper for Banking > Daily Financial (CMC).
 *
 * Owns the filter state — currency scope, "Active accounts only",
 * "Include internal transfers", and the empty-state Search trigger.
 * Fires `GET /api/v1/banking/reports/daily-financial` against the real
 * Spring Boot backend with the resolved query params; the page renders
 * eagerly from `data` once Search has fired at least once.
 *
 * Filter changes after the first search trigger an automatic refetch
 * (legacy `fn_loadData(input, option=true)` parity) so the user sees
 * fresh data without having to re-click Search.
 */
export default function DailyFinancialClient() {
    const [scope, setScope] = useState<CurrencyScope>("all");
    const [activeOnly, setActiveOnly] = useState(true);
    const [includeInternalTransfers, setIncludeInternalTransfers] = useState(true);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchKey, setSearchKey] = useState(0);
    const [asOfIsoDate, setAsOfIsoDate] = useState(() =>
        // Browser-LOCAL today, not UTC (ICT users after 17:00 would otherwise
        // default to yesterday).
        todayLocalIso(),
    );

    const loader = useCallback(() => {
        return fetchDailyFinancial({
            asOf: toBackendDate(asOfIsoDate),
            currencyScope: toWireScope(scope),
            activeAccountsOnly: activeOnly,
            includeInternalTransfers,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKey]);

    const { data, loading } = useApiData(
        hasSearched ? loader : () => Promise.resolve(undefined),
        [searchKey, hasSearched],
    );

    const financialStatus = useMemo(
        () => data?.financial_status?.map(mapFinancialStatus),
        [data],
    );
    const currentAccounts = useMemo(
        () => data?.current_accounts?.map(mapCurrentAccountRow),
        [data],
    );

    const handleSearch = () => {
        setHasSearched(true);
        setSearchKey((k) => k + 1);
    };

    const bumpIfSearched = () => {
        if (hasSearched) setSearchKey((k) => k + 1);
    };

    return (
        <DailyFinancialPage
            financialStatus={financialStatus}
            currentAccounts={currentAccounts}
            asOfDate={formatDmy(asOfIsoDate)}
            asOfIsoDate={asOfIsoDate}
            onAsOfIsoDateChange={(next) => { setAsOfIsoDate(next); bumpIfSearched(); }}
            scope={scope}
            onScopeChange={(next) => { setScope(next); bumpIfSearched(); }}
            activeOnly={activeOnly}
            onActiveOnlyChange={(next) => { setActiveOnly(next); bumpIfSearched(); }}
            includeInternalTransfers={includeInternalTransfers}
            onIncludeInternalTransfersChange={(next) => { setIncludeInternalTransfers(next); bumpIfSearched(); }}
            onSearch={handleSearch}
            hasSearched={hasSearched}
            loading={loading}
        />
    );
}

function toWireScope(scope: CurrencyScope): string {
    if (scope === "vnd") return "VND";
    if (scope === "fcy") return "FCY";
    return "ALL";
}

/** Backend expects `yyyyMMdd`; the loader keeps an ISO date for display. */
function toBackendDate(iso: string): string {
    return iso.replaceAll("-", "");
}

/** `YYYY-MM-DD` → `DD-MM-YYYY` for the filter chip text. */
function formatDmy(iso: string): string {
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}-${m}-${y}`;
}
