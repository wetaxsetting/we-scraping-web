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
 * into the in-memory `DailyCashPage` props (summary, accounts). The legacy
 * VN view has no physical-cash table (Redmine #42096), so no holdings list
 * is rendered.
 */
export default function DailyCashClient() {
    const [scope, setScope] = useState<CurrencyScope>("all");
    const [hasSearched, setHasSearched] = useState(false);
    const [searchKey, setSearchKey] = useState(0);

    // User-picked as-of date (ISO `YYYY-MM-DD`). Defaults to today so the
    // chip reads as the current snapshot before the user picks; changing
    // it does NOT refetch on its own — the user must click Search,
    // matching the legacy `rept_0009_001` "click to apply" behaviour.
    const [asOfIsoDate, setAsOfIsoDate] = useState<string>(
        () => new Date().toISOString().slice(0, 10),
    );

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
    /* Split the flat account list into Current vs Saving sections using the
       DB-confirmed legacy `ACCT_TYPE_CD` discriminator (see helpers below):
       Current = "03" | "04", Savings = "05" | "06". Loan ("01"), term
       deposit ("02"), and "07"/"08" appear in neither table (legacy parity). */
    const currentAccounts = useMemo<DailyCashAccountRow[] | undefined>(
        () => data?.accounts?.filter((a) => isCurrentType(a.acct_type_cd)).map(toAccountRow),
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
            accounts={currentAccounts}
            savingAccounts={savingAccounts}
            asOfDate={formatDmy(asOfIsoDate)}
            asOfIsoDate={asOfIsoDate}
            onAsOfDateChange={setAsOfIsoDate}
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

/* DB-confirmed legacy `ACCT_TYPE_CD` split (rept_0009_001_osmc.ts:622,748):
 * Current Accounts = "03" | "04"; Savings Accounts = "05" | "06". Loan ("01"),
 * Term/Fixed deposit ("02"), and "07"/"08" render in NO table on the legacy VN
 * view and are intentionally dropped from both sections. */
const CURRENT_ACCT_TYPES = new Set(["03", "04"]);
const SAVING_ACCT_TYPES = new Set(["05", "06"]);

/** Legacy Current Account bucket — `ACCT_TYPE_CD` "03" | "04". */
function isCurrentType(acctTypeCd: string | undefined | null): boolean {
    return CURRENT_ACCT_TYPES.has((acctTypeCd ?? "").trim());
}

/** Legacy Savings Account bucket — `ACCT_TYPE_CD` "05" | "06". */
function isSavingType(acctTypeCd: string | undefined | null): boolean {
    return SAVING_ACCT_TYPES.has((acctTypeCd ?? "").trim());
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
        // Only Current (03/04) and Savings (05/06) contribute — matches the
        // legacy summary buckets; loan/term/07/08 are excluded.
        if (isCurrentType(a.acct_type_cd)) bucket.current += bal;
        else if (isSavingType(a.acct_type_cd)) bucket.savings += bal;
        buckets.set(ccy, bucket);
    }
    return Array.from(buckets.entries()).map(([ccy, b]) => ({
        currencyLabel: ccy,
        cash: "0",
        current: String(b.current),
        savings: String(b.savings),
        timeDeposit: "0",
        loan: "0",
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
        loan: String(r.total_loan ?? 0),
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
