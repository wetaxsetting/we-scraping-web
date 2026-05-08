"use client";

import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import DateRangePicker from "@/components/shared/DateRangePicker";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";

import TransactionHistoryActions from "./TransactionHistoryActions";
import TransactionStatusTabs from "./TransactionStatusTabs";
import TransactionTable from "./TransactionTable";
import TransactionTableFooter from "./TransactionTableFooter";
import TransactionTypeFilter from "./TransactionTypeFilter";
import type { TransactionAccount } from "./accounts";
import { countsFor } from "./mockData";
import type {
    TransactionRow,
    TransactionStatusFilter,
    TransactionTypeFilter as TypeFilter,
} from "./types";

// Stable empty-array reference so `rowsProp ?? EMPTY` keeps the same
// identity across renders — otherwise downstream `useMemo` deps churn
// every render and the React Compiler lint flags it.
const EMPTY_ROWS: TransactionRow[] = [];

type TransactionHistoryPageProps = {
    /** Selected account — drives the breadcrumb title and the data fetch. */
    account: TransactionAccount;
    /**
     * API-fetched rows. Defaults to an empty array when the live request
     * is in flight or returns no rows — Sprint 1 stabilization removed
     * the `rowsFor(account.id)` mock fallback, so the table renders
     * empty rather than seeded with synthetic data.
     */
    rows?: TransactionRow[];
};

/**
 * Transaction History detail page — Banking module. One component for
 * every account under both VND and FCY groups: the account choice is
 * driven by the URL (`/banking/transaction-history/[id]` or the FCY
 * twin) and the sidebar's nested account list. Mirrors Figma frames
 * 6044:25536 / 6044:25523 / 6044:25526 — a single top header block
 * with two aligned columns, then the data table:
 *
 *   Header (one block, two columns, `items-start`):
 *     Left  col:  title            |  Right col:  list + Excel + Smart Organizer
 *                 date + flow radio             All / Confirmed / Unconfirmed + Search
 *   Table: 10-col shared scroll: 5 statement cols + 5 matching cols
 *   Footer: total count + deposit/withdraw totals (pinned via mt-auto, §7a)
 *   Pagination: shared component outside the scroll container
 */
export default function TransactionHistoryPage({
    account,
    rows: rowsProp,
}: TransactionHistoryPageProps) {
    const { t } = useTranslation();
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>("all");
    const [search, setSearch] = useState("");
    const [dateRange] = useState({
        start: "25-04-2024",
        end: "25-12-2024",
    });

    const rows = rowsProp ?? EMPTY_ROWS;

    // Apply the deposit/withdraw flow filter first — status tabs and search
    // both operate on the already-flow-filtered scope so the counts match
    // what the user actually sees in the table.
    const byFlow = useMemo(() => {
        if (typeFilter === "all") return rows;
        if (typeFilter === "deposit") return rows.filter((r) => r.deposit);
        return rows.filter((r) => r.withdraw);
    }, [rows, typeFilter]);

    const statusCounts = useMemo(() => countsFor(byFlow), [byFlow]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return byFlow.filter((row) => {
            if (statusFilter === "confirmed" && !row.confirmed) return false;
            if (statusFilter === "unconfirmed" && row.confirmed) return false;
            if (!q) return true;
            return (
                row.remarks.toLowerCase().includes(q) ||
                row.contactsName?.toLowerCase().includes(q) ||
                row.purpose?.toLowerCase().includes(q) ||
                row.deposit?.toLowerCase().includes(q) ||
                row.withdraw?.toLowerCase().includes(q)
            );
        });
    }, [byFlow, statusFilter, search]);

    // Sibling totals: recompute on the filtered scope so the footer reflects
    // the currently-visible set, not the whole account.
    const totals = useMemo(() => {
        const count = filteredRows.length;
        let depositSum = 0;
        let withdrawSum = 0;
        for (const r of filteredRows) {
            if (r.deposit) depositSum += parseAmount(r.deposit);
            if (r.withdraw) withdrawSum += parseAmount(r.withdraw);
        }
        return {
            count,
            depositTotal: format(depositSum),
            withdrawTotal: format(withdrawSum),
        };
    }, [filteredRows]);

    return (
        <PageLayout>
            {/* Single top header block — two-column flex.
               Left:  title (row 1) + date range + flow radio (row 2).
               Right: action toolbar (row 1) + status tabs + search (row 2).
               `items-start` keeps the toolbar on the same top line as
               the title so the Excel icon and Smart Organizer button
               sit at the top-right corner of the header block per
               Figma 6044:25536 / 6044:25523 / 6044:25526. Inlined (not
               `<PageHeader>`) because this screen needs a two-row stack
               in both columns, which the shared header can't express. */}
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-4 pt-4 md:pt-6">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("txn_history.breadcrumb", {
                            account: `${account.bankName} (${account.currency})`,
                        })}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4">
                        <DateRangePicker
                            start={dateRange.start}
                            end={dateRange.end}
                        />
                        <TransactionTypeFilter
                            value={typeFilter}
                            onChange={setTypeFilter}
                        />
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                    <TransactionHistoryActions />
                    <div className="flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-4">
                        <TransactionStatusTabs
                            active={statusFilter}
                            counts={statusCounts}
                            onChange={setStatusFilter}
                        />
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder={t("txn_history.search_placeholder")}
                        />
                    </div>
                </div>
            </div>

            <DataTableShell
                footerMode="paginationWithTotals"
                table={<TransactionTable rows={filteredRows} />}
                footer={
                    <TransactionTableFooter
                        totals={totals}
                        currency={account.currency}
                        className="mt-auto"
                    />
                }
                pagination={
                    <Pagination
                        page={1}
                        pageCount={Math.max(1, Math.ceil(filteredRows.length / 10))}
                        pageSize={10}
                        totalLabel={t("common.showing_of", {
                            shown: String(filteredRows.length),
                            total: String(filteredRows.length),
                        })}
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}

function parseAmount(s: string): number {
    if (s.includes(",") && s.includes(".")) return Number(s.replace(/,/g, ""));
    if (s.match(/^\d{1,3}(\.\d{3})+$/)) return Number(s.replace(/\./g, ""));
    return Number(s.replace(/[,\s]/g, ""));
}

function format(n: number): string {
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
