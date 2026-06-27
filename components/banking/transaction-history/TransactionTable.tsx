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
            <colgroup>
                {renderable.map((col) => {
                    const def = TRANSACTION_HISTORY_COLUMN_REGISTRY[col.field_id]!;
                    return (
                        <col
                            key={col.field_id}
                            style={{ width: col.size || def.defaultWidth }}
                        />
                    );
                })}
                {/* Trailing action column — Confirm / Undo. */}
                <col style={{ width: "110px" }} />
            </colgroup>

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
                        // Legacy `fnsh_0002_001` only tints the
                        // matching-panel cluster (Confirmed by / Action)
                        // yellow when the row is unmatched. The
                        // bank-statement and metadata columns on the
                        // left stay white. Purpose / VAS / Contact
                        // carry an ALWAYS-yellow tint independent of
                        // matching state (see column registry).
                        const panelTint = isMatched ? "" : "bg-[#FFFEDB]";

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
                                   matching-panel cluster when the row is
                                   unmatched. */}
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
