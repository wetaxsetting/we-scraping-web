"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import Pagination from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import CardSummaryCards from "./CardSummaryCards";
import CardTransactionsFilterBar from "./CardTransactionsFilterBar";
import CardTransactionsTable from "./CardTransactionsTable";
import CardTransactionsTableFooter from "./CardTransactionsTableFooter";
import { mockCurrencyTotals, mockRows, mockSummary } from "./mockData";
import type { LinkTab } from "./types";

export default function CardTransactionsPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<LinkTab>("all");
    const [search, setSearch] = useState("");
    const [dateRange] = useState({ start: "05-Jan-2025", end: "30-Jan-2025" });

    const filteredRows = useMemo(() => {
        let rows = mockRows;

        if (activeTab === "linked") {
            rows = rows.filter(
                (r) => !r.linkRef.isAction && r.linkRef.primary !== "",
            );
        } else if (activeTab === "unlinked") {
            rows = rows.filter((r) => r.linkRef.isAction);
        }

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter((r) =>
                [r.merchant, r.cardNickname, r.cardholder, r.cardNumber, r.reportingAccount]
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
            );
        }

        return rows;
    }, [activeTab, search]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-6">
                {/* Page header — title left, actions right */}
                <PageHeader title={t("payment.card.title")}>
                    <div className="flex items-center gap-2">
                        {/* Dashboard chip button */}
                        <button
                            type="button"
                            className={cn(
                                "flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3",
                                "bg-brand text-white text-wb-14-tight font-medium",
                                "hover:bg-brand-hover",
                            )}
                        >
                            <span>{t("payment.card.dashboard")}</span>
                            <Eye className="size-4" strokeWidth={1.8} />
                        </button>

                        {/* List / Print / Excel icon buttons */}
                        <PageActionButtons showList showPrint showExcel />

                        {/* Manage Cards outlined button */}
                        <button
                            type="button"
                            className="flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50"
                        >
                            {t("payment.card.manage_cards")}
                        </button>

                        {/* Update — brand solid button */}
                        <button
                            type="button"
                            className="flex h-[var(--h-wb-filter-btn)] shrink-0 cursor-pointer items-center rounded-md bg-brand px-4 text-wb-14-tight font-medium text-white hover:bg-brand-hover"
                        >
                            {t("payment.card.update")}
                        </button>
                    </div>
                </PageHeader>

                {/* Summary cards */}
                <CardSummaryCards summary={mockSummary} />

                {/* Filter / toolbar */}
                <CardTransactionsFilterBar
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    activeTab={activeTab}
                    search={search}
                    onTabChange={setActiveTab}
                    onSearchChange={setSearch}
                />

                {/* Table + footer + pagination */}
                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={<CardTransactionsTable rows={filteredRows} />}
                    footer={
                        <CardTransactionsTableFooter
                            transactionCount={filteredRows.length}
                            totals={mockCurrencyTotals}
                            className="mt-auto"
                        />
                    }
                    pagination={
                        <Pagination
                            page={1}
                            pageCount={3}
                            pageSize={10}
                            totalLabel={`${filteredRows.length} of ${mockRows.length}`}
                            className="shrink-0"
                        />
                    }
                />
            </div>
        </div>
    );
}
