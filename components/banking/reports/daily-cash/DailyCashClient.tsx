"use client";

import { useCallback, useMemo, useState } from "react";

import DailyCashPage from "./DailyCashPage";
import type {
    DailyCashAccountRow,
    DailyCashSummaryRow,
} from "./types";
import {
    fetchDailyCashReport,
    type ApiDailyCashReportResponse,
} from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import type { CurrencyScope } from "@/components/shared/CurrencyScopeToggle";

/**
 * Client wrapper for the Banking > Daily Cash report.
 *
 * Targets the refactor endpoint `GET /api/v1/banking/reports/daily-cash-report`
 * (slug: `daily-cash-report`). Mirrors the legacy `rept_0009_001.act` flow:
 *
 *   - Boots in the empty placeholder state (Figma 96:40920).
 *   - Clicking the Search button fires a real refetch against the live
 *     `daily-cash-report` endpoint with the current `asOfDate` + currency
 *     scope.
 *   - Toggling the currency scope re-runs the fetch automatically once
 *     the user has searched at least once.
 *
 * Maps the three-tier wire shape (currency_summary, accounts, currency_flow)
 * into the existing in-memory `DailyCashPage` props (summary, accounts).
 * `holdings` stays empty — the backend folds cash holdings into the
 * currency_summary cash bucket rather than exposing them as a separate list.
 */
export default function DailyCashClient() {
    const [scope, setScope] = useState<CurrencyScope>("all");
    const [hasSearched, setHasSearched] = useState(false);
    const [searchKey, setSearchKey] = useState(0);

    // Today's date (local). Re-evaluated on every refetch so a long-lived
    // page picks up the next day automatically.
    const asOfIsoDate = useMemo(() => new Date().toISOString().slice(0, 10), [searchKey]);

    const loader = useCallback(() => {
        return fetchDailyCashReport({
            asOfDate: asOfIsoDate,
            currency: toWireCurrency(scope),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchKey]);

    const { data, loading } = useApiData(
        // Skip the initial mount fire — only fetch after Search.
        hasSearched ? loader : () => Promise.resolve(EMPTY_REPORT),
        [searchKey, hasSearched],
    );

    const summary = useMemo<DailyCashSummaryRow[] | undefined>(
        () => {
            if (!data) return undefined;
            const fromBackend = data.currency_summary?.map(toSummaryRow) ?? [];
            // Backend's `currency_summary` may ship empty when the JEX
            // aggregator hasn't run for the day. Fall back to a
            // client-side rollup off the account list so the per-CCY
            // `Total <CCY> : …` blocks always render when there are
            // accounts to summarise.
            if (fromBackend.length > 0) return fromBackend;
            return rollupSummary(data.accounts ?? []);
        },
        [data],
    );
    /* Split the flat account list into Current vs Saving sections
       using the legacy `ACCT_TYPE_CD` discriminator. Per
       `wabooks.enums.AcctTypeCd`: 02 = demand/current, 03 = saving,
       04 = term deposit, 05 = overdraft. Saving goes to its own
       table; everything else is treated as Current so term-deposit
       and other product types stay visible. */
    const currentAccounts = useMemo<DailyCashAccountRow[] | undefined>(
        () => data?.accounts?.filter((a) => !isSavingType(a.acct_type_cd)).map(toAccountRow),
        [data],
    );
    const savingAccounts = useMemo<DailyCashAccountRow[] | undefined>(
        () => data?.accounts?.filter((a) => isSavingType(a.acct_type_cd)).map(toAccountRow),
        [data],
    );

    const handleSearch = () => {
        setHasSearched(true);
        setSearchKey((k) => k + 1);
    };

    const handleScopeChange = (next: CurrencyScope) => {
        setScope(next);
        // Re-run the report when the scope changes after the first
        // search — matches the legacy "filter changes refetch" behaviour.
        if (hasSearched) setSearchKey((k) => k + 1);
    };

    return (
        <DailyCashPage
            summary={summary}
            holdings={undefined}
            accounts={currentAccounts}
            savingAccounts={savingAccounts}
            asOfDate={formatDmy(asOfIsoDate)}
            scope={scope}
            onScopeChange={handleScopeChange}
            onSearch={handleSearch}
            hasSearched={hasSearched}
            loading={loading}
        />
    );
}

const EMPTY_REPORT: ApiDailyCashReportResponse = {
    as_of_date: "",
    currency: "ALL",
    currency_summary: [],
    accounts: [],
    currency_flow: [],
};

/** Legacy `ACCT_TYPE_CD === "03"` is the Saving Account bucket. Everything
 *  else (current / overdraft / term deposit / loan / cash) is treated as
 *  a Current row by the Daily Cash report. */
function isSavingType(acctTypeCd: string | undefined | null): boolean {
    return (acctTypeCd ?? "").trim() === "03";
}

/** Group the flat account list into per-currency summary buckets so the
 *  Excel `Total <CCY>: …` blocks render even when the backend ships an
 *  empty `currency_summary`. Mirrors the legacy `rept_0009_001` rollup. */
function rollupSummary(
    accounts: ReadonlyArray<ApiDailyCashReportResponse["accounts"][number]>,
): DailyCashSummaryRow[] {
    const buckets = new Map<string, { current: number; savings: number }>();
    for (const a of accounts) {
        const ccy = a.currency_cd || "VND";
        const bucket = buckets.get(ccy) ?? { current: 0, savings: 0 };
        const bal = Number(a.balance ?? 0);
        if (isSavingType(a.acct_type_cd)) bucket.savings += bal;
        else bucket.current += bal;
        buckets.set(ccy, bucket);
    }
    return Array.from(buckets.entries()).map(([ccy, b]) => ({
        currencyLabel: ccy,
        cash: "0",
        current: String(b.current),
        savings: String(b.savings),
        timeDeposit: "0",
        available: String(b.current),
    }));
}

function toWireCurrency(scope: CurrencyScope): string {
    if (scope === "vnd") return "VND";
    if (scope === "fcy") return "FCY";
    return "ALL";
}

/** `YYYY-MM-DD` → `DD-MM-YYYY` for display in the filter chip. */
function formatDmy(iso: string): string {
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}-${m}-${y}`;
}

function toSummaryRow(
    r: ApiDailyCashReportResponse["currency_summary"][number],
): DailyCashSummaryRow {
    return {
        currencyLabel: r.currency_cd,
        cash: String(r.total_cash ?? 0),
        current: String(r.total_demand_deposit ?? 0),
        savings: String(r.total_savings ?? 0),
        timeDeposit: String(r.total_term_deposit ?? 0),
        available: String(r.total_demand_deposit ?? 0),
    };
}

function toAccountRow(
    r: ApiDailyCashReportResponse["accounts"][number],
): DailyCashAccountRow {
    return {
        id: `${r.bank_cd}_${r.acct_no}`,
        bank: r.bank_nm || r.bank_cd,
        accountNo: r.acct_no,
        currency: r.currency_cd,
        numDebits: Number(r.send_count ?? 0),
        debit: String(r.send_amount ?? 0),
        numCredits: Number(r.receive_count ?? 0),
        credit: String(r.receive_amount ?? 0),
        balance: String(r.balance ?? 0),
    };
}
