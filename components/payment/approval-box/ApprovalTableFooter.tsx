"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { CurrencyTotal } from "./types";

type ApprovalTableFooterProps = {
    documentCount: number;
    totals: CurrencyTotal[];
    className?: string;
};

/**
 * Summary bar rendered OUTSIDE the table's horizontal scroll container
 * (CLAUDE.md §7a `paginationWithStickyFooter` mode) so it stays pinned
 * to the viewport when the user pans the wide table sideways. The
 * Approval Box totals don't column-align with the table body — the
 * currency totals are free-form text — so a flex bar at viewport width
 * is the correct shape, not a sibling `<table>` with `min-width`.
 */
export default function ApprovalTableFooter({
    documentCount,
    totals,
    className,
}: ApprovalTableFooterProps) {
    const { t } = useTranslation();

    return (
        <div
            className={cn(
                "grid w-full shrink-0 grid-cols-6 items-center gap-x-4 gap-y-2 px-4 py-3",
                className,
            )}
        >
            {/* Col 1 — doc count, left edge */}
            <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                {t("approval.document_count", { count: documentCount })}
            </span>

            {/* Cols 2-4 — currency totals positioned across the middle */}
            {totals.map((total) => (
                <span
                    key={total.currency}
                    className="whitespace-nowrap text-wb-13 font-medium text-wb-ink"
                >
                    {t("approval.total_label", { currency: total.currency })}
                    {" : "}
                    <span className="font-semibold">{total.total}</span>
                </span>
            ))}

            {/* Cols 5-6 — intentional right-side breathing room, mirrors the
                legacy live system where the right portion of the footer
                bar stays empty so the totals visually anchor in the
                middle-left of the viewport. */}
            <span aria-hidden />
            <span aria-hidden />
        </div>
    );
}
