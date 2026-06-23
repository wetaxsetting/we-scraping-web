"use client";

import { ChevronDown, FileText, StickyNote } from "lucide-react";
import * as React from "react";

import { formatAmount } from "@/lib/currency";

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

import PurposeSelect, { type PurposeOption } from "@/components/shared/PurposeSelect";
import ReportingAccountSelect, { type ReportingAccountOption } from "@/components/shared/ReportingAccountSelect";
import InlineTextEdit from "@/components/shared/InlineTextEdit";

import CardTransactionsTableColumns from "./CardTransactionsTableColumns";
import type { CardTransaction } from "./cardTransactionMappers";

/** Reporting Account display label — the user-facing "<code> - <name>"
 *  form ("ACC-01 - REVENUE"), mirroring the legacy `card_0001_001` grid
 *  and the picker-popover option rows. Falls back to the bare code while
 *  the name dictionary is still resolving; `null` when the row carries no
 *  account at all. */
function reportingAccountLabel(row: CardTransaction): string | null {
    if (!row.chartAcctCd) return null;
    return row.chartAcctNm
        ? `${row.chartAcctCd} - ${row.chartAcctNm}`
        : row.chartAcctCd;
}

/** Purpose display label for a LOCKED (confirmed) row — "<code> <name>",
 *  matching the format the shared `<PurposeSelect>` shows for an editable
 *  row so the column reads identically either side of the lock. Falls back
 *  to the bare code while the name dictionary resolves; `null` when empty. */
function purposeLabel(row: CardTransaction): string | null {
    if (!row.cardTrnsUsageCode) return null;
    return row.cardTrnsUsageNm
        ? `${row.cardTrnsUsageCode} ${row.cardTrnsUsageNm}`
        : row.cardTrnsUsageCode;
}

/** Build the {@link PurposeOption} value the shared `<PurposeSelect>` chip
 *  renders for a row. For card transactions the short code IS the
 *  `use_usag_cd`, so `code` and `useUsagCd` are the same value. */
function purposeValue(row: CardTransaction): PurposeOption | null {
    if (!row.cardTrnsUsageCode) return null;
    return {
        useUsagCd: row.cardTrnsUsageCode,
        code:      row.cardTrnsUsageCode,
        name:      row.cardTrnsUsageNm ?? "",
    };
}

/** Build the {@link ReportingAccountOption} value the shared
 *  `<ReportingAccountSelect>` chip renders for a row. Prefers the full
 *  option (with breadcrumb) from the loaded chart-of-accounts list; falls
 *  back to a minimal option from the row's own resolved code + name when
 *  the account isn't in the active list (e.g. inactive / restricted). */
function reportingAccountValue(
    row: CardTransaction,
    byCode: Map<string, ReportingAccountOption>,
): ReportingAccountOption | null {
    if (!row.chartAcctCd) return null;
    return (
        byCode.get(row.chartAcctCd) ?? {
            chartAcctSeqNo: row.chartAcctSeqNo ?? "",
            code:           row.chartAcctCd,
            name:           row.chartAcctNm ?? row.chartAcctCd,
            breadcrumb:     null,
        }
    );
}

/** Cream highlight band for an UNCONFIRMED row (no Approval Ref). The
 *  band spans the editable / output columns — Reporting Account → Status →
 *  Purpose → Link Reference → Description → Approval Ref → memo — and stops
 *  at the left identity columns (Date/Time … Amount), which keep the normal
 *  table background. The memo cell carries it too so the band runs
 *  continuously to the row's right edge with no white gap. `group-hover`
 *  darkens the whole band in lockstep with the row hover (the `<tr>` carries
 *  `group`). Confirmed rows (Approval Ref present) never apply this. */
const CELL_YELLOW = "bg-[#fdfbea] group-hover:bg-[#f8f4d5]";

