"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type BatchFooterTotal = { currency: string; amount: string };

type BatchListStickyFooterProps = {
    /** Pre-translated count label rendered on the left edge — e.g.
     *  {@code "8 file(s)"}. Optional: passing an empty string hides the
     *  cell. */
    countLabel?: string;
    /** Per-currency totals rendered across the middle of the bar. Each
     *  entry shows as {@code "Total <currency> : <amount>"}. The shared
     *  set of legacy currencies (USD / VND / KRW) is always rendered —
     *  any missing currencies default to {@code "0"} so the bar reads
     *  the same regardless of whether the page has rows for them. */
    totals: BatchFooterTotal[];
    className?: string;
};

/** Default currencies always shown for batch-file Scheduled / Result
 *  pages — USD + VND. KRW is intentionally excluded; the legacy live
 *  WeCMS Internal Transfer / Vendor / Expense / Payroll / Overseas
 *  pages do NOT denominate transactions in KRW so emitting a
 *  "Total KRW : 0" row reads as visual noise. Approval Box keeps its
 *  own three-currency footer ([ApprovalTableFooter](../approval-box/ApprovalTableFooter.tsx))
 *  unchanged. Any extra currencies the page supplies (e.g. overseas
 *  FCY) append after USD + VND. */
const ALWAYS_SHOW_CURRENCIES = ["USD", "VND"] as const;

/**
 * Sticky summary bar for batch-file Scheduled / Result pages. Mirrors
 * the Approval Box footer shape (CLAUDE.md §7a
 * `paginationWithStickyFooter`) — a flex-grid bar at viewport width
 * that stays pinned to the bottom-left of the visible scroll viewport
 * when the user pans the wide batch-list table sideways. The doc
 * count anchors on the left; currency totals spread across the middle;
 * two empty cells on the right preserve the legacy live-system layout
 * where the right portion of the bar reads as intentional breathing
 * room.
 *
 * 6-column grid scales gracefully: 1 currency leaves 4 right-side
 * blanks; 3 currencies fill cols 2-4 with the same breathing room as
 * Approval Box. Pages that need a different layout extend this
 * component instead of forking it locally.
 */
export default function BatchListStickyFooter({
    countLabel,
    totals,
    className,
}: BatchListStickyFooterProps) {
    const { t } = useTranslation();

    // Merge the caller's totals with the always-show currencies — every
    // {@link ALWAYS_SHOW_CURRENCIES} entry renders (defaulting to "0"
    // when missing), and any extra currencies the page supplied append
    // after the standard set. Same UX as Approval Box where USD / VND /
    // KRW always render even when one (or all) have no rows.
    const totalsByCurrency = new Map(totals.map((t) => [t.currency, t]));
    const mergedTotals: BatchFooterTotal[] = [];
    for (const ccy of ALWAYS_SHOW_CURRENCIES) {
        const found = totalsByCurrency.get(ccy);
        mergedTotals.push(found ?? { currency: ccy, amount: "0" });
    }
    for (const t of totals) {
        if (!ALWAYS_SHOW_CURRENCIES.includes(t.currency as (typeof ALWAYS_SHOW_CURRENCIES)[number])) {
            mergedTotals.push(t);
        }
    }

    return (
        <div
            className={cn(
                "grid w-full shrink-0 grid-cols-6 items-center gap-x-4 gap-y-2 px-4 py-3",
                className,
            )}
        >
            {/* Col 1 — doc / file count, left edge */}
            <span className="whitespace-nowrap text-wb-13 font-medium text-wb-ink">
                {countLabel ?? ""}
            </span>

            {/* Cols 2..N+1 — currency totals */}
            {mergedTotals.map((total) => (
                <span
                    key={total.currency}
                    className="whitespace-nowrap text-wb-13 font-medium text-wb-ink"
                >
                    {t("payment.internal.footer_total", { currency: total.currency })}
                    {" : "}
                    <span className="font-semibold">{total.amount}</span>
                </span>
            ))}

            {/* Remaining cols — right-side breathing room (mirrors
                legacy live system + Approval Box). Pad up to 6 cells. */}
            {Array.from({ length: Math.max(0, 5 - mergedTotals.length) }).map((_, i) => (
                <span key={`pad-${i}`} aria-hidden />
            ))}
        </div>
    );
}
