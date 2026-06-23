"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shared summary footer for the batch-file Payment list tables (Scheduled
 * + Result, every module). Mirrors the Approval Box footer fix
 * (`components/payment/approval-box/ApprovalTableFooter.tsx`):
 *
 *  - A sibling `<table>` (via the shared {@link DataTableFooter}) whose
 *    `<tfoot>` imports the SAME `<colgroup>` the main table renders, so its
 *    cells share the table's exact column widths and scroll in lockstep
 *    when the table pans horizontally.
 *  - One `<td>` per rendered column — no spanning `colSpan` cell — so every
 *    footer cell lines up under its header column.
 *  - Kept as a sibling (not an inline `<tfoot>`) so it can be both
 *    bottom-anchored AND sticky: `mt-auto` (passed by the page) pushes it to
 *    the bottom of the scroll area when rows are few (empty space stays
 *    ABOVE it), while `sticky bottom-0` pins it to the bottom edge of the
 *    scroll container when the body overflows — so it stays visible while
 *    many rows scroll, mirroring the sticky `<thead>` at the top. It pans
 *    horizontally together with the header + body (sticky is vertical-only)
 *    and the horizontal scrollbar sits just below it.
 *
 * Each consumer builds the ordered `slotKeys` list (mirroring its header
 * column conditionals) and calls {@link placeBatchFooterCells} to map the
 * count label + currency totals onto the matching columns, then passes the
 * page's `<colgroup>` element + `minWidth`.
 */
export type BatchFooterTotal = { currency: string; amount: string };

/** Currencies always rendered on batch footers — USD + VND. KRW is
 *  intentionally excluded for batch pages (the legacy live Internal
 *  Transfer / Vendor / Expense / Payroll / Overseas lists never
 *  denominate in KRW, so a "Total KRW : 0" cell reads as noise).
 *  Approval Box keeps its own three-currency footer. */
export const ALWAYS_SHOW_CURRENCIES = ["USD", "VND"] as const;

/** Merge the page's totals with the always-show set — every
 *  {@link ALWAYS_SHOW_CURRENCIES} entry renders (defaulting to "0" when
 *  missing); any extra currencies the page supplies append after. */
export function mergeBatchTotals(totals: BatchFooterTotal[]): BatchFooterTotal[] {
    const byCurrency = new Map(totals.map((tot) => [tot.currency, tot]));
    const merged: BatchFooterTotal[] = [];
    for (const ccy of ALWAYS_SHOW_CURRENCIES) {
        merged.push(byCurrency.get(ccy) ?? { currency: ccy, amount: "0" });
    }
    for (const tot of totals) {
        if (
            !ALWAYS_SHOW_CURRENCIES.includes(
                tot.currency as (typeof ALWAYS_SHOW_CURRENCIES)[number],
            )
        ) {
            merged.push(tot);
        }
    }
    return merged;
}

/** One footer total label — `Total <ccy> : <amount>`. */
function BatchFooterTotalLabel({ currency, amount }: BatchFooterTotal) {
    const { t } = useTranslation();
    return (
        <>
            {t("payment.internal.footer_total", { currency })}
            {" : "}
            <span className="font-semibold">{amount}</span>
        </>
    );
}

export type BatchFooterCell = { content?: React.ReactNode };

/**
 * Map the count label + currency totals onto the ordered column slots.
 *
 *  - The count label sits in `countSlotKey` (the Date/Time column),
 *    falling back to the first column when that slot is hidden.
 *  - The currency totals fill consecutive columns starting at
 *    `amountSlotKey` (the Total Transfer Amount column) — Total USD in
 *    that column, Total VND in the next, etc. — exactly like Approval Box
 *    spreads its totals across consecutive columns. The trailing ACTION
 *    column never receives a total.
 */
export function placeBatchFooterCells(
    slotKeys: string[],
    opts: {
        countLabel: string;
        countSlotKey: string;
        amountSlotKey: string;
        totals: BatchFooterTotal[];
    },
): BatchFooterCell[] {
    const cells: BatchFooterCell[] = slotKeys.map(() => ({}));

    let countIdx = slotKeys.indexOf(opts.countSlotKey);
    if (countIdx < 0) countIdx = 0;
    cells[countIdx] = { content: opts.countLabel };

    let amountIdx = slotKeys.indexOf(opts.amountSlotKey);
    if (amountIdx < 0) amountIdx = Math.min(countIdx + 1, slotKeys.length - 1);

    opts.totals.forEach((tot, i) => {
        const pos = amountIdx + i;
        if (
            pos >= 0 &&
            pos < slotKeys.length &&
            pos !== countIdx &&
            slotKeys[pos] !== "ACTION"
        ) {
            cells[pos] = {
                content: (
                    <BatchFooterTotalLabel
                        currency={tot.currency}
                        amount={tot.amount}
                    />
                ),
            };
        }
    });

    return cells;
}

/**
 * Sibling-table footer renderer — one `<td>` per cell, sharing the main
 * table's `<colgroup>` + `min-width`. `sticky bottom-0` keeps it pinned to
 * the bottom of the scroll container while many rows scroll; the caller's
 * `mt-auto` bottom-anchors it when rows are few. Matches the Approval Box
 * footer chrome: `h-[55px]`, `px-2.5 py-2`, `border-t` (from
 * `DataTableFooter`), `text-wb-13`.
 */
export default function PaymentBatchTableFooter({
    colgroup,
    minWidth,
    cells,
    className,
}: {
    colgroup: React.ReactNode;
    minWidth?: string;
    cells: BatchFooterCell[];
    className?: string;
}) {
    return (
        <DataTableFooter
            colgroup={colgroup}
            minWidth={minWidth}
            className={cn("sticky bottom-0 z-20 h-[50px]", className)}
        >
            <tr className="h-[50px]">
                {cells.map((cell, i) => (
                    <td
                        key={i}
                        className="whitespace-nowrap px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink"
                    >
                        {cell.content ?? null}
                    </td>
                ))}
            </tr>
        </DataTableFooter>
    );
}
