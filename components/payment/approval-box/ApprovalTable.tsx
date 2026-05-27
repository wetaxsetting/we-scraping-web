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
import type { ViewSettingItem } from "@/components/shared/view-setting";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import StatusBadge from "./StatusBadge";
import type { ApprovalApprover, ApprovalRow, ApproverStatus } from "./types";

type ApprovalTableProps = {
    rows: ApprovalRow[];
    /** Visible & ordered columns derived from the page's View Setting.
     *  Each entry's FIELD_ID must have a matching {@link APPROVAL_COLUMN_REGISTRY}
     *  entry — items without a registry entry are silently dropped (defensive
     *  fallback for an admin adding a column to the DB before the renderer
     *  catches up). */
    items: ViewSettingItem[];
    /** Fires when the user clicks the Document No. cell — opens the
     *  read-only Approval Details dialog (mirrors legacy
     *  `resl_0001_001_osmc.ts` `openDetailPopup` behaviour). */
    onDocumentNoClick?: (row: ApprovalRow) => void;
    className?: string;
};

/** Per-cell renderer context — passed to every column's `renderBody`
 *  so individual cells can hook into shared state (e.g. the Approver
 *  popover open-row id) without each renderer owning its own state. */
type BodyCtx = {
    t: (key: string, vars?: Record<string, string | number>) => string;
    onDocumentNoClick?: (row: ApprovalRow) => void;
    openApproverRowId: string | null;
    setOpenApproverRowId: React.Dispatch<React.SetStateAction<string | null>>;
};

type ApprovalColumnDef = {
    /** Tailwind class that drives the `<col>` width — kept on the
     *  registry so a column hidden by View Setting also drops its
     *  `<col>` entry from the table's colgroup. */
    colClassName: string;
    /** i18n key for the `<th>` label. */
    headerKey: string;
    /** Right-aligned columns (numeric amounts). Left-aligned by default. */
    align?: "left" | "right";
    /** Cell content renderer. Each renderer owns its own wrapper
     *  (truncate span, button, badge, popover, …) — the calling
     *  `<TableCell>` only contributes padding + alignment. */
    renderBody: (row: ApprovalRow, ctx: BodyCtx) => React.ReactNode;
};

/** Shared truncate-span used by every plain-text cell — matches the
 *  legacy `TextCell` rhythm (block + truncate + text-wb-13 + medium). */
function TextSpan({ children }: { children: React.ReactNode }) {
    return (
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
            {children}
        </span>
    );
}

/**
 * Column registry — one entry per FIELD_ID seeded for Approval Box.
 * View Setting drives both the colgroup and the body via this map:
 * hide a column from the popover → its entry is dropped from
 * `visibleItems` → its `<col>`, `<th>` and `<td>`s disappear from
 * the table. Reorder rows in the popover → the same `visibleItems`
 * array re-orders, so the columns shift to match.
 *
 * FIELD_IDs match the live JEX `resl_0001_001` column codes and the
 * V84+ seed in `SYS_SCR_OPTION_WECMS`.
 */
