"use client";

import { AlertCircle, CheckCircle2, ChevronDown, Hourglass, User, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ApprovalTableColumns from "./ApprovalTableColumns";
import StatusBadge from "./StatusBadge";
import type { ApprovalApprover, ApprovalRow, ApproverStatus } from "./types";

type ApprovalTableProps = {
    rows: ApprovalRow[];
    /** Fires when the user clicks the Document No. cell — opens the
     *  read-only Approval Details dialog (mirrors legacy
     *  `resl_0001_001_osmc.ts` `openDetailPopup` behaviour). */
    onDocumentNoClick?: (row: ApprovalRow) => void;
    className?: string;
};

/**
 * Approval Box main table (thead + tbody only). Mirrors legacy
 * `resl_0001_001_view_osmc.jsp` — 11 columns: leading checkbox plus
 * the 10 data columns. No trailing Action column; Approve / Reject
 * live inside the Approval Details dialog opened from the Document
 * No. link.
 *
 * The pure-`<table>` shape is preserved so the sibling footer-table can
 * share the same `<colgroup>` for crisp column boundaries (see
 * ApprovalTableColumns).
 */
export default function ApprovalTable({
    rows,
    onDocumentNoClick,
    className,
}: ApprovalTableProps) {
    const { t } = useTranslation();
    /** Row id whose Approver popover is currently expanded. Only one
     *  row's popover can be open at a time. Mirrors the legacy
     *  `resl_0001_001_osmc.ts` `fn_hoverStt` hover-card behaviour but
     *  driven by click (more reliable on touch + keyboard than hover). */
    const [openApproverRowId, setOpenApproverRowId] = useState<string | null>(null);

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
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => {
                    return (
                        <TableRow
                            key={row.id}
                            className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                        >
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
                            <TextCell align="right">{formatAmount(row.amount, row.currency, false)}</TextCell>
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
                                <ApproverCell
                                    row={row}
                                    open={openApproverRowId === row.id}
                                    onToggle={() =>
                                        setOpenApproverRowId((prev) =>
                                            prev === row.id ? null : row.id,
                                        )
                                    }
                                    onClose={() => setOpenApproverRowId(null)}
                                />
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

/**
 * Approver column cell — first-approver name + count chip + chevron
 * toggle. Clicking the cell expands a popover listing every approver
 * in the chain with line-number badge, name, status, and acted-at
 * date. Mirrors legacy {@code resl_0001_001_osmc.ts:533-622}
 * {@code fn_hoverStt} behaviour. ESC + outside-click dismiss.
 */
function ApproverCell({
    row,
    open,
    onToggle,
    onClose,
}: {
    row: ApprovalRow;
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
}) {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        }
        function handleMouseDown(e: MouseEvent) {
            const target = e.target as Node | null;
            if (!target) return;
            // Click inside the popover stays.
            if (popoverRef.current?.contains(target)) return;
            // Click on the cell's trigger toggles via its own handler.
            const anchor = popoverRef.current?.parentElement;
            if (anchor?.contains(target)) return;
            onClose();
        }
        document.addEventListener("keydown", handleKey, true);
        const id = window.setTimeout(() => {
            document.addEventListener("mousedown", handleMouseDown);
        }, 0);
        return () => {
            window.clearTimeout(id);
            document.removeEventListener("keydown", handleKey, true);
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [open, onClose]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="flex w-full cursor-pointer items-center gap-1 rounded-md py-0.5 text-left hover:bg-black/[0.03]"
            >
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
                    className={cn(
                        "size-[18px] shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    className="absolute right-0 top-full z-30 mt-1 w-[360px] overflow-hidden rounded-lg bg-white shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),_0px_2px_4px_0px_rgba(0,0,0,0.08),_0px_4px_8px_0px_rgba(0,0,0,0.08)]"
                >
                    {row.approvers.length === 0 ? (
                        <div className="px-4 py-3 text-wb-13 font-normal text-wb-muted">
                            —
                        </div>
                    ) : (
                        row.approvers.map((a, idx) => (
                            <ApproverRow
                                key={a.userId}
                                approver={a}
                                lineNo={a.lineNo ?? idx + 1}
                                showDivider={idx > 0}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * One row inside the Approver popover — Figma `comm_0195_001` hover-card.
 * Layout: line-number · avatar · name+date stack · status pill (right).
 */
function ApproverRow({
    approver,
    lineNo,
    showDivider,
}: {
    approver: ApprovalApprover;
    lineNo: number;
    showDivider: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center gap-3 px-4 py-3",
                showDivider && "border-t border-wb-table-border",
            )}
        >
            <span className="w-4 shrink-0 text-center text-wb-13 font-medium text-wb-ntrl-9">
                {lineNo}
            </span>
            <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-wb-bg-sidebar shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06)]"
            >
                <User className="size-4 text-wb-ntrl-6" strokeWidth={1.8} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-wb-13 font-semibold text-wb-ink">
                    {approver.userName}
                </span>
                {approver.actedAt && (
                    <span className="truncate text-wb-12 font-normal text-wb-muted">
                        {approver.actedAt}
                    </span>
                )}
            </div>
            <ApproverStatusPill status={approver.status} />
        </div>
    );
}

/**
 * Status pill on the right side of each approver row. Colour + icon +
 * label per Figma:
 *   P → Pending (orange + hourglass)
 *   A → Approved (green + check)
 *   R → Rejected (red + X)
 *   W → Unable To Approve (orange + alert)
 *   S → Unable To Approve (orange + alert)
 */
function ApproverStatusPill({ status }: { status: ApproverStatus }) {
    const { t } = useTranslation();
    const labelKey =
        status === "W" || status === "S"
            ? "approval.approver_status.unable"
            : `approval.approver_status.${status}`;
    const { tone, Icon } = statusVisuals(status);
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1 text-wb-13 font-medium",
                tone,
            )}
        >
            <span>{t(labelKey)}</span>
            <Icon className="size-4" strokeWidth={1.8} aria-hidden />
        </span>
    );
}

function statusVisuals(status: ApproverStatus): {
    tone: string;
    Icon: typeof Hourglass;
} {
    switch (status) {
        case "A":
            return { tone: "text-wb-status-approved-text", Icon: CheckCircle2 };
        case "R":
            return { tone: "text-wb-status-rejected-text", Icon: XCircle };
        case "P":
            return { tone: "text-wb-status-pending-text", Icon: Hourglass };
        case "W":
        case "S":
        default:
            return { tone: "text-wb-status-pending-text", Icon: AlertCircle };
    }
}
