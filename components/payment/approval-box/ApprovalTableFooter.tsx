"use client";

import DataTableFooter from "@/components/shared/DataTableFooter";
import type { ViewSettingItem } from "@/components/shared/view-setting";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ApprovalColgroup, approvalTableMinWidthPx } from "./ApprovalTable";
import type { CurrencyTotal } from "./types";

type ApprovalTableFooterProps = {
    documentCount: number;
    totals: CurrencyTotal[];
    /** The SAME visible/ordered View Setting columns the main table
     *  renders. The footer builds its `<colgroup>` + `min-width` from this
     *  list so its cells share the table's exact column widths and scroll
     *  in lockstep when the table pans horizontally. */
    items: ViewSettingItem[];
    className?: string;
};

/**
 * Summary row for the Approval Box table — a sibling `<table>` (via the
 * shared {@link DataTableFooter}) whose `<tfoot>` imports the SAME
 * `<colgroup>` the main table builds from the live View Setting. Kept as a
 * sibling (not an inline `<tfoot>`) so it can be both bottom-anchored AND
 * sticky:
 *  - `mt-auto` (passed by the page) pushes it to the bottom of the scroll
 *    area when rows are few, so empty space stays ABOVE the footer;
 *  - `sticky bottom-0` pins it to the bottom edge of the scroll container
 *    when the body overflows, so it stays visible while many rows scroll —
 *    the mirror of the sticky `<thead>` at the top.
 * It pans horizontally together with the header + body (sticky is
 * vertical-only) and the horizontal scrollbar sits just below it.
 *
 * One `<td>` per visible column — no spanning cell — so every footer cell
 * lines up under its header column:
 *  - the document count sits under the Date column;
 *  - the currency totals fill consecutive columns from Transfer Currency
 *    (e.g. Currency → USD, Transfer Amount → VND, Approval Status → KRW).
 */
export default function ApprovalTableFooter({
    documentCount,
    totals,
    items,
    className,
}: ApprovalTableFooterProps) {
    const { t } = useTranslation();

    // One footer cell per visible column, mapped by position so each value
    // lands under its header column.
    const cells: React.ReactNode[] = items.map(() => null);

    const dateIdx = items.findIndex((c) => c.field_id === "REG_DTM");
    const docIdx = dateIdx >= 0 ? dateIdx : 0;
    cells[docIdx] = t("approval.document_count", { count: documentCount });

    let anchor = items.findIndex((c) => c.field_id === "CURRENCY");
    if (anchor < 0) anchor = items.findIndex((c) => c.field_id === "TOT_PAY_AMT");
    if (anchor < 0) anchor = Math.min(docIdx + 1, items.length - 1);

    totals.forEach((tot, i) => {
        const pos = anchor + i;
        if (pos >= 0 && pos < cells.length && pos !== docIdx) {
            cells[pos] = (
                <>
                    {t("approval.total_label", { currency: tot.currency })}
                    {" : "}
                    <span className="font-semibold">{tot.total}</span>
                </>
            );
        }
    });

    return (
        <DataTableFooter
            colgroup={<ApprovalColgroup items={items} />}
            minWidth={`${approvalTableMinWidthPx(items)}px`}
            className={cn("sticky bottom-0 z-20 h-[50px]", className)}
        >
            <tr className="h-[50px]">
                {items.map((col, i) => (
                    <td
                        key={col.field_id}
                        className="whitespace-nowrap px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink"
                    >
                        {cells[i]}
                    </td>
                ))}
            </tr>
        </DataTableFooter>
    );
}
