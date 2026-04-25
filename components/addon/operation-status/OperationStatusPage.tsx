"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";

import OperationStatusActionBar from "./OperationStatusActionBar";
import { mockOperationRows } from "./mockData";
import type { OperationCompanyRow, OperationStatusCode } from "./types";

const DEFAULT_PAGE_SIZE = 15;
const TOTAL_COMPANIES = 202;

/**
 * Add-on Service > Operation Status Inquiry (Figma node 12346:109158, live
 * JEX ref `aosv_0001_001.act`).
 *
 * Paginated list of customer/supplier companies whose tax-authority
 * operation status (e-invoice certificate state) is polled from the
 * Vietnamese General Department of Taxation. Uses `<DataTableShell>` in
 * `paginationOnly` mode — Figma has pagination but no totals row, so no
 * sibling footer `<table>` is rendered (CLAUDE.md §7a "Table Footer
 * Modes").
 */
export default function OperationStatusPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");

    const filteredRows = useMemo<OperationCompanyRow[]>(() => {
        const q = search.trim().toLowerCase();
        if (!q) return mockOperationRows;
        return mockOperationRows.filter((r) =>
            [r.companyName, r.taxCode, r.address]
                .join(" ")
                .toLowerCase()
                .includes(q),
        );
    }, [search]);

    const pageCount = Math.ceil(TOTAL_COMPANIES / DEFAULT_PAGE_SIZE);

    return (
        <PageLayout>
            <PageHeader title={t("operation.title")}>
                <OperationStatusActionBar />
            </PageHeader>

            <FilterRow right={<SearchInput value={search} onChange={setSearch} />}>
                <FilterDropdown
                    value={t("operation.filter.all_operation_status")}
                    className="w-[250px]"
                />
            </FilterRow>

            <DataTableShell
                footerMode="paginationOnly"
                table={
                    <table className="w-full min-w-[960px] table-fixed border-collapse">
                        <colgroup>
                            <col className="w-[66px]" />
                            <col />
                            <col />
                            <col className="w-[339px]" />
                            <col className="w-[220px]" />
                        </colgroup>
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                <TableHead className="px-2.5 text-left">
                                    <Checkbox className="size-[var(--size-wb-icon-sm)]" />
                                </TableHead>
                                <TableHeaderCell>{t("operation.col.company")}</TableHeaderCell>
                                <TableHeaderCell>{t("operation.col.address")}</TableHeaderCell>
                                <TableHeaderCell>{t("operation.col.operation_status")}</TableHeaderCell>
                                <TableHeaderCell>{t("operation.col.last_update")}</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                                >
                                    <TableCell className="px-2.5 align-middle">
                                        <Checkbox className="size-[var(--size-wb-icon-sm)]" />
                                    </TableCell>
                                    <TableCell className="px-2.5 py-2.5 align-middle">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="truncate text-wb-13 font-medium text-wb-ink">
                                                {row.companyName}
                                            </span>
                                            <span className="truncate text-wb-13 font-normal text-wb-muted">
                                                {row.taxCode}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-2.5 py-2.5 align-middle">
                                        <span className="block truncate text-wb-13 font-normal text-wb-ink">
                                            {row.address}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-2.5 py-2.5 align-middle">
                                        <OperationStatusCell status={row.status} />
                                    </TableCell>
                                    <TableCell className="px-2.5 py-2.5 align-middle">
                                        <span className="text-wb-13 font-normal text-wb-ink">
                                            {row.lastUpdate}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                }
                pagination={
                    <Pagination
                        page={1}
                        pageCount={pageCount}
                        pageSize={DEFAULT_PAGE_SIZE}
                        totalLabel={t("common.showing_of", {
                            shown: String(filteredRows.length),
                            total: String(TOTAL_COMPANIES),
                        })}
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}

function OperationStatusCell({ status }: { status: OperationStatusCode }) {
    const { t } = useTranslation();
    return (
        <span className="inline-flex items-center gap-1 text-wb-13 font-medium text-wb-status-approved-text">
            <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
            <span>{t(`operation.status.${status}`)}</span>
        </span>
    );
}
