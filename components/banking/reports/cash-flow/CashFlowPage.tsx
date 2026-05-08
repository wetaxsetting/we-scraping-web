"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import ReportLayout from "@/components/shared/ReportLayout";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type {
    CashFlowGroup,
    CashFlowReport,
    CashFlowSubgroup,
} from "./types";

const EMPTY_REPORT: CashFlowReport = {
    months: [],
    openingBalance: [],
    groups: [],
    salesProfit: [],
    nonSalesProfit: [],
    endBalance: [],
};

type CashFlowPageProps = {
    /** API-fetched report. Empty default — Sprint 1 stabilization removed
     *  the mock seed; API is the single source of truth. */
    report?: CashFlowReport;
};

/**
 * Cash Flow report — Figma 9183:23697. Pivot matrix: months go across,
 * revenue / expenses groupings go down with nested subgroups. Sub-total,
 * sales-profit, non-sales-profit, and end-balance rows are highlighted
 * using the shared WB status tokens (progress = sub-total blue, approved
 * = profit/balance green).
 */
export default function CashFlowPage({ report }: CashFlowPageProps = {}) {
    const { t } = useTranslation();
    const [year] = useState("2025");
    const [search, setSearch] = useState("");
    const data = report ?? EMPTY_REPORT;

    return (
        <PageLayout>
            <PageHeader title={t("report.cash_flow.title")}>
                <Button
                    type="button"
                    variant="outline"
                    className="h-9 gap-2 px-4 text-wb-14"
                >
                    <FileSpreadsheet
                        className="size-4 text-wb-status-approved-text"
                        strokeWidth={2}
                    />
                    {t("report.download_excel")}
                </Button>
            </PageHeader>

            <FilterRow right={<SearchInput value={search} onChange={setSearch} />}>
                <span className="text-wb-14-tight font-medium text-black">
                    {t("report.cash_flow.exchange_rate")}
                </span>
                <FilterDropdown value="26,138" className="w-[120px]" />
                <FilterDropdown value="VND" className="w-[90px]" />
                <FilterDropdown value={year} className="w-[100px]" />
                <FilterDropdown
                    value={t("report.cash_flow.period.this_year")}
                    className="w-[140px]"
                />
                <FilterDropdown
                    value={t("report.filter.all_accounts")}
                    className="min-w-[180px]"
                />
            </FilterRow>

            {/* Banking report layout (CLAUDE.md §7b) — continuous-scroll
               body, no pagination. */}
            <ReportLayout>
                <CashFlowTable report={data} />
            </ReportLayout>
        </PageLayout>
    );
}

