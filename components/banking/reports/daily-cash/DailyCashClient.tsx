"use client";

import { useMemo } from "react";

import DailyCashPage from "./DailyCashPage";
import type {
    DailyCashAccountRow,
    DailyCashSummaryRow,
} from "./types";
import { fetchDailyCashReport, type ApiDailyCashReportResponse } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";

/**
 * Client wrapper for the Banking > Daily Cash report.
 *
 * Targets the refactor endpoint `GET /api/v1/banking/reports/daily-cash-report`
 * (slug: `daily-cash-report`). Sends `asOfDate` (today's date) + `currency=ALL`
 * on mount; Search-button-driven refetch + currency toggle land in a follow-up
 * (per the spec's §4 "Frontend page" section — currently this client renders
 * eagerly to keep the existing page chrome stable while the migration is
 * incremental).
 *
 * Maps the three-tier wire shape (currency_summary, accounts, currency_flow)
 * into the existing in-memory `DailyCashPage` props (summary, holdings,
 * accounts) so the page composition stays untouched. `holdings` stays empty —
 * the new endpoint folds cash holdings into the currency_summary cash bucket
 * rather than exposing them as a separate list.
 */
export default function DailyCashClient() {
    const asOfDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const { data } = useApiData(
        () => fetchDailyCashReport({ asOfDate, currency: "ALL" }),
        [asOfDate],
    );

    const summary = useMemo<DailyCashSummaryRow[] | undefined>(
        () => data?.currency_summary?.map(toSummaryRow),
        [data],
    );
    const accounts = useMemo<DailyCashAccountRow[] | undefined>(
        () => data?.accounts?.map(toAccountRow),
        [data],
    );

    return (
        <DailyCashPage summary={summary} holdings={undefined} accounts={accounts} />
    );
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
