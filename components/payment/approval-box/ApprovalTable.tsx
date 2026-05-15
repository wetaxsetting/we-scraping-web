"use client";

import { ChevronDown } from "lucide-react";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ApprovalTableColumns from "./ApprovalTableColumns";
import StatusBadge from "./StatusBadge";
import type { ApprovalRow, RowAction } from "./types";

type ApprovalTableProps = {
    rows: ApprovalRow[];
    selectedIds: ReadonlySet<string>;
    onToggleRow: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onRowAction: (row: ApprovalRow, action: RowAction) => void;
    /** Fires when the user clicks the Document No. cell — opens the
     *  read-only Approval Details dialog (mirrors legacy
     *  `resl_0001_001_osmc.ts` `openDetailPopup` behaviour). */
    onDocumentNoClick?: (row: ApprovalRow) => void;
    className?: string;
};

const ACTION_COL_KEY = "approval.col.action";

/**
 * Approval Box main table (thead + tbody only). Two columns beyond the
 * mock-era surface:
 *   - leading checkbox column for bulk selection
 *   - trailing action column with Approve / Reject CTAs when the
 *     current user is the next-step approver (`row.actionable`).
 *
 * The pure-`<table>` shape is preserved so the sibling footer-table can
 * share the same `<colgroup>` for crisp column boundaries (see
 * ApprovalTableColumns).
 */
export default function ApprovalTable({
    rows,
    selectedIds,
    onToggleRow,
    onToggleAll,
    onRowAction,
    onDocumentNoClick,
    className,
}: ApprovalTableProps) {
    const { t } = useTranslation();
    const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
    const someSelected = !allSelected && rows.some((r) => selectedIds.has(r.id));
    const headerState: boolean | "indeterminate" = allSelected
        ? true
        : someSelected
            ? "indeterminate"
            : false;

    return (
        <table
            className={cn(
                "w-full min-w-[var(--w-wb-ap-table-min)] table-fixed border-collapse",
                className,
            )}
        >
            <ApprovalTableColumns />
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>
                        <Checkbox
                            aria-label={t("approval.bulk.select_all")}
                            checked={headerState}
                            onCheckedChange={(next) => onToggleAll(next === true)}
                        />
                    </TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.date")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.type")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.document_no")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.title")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.currency")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("approval.col.amount")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.status")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.scheduled")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.requestor")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.approver")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t(ACTION_COL_KEY)}</TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => {
                    const selected = selectedIds.has(row.id);
                    return (
                        <TableRow
                            key={row.id}
                            className={cn(
                                "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                                selected && "bg-brand-softer",
                            )}
                        >
                            <TableCell className="px-2.5 py-2.5">
                                <Checkbox
                                    aria-label={t("approval.bulk.select_row")}
                                    checked={selected}
                                    onCheckedChange={() => onToggleRow(row.id)}
                                />
                            </TableCell>
                            <TextCell>{row.date}</TextCell>
                            <TextCell>{row.type}</TextCell>
                            {/* Document No. — clickable when a handler is
                             *  provided. Opens the read-only Approval
                             *  Details dialog. Mirrors legacy
                             *  `resl_0001_001_osmc.ts` doc-no click. */}
                            <TableCell className="px-2.5 py-2.5">
                                {onDocumentNoClick ? (
                                    <button
                                        type="button"
                                        onClick={() => onDocumentNoClick(row)}
                                        className="block w-full truncate text-left text-wb-13 font-medium text-brand underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
                                    >
                                        {row.documentNo}
                                    </button>
                                ) : (
                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                        {row.documentNo}
                                    </span>
                                )}
                            </TableCell>
                            <TextCell className="pr-4">{row.title}</TextCell>
                            <TextCell>{row.currency}</TextCell>
                            <TextCell align="right">{row.amount}</TextCell>
                            <TableCell className="px-2.5 py-2.5">
                                <StatusBadge
                                    status={row.status}
                                    step={row.statusStep}
                                    label={t(`approval.tab.${row.status}`)}
                                />
                            </TableCell>
                            <TextCell>
                                {row.scheduledDate ?? t("approval.scheduled_empty")}
                            </TextCell>
                            <TextCell>{row.requestor}</TextCell>
                            <TableCell className="px-2.5 py-2.5">
                                <div className="flex items-center gap-1">
                                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                                        {row.approver}
                                    </span>
                                    {row.approverCount != null && (
                                        <span className="inline-flex items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium uppercase text-black/70">
                                            {row.approverCount}
                                        </span>
                                    )}
                                    <ChevronDown
                                        aria-hidden
                                        className="size-[18px] shrink-0 text-wb-ntrl-6"
                                        strokeWidth={1.8}
                                    />
                                </div>
                            </TableCell>
                            <TableCell className="px-2.5 py-2.5 text-right">
                                {row.actionable ? (
                                    <div className="inline-flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onRowAction(row, "reject")}
                                            className="h-7 rounded-md border border-wb-border-sidebar bg-white px-2.5 text-wb-12 font-medium text-wb-status-rejected-text hover:bg-black/5"
                                        >
                                            {t("approval.action.reject.cta")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRowAction(row, "approve")}
                                            className="h-7 rounded-md bg-brand px-2.5 text-wb-12 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                        >
                                            {t("approval.action.approve.cta")}
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-wb-12 font-normal text-wb-muted">
                                        {t("approval.action.unavailable")}
                                    </span>
                                )}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </table>
    );
}

function TextCell({
    children,
    align = "left",
    className,
}: {
    children: React.ReactNode;
    align?: "left" | "right";
    className?: string;
}) {
    return (
        <TableCell
            className={cn(
                "px-2.5 py-2.5",
                align === "right" && "text-right",
                className,
            )}
        >
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {children}
            </span>
        </TableCell>
    );
}
