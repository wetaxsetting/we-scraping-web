"use client";

import { useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageLayout from "@/components/shared/PageLayout";
import PageActionButtons from "@/components/shared/PageActionButtons";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { useTranslation } from "@/lib/i18n";

import DetailHeader from "./DetailHeader";
import DetailSummary, { type DetailSummaryField } from "./DetailSummary";
import FileCard from "./FileCard";
import PaymentListTable from "./PaymentListTable";
import type { PaymentListColumn } from "./types";

type PaymentDetailPageProps<Row extends { id: string }> = {
    /** Parent list label rendered before the chevron (already translated). */
    listTitle: string;
    /** File / row identifier rendered after the chevron. */
    subtitle: string;
    /** Route the Back button returns to. */
    backHref: string;
    /** Summary card fields — usually 4–6 label/value pairs. */
    summary: DetailSummaryField[];
    /** Optional uploaded-file chip — omit on flows that don't carry a file. */
    file?: { name: string; size: string };
    /** Inner detail-transaction columns. */
    columns: PaymentListColumn<Row>[];
    /** Inner detail-transaction rows (mock for static UI). */
    rows: Row[];
    /** Min-width for the inner table so it horizontally scrolls cleanly. */
    minWidth: string;
    /**
     * Optional per-row Tailwind class — passed through to PaymentListTable for
     * row-level highlights (e.g. amber background for assigned reporting accounts
     * per Figma 8:599).
     */
    getRowClass?: (row: Row) => string | undefined;
    /** Optional slot rendered between the file card row and the table —
     *  used for the Result variant's status tab strip. */
    aboveTable?: React.ReactNode;
};

/**
 * Shared layout for every Payment detail page (Sprint 2). Mirrors Figma 8:599:
 * breadcrumb header + Back button → single-line summary card → file card row
 * (file chip LEFT, list-icon + search RIGHT on the same flex row) → optional
 * tabs → detail transaction table.
 *
 * Pagination is intentionally absent: detail pages show all transactions in a
 * batch (Figma 8:599 has no pagination footer). If a future detail screen needs
 * pagination, add a `showPagination` prop rather than re-adding it here.
 *
 * Reused by all Sprint 2 detail pages so chrome stays consistent.
 */
export default function PaymentDetailPage<Row extends { id: string }>({
    listTitle,
    subtitle,
    backHref,
    summary,
    file,
    columns,
    rows,
    minWidth,
    getRowClass,
    aboveTable,
}: PaymentDetailPageProps<Row>) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");

    return (
        <PageLayout>
            <DetailHeader
                listTitle={listTitle}
                subtitle={subtitle}
                backHref={backHref}
            />

            <DetailSummary fields={summary} />

            {/* File card row — file chip LEFT, toolbar (list + search) RIGHT,
                matching Figma 8:897 "Frame 1000004877" layout. */}
            {file ? (
                <div className="flex shrink-0 items-center justify-between gap-3">
                    <FileCard name={file.name} size={file.size} />
                    <div className="flex items-center gap-2">
                        {/* Figma 8:599 — detail toolbar has list icon only; no print, no excel */}
                        <PageActionButtons showList />
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder={t("common.search")}
                        />
                    </div>
                </div>
            ) : null}

            {aboveTable}

            <DataTableShell
                footerMode="paginationOnly"
                table={
                    <PaymentListTable
                        columns={columns}
                        rows={rows}
                        minWidth={minWidth}
                        getRowClass={getRowClass}
                    />
                }
                pagination={
                    // Figma 8:599 has no pagination on detail pages — hidden always.
                    <Pagination
                        page={1}
                        pageCount={1}
                        pageSize={10}
                        totalLabel={t("common.showing_of", {
                            shown: String(rows.length),
                            total: String(rows.length),
                        })}
                        hidden
                        className="shrink-0"
                    />
                }
            />
        </PageLayout>
    );
}
