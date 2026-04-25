"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CalendarIconButtonProps = {
    onClick?: () => void;
    className?: string;
    /** Override the default `common.open_calendar` aria-label translation key. */
    ariaLabelKey?: string;
};

/**
 * Shared calendar trigger — the canonical filter-row calendar icon used
 * everywhere a Payment / Banking / Add-on page needs a calendar affordance.
 *
 * Mirrors Approval Box exactly:
 *   • asset  → `/assets/common/ico-calendar-outline.svg`
 *   • icon   → `size-4` (16 px)
 *   • button → `size-8` (32 px) hit area, no border, no background
 *
 * Owns the visual contract so:
 *   • `<DateRangePicker>` (Approval Box, Sales / Expenses e-Invoices,
 *     Transaction History, Reports) renders this trailing the date chips.
 *   • `<ScheduledTransferPage>` and `<TransferResultPage>` render this as
 *     a sibling chip after the "Last 30 Days" period dropdown — matching
 *     the Approval Box pattern (calendar = separate button, never an icon
 *     inside a dropdown).
 *
 * Do not substitute `lucide-react`'s `<Calendar>` glyph — the design
 * system asset is a different stroke weight and proportions.
 */
export default function CalendarIconButton({
    onClick,
    className,
    ariaLabelKey = "common.open_calendar",
}: CalendarIconButtonProps) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            aria-label={t(ariaLabelKey)}
            onClick={onClick}
            className={cn(
                "flex size-8 shrink-0 cursor-pointer items-center justify-center",
                className,
            )}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/common/ico-calendar-outline.svg"
                alt=""
                aria-hidden
                className="size-4"
            />
        </button>
    );
}
