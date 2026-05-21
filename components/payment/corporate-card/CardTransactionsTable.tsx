"use client";

import { ChevronDown, StickyNote } from "lucide-react";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import type { SortDirection } from "@/hooks/useTableSort";
import { Checkbox } from "@/components/ui/checkbox";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import CardTransactionsTableColumns from "./CardTransactionsTableColumns";
import type { CardTransaction } from "./cardTransactionMappers";

type CardTransactionsTableProps = {
    rows:               CardTransaction[];
    sortField:          string | null;
    sortDirection:      SortDirection;
    onSort:             (fieldId: string) => void;
    onEditDescription?: (row: CardTransaction) => void;
    /** Receives the clicked row + the cell's bounding rect so the
     *  parent can anchor the {@link ReportingAccountPickerPopover}
     *  directly under the cell (legacy `card_0001_001.ts:1117-1124`
     *  `pic-infor-contBox`). */
    onEditReportingAccount?: (row: CardTransaction, anchorRect: DOMRect) => void;
    /** The row whose Reporting Account popover is currently open —
     *  used to paint the legacy `bgYellow` highlight on the active
     *  cell (`card_0001_001.ts:1099`). */
    activeReportingRow?:    CardTransaction | null;
    /** Set of `cardSeqNo` values currently checked. The page owns
     *  the selection state so the Request Approval button (lives
     *  outside the table) can read it. */
    selected?:              ReadonlySet<string>;
    /** Toggle a single row's selection. Receives the row whose
     *  checkbox was clicked. Rows already carrying an
     *  {@code apprSeqNo} are skipped at the page level (legacy
     *  `card_0001_001.ts:650` disables the Request Approval button
     *  when any selected row already has one). */
    onToggleRow?:           (row: CardTransaction) => void;
    /** Toggle the "select all" header checkbox. Called with the
     *  ROWS the table is currently rendering (filtered + paged)
     *  so the page can union / subtract them from the global
     *  selection. */
    onToggleAll?:           (rows: CardTransaction[]) => void;
    /** Click on a row's Approval Ref cell. Only fires for rows that
     *  carry a non-null {@code apprSeqNo} (legacy `card_0001_001.ts:1239`
     *  adds the `approRefDetail` class only when `APPR_SEQ_NO != null`). */
    onApprovalRefClick?:    (row: CardTransaction) => void;
    className?:         string;
};

/**
 * Card Transactions main table (thead + tbody). Bare `<table>` so it
 * can share the colgroup with the sibling footer and scroll together
 * inside `<DataTableShell>` — matches the shared `bare-table + colgroup`
 * baseline ([wecms-web-main/CLAUDE.md §"Known Inconsistency — two table
 * patterns"]).
 *
 * <p>Sortable headers are wired to the page's `useTableSort` cycle via
 * the standard {@link TableHeaderCell} contract — `sortFieldId` must
 * match the View Setting FIELD_ID + the backend `CardTrnsHstrSortField`
 * whitelist. Projection-only columns (`CHART_ACCT_NM`, `APPR_DOC_NO`,
 * `CARD_TRNS_USAGE_NM`, `DISP_DOC_ID`, `CARD_NICK_NM`, `CARD_HLDR_NM`)
 * are rendered non-sortable because the backend whitelist has no entry
 * for them — same precedent the V176 seed encodes via `SORT_YN='N'`.
 *
 * <p>Per-row edit handlers (`onEditDescription`, `onEditReportingAccount`)
 * trigger the matching shadcn `<Dialog>` flows in the page wrapper.
 * Both are optional so static-UI consumers can omit them.
 */
