"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { cn } from "@/lib/utils";

import type { CurrencyTotal, PaymentListColumn } from "./types";

type PaymentListTableFooterProps<Row> = {
    columns: PaymentListColumn<Row>[];
    /**
     * Pre-formatted count label, e.g. `"5 transaction(s)"`. Already runs
     * through `t(…)` at the call site so the footer stays presentation-only.
     */
    countLabel: string;
    /**
     * One label-value pair per currency. Rendered as evenly-distributed cells
     * after the count cell, mirroring Approval Box's footer.
     */
    totals?: CurrencyTotal[];
    /**
     * Translation-rendered prefix for each total cell — e.g. `"Total {currency}"`
     * already interpolated. The cell shows `{prefix} : {total}` with the total
     * in `font-semibold`.
     */
    formatTotal?: (t: CurrencyTotal) => { prefix: string; value: string };
    /** Must match the main table's `minWidth` for lockstep horizontal scroll. */
    minWidth: string;
    className?: string;
};

const COUNT_COLS = 2;

/**
 * Sibling-table footer for payment list pages (Sprint 2). Same shape as
 * `ApprovalTableFooter` — count cell on the left, currency totals spanning
 * the remaining columns. The shared `<DataTableFooter>` owns the `<table>`
 * chrome; this component only owns the row layout so each page gets the
 * same column-aligned summary without re-implementing the footer table.
 */
export default function PaymentListTableFooter<Row>({
    columns,
    countLabel,
    totals = [],
    formatTotal,
    minWidth,
    className,
}: PaymentListTableFooterProps<Row>) {
    const remaining = columns.length - COUNT_COLS;
    const baseColspan = totals.length > 0
        ? Math.floor(remaining / totals.length)
        : remaining;
    const lastColspan = totals.length > 0
        ? remaining - baseColspan * (totals.length - 1)
        : remaining;

    return (
        <DataTableFooter
            colgroup={
                <colgroup>
                    {columns.map((c) => (
                        <col key={c.key} style={{ width: c.width }} />
                    ))}
                </colgroup>
            }
            minWidth={minWidth}
            className={cn("sticky bottom-0 z-20 h-[50px]", className)}
        >
            <tr className="h-[50px]">
                <td colSpan={COUNT_COLS} className="px-2.5 py-3">
                    <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                        {countLabel}
                    </span>
                </td>

                {totals.length === 0 ? (
                    <td colSpan={remaining} />
                ) : (
                    totals.map((total, i) => {
                        const formatted = formatTotal?.(total) ?? {
                            prefix: `Total ${total.currency}`,
                            value: total.total,
                        };
                        return (
                            <td
                                key={total.currency}
                                colSpan={i === totals.length - 1 ? lastColspan : baseColspan}
                                className="px-2.5 py-3"
                            >
                                <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                                    {formatted.prefix}
                                    {" : "}
                                    <span className="font-semibold">{formatted.value}</span>
                                </span>
                            </td>
                        );
                    })
                )}
            </tr>
        </DataTableFooter>
    );
}
