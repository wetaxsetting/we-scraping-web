"use client";

import { ChevronDown, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    /** Minimum table width in px — must match the footer's `minWidth`. */
    minWidth?: string;
    className?: string;
};

/**
 * Transaction history table per Figma node 989:22011 — ten columns
 * rendered as a single semantic `<table>` split into two logical halves:
 *
 *   Left (bank statement)   : Date/Time · Deposit · Withdraw · Balance · Remarks
 *   Right (matching panel)  : Purpose · VAS Account · Contacts Name ·
 *                              Confirmed by · Action (Confirm / Undo)
 *
 * Unconfirmed rows render yellow with editable Purpose / VAS dropdowns,
 * a Contacts Name input, and a Confirm button. Confirmed rows render
 * read-only values with a coloured doc icon and an Undo button.
 *
 * The summary row is a sibling `<TransactionTableFooter>` pinned to the
 * bottom of the scroll container via `mt-auto` (Approval Box canonical
 * pattern, CLAUDE.md §7a); both tables import the same
 * `TransactionTableColumns` so the Deposit / Withdraw totals align under
 * their columns.
 */
export default function TransactionTable({
    rows,
    onConfirm,
    onUndo,
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

            <TableHeader className="sticky top-0 z-20">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("txn_history.col.date_time")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("txn_history.col.deposit")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("txn_history.col.withdraw")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("txn_history.col.balance")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.remarks")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.purpose")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.vas_account")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.contacts_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("txn_history.col.confirmed_by")}</TableHeaderCell>
                    <TableHeaderCell sortable={false}>&nbsp;</TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.length === 0 ? (
                    <TableRow className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                        <TableCell
                            colSpan={10}
                            className="px-2.5 py-6 text-center align-middle text-wb-13 font-medium text-wb-muted"
                        >
                            {t("common.no_rows")}
                        </TableCell>
                    </TableRow>
                ) : (
                    rows.map((row) => (
                        <TableRow
                            key={row.id}
                            className={cn(
                                "h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0",
                                !row.confirmed && "bg-[#FFFBEA]",
                            )}
                        >
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

                            <TableCell className="px-2.5 py-2.5 text-right align-middle">
                                <span className="text-wb-13 font-medium text-wb-status-approved-text">
                                    {row.deposit ?? "-"}
                                </span>
                            </TableCell>

                            <TableCell className="px-2.5 py-2.5 text-right align-middle">
                                <span className="text-wb-13 font-medium text-wb-status-rejected-text">
                                    {row.withdraw ?? "-"}
                                </span>
                            </TableCell>

                            <TableCell className="px-2.5 py-2.5 text-right align-middle">
                                <span className="text-wb-13 font-medium text-wb-ink">
                                    {row.balance}
                                </span>
                            </TableCell>

                            <TableCell className="px-2.5 py-2.5 align-middle">
                                <span className="block text-wb-13 font-normal leading-[1.45] text-wb-muted">
                                    {row.remarks}
                                </span>
                            </TableCell>

                            {/* Matching panel cells */}
                            <TableCell className="px-2.5 py-2.5 align-middle">
                                {row.confirmed ? (
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {row.purpose ?? "-"}
                                    </span>
                                ) : (
                                    <SelectChip
                                        value={row.purpose}
                                        placeholder={t("common.select")}
                                    />
                                )}
                            </TableCell>

                            <TableCell className="px-2.5 py-2.5 align-middle">
                                {row.confirmed ? (
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {row.vasAccount ?? "-"}
                                    </span>
                                ) : (
                                    <SelectChip
                                        value={row.vasAccount}
                                        placeholder={t("common.select")}
                                    />
                                )}
                            </TableCell>

                            <TableCell className="px-2.5 py-2.5 align-middle">
                                {row.confirmed ? (
                                    <span className="block text-wb-13 font-medium text-wb-ink">
                                        {row.contactsName ?? "-"}
                                    </span>
                                ) : (
                                    <ContactsInput value={row.contactsName} />
                                )}
                            </TableCell>

                            <TableCell className="px-2.5 py-2.5 align-middle">
                                {row.confirmed && row.confirmedBy ? (
                                    <div className="flex items-center gap-2">
                                        <FileText
                                            className={cn(
                                                "size-4 shrink-0",
                                                row.docIconVariant === "pink"
                                                    ? "text-wb-status-rejected-text"
                                                    : "text-[#C99D1E]",
                                            )}
                                            strokeWidth={1.6}
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-wb-13 font-medium text-brand underline-offset-2 hover:underline">
                                                {row.confirmedBy.name}
                                            </span>
                                            <span className="text-wb-13 font-medium text-wb-muted">
                                                {row.confirmedBy.date}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-wb-13 font-medium text-wb-muted">
                                        -
                                    </span>
                                )}
                            </TableCell>

                            <TableCell className="px-2.5 py-2.5 text-right align-middle">
                                {row.confirmed ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onUndo?.(row.id)}
                                        className="h-8 px-3 text-wb-13 font-medium text-wb-ink"
                                    >
                                        {t("txn_history.action.undo")}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => onConfirm?.(row.id)}
                                        className="h-8 px-3 text-wb-13 font-medium"
                                    >
                                        {t("txn_history.action.confirm")}
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </table>
    );
}

/**
 * Read-only visual for an unconfirmed Purpose / VAS Account cell. Mirrors
 * the Figma dropdown — placeholder text plus a chevron — without wiring a
 * real select popover yet (slotted in with the backend).
 */
function SelectChip({
    value,
    placeholder,
}: {
    value?: string;
    placeholder: string;
}) {
    return (
        <div className="flex h-9 w-full items-center justify-between rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-13 font-medium">
            <span
                className={cn(
                    "truncate",
                    value ? "text-wb-ink" : "text-wb-ntrl-5",
                )}
            >
                {value ?? placeholder}
            </span>
            <ChevronDown className="ml-2 size-4 shrink-0 text-wb-ntrl-6" strokeWidth={1.8} />
        </div>
    );
}

/**
 * Read-only visual for the editable Contacts Name cell on unconfirmed
 * rows. Renders as an input with a leading search glyph per Figma.
 */
function ContactsInput({ value }: { value?: string }) {
    return (
        <div className="flex h-9 w-full items-center gap-2 rounded-md border border-wb-ntrl-4 bg-white px-2.5">
            <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                className="size-4 shrink-0 text-wb-ntrl-5"
            >
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                <path
                    d="m14 14 3 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                />
            </svg>
            <span
                className={cn(
                    "block flex-1 truncate text-wb-13 font-medium",
                    value ? "text-wb-ink" : "text-wb-ntrl-5",
                )}
            >
                {value ?? "Search contact name"}
            </span>
        </div>
    );
}
