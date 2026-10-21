import type { AnnexInvoicePage, AnnexInvoiceRow, AnnexTaxGroup } from "./types";

/** One VAT-rate group as rendered: header row + its invoice rows. */
export type AnnexDisplayGroup = {
    /** `vat_rate_order` — drives the group header's leading number. */
    order: number;
    /** `vat_rate` of the group, e.g. `"8%"` / `"KKKNT"`. */
    vatRate: string;
    /** Rows of the current page. `no` counts from 1 at the group's first row in
     *  the whole filtered set, so a group spanning pages keeps counting up. */
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
 * - Row numbers continue across pages. A group of 18 invoices split 8 / 10 over
 *   two pages numbers 1-8 then 9-18, not 1-8 then 1-10: the number identifies an
 *   invoice inside its group on the filed listing, so restarting it per page
 *   would print two rows claiming to be "1" in the same group.
 * - Subtotals come from `tax_groups` (whole filtered set), not from summing the
 *   page, so a group that straddles pages still shows its full subtotal. They
 *   are keyed by `tax_rate_label` so a change in backend ordering can't shift
 *   the wrong total onto a group.
 */
/**
 * Where each group starts in the whole filtered set, as a 0-based row index.
 *
 * `tax_groups` carries the row count of every group across the whole set (not
 * just this page) and arrives in group order — the backend builds it from the
 * same query that orders the rows. Running those counts up gives the offset a
 * page needs to keep numbering a group it inherited from the page before.
 *
 * A group may arrive with no label at all (the live set carries one such bucket
 * of 2 rows). It still occupies positions in the ordering, so its count has to
 * be added up — dropping it shifts every group after it. It just cannot be
 * looked up, so its own rows fall back to per-page numbering.
 *
 * Returns `null` when the counts cannot be trusted, in which case the caller
 * numbers from 1 per page rather than printing numbers that are confidently
 * wrong.
 */
function groupStartIndexes(
    data: AnnexInvoicePage | null | undefined,
): Map<string, number> | null {
    const groups = (data?.taxGroups ?? []).filter((g) => g.groupCd !== "TOTAL");
    if (groups.length === 0) return null;

    const starts = new Map<string, number>();
    let acc = 0;
    for (const g of groups) {
        if (!Number.isFinite(g.rowCount) || g.rowCount < 0) return null;
        const label = g.taxRateLabel ?? g.groupCd;
        if (label != null) starts.set(label, acc);
        acc += g.rowCount;
    }
    // The counts have to describe the same set the rows came from.
    if (data?.totalCount != null && acc !== data.totalCount) return null;

    return starts;
}

export function groupAnnexRows(data: AnnexInvoicePage | null | undefined): {
    groups: AnnexDisplayGroup[];
    /** Subtotal lookup keyed by the group's `vatRate`. */
    groupTotals: Map<string, AnnexTaxGroup>;
    grandTotal: AnnexTaxGroup | null;
} {
    // Absolute index of this page's first row within the whole filtered set.
    const pageStart = (data?.pageNumber ?? 0) * (data?.pageSize ?? 0);
    const starts = groupStartIndexes(data);

    // Bucket by group, keeping each row's position on the page so its absolute
    // index — and from that its number within the group — stays recoverable.
    const buckets = new Map<number, { row: AnnexInvoiceRow; pageIndex: number }[]>();
    (data?.rows ?? []).forEach((row, pageIndex) => {
        const bucket = buckets.get(row.vatRateOrder) ?? [];
        bucket.push({ row, pageIndex });
        buckets.set(row.vatRateOrder, bucket);
    });

    return {
        groups: [...buckets.entries()].map(([order, entries]) => {
            const vatRate = entries[0]?.row.vatRate ?? "";
            const groupStart = starts?.get(vatRate);

            // A group starting on this page must come out as 1. Anything else
            // means the counts do not line up with the rows, so fall back to
            // per-page numbering instead of printing a wrong number.
            const numbered = entries.map(({ row, pageIndex }, i) =>
                groupStart == null
                    ? { ...row, no: i + 1 }
                    : { ...row, no: pageStart + pageIndex - groupStart + 1 },
            );
            const usable = numbered.every((r, i) => r.no === numbered[0].no + i && r.no >= 1);

            return {
                order,
                vatRate,
                rows: usable ? numbered : entries.map(({ row }, i) => ({ ...row, no: i + 1 })),
            };
        }),
        groupTotals: new Map(
            (data?.taxGroups ?? []).map((g) => [g.taxRateLabel ?? g.groupCd, g]),
        ),
        grandTotal: data?.grandTotal ?? null,
    };
}
