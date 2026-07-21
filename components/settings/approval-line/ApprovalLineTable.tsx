"use client";

import { ChevronDown } from "lucide-react";

import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import EditIcon from "@/components/shared/icons/EditIcon";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import type { SortDirection } from "@/hooks/useTableSort";
import { formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";

import ApproverListPopover from "./ApproverListPopover";
import type { ApprovalLineRow } from "./types";

type ApprovalLineTableProps = {
    rows: ApprovalLineRow[];
    /** Currently-sorting FIELD_ID (`APPR_LINE_NM` / `APPRVR_NM` /
     *  `REG_DTM`) or `null` for default. Sourced from
     *  `useTableSort()` in the host panel. */
    sortField?:     string | null;
    sortDirection?: SortDirection;
    /** Click / Enter / Space handler — receives the column's FIELD_ID.
     *  Pass the `toggleSort` returned from `useTableSort()` to cycle
     *  default → ASC → DESC → default. Omitted (along with
     *  {@link sortField}) the headers render with the inactive default
     *  glyph and are non-interactive — used by offline-dev /
     *  Storybook. */
    onSort?:   (fieldId: string) => void;
    /** Approval-line surrogate of the row whose approver-list popover
     *  is currently open, or {@code null} for none. Hoisted to the
     *  panel so only one popover can be open at a time — clicking a
     *  different row's chip auto-closes the previous popover via the
     *  shared toggle state. */
    openApproversRowId?: number | null;
    /** Toggle handler. Pass {@code id} to open / switch; pass
     *  {@code null} to close. Same-id calls close (close-on-second-
     *  click). */
    onToggleApprovers?:  (id: number | null) => void;
    onEdit?:   (row: ApprovalLineRow) => void;
    onDelete?: (row: ApprovalLineRow) => void;
};

/**
 * Approval Line table — Figma 9196:11717.
 *
 * <p>Mirrors the canonical Settings-popup table chrome shared by
 * Bank Account and ERP Transaction History: bare `<table>` +
 * `table-fixed` + `<colgroup>`, sticky `bg-wb-bg-sidebar` thead,
 * `text-wb-13` for header / body (CLAUDE.md §5 table typography),
 * shared `border-wb-table-border` row separators, and the canonical
 * `/assets/table/ico-sort.svg` sort glyph.
 *
 * <p>Approver cell: the primary approver name (`approvers[0].name`)
 * plus an "+N" count chip + chevron when the chain has more than one
 * row. Single-approver lines render the name alone, no chip.
 *
 * <p>Create-date cell: the legacy `yyyyMMddHHmmss` string trimmed to
 * `yyyy-MM-dd` for display. Mirrors the static-UI behaviour the
 * Figma frame specifies.
 */
export default function ApprovalLineTable({
    rows,
    sortField,
    sortDirection,
    onSort,
    openApproversRowId,
    onToggleApprovers,
    onEdit,
    onDelete,
}: ApprovalLineTableProps) {
    const { t, locale } = useTranslation();

    return (
        <table className="w-full table-fixed border-collapse">
            <colgroup>
                <col style={{ width: "32%" }} />
                <col style={{ width: "38%" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "180px" }} />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <TableHeaderCell
                        sortFieldId="APPR_LINE_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t("settings.approval_line.col.name")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="APPRVR_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t("settings.approval_line.col.approver")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortFieldId="REG_DTM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        textSizeClass="text-wb-13"
                    >
                        {t("settings.approval_line.col.create_date")}
                    </TableHeaderCell>
                    <th
                        className="bg-wb-bg-sidebar"
                        aria-label={t("settings.approval_line.col.actions")}
                    />
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const primary = row.approvers[0]?.name ?? "";
                    // Legacy `comm_0222_001.ts:139,150` shows the TOTAL
                    // approver count (REC1.length) — including the first —
                    // and renders the badge even for a single-approver line.
                    const approverCount = row.approvers.length;
                    return (
                        <tr
                            key={row.apprLineNo}
                            className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                        >
                            {/* Approval Line Name */}
                            <BodyCell>
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {row.apprLineNm}
                                </span>
                            </BodyCell>

                            {/* Primary approver + total-count chip (legacy
                               shows the count even for a single-approver
                               line). The chip + chevron form a single
                               <button> that toggles the approver-list
                               popover. The popover anchors via the
                               cell's `relative` wrapper — same pattern
                               as <AddApproverPopover> inside the
                               dialog (no portal, no viewport-coord
                               math, stays inside the modal). */}
                            <BodyCell>
                                <div className="relative flex items-center gap-1">
                                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                                        {primary}
                                    </span>
                                    {approverCount > 0 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => onToggleApprovers?.(row.apprLineNo)}
                                                aria-haspopup="dialog"
                                                aria-expanded={openApproversRowId === row.apprLineNo}
                                                aria-label={t(
                                                    "settings.approval_line.actions.show_approvers_aria",
                                                    { name: row.apprLineNm },
                                                )}
                                                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[4px] p-0.5 -my-0.5 hover:bg-black/[0.04]"
                                            >
                                                <span className="inline-flex shrink-0 items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium text-wb-ntrl-8">
                                                    {approverCount}
                                                </span>
                                                <ChevronDown
                                                    className="size-[18px] shrink-0 text-wb-ntrl-6"
                                                    strokeWidth={1.8}
                                                    aria-hidden
                                                />
                                            </button>
                                            {openApproversRowId === row.apprLineNo && (
                                                <ApproverListPopover
                                                    approvers={row.approvers}
                                                    onClose={() => onToggleApprovers?.(null)}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            </BodyCell>

                            {/* Create Date — REG_DTM is a UTC instant
                               (ApprovalLine.java REG_DTM), shifted to VN
                               and rendered date-only per the active
                               language (EN DD-MMM-YYYY / KO YYYY-MM-DD /
                               VI DD-MM-YYYY). */}
                            <BodyCell>
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {formatRegDtm(row.regDtm, locale)}
                                </span>
                            </BodyCell>

                            {/* Actions — Edit (default button) + Delete
                               (warning button). h-8 keeps the row at its
                               canonical 48 px target with 10 px vertical
                               padding. */}
                            <td className="px-2.5 py-2.5 align-middle">
                                <div className="flex items-center justify-start gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => onEdit?.(row)}
                                        aria-label={t(
                                            "settings.approval_line.actions.edit_aria",
                                            { name: row.apprLineNm },
                                        )}
                                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2.5 text-wb-13 font-medium text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                                    >
                                        <EditIcon className="size-4" />
                                        {t("settings.approval_line.actions.edit")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete?.(row)}
                                        aria-label={t(
                                            "settings.approval_line.actions.delete_aria",
                                            { name: row.apprLineNm },
                                        )}
                                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-wb-red-04 bg-white px-2.5 text-wb-13 font-medium text-wb-red-07 shadow-wb-warning-btn hover:bg-wb-red-04/10"
                                    >
                                        <DeleteIcon className="size-4" />
                                        {t("settings.approval_line.actions.delete")}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/**
 * `yyyyMMddHHmmss` (UTC) → locale-aware display date. `REG_DTM` is a
 * UTC instant, so it is shifted to the display zone (Asia/Ho_Chi_Minh)
 * and the calendar date is rendered per the active language via the
 * shared `formatUtcDtmByLanguage` (date part only — the column shows no
 * time). Defensive against malformed / partial values; never throws.
 */
function formatRegDtm(regDtm: string, locale: Locale): string {
    if (!regDtm) return "";
    return formatUtcDtmByLanguage(regDtm, locale).date;
}

function BodyCell({ children }: { children: React.ReactNode }) {
    return <td className="px-3 py-3 align-middle">{children}</td>;
}