type CardTransactionsTableProps = {
    rows:               CardTransaction[];
    sortField:          string | null;
    sortDirection:      SortDirection;
    onSort:             (fieldId: string) => void;
    /** Reporting Account dropdown options (active chart-of-accounts),
     *  shared with the inline {@link ReportingAccountSelect} on every
     *  editable row. */
    reportingAccountOptions?: ReportingAccountOption[];
    /** Commit a Reporting Account pick on an editable row →
     *  `PUT .../reporting-account`. Mirrors legacy `card_0001_001_u002`.
     *  Never fires for locked rows (read-only plain text, not the picker). */
    onReportingAccountChange?: (row: CardTransaction, next: ReportingAccountOption) => void;
    /** Clear the Reporting Account on an editable row →
     *  `DELETE .../reporting-account`. Drives the × clear button
     *  (clear-first flow). Never fires for locked rows. */
    onReportingAccountClear?: (row: CardTransaction) => void;
    /** Purpose dropdown options (USAG_INFM grp_cd "6"), shared with the
     *  inline {@link PurposeSelect} on every editable row. */
    purposeOptions?:        PurposeOption[];
    /** Commit a Purpose pick on an editable row → `PATCH {field:"purpose"}`.
     *  Mirrors legacy `card_0001_001_u001`. Never fires for locked rows
     *  (they render read-only plain text, not the picker). */
    onPurposeChange?:       (row: CardTransaction, next: PurposeOption) => void;
    /** Clear the Purpose on an editable row → `PATCH {field:"purpose",
     *  value:null}`. Drives the × clear button (clear-first flow); after
     *  clearing, the cell shows the hover pencil again. Never fires for
     *  locked rows. */
    onPurposeClear?:        (row: CardTransaction) => void;
    /** Commit a Description edit on an editable row → `PATCH
     *  {field:"description"}`. Mirrors legacy `card_0001_001_u001` with
     *  `FIELD_ID='CONT'`. Never fires for locked rows. */
    onDescriptionChange?:   (row: CardTransaction, next: string) => void;
    /** Clear the Description on an editable row → `PATCH
     *  {field:"description", value:null}`. Drives the × clear button
     *  (clear-first flow); after clearing, the cell shows the hover pencil
     *  → input again. Never fires for locked rows. */
    onDescriptionClear?:    (row: CardTransaction) => void;
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
    /** Click on a row's Link Reference cell. Mirrors legacy
     *  {@code card_0001_001.ts:533-542} `.link_card_payment` click —
     *  opens the "Link Card Payments with the Expenses" popup
     *  (`card_0001_002`). */
    onLinkRefClick?:        (row: CardTransaction) => void;
    /** Unlink action from the linked-doc cell dropdown. Mirrors
     *  legacy {@code card_0001_001.ts:283-330} (`.unlink-reference`
     *  click → WBC1165 confirmation → `card_0001_002_u001`). */
    onUnlinkClick?:         (row: CardTransaction) => void;
    /** View Detail action — opens the read-only Receipt / Bill detail
     *  popup. Mirrors legacy {@code card_0001_001.ts:337-350}
     *  `.detail-receipt` / `.detail-e-invoice`. */
    onViewLinkedDoc?:       (row: CardTransaction, docId: string) => void;
    /** Click on the row's memo icon — opens the right-side
     *  {@link MemoPanel} drawer. Mirrors legacy
     *  {@code card_0001_001.ts:1242-1276} `.btn-memo-click`. */
    onOpenMemo?:            (row: CardTransaction) => void;
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
 * <p>Per-row editing reuses the shared Transaction History pickers:
 * Reporting Account → {@link ReportingAccountSelect}; Purpose →
 * {@link PurposeSelect} (with × clear, clear-first); Description →
 * {@link InlineTextEdit}. All are gated on `!apprSeqNo` (unconfirmed) — a
 * confirmed row renders read-only plain text for all three, and no
 * picker / input / update handler is reachable.
 */
export default function CardTransactionsTable({
    rows,
    sortField,
    sortDirection,
    onSort,
    reportingAccountOptions = [],
    onReportingAccountChange,
    onReportingAccountClear,
    purposeOptions = [],
    onPurposeChange,
    onPurposeClear,
    onDescriptionChange,
    onDescriptionClear,
    selected,
    onToggleRow,
    onToggleAll,
    onApprovalRefClick,
    onLinkRefClick,
    onUnlinkClick,
    onViewLinkedDoc,
    onOpenMemo,
    className,
}: CardTransactionsTableProps) {
    const allChecked = selected != null && rows.length > 0 && rows.every((r) => selected.has(r.cardSeqNo));
    const someChecked = selected != null && rows.some((r) => selected.has(r.cardSeqNo));
    const { t } = useTranslation();

    /** Code → full option lookup so each row's Reporting Account chip can
     *  render the breadcrumb sub-line from the loaded chart-of-accounts
     *  list (the row itself only carries code + resolved name). */
    const reportingByCode = React.useMemo(() => {
        const m = new Map<string, ReportingAccountOption>();
        for (const o of reportingAccountOptions) m.set(o.code, o);
        return m;
    }, [reportingAccountOptions]);

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
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="TRSC_DT"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.date_time")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="CARD_NO"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.card_number")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="MERCH_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.merchant")}
                    </TableHeaderCell>
                    {/* CARD_NICK_NM / CARD_HLDR_NM — projection-only on
                        the wire (CARD_MSTR join). Sort cycle wires via
                        the V237 whitelist (proxies to cardNo until the
                        backend ports a real LEFT JOIN sort). */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="CARD_NICK_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.card.col.card_nickname")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="CARD_HLDR_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.card.col.cardholder")}
                    </TableHeaderCell>
                    {/* CCY_CD — legacy disp_ord 6. */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="CCY_CD"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.currency")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        align="right"
                        sortable
                        sortFieldId="TRSC_AMT"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.amount")}
                    </TableHeaderCell>
                    {/* CHART_ACCT_NM — projection-only (CHART_ACCT_INFM
                        join). Sort cycle wires via the V237 whitelist
                        (proxies to chartAcctCd on the master). `border-l`
                        mirrors legacy `card_0001_001.ts:1100,1128` which
                        gives the cell the `border-start` class, drawing
                        the vertical separator between Amount and
                        Reporting Account columns. */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="CHART_ACCT_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                        className="border-l border-wb-table-border"
                    >
                        {t("payment.card.col.reporting_account")}
                    </TableHeaderCell>
                    {/* STTS — legacy disp_ord 9. Server emits the
                        i18n key `payment.card_transactions.status.<code>`
                        in `stts_key`; the body cell falls back to the
                        raw `stts` value when no locale entry exists. */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="STTS"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.col.status")}
                    </TableHeaderCell>
                    {/* CARD_TRNS_USAGE_NM — legacy disp_ord 10 (Purpose). */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="CARD_TRNS_USAGE_NM"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.card.col.purpose")}
                    </TableHeaderCell>
                    {/* DISP_DOC_ID — legacy disp_ord 11 (Link Reference).
                        V237 flipped SORT_YN to 'Y'; the whitelist proxies
                        to apprSeqNo until the backend ports a real LEFT
                        JOIN sort on the linked-document id. */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="DISP_DOC_ID"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.card.col.link_reference")}
                    </TableHeaderCell>
                    {/* CONT — legacy disp_ord 12 (Description). */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="CONT"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.card.col.description")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable
                        sortFieldId="APPR_DOC_NO"
                        activeSortField={sortField}
                        activeSortDirection={sortDirection}
                        onSort={onSort}
                    >
                        {t("payment.card.col.approval_ref")}
                    </TableHeaderCell>
                    {/* Note — Phase B icon-only column, never sortable. */}
                    <TableCell className="px-2 py-2.5" />
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.cardSeqNo}
                        className={cn(
                            "group h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                            // Left identity columns (Date/Time … Amount) keep the
                            // normal table background + hover. The unconfirmed-row
                            // cream band lives on the Reporting Account → memo cells
                            // (see CELL_YELLOW), so confirmed rows look fully normal
                            // and unconfirmed rows highlight the editable/output band.
                            "hover:bg-neutral-50/60",
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

                        {/* Reporting Account — shared inline
                            `<ReportingAccountSelect>` ("Select Account ↓"
                            link → search dropdown, commit-on-pick) when the
                            row has NO approval reference; read-only
                            "<code> - <name>" plain text once an Approval Ref
                            exists (locked — legacy `card_0001_001.ts:1128`
                            renders a bare <span>). The picker isn't rendered
                            for locked rows, so no PUT can fire. No × clear —
                            the card backend has no reporting-account clear
                            endpoint; the value is changed by re-picking. The
                            `border-l` mirrors legacy `border-start`. */}
                        <TableCell
                            className={cn(
                                "px-2.5 py-2.5 border-l border-wb-table-border",
                                !row.apprSeqNo && CELL_YELLOW,
                            )}
                        >
                            {row.apprSeqNo ? (
                                <span
                                    className="block truncate text-wb-13 font-medium text-wb-ink"
                                    title={reportingAccountLabel(row) ?? ""}
                                >
                                    {reportingAccountLabel(row) ?? ""}
                                </span>
                            ) : (
                                <ReportingAccountSelect
                                    value={reportingAccountValue(row, reportingByCode)}
                                    options={reportingAccountOptions}
                                    onChange={(next) => onReportingAccountChange?.(row, next)}
                                    onClear={onReportingAccountClear ? () => onReportingAccountClear(row) : undefined}
                                />
                            )}
                        </TableCell>

                        {/* Status — STTS. Render the i18n-key the server
                            emits in `stts_key`; fall back to the raw
                            `stts` value when the key has no locale entry
                            (in-house `t()` returns the key itself on a
                            miss — compare to detect that). */}
                        <TableCell className={cn("px-2.5 py-2.5", !row.apprSeqNo && CELL_YELLOW)}>
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

                        {/* Purpose — shared inline `<PurposeSelect>` (hover
                            pencil → search dropdown, commit-on-pick) when the
                            row has NO approval reference; read-only plain text
                            once an Approval Ref exists (locked — legacy
                            `card_0001_001.ts:1141` drops the `edit` affordance
                            when APPR_SEQ_NO is set). The picker is not even
                            rendered for locked rows, so no PATCH can fire. */}
                        <TableCell className={cn("px-2.5 py-2.5", !row.apprSeqNo && CELL_YELLOW)}>
                            {row.apprSeqNo ? (
                                <span
                                    className="block truncate text-wb-13 font-medium text-wb-ink"
                                    title={purposeLabel(row) ?? ""}
                                >
                                    {purposeLabel(row) ?? ""}
                                </span>
                            ) : (
                                <PurposeSelect
                                    value={purposeValue(row)}
                                    options={purposeOptions}
                                    recentUseUsagCds={[]}
                                    onChange={(next) => onPurposeChange?.(row, next)}
                                    onClear={onPurposeClear ? () => onPurposeClear(row) : undefined}
                                />
                            )}
                        </TableCell>

                        {/* Link Reference — legacy `card_0001_001.ts:533-542`
                            `.link_card_payment`. Unlinked rows render
                            a clickable "Link" CTA; linked rows render
                            the linked doc id (blue text) + chevron that
                            opens the Unlink dropdown. */}
                        <TableCell className={cn("px-2.5 py-2.5", !row.apprSeqNo && CELL_YELLOW)}>
                            {row.linkedDocs.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={() => onLinkRefClick?.(row)}
                                    disabled={!onLinkRefClick}
                                    className={cn(
                                        "block w-full truncate text-left text-wb-13 font-medium text-brand underline-offset-2",
                                        onLinkRefClick
                                            ? "cursor-pointer hover:underline"
                                            : "cursor-default",
                                    )}
                                >
                                    {t("payment.card.link.cell")}
                                </button>
                            ) : (
                                <LinkedDocCell
                                    row={row}
                                    onUnlink={onUnlinkClick}
                                    onViewDetail={onViewLinkedDoc}
                                />
                            )}
                        </TableCell>

                        {/* Description — CONT. Shared inline `<InlineTextEdit>`
                            (hover pencil → `h-8` input, commit on Enter/blur,
                            Esc cancels) when the row has NO approval reference;
                            read-only plain text once an Approval Ref exists
                            (locked — legacy `card_0001_001.ts:1141`). The input
                            is not rendered for locked rows, so no PATCH fires. */}
                        <TableCell className={cn("px-2.5 py-2.5", !row.apprSeqNo && CELL_YELLOW)}>
                            {row.apprSeqNo ? (
                                <span
                                    className="block truncate text-wb-13 font-medium text-wb-ink"
                                    title={row.description ?? ""}
                                >
                                    {row.description ?? ""}
                                </span>
                            ) : (
                                <InlineTextEdit
                                    value={row.description}
                                    ariaLabel={t("payment.card.col.description")}
                                    clearAriaLabel={t("payment.card.description.clear")}
                                    placeholder={t("payment.card.dialog.edit_description.placeholder")}
                                    onCommit={(next) => onDescriptionChange?.(row, next)}
                                    onClear={onDescriptionClear ? () => onDescriptionClear(row) : undefined}
                                />
                            )}
                        </TableCell>

                        {/* Approval Ref — clickable when the row carries
                            an `apprSeqNo` (mirrors legacy `approRefDetail`
                            class @ `card_0001_001.ts:1239`). Displays
                            the legacy `VO_YYMMDD_NNN` doc-no when
                            available; falls back to the raw apprSeqNo
                            for old rows whose master DOC_NO is null. */}
                        <TableCell className={cn("px-2.5 py-2.5", !row.apprSeqNo && CELL_YELLOW)}>
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

                        {/* Memo icon — click to open the right-side
                            memo / note drawer. Mirrors legacy
                            `card_0001_001.ts:1242-1276` `.btn-memo-click`.
                            (Description editing happens inline on the
                            Description column — the row icon is now
                            dedicated to the polymorphic memo thread.) */}
                        <TableCell className={cn("px-2 py-2.5 text-center", !row.apprSeqNo && CELL_YELLOW)}>
                            <button
                                type="button"
                                aria-label={t("payment.card.col.memo")}
                                onClick={() => onOpenMemo?.(row)}
                                disabled={!onOpenMemo}
                                className={cn(
                                    "inline-flex items-center justify-center rounded p-0.5",
                                    onOpenMemo
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

/* ── Link Reference cell — linked row variant ──────────────────── */

/**
 * Linked-state variant of the Link Reference cell. Renders the first
 * linked doc id as blue text + a chevron trigger that opens a small
 * portalled dropdown with the Unlink action. Mirrors legacy
 * `card_0001_001.ts:337-350` `.dropdownLink` pattern.
 *
 * Clicking outside the dropdown closes it. Unlink fires
 * `onUnlinkClick(row)` — the page-level handler runs the WBC1165
 * confirmation + the DELETE call.
 */
function LinkedDocCell({
    row,
    onUnlink,
    onViewDetail,
}: {
    row:           CardTransaction;
    onUnlink?:     (row: CardTransaction) => void;
    onViewDetail?: (row: CardTransaction, docId: string) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const docs       = row.linkedDocs;
    const first      = docs[0];
    const second     = docs[1];
    const overflow   = docs.length - 2;

    const labelOf = (d: typeof first): string =>
        (d?.dispDocId || d?.docId || "");

    return (
        <div ref={ref} className="relative inline-flex max-w-[180px] flex-col items-start gap-0.5">
            {/* First line — primary doc id + optional +N badge + chevron */}
            <div className="flex w-full items-center gap-1">
                <button
                    type="button"
                    onClick={() => onViewDetail?.(row, first.docId)}
                    disabled={!onViewDetail}
                    className={cn(
                        "min-w-0 flex-1 truncate text-left text-wb-13 font-medium text-brand underline-offset-2",
                        onViewDetail
                            ? "cursor-pointer hover:underline"
                            : "cursor-default",
                    )}
                    title={labelOf(first)}
                >
                    {labelOf(first)}
                </button>
                {overflow > 0 && (
                    <span className="shrink-0 rounded bg-brand-soft px-1 text-wb-11 font-medium text-brand">
                        +{overflow}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-label={t("payment.card.link.view_detail")}
                    className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded text-wb-ntrl-6 hover:text-wb-ink"
                >
                    <ChevronDown className="size-3" strokeWidth={1.8} />
                </button>
            </div>

            {/* Second line — secondary doc id, only when 2+ linked. */}
            {second && (
                <button
                    type="button"
                    onClick={() => onViewDetail?.(row, second.docId)}
                    disabled={!onViewDetail}
                    className={cn(
                        "block max-w-full truncate text-left text-wb-13 font-medium text-brand underline-offset-2",
                        onViewDetail
                            ? "cursor-pointer hover:underline"
                            : "cursor-default",
                    )}
                    title={labelOf(second)}
                >
                    {labelOf(second)}
                </button>
            )}

            {/* Rich popover — full list of linked docs (icon + name +
                amount per row), plus an Unlink action at the bottom.
                Mirrors Figma 693:22336. */}
            {open && (
                <div className="absolute left-0 top-full z-20 mt-1 w-[340px] rounded-lg border border-wb-ntrl-4 bg-white py-1 shadow-wb-card">
                    {docs.map((d) => (
                        <button
                            key={d.docId}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onViewDetail?.(row, d.docId);
                            }}
                            disabled={!onViewDetail}
                            className={cn(
                                "flex w-full items-center gap-3 border-b border-wb-table-border px-4 py-3 text-left last:border-b-0",
                                onViewDetail
                                    ? "cursor-pointer hover:bg-neutral-50"
                                    : "cursor-default",
                            )}
                        >
                            <FileText
                                className="size-4 shrink-0 text-wb-ntrl-6"
                                strokeWidth={1.6}
                                aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate text-wb-13 font-medium text-brand">
                                {labelOf(d)}
                            </span>
                            <span className="shrink-0 text-wb-13 font-medium text-wb-ink">
                                {d.totlAmt
                                    ? formatAmount(d.totlAmt, row.ccyCd, true)
                                    : ""}
                            </span>
                        </button>
                    ))}
                    {onUnlink && (
                        <div className="border-t border-wb-table-border">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    onUnlink(row);
                                }}
                                className="block w-full cursor-pointer px-4 py-2.5 text-left text-wb-13 font-medium text-wb-status-rejected-text hover:bg-neutral-50"
                            >
                                {t("payment.card.link.unlink")}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
