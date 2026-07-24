"use client";

import { cn } from "@/lib/utils";
import type { TaxFilingStatus } from "./types";

const STATUS_CLASSES: Record<TaxFilingStatus, string> = {
    confirmed: "bg-[#dcfce7] border border-[#bbf7d0] text-[#14532d]",
    draft:     "bg-[#f5f5f5] border border-[#e5e5e5] text-[#a3a3a3]",
    submitted: "bg-brand-softer border border-brand text-brand-active",
    cancelled: "bg-wb-status-rejected-bg border border-wb-status-rejected-text/20 text-wb-status-rejected-text",
};

const STATUS_LABELS: Record<TaxFilingStatus, string> = {
    confirmed: "Confirmed",
    draft:     "Draft",
    submitted: "Submitted",
    cancelled: "Cancelled",
};

type Props = { status: TaxFilingStatus; className?: string };

export default function TaxFilingStatusBadge({ status, className }: Props) {
    return (
        <span
            className={cn(
                "inline-flex h-7 items-center rounded-[6px] px-1.5 text-wb-13 font-medium",
                STATUS_CLASSES[status],
                className,
            )}
        >
            {STATUS_LABELS[status]}
        </span>
    );
}
