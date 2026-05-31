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
import {
    isSpecialViewSettingField,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import type { SortDirection } from "@/hooks/useTableSort";
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
    /** View Setting `FIELD_ID` currently driving the table-wide sort
     *  state. Sourced once per page from the shared `useTableSort()`. */
    sortField?: string | null;
    sortDirection?: SortDirection;
    /** Receives the header's own `sortFieldId` — wire to
     *  `useTableSort().toggleSort`. Omitting it (or `sortField`)
     *  degrades headers to display-only. */
    onSort?: (fieldId: string) => void;
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
        headerKey: "approval.col.date",
        renderBody: (row) => <TextSpan>{row.date}</TextSpan>,
    },
    DOC_NM: {
        headerKey: "approval.col.type",
        renderBody: (row) => <TextSpan>{row.type}</TextSpan>,
    },
    DOC_NO: {
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
        headerKey: "approval.col.title",
        renderBody: (row) => <TextSpan>{row.title}</TextSpan>,
    },
    FILE_NM: {
        headerKey: "approval.col.file_name",
        renderBody: (row) => <TextSpan>{row.fileName}</TextSpan>,
    },
    CURRENCY: {
        headerKey: "approval.col.currency",
        renderBody: (row) => <TextSpan>{row.currency}</TextSpan>,
    },
    TOT_PAY_AMT: {
        headerKey: "approval.col.amount",
        align: "right",
        renderBody: (row) => (
            <TextSpan>{formatAmount(row.amount, row.currency, false)}</TextSpan>
        ),
    },
    PAY_END_YN: {
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
        headerKey: "approval.col.scheduled",
        renderBody: (row, ctx) => (
            <TextSpan>{row.scheduledDate ?? ctx.t("approval.scheduled_empty")}</TextSpan>
        ),
    },
    DRAFT_USER_NM: {
        headerKey: "approval.col.requestor",
        renderBody: (row) => <TextSpan>{row.requestor}</TextSpan>,
    },
    APPRER_NM: {
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
 * Per-column fallback width used when a View Setting item is missing
 * its `size` field (older backend without the legacy widths seed).
 * Values mirror the V216 seed so the table still renders correctly
 * before the migration has run on a developer's local DB. Once
 * `size` arrives on the wire, this map is bypassed entirely.
 */
const FALLBACK_WIDTH_BY_FIELD: Record<string, string> = {
    REG_DTM:       "90px",
    DOC_NM:        "170px",
    DOC_NO:        "135px",
    TITL:          "220px",
    FILE_NM:       "260px",
    CURRENCY:      "150px",
    TOT_PAY_AMT:   "150px",
    PAY_END_YN:    "160px",
    PAY_DATE:      "145px",
    DRAFT_USER_NM: "180px",
    APPRER_NM:     "180px",
};

/** Parse a `"Npx"` size string returned by the View Setting API into
 *  the numeric pixel count. Returns 0 when the value is missing,
 *  malformed, or a non-pixel unit — caller treats the column as
 *  zero-width for the `min-w` calculation, which is the safest
 *  degradation when the backend ships nonsense for one column. */
function parsePxSize(raw: string | undefined): number {
    if (!raw) return 0;
    const match = raw.trim().match(/^(\d+(?:\.\d+)?)px$/i);
    return match ? Number(match[1]) : 0;
}

/** Resolve the per-column pixel width from the View Setting item.
 *  Wire `size` wins; falls back to the V216 seed map when the wire
 *  ships a column without size (older backend). The returned string
 *  is the inline `<col style={{ width }}>` value used by the
 *  colgroup — keep it CSS-shaped (`"90px"`). */
function resolveColumnWidth(item: ViewSettingItem): string {
    if (item.size && parsePxSize(item.size) > 0) return item.size;
    return FALLBACK_WIDTH_BY_FIELD[item.field_id] ?? "120px";
}

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
    sortField,
    sortDirection,
    onSort,
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

    // Drive the table's min-width from the live View Setting widths
    // so hiding columns shrinks the horizontal-scroll trigger point
    // exactly the way the design intends — and so re-seeding the DB
    // SIZE values flows through with no further code change.
    const minWidthPx = visibleColumns.reduce(
        (sum, col) => sum + parsePxSize(resolveColumnWidth(col)),
        0,
    );

    return (
        <table
            className={cn(
                "w-full table-fixed border-collapse",
                className,
            )}
            style={{ minWidth: `${minWidthPx}px` }}
        >
            <colgroup>
                {visibleColumns.map((col) => (
                    <col
                        key={col.field_id}
                        style={{ width: resolveColumnWidth(col) }}
                    />
                ))}
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
                                sortable={
                                    col.sort_yn === "Y" &&
                                    !isSpecialViewSettingField(col.field_id)
                                }
                                sortFieldId={col.field_id}
                                activeSortField={sortField}
                                activeSortDirection={sortDirection}
                                onSort={onSort}
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
