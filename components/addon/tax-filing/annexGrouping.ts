import type { AnnexInvoicePage, AnnexInvoiceRow, AnnexTaxGroup } from "./types";

/** One VAT-rate group as rendered: header row + its invoice rows. */
export type AnnexDisplayGroup = {
    /** `vat_rate_order` — drives the group header's leading number. */
    order: number;
    /** `vat_rate` of the group, e.g. `"8%"` / `"KKKNT"`. */
    vatRate: string;
    /** Rows of the current page, numbered from 1 within the group. */
    rows: (AnnexInvoiceRow & { no: number })[];
};

/**
 * Shape one page of annex invoices for the BKBR / BKMV listings.
 *
 * Both tabs render the same structure — rows bucketed by `vat_rate_order` with a
 * header and a subtotal per bucket — so the grouping lives here rather than
 * being duplicated per tab (CLAUDE.md §1, the two-call rule).
 *
 * Two things are deliberate:
 *
 * - Only groups present on the **current page** are returned, so paging counts
 *   invoice lines rather than groups.
 * - Subtotals come from `tax_groups` (whole filtered set), not from summing the
 *   page, so a group that straddles pages still shows its full subtotal. They
 *   are keyed by `tax_rate_label` so a change in backend ordering can't shift
 *   the wrong total onto a group.
 */
export function groupAnnexRows(data: AnnexInvoicePage | null | undefined): {
    groups: AnnexDisplayGroup[];
    /** Subtotal lookup keyed by the group's `vatRate`. */
    groupTotals: Map<string, AnnexTaxGroup>;
    grandTotal: AnnexTaxGroup | null;
} {
    const buckets = new Map<number, AnnexInvoiceRow[]>();
    for (const row of data?.rows ?? []) {
        const bucket = buckets.get(row.vatRateOrder) ?? [];
        bucket.push(row);
        buckets.set(row.vatRateOrder, bucket);
    }

    return {
        groups: [...buckets.entries()].map(([order, rows]) => ({
            order,
            vatRate: rows[0]?.vatRate ?? "",
            rows: rows.map((row, i) => ({ ...row, no: i + 1 })),
        })),
        groupTotals: new Map(
            (data?.taxGroups ?? []).map((g) => [g.taxRateLabel ?? g.groupCd, g]),
        ),
        grandTotal: data?.grandTotal ?? null,
    };
}
