"use client";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import type { SortDirection } from "@/hooks/useTableSort";
import { formatDateChip } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { FirmBankingHistoryRow, FirmBankingResult } from "./types";

type FirmBankingHistoryTableProps = {
    rows: FirmBankingHistoryRow[];
    /**
     * Currently-sorting FIELD_ID (e.g. {@code TARN_DTM}). The shared
     * {@code <TableHeaderCell>} reads this to render its active glyph
     * + ARIA `aria-sort` attribute.
     */
    sortField: string | null;
    sortDirection: SortDirection;
    /** Click / Enter / Space handler — receives the column's FIELD_ID. */
    onSort: (fieldId: string) => void;
    /**
     * Fires when a row's `View Details` is clicked. The trigger's bounding
     * rect is forwarded so the panel can anchor the detail popover under
     * the button — see {@link FirmBankingHistoryDetailPopover}.
     */
    onViewDetails?: (row: FirmBankingHistoryRow, anchorRect: DOMRect) => void;
    /**
     * Label rendered inside the empty-state row when {@code rows} is
     * empty. Defaults to the localized "No Data Found" message. Hosts
     * pass the localized "Loading…" string while a sticky-loading
     * window is open so the empty state doesn't flash on/off before
     * the first rows arrive.
     */
    emptyLabel?: string;
};

/**
 * Firm Banking History table — Figma 9198:11718.
 *
 * <p>Bare {@code <table>} + {@code table-fixed} + {@code <colgroup>} so
 * column widths stay stable when the panel is narrower (the parent
 * scroll container handles horizontal scroll). The header is
 * {@code sticky top-0} so it stays pinned while the body scrolls — same
 * shape as {@code <PurposeTable>}.
 *
 * <p>Sortable headers use the shared {@code <TableHeaderCell>} so the
 * sort glyph + ARIA semantics match every other list page in the app.
 * Headers carry the View Setting FIELD_ID values whitelisted by the
 * Phase 2 backend's {@code FirmBankingHistorySortField} enum
 * ({@code TARN_DTM}, {@code SVC_TYPE}, {@code SVC_NM}, {@code SEQ_NO},
 * {@code DEP_BANK_CD}, {@code RSLT_CD}).
 *
 * <p>Result colours are plain text in the WB365 status ramps (no pill /
 * background) — the Figma frame shows coloured copy, not a badge.
 */
