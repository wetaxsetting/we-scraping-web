"use client";

import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import FilterRow from "@/components/shared/FilterRow";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { mockTransferHistory, mockTransferHistoryTotal } from "./mockData";
import TransferHistoryTable from "./TransferHistoryTable";
import TransferHistoryTableFooter from "./TransferHistoryTableFooter";
import type { TransferStatus } from "./types";

type StatusFilter = "all" | TransferStatus;

const STATUS_OPTIONS: StatusFilter[] = ["all", "success", "failed"];

export default function TransferHistoryPage() {
    const { t } = useTranslation();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [startDate] = useState("25-04-2024");
    const [endDate] = useState("25-12-2024");

    const filteredRows = useMemo(() => {
        if (statusFilter === "all") return mockTransferHistory;
        return mockTransferHistory.filter((r) => r.status === statusFilter);
    }, [statusFilter]);

    const totals = useMemo(
        () => ({
            ...mockTransferHistoryTotal,
            count: filteredRows.length,
        }),
        [filteredRows.length],
    );

    return (
        <PageLayout>
            <PageHeader title={t("transfer_history.title")}>
                <PageActionButtons showList showPrint showExcel />
            </PageHeader>

            <FilterRow>
                <DateChip value={startDate} />
                <DateChip value={endDate} />
                <div className="ml-2 flex flex-wrap items-center gap-4">
                    {STATUS_OPTIONS.map((key) => (
                        <RadioButton
                            key={key}
                            active={statusFilter === key}
                            label={t(`transfer_history.filter.${key}`)}
                            onClick={() => setStatusFilter(key)}
                        />
                    ))}
                </div>
            </FilterRow>

            <DataTableShell
                footerMode="paginationWithTotals"
                table={<TransferHistoryTable rows={filteredRows} />}
                footer={
                    <TransferHistoryTableFooter
                        totals={totals}
                        className="mt-auto"
                    />
                }
                pagination={
                    <Pagination
                        page={1}
                        pageCount={3}
                        pageSize={10}
                        totalLabel={t("common.showing_of", {
                            shown: String(filteredRows.length),
                            total: "30",
                        })}
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}

function DateChip({ value }: { value: string }) {
    const { t } = useTranslation();
    return (
        <div className="flex h-[var(--h-wb-filter-btn)] items-center gap-2 overflow-clip rounded-md bg-white px-2 shadow-wb-btn">
            <span className="whitespace-nowrap text-wb-14-tight font-medium text-wb-ntrl-8">
                {value}
            </span>
            <button
                type="button"
                aria-label={t("common.open_calendar")}
                className="flex size-4 shrink-0 cursor-pointer items-center justify-center"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/common/ico-calendar-outline.svg"
                    alt=""
                    aria-hidden
                    className="size-4"
                />
            </button>
        </div>
    );
}

function RadioButton({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className="flex cursor-pointer items-center gap-2.5"
        >
            <span
                className={cn(
                    "relative flex size-[18px] shrink-0 items-center justify-center rounded-full border bg-white",
                    active ? "border-brand" : "border-wb-ntrl-4",
                )}
            >
                {active && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                {label}
            </span>
        </button>
    );
}
