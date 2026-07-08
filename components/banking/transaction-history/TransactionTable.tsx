"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { isSpecialViewSettingField, type ViewSettingItem } from "@/components/shared/view-setting";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import TransactionTableColumns from "./TransactionTableColumns";
import {
    TRANSACTION_HISTORY_COLUMN_REGISTRY,
    type TransactionColumnContext,
} from "./columnRegistry";
import type {
    ContactOption,
    PurposeOption,
    ReportingAccountOption,
    TransactionRow,
    VasAccountOption,
} from "./types";

type TransactionTableProps = {
    rows: TransactionRow[];
    /** Live View Setting items (use_yn='Y' + sorted by disp_ord). Drives
     *  the `<colgroup>`, `<thead>`, and per-row `<TableCell>` rendering
     *  so toggle/reorder in the popover is immediately reflected in the
     *  table (CLAUDE.md §13). */
    visibleColumns: ViewSettingItem[];
    /** Currency code for amount cells — `"VND"` on the VND screen, the
     *  account's CCY on the FCY screen. Threaded into every column
     *  renderer so `formatAmount` applies the right precision. */
    currency: string;
    onConfirm?: (rowId: string) => void;
    onUndo?: (rowId: string) => void;
    /** Open the memo drawer for this transaction. Rendered only on
     *  confirmed rows (legacy `fnsh_0002_001_osmc_VN` runtime parity —
     *  the memo icon sits beside Undo in the confirmed action cell). */
    onOpenMemo?: (row: TransactionRow) => void;
    /** Open the Smart Organizer popup anchored on this row. */
    onOrganize?: (rowId: string) => void;
    reportingAccountOptions: ReportingAccountOption[];
    onReportingAccountChange?: (
        rowId: string,
        next: ReportingAccountOption,
    ) => void;
    onReportingAccountClear?: (rowId: string) => void;
    purposeOptions: PurposeOption[];
    recentPurposeUseUsagCds: string[];
    onPurposeChange?: (rowId: string, next: PurposeOption) => void;
    onPurposeClear?: (rowId: string) => void;
    vasAccountOptions: VasAccountOption[];
    recentVasAcctCds: string[];
    onVasAccountChange?: (rowId: string, next: VasAccountOption) => void;
    onVasAccountClear?: (rowId: string) => void;
    contactOptions: ContactOption[];
    recentContactTrcoKeys: string[];
    onContactChange?: (rowId: string, next: ContactOption) => void;
    onContactClear?: (rowId: string) => void;
    /** Minimum table width in px — recomputed from `visibleColumns`
     *  by the parent so the footer scrolls in lockstep. */
    minWidth?: string;
    className?: string;
};

/**
 * Transaction history table — column-set is driven by View Setting
 * (CLAUDE.md §13). The parent passes `visibleColumns` (already filtered
 * to `use_yn === 'Y'` and sorted by `disp_ord`); this component
 * iterates them to build the `<colgroup>`, header row, and per-row
 * cells via {@link TRANSACTION_HISTORY_COLUMN_REGISTRY}.
 *
 * The trailing action column (Confirm / Undo) is hardcoded chrome at
 * the end of every row — it is not part of the View Setting seed and
 * cannot be toggled / reordered by the user (same convention as
 * Account Inquiry's leading checkbox column).
 *
 * Unconfirmed rows tint the matching-panel cluster (Purpose / VAS /
 * Contact / Confirmed by / Action) yellow; the left-side
 * bank-statement columns stay white.
 */
