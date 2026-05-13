"use client";

import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageLayout from "@/components/shared/PageLayout";
import PageActionButtons from "@/components/shared/PageActionButtons";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { useTableSort } from "@/hooks/useTableSort";
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
    /**
     * Fired when the user clicks the download glyph on the file chip.
     * Omit to render the button inert (today's default — every detail
     * page that needs working download must pass a handler).
     */
    onDownloadFile?: () => void;
    /**
     * Fired when the user clicks the list icon in the file-row toolbar.
     * Receives the icon's `DOMRect` so callers that anchor a popover
     * (View Setting per CLAUDE.md §13) can position relative to the
     * trigger. Pages without View Setting wiring can ignore the
     * argument and surface a "coming soon" dialog stub.
     */
    onListView?: (anchorRect: DOMRect) => void;
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
    /**
     * Opt-in client-side keyword search. When `searchableFields` is
     * supplied the file-row toolbar's SearchInput filters the visible
     * `rows` against those string fields (case-insensitive substring
     * match). Detail pages render a single batch's lines so a
     * client-side filter is appropriate — no pagination round-trip.
     */
    searchableFields?: ReadonlyArray<keyof Row & string>;
    /**
     * Opt-in client-side column sort. When `true`, every column whose
     * `sortable: true` flag is set wires a sort glyph + click handler
     * through {@code useTableSort}; the table sorts the visible
     * filtered `rows` by the column's `sortValue` (or `row[key]` if
     * none) before render. Cycle is the standard
     * default → ASC → DESC → default per CLAUDE.md §13a.
     */
    enableSort?: boolean;
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
 * Search + sort are opt-in via `searchableFields` / `enableSort`; both apply
 * client-side to the in-memory `rows` since a detail page already holds the
 * full batch.
 *
 * Reused by all Sprint 2 detail pages so chrome stays consistent.
 */
export default function PaymentDetailPage<Row extends { id: string }>({
    listTitle,
    subtitle,
    backHref,
    summary,
    file,
    onDownloadFile,
    onListView,
    columns,
    rows,
    minWidth,
    getRowClass,
    aboveTable,
    searchableFields,
    enableSort,
}: PaymentDetailPageProps<Row>) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const sort = useTableSort();

    // Client-side filter + sort. Both opt-in: pages that don't pass
    // `searchableFields` or `enableSort` get the original behaviour
    // (rows render verbatim in the order the parent supplied).
    const visibleRows = useMemo(() => {
        let out = rows;

        if (searchableFields && search.trim()) {
            const q = search.trim().toLowerCase();
            out = out.filter((row) =>
                searchableFields
                    .map((f) => {
                        const v = (row as Record<string, unknown>)[f];
                        return typeof v === "string" ? v : "";
                    })
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
            );
        }

        if (enableSort && sort.sortField && sort.sortDirection) {
            const col = columns.find((c) => c.key === sort.sortField);
            if (col) {
                const dir = sort.sortDirection === "ASC" ? 1 : -1;
                out = [...out].sort((a, b) => {
                    const av = col.sortValue
                        ? col.sortValue(a)
                        : (a as Record<string, unknown>)[col.key];
                    const bv = col.sortValue
                        ? col.sortValue(b)
                        : (b as Record<string, unknown>)[col.key];
                    return compareValues(av, bv) * dir;
                });
            }
        }
        return out;
    }, [rows, search, searchableFields, enableSort, sort.sortField, sort.sortDirection, columns]);

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
                    <FileCard
                        name={file.name}
                        size={file.size}
                        onDownload={onDownloadFile}
                    />
                    <div className="flex items-center gap-2">
                        {/* Figma 8:599 — detail toolbar has list icon only; no print, no excel.
                            `onList` receives the icon's DOMRect; the page forwards it to the
                            View Setting popover anchor per CLAUDE.md §13. */}
                        <PageActionButtons showList onList={onListView} />
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
                        rows={visibleRows}
                        minWidth={minWidth}
                        getRowClass={getRowClass}
                        {...(enableSort
                            ? {
                                  sort: {
                                      field: sort.sortField,
                                      direction: sort.sortDirection,
                                  },
                                  onSort: sort.toggleSort,
                              }
                            : {})}
                    />
                }
                pagination={
                    // Figma 8:599 has no pagination on detail pages — hidden always.
                    <Pagination
                        page={1}
                        pageCount={1}
                        pageSize={10}
                        totalLabel={t("common.showing_of", {
                            shown: String(visibleRows.length),
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

/**
 * Compare two sort values. Numbers compare numerically; strings compare
 * with the user's locale (case-insensitive). Mixed types coerce to
 * string so the sort still produces a stable order. NULL / undefined
 * always sort LAST regardless of direction — matches the legacy JEX
 * SQL NULLs-last ordering used on every list page.
 */
function compareValues(a: unknown, b: unknown): number {
    const aMissing = a == null || a === "";
    const bMissing = b == null || b === "";
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}