export default function CardTransactionsTable({
    rows,
    sortField,
    sortDirection,
    onSort,
    onEditDescription,
    onEditReportingAccount,
    activeReportingRow,
    selected,
    onToggleRow,
    onToggleAll,
    onApprovalRefClick,
    className,
}: CardTransactionsTableProps) {
    const allChecked = selected != null && rows.length > 0 && rows.every((r) => selected.has(r.cardSeqNo));
    const someChecked = selected != null && rows.some((r) => selected.has(r.cardSeqNo));
    const { t } = useTranslation();

    return (
        <table
            className={cn(
                "w-full min-w-[var(--w-wb-ct-table-min)] table-fixed border-collapse",
                className,
            )}
        >
            <CardTransactionsTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {/* Checkbox column — special FIELD_ID, never sortable.
                        Header checkbox toggles every visible row's
                        selection. Indeterminate state shows when SOME
                        but not ALL visible rows are checked. */}
                    <TableCell className="px-3 py-2.5">
                        <Checkbox
                            aria-label={t("payment.aria.select_all")}
                            checked={allChecked ? true : someChecked ? "indeterminate" : false}
                            onCheckedChange={() => onToggleAll?.(rows)}
                            disabled={!onToggleAll || rows.length === 0}
                        />
                    </TableCell>
                    <TableHeaderCell
                        sortable
                        sortFieldId="TRSC_DT"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.date_time")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortable
                        sortFieldId="CARD_NO"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.card_number")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        sortable
                        sortFieldId="MERCH_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.merchant")}
                    </TableHeaderCell>
                    {/* CARD_NICK_NM / CARD_HLDR_NM — projection-only,
                        not in CardTrnsHstrSortField whitelist. */}
                    <TableHeaderCell sortable={false}>{t("payment.card.col.card_nickname")}</TableHeaderCell>
                    <TableHeaderCell sortable={false}>{t("payment.card.col.cardholder")}</TableHeaderCell>
                    {/* CCY_CD — legacy disp_ord 6. */}
                    <TableHeaderCell sortable={false}>{t("payment.col.currency")}</TableHeaderCell>
                    <TableHeaderCell
                        align="right"
                        sortable
                        sortFieldId="TRSC_AMT"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.amount")}
                    </TableHeaderCell>
                    {/* CHART_ACCT_NM — projection-only (whitelist excludes it).
                        `border-l` mirrors legacy `card_0001_001.ts:1100,1128`
                        which gives the cell the `border-start` class, drawing
                        the vertical separator between Amount and Reporting
                        Account columns. */}
                    <TableHeaderCell sortable={false} className="border-l border-wb-table-border">
                        {t("payment.card.col.reporting_account")}
                    </TableHeaderCell>
                    {/* STTS — legacy disp_ord 9. Server emits the
                        i18n key `payment.card_transactions.status.<code>`
                        in `stts_key`; the body cell falls back to the
                        raw `stts` value when no locale entry exists. */}
                    <TableHeaderCell sortable={false}>{t("payment.col.status")}</TableHeaderCell>
                    {/* CARD_TRNS_USAGE_NM — legacy disp_ord 10 (Purpose). */}
                    <TableHeaderCell sortable={false}>{t("payment.card.col.purpose")}</TableHeaderCell>
                    {/* DISP_DOC_ID / APPR_DOC_NO — V176 seed SORT_YN='N'. */}
                    <TableHeaderCell sortable={false}>{t("payment.card.col.link_reference")}</TableHeaderCell>
                    {/* CONT — legacy disp_ord 12 (Description). */}
                    <TableHeaderCell sortable={false}>{t("payment.card.col.description")}</TableHeaderCell>
                    <TableHeaderCell sortable={false}>{t("payment.card.col.approval_ref")}</TableHeaderCell>
                    {/* Note — Phase B icon-only column, never sortable. */}
                    <TableCell className="px-2 py-2.5" />
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.cardSeqNo}
                        className={cn(
                            "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                            row.highlighted
                                ? "bg-[#fffde7] hover:bg-[#fff9c4]"
                                : "hover:bg-neutral-50/60",
                        )}
                    >
                        {/* Checkbox — controlled. Rows that already
                            carry an `apprSeqNo` are disabled (legacy
                            `card_0001_001.ts:650` excludes them from
                            Request Approval). */}
                        <TableCell className="px-3 py-2.5">
                            <Checkbox
                                aria-label={t("payment.aria.select_file", {
                                    fileName: row.merchNm ?? row.cardNo,
                                })}
                                checked={selected?.has(row.cardSeqNo) ?? false}
                                onCheckedChange={() => onToggleRow?.(row)}
                                disabled={!onToggleRow || !!row.apprSeqNo}
                            />
                        </TableCell>

                        {/* Date / Time — two lines */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block text-wb-13 font-medium text-wb-ink">
                                {row.trscDate}
                            </span>
                            <span className="block text-wb-13 font-medium text-wb-muted">
                                {row.trscTime}
                            </span>
                        </TableCell>

                        {/* Card Number — brand name + masked number */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-semibold text-wb-ink">
                                {row.cardNm ?? ""}
                            </span>
                            <span className="block truncate text-wb-13 font-medium text-wb-muted">
                                {row.cardNo}
                            </span>
                        </TableCell>

                        {/* Merchant */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.merchNm ?? ""}
                            </span>
                        </TableCell>

                        {/* Card Nickname */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.cardNickNm ?? ""}
                            </span>
                        </TableCell>

                        {/* Cardholder */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.cardHldrNm ?? ""}
                            </span>
                        </TableCell>

                        {/* Currency — CCY_CD */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block text-wb-13 font-medium text-wb-ink">
                                {row.ccyCd}
                            </span>
                        </TableCell>

                        {/* Amount — right-aligned */}
                        <TableCell className="px-2.5 py-2.5 text-right">
                            <span className="block text-wb-13 font-medium text-wb-ink">
                                {row.trscAmt}
                            </span>
                        </TableCell>

                        {/* Reporting Account — click to edit (PUT). The
                            `border-l` mirrors legacy `card_0001_001.ts:1100,1128`
                            (`border-start`). When the picker popover is
                            open for this row, the cell paints a yellow
                            highlight per legacy
                            `card_0001_001.ts:1099 (bgYellow)`. */}
                        <TableCell
                            className={cn(
                                "px-2.5 py-2.5 border-l border-wb-table-border",
                                activeReportingRow?.cardSeqNo === row.cardSeqNo && "bg-wb-status-pending-bg",
                            )}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    if (!onEditReportingAccount) return;
                                    // Use the parent <td>'s rect as the
                                    // anchor — gives the popover the full
                                    // cell width to compute its own size
                                    // against.
                                    const cell = e.currentTarget.closest("td");
                                    const rect = (cell ?? e.currentTarget).getBoundingClientRect();
                                    onEditReportingAccount(row, rect);
                                }}
                                disabled={!onEditReportingAccount}
                                className={cn(
                                    "flex w-full items-center gap-0.5 text-left",
                                    onEditReportingAccount
                                        ? "cursor-pointer hover:text-brand"
                                        : "cursor-default",
                                )}
                            >
                                <span className="truncate text-wb-13 font-medium text-wb-ink">
                                    {row.chartAcctCd
                                        ? row.chartAcctCd
                                        : t("payment.card.column_select_account")}
                                </span>
                                <ChevronDown
                                    aria-hidden
                                    className="size-4 shrink-0 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                />
                            </button>
                        </TableCell>

                        {/* Status — STTS. Render the i18n-key the server
                            emits in `stts_key`; fall back to the raw
                            `stts` value when the key has no locale entry
                            (in-house `t()` returns the key itself on a
                            miss — compare to detect that). */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {(() => {
                                    if (!row.statusKey) return row.status ?? "";
                                    const resolved = t(row.statusKey);
                                    return resolved === row.statusKey
                                        ? (row.status ?? "")
                                        : resolved;
                                })()}
                            </span>
                        </TableCell>

                        {/* Purpose — CARD_TRNS_USAGE_NM. Wire ships
                            the code today; rendered as-is until the
                            backend adds a resolved `card_trns_usage_nm`
                            sibling. */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.cardTrnsUsageCode ?? ""}
                            </span>
                        </TableCell>

                        {/* Link Reference — Phase B placeholder ("—" when not linked) */}
                        <TableCell className="px-2.5 py-2.5">
                            <span className="block truncate text-wb-13 font-medium text-wb-muted">
                                —
                            </span>
                        </TableCell>

                        {/* Description — CONT */}
                        <TableCell className="px-2.5 py-2.5">
                            <span
                                className="block truncate text-wb-13 font-medium text-wb-ink"
                                title={row.description ?? ""}
                            >
                                {row.description ?? ""}
                            </span>
                        </TableCell>

                        {/* Approval Ref — clickable when the row carries
                            an `apprSeqNo` (mirrors legacy `approRefDetail`
                            class @ `card_0001_001.ts:1239`). Displays
                            the legacy `VO_YYMMDD_NNN` doc-no when
                            available; falls back to the raw apprSeqNo
                            for old rows whose master DOC_NO is null. */}
                        <TableCell className="px-2.5 py-2.5">
                            {row.apprSeqNo ? (
                                <button
                                    type="button"
                                    onClick={() => onApprovalRefClick?.(row)}
                                    disabled={!onApprovalRefClick}
                                    className={cn(
                                        "block w-full truncate text-left text-wb-13 font-medium text-brand underline-offset-2",
                                        onApprovalRefClick
                                            ? "cursor-pointer hover:underline"
                                            : "cursor-default",
                                    )}
                                    title={row.apprDocNo ?? row.apprSeqNo}
                                >
                                    {row.apprDocNo ?? row.apprSeqNo}
                                </button>
                            ) : null}
                        </TableCell>

                        {/* Note icon — click to edit description (PATCH) */}
                        <TableCell className="px-2 py-2.5 text-center">
                            <button
                                type="button"
                                aria-label={t("payment.card.col.note")}
                                onClick={() => onEditDescription?.(row)}
                                disabled={!onEditDescription}
                                className={cn(
                                    "inline-flex items-center justify-center rounded p-0.5",
                                    onEditDescription
                                        ? "cursor-pointer text-wb-ntrl-6 hover:text-brand"
                                        : "cursor-default text-wb-ntrl-4",
                                )}
                            >
                                <StickyNote className="size-[18px]" strokeWidth={1.5} />
                            </button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}