export default function TransactionTable({
    rows,
    visibleColumns,
    currency,
    onConfirm,
    onUndo,
    onOpenMemo,
    onOrganize,
    reportingAccountOptions,
    onReportingAccountChange,
    onReportingAccountClear,
    purposeOptions,
    recentPurposeUseUsagCds,
    onPurposeChange,
    onPurposeClear,
    vasAccountOptions,
    recentVasAcctCds,
    onVasAccountChange,
    onVasAccountClear,
    contactOptions,
    recentContactTrcoKeys,
    onContactChange,
    onContactClear,
    minWidth,
    className,
}: TransactionTableProps) {
    const { t, locale } = useTranslation();

    // Drop special FIELD_IDs (CHECKBOX / ETC) defensively — the popover
    // already hides them and the seed for this screen carries none, but
    // a future admin reseed could introduce them and they must never
    // render as user-visible columns here.
    const renderable = visibleColumns.filter(
        (col) =>
            !isSpecialViewSettingField(col.field_id) &&
            TRANSACTION_HISTORY_COLUMN_REGISTRY[col.field_id] !== undefined,
    );

    return (
        <table
            className={cn("w-full table-fixed border-collapse", className)}
            style={minWidth ? { minWidth } : undefined}
        >
            {/* Same shared colgroup the sibling footer renders, so header,
               body, and footer share ONE DB-`size`-driven column model +
               the trailing action column (CLAUDE.md §13c). */}
            <TransactionTableColumns visibleColumns={visibleColumns} />


            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {renderable.map((col) => {
                        const def = TRANSACTION_HISTORY_COLUMN_REGISTRY[col.field_id]!;
                        return (
                            <TableHeaderCell
                                key={col.field_id}
                                align={def.align ?? "left"}
                                sortable={false}
                                textSizeClass="text-wb-13"
                            >
                                {t(def.headerKey)}
                            </TableHeaderCell>
                        );
                    })}
                    <TableHeaderCell sortable={false} textSizeClass="text-wb-13">&nbsp;</TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.length === 0 ? null : (
                    rows.map((row) => {
                        const isMatched = row.linkMatchYn === "Y";
                        // Legacy `fnsh_0002_001` (ts:912 —
                        // `bgYellow = CNFM_BY_USER_ID ? "" : "yellow-bg"`)
                        // tints the matching-panel cluster (Purpose / VAS /
                        // Contact / Confirmed by / Action) yellow while the
                        // row is UNCONFIRMED and white once CONFIRMED. The
                        // tint is driven by CONFIRM state, NOT match state —
                        // a confirmed-but-unmatched row must still go white.
                        // The bank-statement / metadata columns on the left
                        // stay white in both states (see column registry).
                        const panelTint = row.confirmed ? "" : "bg-[#FFFEDB]";

                        const ctx: TransactionColumnContext = {
                            row,
                            t,
                            locale,
                            currency,
                            panelTint,
                            isMatched,
                            onOrganize,
                            reportingAccountOptions,
                            onReportingAccountChange,
                            onReportingAccountClear,
                            purposeOptions,
                            recentPurposeUseUsagCds,
                            onPurposeChange,
                            onPurposeClear,
                            vasAccountOptions,
                            recentVasAcctCds,
                            onVasAccountChange,
                            onVasAccountClear,
                            contactOptions,
                            recentContactTrcoKeys,
                            onContactChange,
                            onContactClear,
                        };

                        return (
                            <TableRow
                                key={row.id}
                                className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                            >
                                {renderable.map((col) => {
                                    const def = TRANSACTION_HISTORY_COLUMN_REGISTRY[col.field_id]!;
                                    const cellClass = def.cellClassName?.(ctx);
                                    return (
                                        <TableCell
                                            key={col.field_id}
                                            className={cn(
                                                "px-2.5 py-2.5 align-middle",
                                                def.align === "right" && "text-right",
                                                cellClass,
                                            )}
                                        >
                                            {def.renderBody(ctx)}
                                        </TableCell>
                                    );
                                })}

                                {/* Trailing action column — Confirm / Undo.
                                   Not part of View Setting; always rendered.
                                   Carries the same yellow tint as the
                                   matching-panel cluster while the row is
                                   UNCONFIRMED; white once confirmed. */}
                                <TableCell className={cn("px-2.5 py-2.5 align-middle", panelTint)}>
                                    {row.confirmed ? (
                                        // Confirmed → memo icon + Undo (legacy
                                        // `fnsh_0002_001_osmc_VN.js:724` — the memo
                                        // icon renders ONLY inside the confirmed
                                        // branch; the sticker color reflects the
                                        // row's newest memo, else the neutral fileW).
                                        <div className="flex items-center gap-1.5">
                                            {/* Memo icon — same 24px fileX PNG + button
                                               styling as Card Transactions
                                               (CardTransactionsTable memo cell) so the
                                               two screens read identically. */}
                                            <button
                                                type="button"
                                                onClick={() => onOpenMemo?.(row)}
                                                className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded p-0.5 hover:opacity-80"
                                                aria-label={t("txn_history.action.memo")}
                                                title={t("txn_history.action.memo")}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={`/assets/memo/${(row.memoCount ?? 0) > 0 && row.memoColor ? row.memoColor : "fileW"}.png`}
                                                    alt=""
                                                    aria-hidden
                                                    className="size-6 max-w-none shrink-0"
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onUndo?.(row.id)}
                                                className="flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-2.5 text-wb-12 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                            >
                                                {t("txn_history.action.undo")}
                                            </button>
                                        </div>
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
