"use client";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ApproverPopoverCell } from "@/components/shared/approver";
import {
    isSpecialViewSettingField,
    ViewSettingColgroup,
    viewSettingMinWidthPx,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import type { SortDirection } from "@/hooks/useTableSort";
import { formatAmount } from "@/lib/currency";
import { formatDateLang, formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import StatusBadge from "./StatusBadge";
import { approvalApproversToChain, type ApprovalRow } from "./types";

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
    /** When set, the row whose {@code apprSeqNo} matches is tinted
     *  ({@code bg-brand-soft}) — drives the deep-link highlight after a
     *  notification click. Null = no highlight (normal list). */
    highlightApprSeqNo?: string | null;
    className?: string;
};

/** Per-cell renderer context — passed to every column's `renderBody`
 *  so individual cells can hook into shared state (e.g. the Approver
 *  popover open-row id) without each renderer owning its own state. */
type BodyCtx = {
    t: (key: string, vars?: Record<string, string | number>) => string;
    /** Active UI locale — drives language-dependent date formatting in the
     *  Date (REG_DTM) and Scheduled Date (PAY_DATE) cells. */
    locale: Locale;
    onDocumentNoClick?: (row: ApprovalRow) => void;
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
 *  legacy `TextCell` rhythm (block + truncate + text-wb-13 + medium).
 *  Optional `title` adds the native hover tooltip used elsewhere in
 *  WeCMS for truncated cells (e.g. ErpTransactionHistoryTable's File
 *  Name column `title={row.orgFileNm}`); omit it and no attribute is
 *  emitted, so existing callers are unchanged. */
function TextSpan({ children, title }: { children: React.ReactNode; title?: string }) {
    return (
        <span
            title={title}
            className="block truncate text-wb-13 font-medium text-wb-ink"
        >
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
        // Registration date — REG_DTM is stored UTC. Convert to VN local and
        // format per active language (EN dd-MMM-yyyy / KO yyyy-MM-dd / VI
        // dd-MM-yyyy). The Date column shows the date only (no time), matching
        // legacy resl_0001_001. Falls back to the pre-formatted `row.date`
        // when the raw wire value is absent.
        renderBody: (row, ctx) => (
            <TextSpan>
                {row.dateRaw
                    ? formatUtcDtmByLanguage(row.dateRaw, ctx.locale).date
                    : row.date}
            </TextSpan>
        ),
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
        // Long titles clamp to 2 lines + ellipsis; the shared
        // <EllipsisTooltip> (Figma 9198:8036) surfaces the full value on
        // hover ONLY when the text actually overflows the clamp, so short
        // titles never trigger a tooltip. `lines={2}` keeps the row height
        // stable — see EllipsisTooltip's vertical-overflow detection.
        renderBody: (row) => (
            <EllipsisTooltip
                text={row.title}
                lines={2}
                className="text-wb-13 font-medium text-wb-ink"
            />
        ),
    },
    FILE_NM: {
        headerKey: "approval.col.file_name",
        // Same 2-line clamp + shared-tooltip treatment as Title — replaces
        // the earlier native `title` tooltip so the dark common tooltip is
        // used consistently across the table. Full file name shows on hover
        // only when the value is clipped.
        renderBody: (row) => (
            <EllipsisTooltip
                text={row.fileName}
                lines={2}
                className="text-wb-13 font-medium text-wb-ink"
            />
        ),
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
        // Scheduled payment date — PAY_DATE is a zone-free calendar date
        // (yyyyMMdd), so it is formatted per language WITHOUT a timezone
        // shift. Falls back to the pre-formatted `row.scheduledDate`.
        renderBody: (row, ctx) => {
            const scheduled = row.payDateRaw
                ? formatDateLang(row.payDateRaw, ctx.locale)
                : row.scheduledDate;
            return (
                <TextSpan>{scheduled || ctx.t("approval.scheduled_empty")}</TextSpan>
            );
        },
    },
    DRAFT_USER_NM: {
        headerKey: "approval.col.requestor",
        renderBody: (row) => <TextSpan>{row.requestor}</TextSpan>,
    },
    APPRER_NM: {
        headerKey: "approval.col.approver",
        renderBody: (row) => (
            <ApproverPopoverCell
                name={row.approver}
                count={row.approverCount ?? null}
                approvers={approvalApproversToChain(row.approvers)}
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

/**
 * Shared `<colgroup>` for the Approval Box table. The main table
 * (`<thead>` + `<tbody>`) and the footer summary row ({@link
 * ApprovalTableFooter}) both build their column layout from the SAME live
 * View Setting `visibleColumns`, so the footer cells line up under the
 * header columns exactly at every horizontal-scroll offset (CLAUDE.md §7a).
 *
 * Thin wrapper over the shared {@link ViewSettingColgroup} so the
 * size→`<col width>` mapping is defined once for the whole app. The
 * {@link FALLBACK_WIDTH_BY_FIELD} map is passed through only for the
 * (never-hit in practice) case of a seed row missing its `size`.
 */
export function ApprovalColgroup({ items }: { items: ViewSettingItem[] }) {
    return (
        <ViewSettingColgroup
            items={items}
            fallbackByField={FALLBACK_WIDTH_BY_FIELD}
            defaultFallback="120px"
        />
    );
}

/** Sum of the visible columns' pixel widths — the table's `min-width`.
 *  The footer must use the identical value so both tables scroll in
 *  lockstep inside the shared scroll container. Delegates to the shared
 *  Σ-visible-px helper. */
export function approvalTableMinWidthPx(items: ViewSettingItem[]): number {
    return viewSettingMinWidthPx(items, {
        fallbackByField: FALLBACK_WIDTH_BY_FIELD,
        defaultFallback: "120px",
    });
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
    highlightApprSeqNo,
    className,
}: ApprovalTableProps) {
    const { t, locale } = useTranslation();

    // Drop rows the registry doesn't know how to render — defensive
    // fallback when admin adds a FIELD_ID to the seed before the
    // frontend renderer catches up. The View Setting hook has already
    // filtered out CHECKBOX/ETC + use_yn === "N" upstream.
    const visibleColumns = items.filter(
        (it) => APPROVAL_COLUMN_REGISTRY[it.field_id] !== undefined,
    );

    const ctx: BodyCtx = {
        t,
        locale,
        onDocumentNoClick,
    };

    // Drive the table's min-width from the live View Setting widths
    // so hiding columns shrinks the horizontal-scroll trigger point
    // exactly the way the design intends — and so re-seeding the DB
    // SIZE values flows through with no further code change.
    const minWidthPx = approvalTableMinWidthPx(visibleColumns);

    return (
        <table
            className={cn(
                "w-full table-fixed border-collapse",
                className,
            )}
            style={{ minWidth: `${minWidthPx}px` }}
        >
            <ApprovalColgroup items={visibleColumns} />
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
                        className={cn(
                            "h-[var(--h-wb-table-row)] border-b border-wb-table-border",
                            highlightApprSeqNo != null &&
                                row.apprSeqNo === highlightApprSeqNo &&
                                "bg-brand-soft",
                        )}
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
