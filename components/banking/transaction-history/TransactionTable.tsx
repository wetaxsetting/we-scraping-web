"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import TransactionTableColumns, {
    TRANSACTION_TABLE_MIN_WIDTH,
} from "./TransactionTableColumns";
import type { TransactionRow } from "./types";

type TransactionTableProps = {
    rows: TransactionRow[];
    onConfirm?: (rowId: string) => void;
    onUndo?: (rowId: string) => void;
    /** Open the Smart Organizer popup anchored on this row. Replaces
     *  the toolbar's blanket "open for first row" behaviour with a
     *  per-row link (legacy `comm_0196_001` parity — `Match to Payment
     *  Transaction` / `Unmatch` lives in the File Name column). */
    onOrganize?: (rowId: string) => void;
    /** Minimum table width in px — must match the footer's `minWidth`. */
    minWidth?: string;
    className?: string;
};

/**
 * Transaction history table aligned with the legacy on-screen layout
 * (10 columns):
 *
 *   1 Transaction ID  · 2 Date/Time  · 3 Deposit · 4 Withdrawal ·
 *   5 Balance         · 6 Remarks    · 7 File Name · 8 Matched Date ·
 *   9 Matched By      · 10 Purpose
 *
 * The summary row is a sibling `<TransactionTableFooter>` pinned to the
 * bottom of the scroll container via `mt-auto` (Approval Box canonical
 * pattern, CLAUDE.md §7a); both tables import the same
 * `TransactionTableColumns` so the Deposit / Withdrawal totals align
 * under their columns.
 *
 * Unconfirmed rows render with the legacy yellow tint plus a row-level
 * Confirm action; confirmed rows render read-only with an Undo action.
 * The Confirm/Undo affordance lives in the Matched By cell so the
 * column structure exactly matches image 2 (no separate Action column).
 */
export default function TransactionTable({
    rows,
    onConfirm,
    onUndo,
    onOrganize,
    minWidth = TRANSACTION_TABLE_MIN_WIDTH,
    className,
}: TransactionTableProps) {
    const { t } = useTranslation();
    return (
        <table
            className={cn("w-full table-fixed border-collapse", className)}
            style={{ minWidth }}
        >
            <TransactionTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("txn_history.col.transaction_id")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.date_time")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.deposit")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.withdraw")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.balance")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.remarks")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.file_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.matched_date")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.matched_by")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.purpose")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.contact_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.confirmed_by")}</TableHeaderCell>
                    <TableHeaderCell sortable={false}>&nbsp;</TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.length === 0 ? (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={13}
                            className="px-2.5 py-6 text-center align-middle text-wb-13 font-medium text-wb-muted"
                        >
                            {t("common.no_rows")}
                        </TableCell>
                    </TableRow>
                ) : (
                    rows.map((row) => {
                        const isMatched = row.linkMatchYn === "Y";
                        const matchedDate =
                            row.matchedDate ?? row.confirmedBy?.date ?? null;
                        const matchedBy =
                            row.matchedBy ?? row.confirmedBy?.name ?? null;
                        // Legacy `fnsh_0002_001` only tints the
                        // matching-panel cluster (Purpose / Contact
                        // Name / Confirmed by) yellow when the row is
                        // unmatched — those columns are user-editable
                        // / pending input. The bank-statement and
                        // metadata columns on the left stay white.
                        // `panelTint` is the conditional class applied
                        // ONLY to the matching-panel cells below.
                        const panelTint = isMatched ? "" : "bg-[#FFFEDB]";
                        return (
                            <TableRow
                                key={row.id}
                                className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                            >
                                {/* 1. Transaction ID */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {row.transactionId ?? ""}
                                    </span>
                                </TableCell>

                                {/* 2. Date/Time */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <div className="flex flex-col">
                                        <span className="text-wb-13 font-medium text-wb-ink">
                                            {row.date}
                                        </span>
                                        <span className="text-wb-13 font-medium text-wb-muted">
                                            {row.time}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* 3. Deposit — legacy left-aligns
                                     numeric columns. Green tint
                                     preserved from refactor for the
                                     deposit / withdraw visual cue. */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-status-approved-text">
                                        {row.deposit ?? "0"}
                                    </span>
                                </TableCell>

                                {/* 4. Withdrawal */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-status-rejected-text">
                                        {row.withdraw ?? "0"}
                                    </span>
                                </TableCell>

                                {/* 5. Balance */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {row.balance}
                                    </span>
                                </TableCell>

                                {/* 6. Remarks */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="block text-wb-13 font-normal leading-[1.45] text-wb-muted">
                                        {row.remarks}
                                    </span>
                                </TableCell>

                                {/* 7. File Name — when matched, shows the
                                     payment-batch file name + an `Unmatch`
                                     link below; when unmatched, shows the
                                     `Match to Payment Transaction` link
                                     that opens the Smart Organizer popup
                                     (legacy `comm_0196_001` per-row entry). */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    {isMatched ? (
                                        <div className="flex flex-col">
                                            {row.fileName && (
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.fileName}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => onOrganize?.(row.id)}
                                                className="self-start text-wb-13 font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
                                            >
                                                {t("smart_organizer.unmatch")}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onOrganize?.(row.id)}
                                            className="block text-left text-wb-13 font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
                                        >
                                            {t("smart_organizer.match_link")}
                                        </button>
                                    )}
                                </TableCell>

                                {/* 8. Matched Date */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {isMatched ? (matchedDate ?? "—") : ""}
                                    </span>
                                </TableCell>

                                {/* 9. Matched By */}
                                <TableCell className="px-2.5 py-2.5 align-middle">
                                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                                        {isMatched ? (matchedBy ?? "—") : ""}
                                    </span>
                                </TableCell>

                                {/* 10. Purpose */}
                                <TableCell className={cn("px-2.5 py-2.5 align-middle", panelTint)}>
                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                        {row.purpose ?? ""}
                                    </span>
                                </TableCell>

                                {/* 11. Contact Name */}
                                <TableCell className={cn("px-2.5 py-2.5 align-middle", panelTint)}>
                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                        {row.contactsName ?? ""}
                                    </span>
                                </TableCell>

                                {/* 12. Confirmed by */}
                                <TableCell className={cn("px-2.5 py-2.5 align-middle", panelTint)}>
                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                        {row.confirmed && row.confirmedBy
                                            ? row.confirmedBy.name
                                            : ""}
                                    </span>
                                </TableCell>

                                {/* 13. Action — Confirm / Undo as a small
                                     white outline button. Matches legacy
                                     `fnsh_0002_001` chrome (NOT the
                                     brand-blue full-width CTA). The
                                     cell shares the same yellow tint
                                     as the matching-panel cluster when
                                     the row is unmatched. */}
                                <TableCell className={cn("px-2.5 py-2.5 align-middle", panelTint)}>
                                    {row.confirmed ? (
                                        <button
                                            type="button"
                                            onClick={() => onUndo?.(row.id)}
                                            className="flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-12 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                        >
                                            {t("txn_history.action.undo")}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onConfirm?.(row.id)}
                                            className="flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-12 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                        >
                                            {t("txn_history.action.confirm")}
                                        </button>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </table>
    );
}
