"use client";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import Tooltip from "@/components/shared/Tooltip";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { SortDirection } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import TransferHistoryTableColumns from "./TransferHistoryTableColumns";
import type { TransferRow } from "./types";

/**
 * Backend-whitelisted sort field ids (mirrors
 * `TransferHistorySortField` enum in
 * `wecms-api/.../domain/banking/transferhistory/dto/`):
 *   TRNS_DT     → REG_DTM
 *   OUT_BANK_NM → OUT_BANK_CODE
 *   IN_BANK_NM  → IN_BANK_CODE
 *   TRSC_AMT    → TRSC_AMT
 *   RMRK        → RMRK
 *
 * Results column has no backend mapping → renders sortable=false.
 */
export const TRANSFER_HISTORY_SORT_FIELD_IDS = {
    TRNS_DT: "TRNS_DT",
    OUT_BANK_NM: "OUT_BANK_NM",
    IN_BANK_NM: "IN_BANK_NM",
    TRSC_AMT: "TRSC_AMT",
    RMRK: "RMRK",
} as const;

type TransferHistoryTableProps = {
    rows: TransferRow[];
    className?: string;
    /**
     * Currently-active sort field id (one of {@link TRANSFER_HISTORY_SORT_FIELD_IDS}).
     * `null` → table is in its default ORDER BY (legacy `REG_DTM DESC`,
     * resolved server-side). Forward `useTableSort().sortField` here.
     */
    sortField?: string | null;
    /** Direction of the active sort (`ASC` / `DESC` / `null`). Forward
     *  `useTableSort().sortDirection`. */
    sortDirection?: SortDirection;
    /** Click handler — receives the header's `sortFieldId`. Forward
     *  `useTableSort().toggleSort`. Omitting this leaves the headers
     *  inert (icon visible, click inactive). */
    onSort?: (fieldId: string) => void;
};

/**
 * Transfer History table — Figma 96:42769. Columns: Date/Time, From Bank,
 * To Bank, Transfer Amount, Remarks, Results. Renders `<thead>` + `<tbody>`
 * only; the summary row is a sibling `<TransferHistoryTableFooter>` pinned
 * to the bottom of the scroll container via `mt-auto` (Approval Box
 * pattern). Both tables share `TransferHistoryTableColumns` so the totals
 * align with the Transfer Amount column.
 */
export default function TransferHistoryTable({
    rows,
    className,
    sortField = null,
    sortDirection = null,
    onSort,
}: TransferHistoryTableProps) {
    const { t } = useTranslation();
    const sortProps = {
        activeSortField: sortField,
        activeSortDirection: sortDirection,
        onSort,
    };

    return (
        <table
            className={cn(
                "w-full min-w-[1080px] table-fixed border-collapse",
                className,
            )}
        >
            <TransferHistoryTableColumns />

            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    {/* `textSizeClass="text-wb-13"` opts into the 13px
                       header standard per wecms-web/CLAUDE.md §5 — same
                       override Own Account Transfer's SourceAccountsTable
                       uses (and the same the rest of the migrated
                       refactor pages converge on). The default
                       `TableHeaderCell` would render 14px, which is why
                       this table's headers looked larger than OAT's. */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortFieldId={TRANSFER_HISTORY_SORT_FIELD_IDS.TRNS_DT}
                        {...sortProps}
                    >
                        {t("transfer_history.col.date_time")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortFieldId={TRANSFER_HISTORY_SORT_FIELD_IDS.OUT_BANK_NM}
                        {...sortProps}
                    >
                        {t("transfer_history.col.from_bank")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortFieldId={TRANSFER_HISTORY_SORT_FIELD_IDS.IN_BANK_NM}
                        {...sortProps}
                    >
                        {t("transfer_history.col.to_bank")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        align="right"
                        sortFieldId={TRANSFER_HISTORY_SORT_FIELD_IDS.TRSC_AMT}
                        {...sortProps}
                    >
                        {t("transfer_history.col.amount")}
                    </TableHeaderCell>
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortFieldId={TRANSFER_HISTORY_SORT_FIELD_IDS.RMRK}
                        {...sortProps}
                    >
                        {t("transfer_history.col.remarks")}
                    </TableHeaderCell>
                    {/* Results has no backend sort mapping —
                       intentionally non-sortable (icon hidden). */}
                    <TableHeaderCell
                        textSizeClass="text-wb-13"
                        sortable={false}
                    >
                        {t("transfer_history.col.results")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
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

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <BankCell
                                bank={row.fromBank}
                                currency={row.fromCurrency}
                                account={row.fromAccount}
                            />
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <BankCell
                                bank={row.toBank}
                                currency={row.toCurrency}
                                account={row.toAccount}
                            />
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 text-right align-middle">
                            <span className="text-wb-13 font-medium text-wb-ink">
                                {row.amount}
                            </span>
                        </TableCell>

                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.remarks}
                            </span>
                        </TableCell>

                        {/* G8: legacy shows TRNS_MSG on hover over the whole
                            Results cell — `<td class="show_message_error">`
                            wrapping a `.error_message` layer that its own
                            mouseenter/mouseleave handlers toggle
                            (`trns_0003_001.ts:318-322` + `:127-133`). The
                            refactor renders that through the shared
                            <Tooltip> instead of a native `title`: same
                            trigger area (`block h-full w-full` fills the
                            cell), product-styled chrome, keyboard reachable.

                            Gating matches legacy exactly — legacy renders the
                            `.error_message` layer only when `TRNS_MSG` is
                            non-empty (`:288`, `:319`) and does NOT branch on
                            `TRNS_STTS`. `<Tooltip>` disables itself on empty
                            content (children render bare, no wrapper, no
                            listeners), so passing the message straight through
                            reproduces that rule. In practice only failed rows
                            carry a message — the engine returns
                            `ErrorMessage: ""` on success — which is why the
                            tooltip is only ever seen on `Failed`. */}
                        <TableCell className="px-2.5 py-2.5 align-middle">
                            <Tooltip
                                content={row.statusMessage || undefined}
                                className="block h-full w-full"
                            >
                                {row.status === "failed" ? (
                                    <div className="flex flex-col">
                                        <span className="text-wb-13 font-medium text-wb-status-rejected-text">
                                            {t("transfer_history.status.failed")}
                                        </span>
                                        <span className="text-wb-13 font-medium text-wb-muted">
                                            {row.lastUpdate}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-wb-13 font-medium text-wb-muted">
                                        {row.lastUpdate}
                                    </span>
                                )}
                            </Tooltip>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}

function BankCell({
    bank,
    currency,
    account,
}: {
    bank: string;
    currency: string;
    account: string;
}) {
    return (
        // Layout (target screenshot 2026-05-20):
        //   line 1:  {bank}  <building-icon>  {currency}
        //   line 2:  {account}                            (muted grey)
        // The icon sits BETWEEN the bank name and the currency
        // code, not before the name — matches the JEX live page.
        <div className="flex flex-col items-start">
            <div className="flex items-start gap-1">
                <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                    {bank}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/table/ico-building.svg"
                    alt=""
                    aria-hidden
                    className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
                />
                <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                    {currency}
                </span>
            </div>
            <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-muted">
                {account}
            </span>
        </div>
    );
}