export const APPROVAL_COLUMN_REGISTRY: Record<string, ApprovalColumnDef> = {
    REG_DTM: {
        colClassName: "w-[var(--w-wb-ap-date)]",
        headerKey: "approval.col.date",
        renderBody: (row) => <TextSpan>{row.date}</TextSpan>,
    },
    DOC_NM: {
        colClassName: "w-[var(--w-wb-ap-type)]",
        headerKey: "approval.col.type",
        renderBody: (row) => <TextSpan>{row.type}</TextSpan>,
    },
    DOC_NO: {
        colClassName: "w-[var(--w-wb-ap-docno)]",
        headerKey: "approval.col.document_no",
        renderBody: (row, ctx) =>
            ctx.onDocumentNoClick ? (
                <button
                    type="button"
                    onClick={() => ctx.onDocumentNoClick?.(row)}
                    className="block w-full truncate text-left text-wb-13 font-medium text-brand underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
                >
                    {row.documentNo}
                </button>
            ) : (
                <TextSpan>{row.documentNo}</TextSpan>
            ),
    },
    TITL: {
        colClassName: "w-[var(--w-wb-ap-title)]",
        headerKey: "approval.col.title",
        renderBody: (row) => <TextSpan>{row.title}</TextSpan>,
    },
    FILE_NM: {
        // No dedicated --w-wb-ap-filename token yet — reuse the title
        // width (legacy resl_0001_001 sizes both at 220-250px).
        colClassName: "w-[var(--w-wb-ap-title)]",
        headerKey: "approval.col.file_name",
        renderBody: (row) => <TextSpan>{row.fileName}</TextSpan>,
    },
    CURRENCY: {
        colClassName: "w-[var(--w-wb-ap-currency)]",
        headerKey: "approval.col.currency",
        renderBody: (row) => <TextSpan>{row.currency}</TextSpan>,
    },
    TOT_PAY_AMT: {
        colClassName: "w-[var(--w-wb-ap-amount)]",
        headerKey: "approval.col.amount",
        align: "right",
        renderBody: (row) => (
            <TextSpan>{formatAmount(row.amount, row.currency, false)}</TextSpan>
        ),
    },
    PAY_END_YN: {
        colClassName: "w-[var(--w-wb-ap-status)]",
        headerKey: "approval.col.status",
        renderBody: (row, ctx) => (
            <StatusBadge
                status={row.status}
                step={row.statusStep}
                label={ctx.t(`approval.tab.${row.status}`)}
            />
        ),
    },
    PAY_DATE: {
        colClassName: "w-[var(--w-wb-ap-scheduled)]",
        headerKey: "approval.col.scheduled",
        renderBody: (row, ctx) => (
            <TextSpan>{row.scheduledDate ?? ctx.t("approval.scheduled_empty")}</TextSpan>
        ),
    },
    DRAFT_USER_NM: {
        colClassName: "w-[var(--w-wb-ap-requestor)]",
        headerKey: "approval.col.requestor",
        renderBody: (row) => <TextSpan>{row.requestor}</TextSpan>,
    },
    APPRER_NM: {
        colClassName: "w-[var(--w-wb-ap-approver)]",
        headerKey: "approval.col.approver",
        renderBody: (row, ctx) => (
            <ApproverCell
                row={row}
                open={ctx.openApproverRowId === row.id}
                onToggle={() =>
                    ctx.setOpenApproverRowId((prev) =>
                        prev === row.id ? null : row.id,
                    )
                }
                onClose={() => ctx.setOpenApproverRowId(null)}
            />
        ),
    },
};

/**
 * Approval Box main table (thead + tbody only). Mirrors legacy
 * `resl_0001_001_view_osmc.jsp` columns. The visible column set is
 * driven entirely by the View Setting `items` prop — toggling /
 * reordering rows in the popover Save round-trip immediately reflects
 * in the rendered colgroup + header + body.
 *
 * Approve / Reject live inside the Approval Details dialog opened
 * from the Document No. link, so there is no trailing Action column.
 */
export default function ApprovalTable({
    rows,
    items,
    onDocumentNoClick,
    className,
}: ApprovalTableProps) {
    const { t } = useTranslation();
    const [openApproverRowId, setOpenApproverRowId] = useState<string | null>(null);

    // Drop rows the registry doesn't know how to render — defensive
    // fallback when admin adds a FIELD_ID to the seed before the
    // frontend renderer catches up. The View Setting hook has already
    // filtered out CHECKBOX/ETC + use_yn === "N" upstream.
    const visibleColumns = items.filter(
        (it) => APPROVAL_COLUMN_REGISTRY[it.field_id] !== undefined,
    );

    const ctx: BodyCtx = {
        t,
        onDocumentNoClick,
        openApproverRowId,
        setOpenApproverRowId,
    };

    return (
        <table
            className={cn(
                "w-full min-w-[var(--w-wb-ap-table-min)] table-fixed border-collapse",
                className,
            )}
        >
            <colgroup>
                {visibleColumns.map((col) => {
                    const def = APPROVAL_COLUMN_REGISTRY[col.field_id];
                    return <col key={col.field_id} className={def.colClassName} />;
                })}
            </colgroup>
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {visibleColumns.map((col) => {
                        const def = APPROVAL_COLUMN_REGISTRY[col.field_id];
                        return (
                            <TableHeaderCell
                                key={col.field_id}
                                textSizeClass="text-wb-13"
                                align={def.align}
                            >
                                {t(def.headerKey)}
                            </TableHeaderCell>
                        );
                    })}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border"
                    >
                        {visibleColumns.map((col) => {
                            const def = APPROVAL_COLUMN_REGISTRY[col.field_id];
                            return (
                                <TableCell
                                    key={col.field_id}
                                    className={cn(
                                        "px-2.5 py-2.5",
                                        def.align === "right" && "text-right",
                                    )}
                                >
                                    {def.renderBody(row, ctx)}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </table>
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
