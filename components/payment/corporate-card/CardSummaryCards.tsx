"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { CardSummary } from "./types";

type CardSummaryCardsProps = {
    summary: CardSummary;
    className?: string;
};

/**
 * Three summary tiles at the top of Card Transactions. Visual style
 * mirrors the Banking &gt; Account Inquiry summary tile
 * ({@code components/shared/AccountInquiryPage.tsx} → {@code SummaryTile})
 * &mdash; brand-coloured title + rounded count chip on top, large
 * right-aligned amount below, off-white card background.
 *
 * <p>The three variants colour the title + count chip but share the
 * same compact layout so the row reads as a single dashboard pane:
 * <ul>
 *   <li>{@code total} &mdash; brand blue (matches the page title)</li>
 *   <li>{@code not-requested} &mdash; status-rejected red</li>
 *   <li>{@code requested} &mdash; status-approved green</li>
 * </ul>
 */
export default function CardSummaryCards({ summary, className }: CardSummaryCardsProps) {
    const { t } = useTranslation();
    return (
        <div className={cn("flex shrink-0 flex-wrap gap-4", className)}>
            <SummaryTile
                label={t("payment.card.summary.total")}
                count={summary.total}
                amount={summary.totalAmount}
                variant="total"
            />
            <SummaryTile
                label={t("payment.card.summary.approval_not_requested")}
                count={summary.approvalNotRequested}
                amount={summary.approvalNotRequestedAmount}
                variant="not-requested"
            />
            <SummaryTile
                label={t("payment.card.summary.approval_requested")}
                count={summary.approvalRequested}
                amount={summary.approvalRequestedAmount}
                variant="requested"
            />
        </div>
    );
}

type SummaryVariant = "total" | "not-requested" | "requested";

type SummaryTileProps = {
    label: string;
    count: number;
    amount: string;
    variant: SummaryVariant;
};

/** Title text colour per variant. Brand blue for TOTAL keeps it the
 *  primary KPI; status-rejected / status-approved tokens carry the
 *  red / green semantic — same shades used by the StatusBadge. */
const TITLE_COLOR: Record<SummaryVariant, string> = {
    total:           "text-brand",
    "not-requested": "text-wb-status-rejected-text",
    requested:       "text-wb-status-approved-text",
};

/** Count-chip background tint per variant. {@code brand-softer} for
 *  TOTAL matches the Account Inquiry tile precedent; the status
 *  variants use the matching {@code wb-status-*-bg} tokens. */
const CHIP_BG: Record<SummaryVariant, string> = {
    total:           "bg-brand-softer",
    "not-requested": "bg-wb-status-rejected-bg",
    requested:       "bg-wb-status-approved-bg",
};

/**
 * Single summary tile — title + count chip top-left, amount bottom-right.
 * Fixed 270px width (literal — narrower than the Account Inquiry tile to
 * match Figma) with {@code min-w} + {@code shrink-0} so every tile is exactly
 * 270px regardless of content length; the row's leftover space ends up on the
 * right. Literal px (not a theme var) is deliberate: a newly-added
 * {@code @theme inline} variable only resolves after Tailwind regenerates its
 * theme CSS, which can desync from a hot-reloaded build and silently fall back
 * to {@code width:auto} (content-sized). The compact 78px height trims the
 * vertical white space so the amount sits at the lower-right.
 */
function SummaryTile({ label, count, amount, variant }: SummaryTileProps) {
    return (
        <div className="flex h-[78px] w-[270px] min-w-[270px] shrink-0 flex-col justify-between rounded-md border border-wb-border-sidebar bg-wb-bg-card px-4 py-3">
            {/* Title row — label top-left + count chip beside it */}
            <div className="flex items-center gap-1.5">
                <p className={cn("text-wb-12 font-bold uppercase tracking-wide", TITLE_COLOR[variant])}>
                    {label}
                </p>
                <span className={cn("flex items-center rounded-full px-1.5 py-0.5", CHIP_BG[variant])}>
                    <span className={cn("text-wb-10 font-bold", TITLE_COLOR[variant])}>
                        {count}
                    </span>
                </span>
            </div>

            {/* Amount — bottom-right (mirrors Account Inquiry's
                "Available Balance" row). */}
            <div className="flex w-full items-center justify-end">
                <span className="text-wb-16 font-semibold text-wb-ink">{amount}</span>
            </div>
        </div>
    );
}
