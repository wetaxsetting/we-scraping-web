"use client";

import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import Pagination from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";

import ApprovalTable from "./ApprovalTable";
import ApprovalTableFooter from "./ApprovalTableFooter";
import ApprovalTabs from "./ApprovalTabs";
import FilterBar from "./FilterBar";
import { mockCurrencyTotals, mockRows, mockTabCounts } from "./mockData";
import type { ApprovalTabKey } from "./types";

export default function ApprovalBoxPage() {
    const { t } = useTranslation();
    const [tab, setTab] = useState<ApprovalTabKey>("all");
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState({
        start: "05-Jan-2025",
        end: "30-Jan-2025",
    });

    // Client-side filter against mock rows (UI-only placeholder; the real
    // query will move server-side once the API lands).
    const filteredRows = useMemo(() => {
        const bucket =
            tab === "all" ? mockRows : mockRows.filter((r) => r.status === tab);
        if (!search.trim()) return bucket;
        const q = search.trim().toLowerCase();
        return bucket.filter((r) =>
            [r.title, r.fileName, r.documentNo, r.requestor, r.approver]
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [tab, search]);

    return (
        // Full-height flex column: main inherits viewport height from AppShell,
        // the table section flexes to fill, and pagination pins to the bottom.
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 md:px-6">
                {/* Page header */}
                <PageHeader title={t("approval.title")}>
                    <PageActionButtons showList showPrint showExcel />
                </PageHeader>

                {/* Tabs */}
                <ApprovalTabs active={tab} counts={mockTabCounts} onChange={setTab} />

                {/* Filter row */}
                <FilterBar
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    search={search}
                    onSearchChange={setSearch}
                    onDateChange={setDateRange}
                />

                {/* Paginated table shell — CLAUDE.md §7a. Shared component
                   owns the scroll container, `mt-auto` footer anchor, and
                   pagination slot so no page re-implements these wrappers. */}
                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={<ApprovalTable rows={filteredRows} />}
                    footer={
                        <ApprovalTableFooter
                            documentCount={filteredRows.length}
                            totals={mockCurrencyTotals}
                            className="mt-auto"
                        />
                    }
                    pagination={
                        <Pagination
                            page={1}
                            pageCount={3}
                            pageSize={10}
                            totalLabel="10 of 30"
                            className="shrink-0"
                        />
                    }
                />
            </div>
        </div>
    );
}
