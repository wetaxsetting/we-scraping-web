"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TaxFilingStatus } from "./types";

const STATUS_CLASSES: Record<TaxFilingStatus, string> = {
    confirmed: "bg-[#dcfce7] border border-[#bbf7d0] text-[#14532d]",
    draft:     "bg-wb-bg-sidebar border border-wb-ntrl-3 text-wb-ntrl-5",
    submitted: "bg-brand-softer border border-brand text-brand-active",
    cancelled: "bg-wb-status-rejected-bg border border-wb-status-rejected-text/20 text-wb-status-rejected-text",
};

/** i18n keys — the badge label must never be a literal (CLAUDE.md i18n rule). */
const STATUS_LABEL_KEYS: Record<TaxFilingStatus, string> = {
    confirmed: "tax_filing.status.confirmed",
    draft:     "tax_filing.status.draft",
    submitted: "tax_filing.status.submitted",
    cancelled: "tax_filing.status.cancelled",
};

type Props = { status: TaxFilingStatus; className?: string };

export default function TaxFilingStatusBadge({ status, className }: Props) {
    const { t } = useTranslation();

    return (
        <span
            className={cn(
                "inline-flex h-7 items-center rounded-[6px] px-1.5 text-wb-13 font-medium",
                STATUS_CLASSES[status],
                className,
            )}
        >
            {t(STATUS_LABEL_KEYS[status])}
        </span>
    );
}
