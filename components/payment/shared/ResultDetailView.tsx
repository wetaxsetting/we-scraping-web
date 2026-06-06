"use client";

import { useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";

import DetailStatusTabs, { type DetailStatusTab } from "./DetailStatusTabs";
import PaymentDetailPage from "./PaymentDetailPage";
import { resultDetailColumns, RESULT_DETAIL_MIN_WIDTH } from "./detailColumns";
import type { PaymentListColumn } from "./types";
import type { DetailTransaction } from "./types";
import type { DetailSummaryField } from "./DetailSummary";
import type { BlockedCharsMap } from "@/lib/api/blockedChars";

type ResultTabKey = "all" | "success" | "failed" | "in_progress";

type ResultDetailViewProps = {
    listTitle: string;
    subtitle: string;
    backHref: string;
    summary: DetailSummaryField[];
    file?: { name: string; size: string };
    rows: DetailTransaction[];
    /** Fires when the user clicks the file-row download glyph. */
    onDownloadFile?: () => void;
    /**
     * Fires when the user clicks the file-row list icon — receives the
     * trigger's `DOMRect` so the caller can anchor a View Setting
     * popover (CLAUDE.md §13). Omit to render the icon inert.
     */
    onListView?: (anchorRect: DOMRect) => void;
    /**
     * Opt-in client-side keyword search. When supplied the file-row
     * SearchInput filters `rows` against the listed string fields
     * (case-insensitive substring match).
     */
    searchableFields?: ReadonlyArray<keyof DetailTransaction & string>;
    /**
     * Opt-in client-side column sort. When `true` every column flagged
     * `sortable: true` participates in the standard cycle.
     */
    enableSort?: boolean;
    /** When supplied, renders the Excel button in the toolbar. */
    onExcelExport?: () => void | Promise<void>;
    /**
     * Override the default column set. Defaults to `resultDetailColumns(t)`
     * which mirrors the generic JEX Result detail layout. Pass
     * `overseasResultDetailColumns(t)` for Overseas Payment pages.
     */
    columns?: PaymentListColumn<DetailTransaction>[];
    /** Override the minimum table width. Paired with `columns` when a
     *  custom column set is wider than the default RESULT_DETAIL_MIN_WIDTH. */
    tableMinWidth?: string;
    /**
     * Per-field blocked-chars map from {@link useBlockedChars}. When
     * supplied AND a {@code columns} override is NOT provided, the
     * default `resultDetailColumns(t, { blockedChars })` factory swaps
     * its Remarks-header static info icon for a live
     * {@link BlockedCharsTooltip}. Ignored when {@code columns} is
     * passed — the page is fully owning the column set in that case.
     */
    blockedChars?: BlockedCharsMap;
    /**
     * Re-run click handler. When supplied, the Banking Transaction ID
     * cell renders a Re-run CTA on rows that qualify (RS_CD ∈
     * transient set + PROC_DTTM today). Receives the line id; the
     * caller handles the confirmation dialog + API call + refresh.
     * Mirrors legacy {@code pymn_0010_002.ts:441-472}.
     */
    onRerun?: (lineId: string) => void;
    /**
     * Pre-translated empty-state copy rendered below the inner table
     * header when the current tab's filtered row set is empty. The
     * caller already filters by tab; the message stays the same per
     * page (Figma per-page contract) so it stays a single string.
     */
    emptyMessage?: string;
    /**
     * Sticky-wrapped initial-loading flag from the consumer. Forwarded
     * to {@link PaymentDetailPage} so the inner table empty-state
     * renders `t("common.loading")` until the first fetch lands.
     */
    loading?: boolean;
    /**
     * Optional header-level action slot (forwarded verbatim to
     * {@link PaymentDetailPage}). Backward-compatible: omit and nothing
     * renders. Used by Payroll Result Detail for the header-level Match /
     * Unmatch + matched-link controls; the other result-detail pages don't
     * pass it and render unchanged.
     */
    headerActions?: React.ReactNode;
};

/**
 * Result-variant detail view — Scheduled detail's twin with two extra
 * pieces: a `<DetailStatusTabs>` strip filtering the inner table by
 * result, and a Date/Time + Results column pair on the table itself.
 *
 * Mirrors the live JEX Result detail (`pymn_0004_002.act`): same summary
 * card + file chip + tabs + per-status table layout.
 */
export default function ResultDetailView({
    listTitle,
    subtitle,
    backHref,
    summary,
    file,
    rows,
    onDownloadFile,
    onListView,
    searchableFields,
    enableSort,
    onExcelExport,
    columns: columnsProp,
    tableMinWidth,
    blockedChars,
    onRerun,
    emptyMessage,
    loading,
    headerActions,
}: ResultDetailViewProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<ResultTabKey>("all");

    const counts = useMemo(() => ({
        all: rows.length,
        success: rows.filter((r) => r.result === "success").length,
        failed: rows.filter((r) => r.result === "failed").length,
        in_progress: rows.filter((r) => r.result === "pending").length,
    }), [rows]);

    const filtered = useMemo(() => {
        if (tab === "all") return rows;
        if (tab === "in_progress") return rows.filter((r) => r.result === "pending");
        return rows.filter((r) => r.result === tab);
    }, [rows, tab]);

    const tabs: DetailStatusTab<ResultTabKey>[] = [
        { key: "all", label: t("payment.detail.tab.all"), count: counts.all },
        { key: "success", label: t("payment.detail.tab.success"), count: counts.success },
        { key: "failed", label: t("payment.detail.tab.failed"), count: counts.failed },
        { key: "in_progress", label: t("payment.detail.tab.in_progress"), count: counts.in_progress },
    ];

    return (
        <PaymentDetailPage<DetailTransaction>
            listTitle={listTitle}
            subtitle={subtitle}
            backHref={backHref}
            summary={summary}
            file={file}
            onDownloadFile={onDownloadFile}
            onListView={onListView}
            onExcelExport={onExcelExport}
            columns={columnsProp ?? resultDetailColumns(t, { blockedChars, onRerun })}
            rows={filtered}
            minWidth={tableMinWidth ?? RESULT_DETAIL_MIN_WIDTH}
            searchableFields={searchableFields}
            enableSort={enableSort}
            emptyMessage={emptyMessage}
            loading={loading}
            headerActions={headerActions}
            aboveTable={
                <DetailStatusTabs<ResultTabKey>
                    active={tab}
                    onChange={setTab}
                    tabs={tabs}
                />
            }
        />
    );
}