function CashFlowTable({ report }: { report: CashFlowReport }) {
    const { t } = useTranslation();
    const monthCount = report.months.length;

    return (
        <table className="w-full min-w-[1600px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[120px]" />
                <col className="w-[200px]" />
                <col className="w-[130px]" />
                <col className="w-[200px]" />
                {report.months.map((month) => (
                    <col key={`col-${month}`} className="w-[110px]" />
                ))}
            </colgroup>

            <thead className="sticky top-0 z-10">
                {/* Opening balance row as the header */}
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar">
                    <th
                        colSpan={2}
                        rowSpan={2}
                        className="bg-wb-bg-sidebar px-2.5 text-center align-middle"
                    >
                        <span className="text-wb-14 font-semibold text-wb-dark">
                            {t("report.cash_flow.opening_balance")}
                        </span>
                    </th>
                    <TableHeaderCell sortable>{t("report.cash_flow.col.item_code")}</TableHeaderCell>
                    <TableHeaderCell sortable>{t("report.cash_flow.col.item_name")}</TableHeaderCell>
                    {report.months.map((month, idx) => (
                        <th
                            key={`month-${month}-${idx}`}
                            className="bg-wb-bg-sidebar px-2.5 py-3 text-right align-middle"
                        >
                            <span className="text-wb-14 font-semibold text-wb-dark">
                                {month}
                            </span>
                        </th>
                    ))}
                </tr>
                {/* Opening balance numeric row */}
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar">
                    <th className="bg-wb-bg-sidebar" aria-hidden />
                    <th className="bg-wb-bg-sidebar" aria-hidden />
                    {report.openingBalance.map((value, idx) => (
                        <th
                            key={`open-${idx}`}
                            className="bg-wb-bg-sidebar px-2.5 py-2 text-right align-middle"
                        >
                            <span className="text-wb-13 font-semibold text-wb-ink">
                                {value || "-"}
                            </span>
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody>
                {report.groups.map((group) => (
                    <GroupRows key={group.id} group={group} monthCount={monthCount} />
                ))}

                {/* Sales profit — green accent */}
                <AccentRow
                    label={t("report.cash_flow.sales_profit")}
                    values={report.salesProfit}
                    variant="approved"
                />

                {/* Non-sales profit — neutral */}
                <AccentRow
                    label={t("report.cash_flow.non_sales_profit")}
                    values={report.nonSalesProfit}
                    variant="approved"
                />

                {/* End balance — darkest green */}
                <tr className="h-[var(--h-wb-table-row)] bg-wb-status-approved-text hover:bg-wb-status-approved-text">
                    <td colSpan={4} className="px-2.5 py-3 text-center align-middle">
                        <span className="text-wb-14 font-semibold uppercase tracking-wb-tight text-white">
                            {t("report.cash_flow.end_balance")}
                        </span>
                    </td>
                    {report.endBalance.map((value, idx) => (
                        <td
                            key={`end-${idx}`}
                            className="px-2.5 py-3 text-right align-middle"
                        >
                            <span className="text-wb-13 font-semibold text-white">
                                {value || "-"}
                            </span>
                        </td>
                    ))}
                </tr>
            </tbody>
        </table>
    );
}

function GroupRows({
    group,
    monthCount,
}: {
    group: CashFlowGroup;
    monthCount: number;
}) {
    const { t } = useTranslation();
    const detailCount = group.subgroups.reduce(
        (acc, sg) => acc + sg.details.length,
        0,
    );

    return (
        <>
            {group.subgroups.map((subgroup, sgIdx) => (
                <SubgroupRows
                    key={subgroup.id}
                    group={group}
                    subgroup={subgroup}
                    isFirstSubgroup={sgIdx === 0}
                    totalDetailCount={detailCount}
                />
            ))}

            {/* Sub-total row */}
            <tr className="h-[var(--h-wb-table-row)] border-b border-wb-table-border bg-wb-status-progress-bg hover:bg-wb-status-progress-bg">
                <td
                    colSpan={4}
                    className="px-2.5 py-3 text-center align-middle"
                >
                    <span className="text-wb-13 font-semibold text-wb-dark">
                        {t("report.cash_flow.sub_total")}
                    </span>
                </td>
                {group.subTotals.slice(0, monthCount).map((value, idx) => (
                    <td
                        key={`${group.id}-st-${idx}`}
                        className="px-2.5 py-3 text-right align-middle"
                    >
                        <span className="text-wb-13 font-semibold text-wb-ink">
                            {value || "-"}
                        </span>
                    </td>
                ))}
            </tr>
        </>
    );
}

function SubgroupRows({
    group,
    subgroup,
    isFirstSubgroup,
    totalDetailCount,
}: {
    group: CashFlowGroup;
    subgroup: CashFlowSubgroup;
    isFirstSubgroup: boolean;
    totalDetailCount: number;
}) {
    return (
        <>
            {subgroup.details.map((detail, detailIdx) => (
                <tr
                    key={detail.id}
                    className="h-[var(--h-wb-table-row)] border-b border-wb-table-border"
                >
                    {/* Group label — rowSpan across all details in the whole group */}
                    {isFirstSubgroup && detailIdx === 0 && (
                        <td
                            rowSpan={totalDetailCount}
                            className="border-r border-wb-table-border px-2.5 py-2.5 align-middle text-center"
                        >
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-wb-13 font-medium text-wb-muted">
                                    {group.labelKo}
                                </span>
                                <span className="text-wb-13 font-semibold text-wb-dark">
                                    {group.labelEn}
                                </span>
                            </div>
                        </td>
                    )}
                    {/* Subgroup label — rowSpan across this subgroup's details */}
                    {detailIdx === 0 && (
                        <td
                            rowSpan={subgroup.details.length}
                            className="border-r border-wb-table-border px-2.5 py-2.5 align-middle"
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="text-wb-13 font-medium text-wb-muted">
                                    {subgroup.labelKo}
                                </span>
                                <span className="text-wb-13 font-medium text-wb-ink">
                                    {subgroup.labelEn}
                                </span>
                            </div>
                        </td>
                    )}
                    <td className="px-2.5 py-2.5 align-middle">
                        <span className="block truncate text-wb-13 font-normal text-wb-muted">
                            {detail.itemCode || "-"}
                        </span>
                    </td>
                    <td className="px-2.5 py-2.5 align-middle">
                        <span className="block truncate text-wb-13 font-medium text-wb-ink">
                            {detail.itemName}
                        </span>
                    </td>
                    {detail.months.map((value, monthIdx) => (
                        <td
                            key={`${detail.id}-${monthIdx}`}
                            className="px-2.5 py-2.5 text-right align-middle"
                        >
                            <span
                                className={cn(
                                    "block truncate text-wb-13",
                                    value
                                        ? "font-medium text-wb-ink"
                                        : "font-normal text-wb-ntrl-5",
                                )}
                            >
                                {value || ""}
                            </span>
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

function AccentRow({
    label,
    values,
    variant,
}: {
    label: string;
    values: string[];
    variant: "approved" | "progress";
}) {
    return (
        <tr
            className={cn(
                "h-[var(--h-wb-table-row)] border-b border-wb-table-border",
                variant === "approved"
                    ? "bg-wb-status-approved-bg hover:bg-wb-status-approved-bg"
                    : "bg-wb-status-progress-bg hover:bg-wb-status-progress-bg",
            )}
        >
            <td colSpan={4} className="px-2.5 py-3 text-center align-middle">
                <span className="text-wb-13 font-semibold uppercase tracking-wb-tight text-wb-dark">
                    {label}
                </span>
            </td>
            {values.map((value, idx) => (
                <td
                    key={`accent-${idx}`}
                    className="px-2.5 py-3 text-right align-middle"
                >
                    <span className="text-wb-13 font-semibold text-wb-ink">
                        {value || "-"}
                    </span>
                </td>
            ))}
        </tr>
    );
}
