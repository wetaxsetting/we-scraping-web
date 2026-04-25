import { cn } from "@/lib/utils";

import type { ResultStatus } from "./types";

/**
 * Result-status pill for the *Payment Result* / *Transfer Result* / *Card
 * Transactions* pages. Shape and typography mirror Approval Box's
 * `<StatusBadge>` but the status vocabulary here is the result-status set
 * (success / failed / pending / cancelled) — the legacy JEX system uses these
 * states for completed payments.
 */

type PaymentResultBadgeProps = {
    status: ResultStatus;
    label: string;
    className?: string;
};

const styles: Record<ResultStatus, { bg: string; text: string; border: string }> = {
    success: {
        bg: "bg-wb-status-approved-bg",
        text: "text-wb-status-approved-text",
        border: "border-wb-status-approved-text/10",
    },
    failed: {
        bg: "bg-wb-status-rejected-bg",
        text: "text-wb-status-rejected-text",
        border: "border-wb-status-rejected-text/10",
    },
    pending: {
        bg: "bg-wb-status-pending-bg",
        text: "text-wb-status-pending-text",
        border: "border-wb-status-pending-text/10",
    },
    cancelled: {
        bg: "bg-wb-status-draft-bg",
        text: "text-wb-status-draft-text",
        border: "border-black/10",
    },
};

export default function PaymentResultBadge({
    status,
    label,
    className,
}: PaymentResultBadgeProps) {
    const s = styles[status];
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-md border px-[7px] py-0.5 text-wb-14-loose font-medium",
                s.bg,
                s.text,
                s.border,
                className,
            )}
        >
            {label}
        </span>
    );
}