export default function FirmBankingHistoryTable({
    rows,
    sortField,
    sortDirection,
    onSort,
    onViewDetails,
    emptyLabel,
}: FirmBankingHistoryTableProps) {
    const { t } = useTranslation();
    const resolvedEmptyLabel =
        emptyLabel ?? t("settings.firm_banking_history.empty_state");
    return (
        // `min-w` forces the table to render at its full width so headers
        // never wrap — the parent scroll container takes over horizontally
        // when the modal panel is narrower than the table's intrinsic width.
        <table className="w-full min-w-[1340px] table-fixed border-collapse">
            <colgroup>
                <col className="w-[140px]" />
                <col className="w-[180px]" />
                <col className="w-[220px]" />
                <col className="w-[260px]" />
                <col className="w-[260px]" />
                <col className="w-[120px]" />
                <col className="w-[160px]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <TableHeaderCell
                        sortFieldId="TARN_DTM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.firm_banking_history.col.date_time")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="SVC_TYPE"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.firm_banking_history.col.service_type")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="SVC_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.firm_banking_history.col.service_name")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="SEQ_NO"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.firm_banking_history.col.seq_no")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="DEP_BANK_CD"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.firm_banking_history.col.inst_code")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="RSLT_CD"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {t("settings.firm_banking_history.col.results")}
                    </TableHeaderCell>
                    {/* "View Details" action column — non-sortable. */}
                    <TableHeaderCell
                        sortable={false}
                        textSizeClass="text-wb-13"
                        className="bg-wb-bg-sidebar"
                    >
                        {/* Visually empty header per Figma; aria-hidden via
                            the empty children. */}
                        <span aria-hidden="true">&nbsp;</span>
                    </TableHeaderCell>
                </tr>
            </thead>

            <tbody>
                {rows.length === 0 ? (
                    /* Empty-state row — spans every visible column and
                       centers the message both axes. `align-middle` on
                       the cell gives true vertical centering inside the
                       row's fixed height; `text-center` handles the
                       horizontal axis. The 7-column `colSpan` matches
                       the `<colgroup>` declaration above so the message
                       hits the full table width regardless of the
                       parent's horizontal scroll position. Typography
                       uses workspace tokens only — no raw px values. */
                    <tr>
                        <td
                            colSpan={7}
                            className="h-[400px] text-center align-middle"
                        >
                            <span
                                className="text-wb-13 font-medium text-wb-muted"
                                role="status"
                            >
                                {resolvedEmptyLabel}
                            </span>
                        </td>
                    </tr>
                ) : rows.map((row) => (
                    <tr
                        key={row.id}
                        className="border-b border-wb-table-border last:border-b-0"
                    >
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                            <div className="flex flex-col text-wb-13 font-medium text-wb-ink">
                                <span>{formatDateChip(row.date)}</span>
                                <span className="text-wb-muted">{row.time}</span>
                            </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-wb-13 font-medium text-wb-ink">
                            {t(`settings.firm_banking_history.service_type.${row.serviceType}`)}
                        </td>
                        <td className="px-3 py-3 align-top">
                            {/* Service-name cell — server-resolved i18n key
                                (svcNameKey) is the source of truth; raw
                                serviceName is the fallback when the key is
                                null (unknown code path). Mirrors legacy
                                comm_0221_001.ts:639-647 SERVICE_NAME_MAP
                                semantics, but the lookup table now lives
                                in Spring (TranTp + FirmBankingServiceNameResolver).
                                Long values surface via the shared
                                <EllipsisTooltip> (Figma 9198:8036) — never
                                via the browser-default `title` attribute. */}
                            <EllipsisTooltip
                                text={row.serviceNameKey ? t(row.serviceNameKey) : row.serviceName}
                                className="text-wb-13 font-medium text-wb-ink"
                            />
                        </td>
                        <td className="px-3 py-3 align-top">
                            {/* Long hash-like values (32-char wire IDs) MUST
                                truncate to a single line and surface the
                                full string in the shared hover tooltip —
                                NOT wrap with `break-all`, which broke row
                                height alignment. Mirrors the Service Name
                                cell above (Figma 9198:8036 ellipsis +
                                tooltip pattern). */}
                            <EllipsisTooltip
                                text={row.seqNo}
                                className="text-wb-13 font-medium text-wb-ink"
                            />
                        </td>
                        <td className="px-3 py-3 align-top">
                            <EllipsisTooltip
                                text={row.instCode}
                                className="text-wb-13 font-medium text-wb-ink"
                            />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                            <ResultText result={row.result} t={t} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-right">
                            <button
                                type="button"
                                onClick={(e) =>
                                    onViewDetails?.(
                                        row,
                                        e.currentTarget.getBoundingClientRect(),
                                    )
                                }
                                className="cursor-pointer text-wb-13 font-medium text-brand hover:underline"
                            >
                                {t("settings.firm_banking_history.view_details")}
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function ResultText({
    result,
    t,
}: {
    result: FirmBankingResult;
    t: (key: string) => string;
}) {
    return (
        <span
            className={cn(
                "text-wb-13 font-medium",
                result === "failed" && "text-wb-status-rejected-text",
                result === "in_progress" && "text-wb-status-progress-text",
                result === "success" && "text-wb-status-approved-text",
            )}
        >
            {t(`settings.firm_banking_history.result.${result}`)}
        </span>
    );
}
