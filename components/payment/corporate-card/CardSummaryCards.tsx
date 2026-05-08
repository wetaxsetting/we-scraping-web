"use client";

import { cn } from "@/lib/utils";

import type { CardSummary } from "./types";

type CardSummaryCardsProps = {
    summary: CardSummary;
    className?: string;
};

/**
 * Three summary tiles at the top of Card Transactions (Figma 45:18250):
 *  - TOTAL (blue badge)
 *  - APPROVAL NOT REQUESTED (red label + badge)
 *  - APPROVAL REQUESTED (green label + badge)
 */
export default function CardSummaryCards({ summary, className }: CardSummaryCardsProps) {
    return (
        <div className={cn("flex shrink-0 flex-wrap gap-4", className)}>
            <SummaryCard
                label="TOTAL"
                count={summary.total}
                amount={summary.totalAmount}
                variant="total"
            />
            <SummaryCard
                label="APPROVAL NOT REQUESTED"
                count={summary.approvalNotRequested}
                amount={summary.approvalNotRequestedAmount}
                variant="not-requested"
            />
            <SummaryCard
                label="APPROVAL REQUESTED"
                count={summary.approvalRequested}
                amount={summary.approvalRequestedAmount}
                variant="requested"
            />
        </div>
    );
}

type SummaryCardVariant = "total" | "not-requested" | "requested";

type SummaryCardProps = {
    label: string;
    count: number;
    amount: string;
    variant: SummaryCardVariant;
};

const VARIANT_LABEL_COLOR: Record<SummaryCardVariant, string> = {
    total: "text-wb-dark",
    "not-requested": "text-[#c50712]",
    requested: "text-[#04662e]",
};

const VARIANT_BADGE_BG: Record<SummaryCardVariant, string> = {
    total: "bg-brand text-white",
    "not-requested": "bg-[#fce9eb] text-[#c50712]",
    requested: "bg-[#e9f5ee] text-[#04662e]",
};

function SummaryCard({ label, count, amount, variant }: SummaryCardProps) {
    return (
        <div className="flex min-w-[240px] flex-1 items-stretch rounded-md border border-wb-border-sidebar bg-white shadow-wb-card">
            <div className="flex flex-col gap-2 px-4 py-3">
                {/* Label row */}
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "text-wb-11 font-semibold uppercase tracking-wide",
                            VARIANT_LABEL_COLOR[variant],
                        )}
                    >
                        {label}
                    </span>
                    <span
                        className={cn(
                            "inline-flex min-w-[18px] items-center justify-center rounded-[4px] px-1 text-wb-10 font-bold",
                            VARIANT_BADGE_BG[variant],
                        )}
                    >
                        {count}
                    </span>
                </div>

                {/* Amount */}
                <p className="text-wb-16 font-bold text-wb-ink">{amount}</p>
            </div>
        </div>
    );
}
