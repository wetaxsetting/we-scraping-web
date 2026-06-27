import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "./types";

/**
 * Status pill — colours come from the Figma WB365 Red / Green / Blue ramps
 * wired as tokens in `app/globals.css` (`--color-wb-status-*`). Pair the
 * filled background with a matching 10%-opacity border so the pill reads
 * clearly on both white and the sidebar-grey table header.
 */

type StatusBadgeProps = {
    status: ApprovalStatus;
    /** Optional progress indicator, e.g. "1/3" for `in_progress`. */
    step?: string;
    /** Translated label (fallback: capitalised status key). */
    label?: string;
    className?: string;
};

const statusStyles: Record<ApprovalStatus, { bg: string; text: string; border: string }> = {
    draft: {
        bg: "bg-wb-status-draft-bg",
        text: "text-wb-status-draft-text",
        border: "border-black/10",
    },
    pending: {
        bg: "bg-wb-status-pending-bg",
        text: "text-wb-status-pending-text",
        border: "border-wb-status-pending-text/10",
    },
    in_progress: {
        bg: "bg-wb-status-progress-bg",
        text: "text-wb-status-progress-text",
        border: "border-wb-status-progress-text/10",
    },
    approved: {
        bg: "bg-wb-status-approved-bg",
        text: "text-wb-status-approved-text",
        border: "border-wb-status-approved-text/10",
    },
    rejected: {
        bg: "bg-wb-status-rejected-bg",
        text: "text-wb-status-rejected-text",
        border: "border-wb-status-rejected-text/10",
    },
};

const fallbackLabel: Record<ApprovalStatus, string> = {
    draft: "Draft",
    pending: "Pending",
    in_progress: "In Progress",
    approved: "Approved",
    rejected: "Rejected",
};

export default function StatusBadge({ status, step, label, className }: StatusBadgeProps) {
    const s = statusStyles[status];
    const text = label ?? fallbackLabel[status];
    // Legacy `fn_apprStt` parity: the "approved/total" progress count is
    // appended ONLY for Approved ("Approved 2/2") and In Progress
    // ("In Progress 1/2"). Pending / Rejected / Draft NEVER show a count —
    // legacy guards on `if (APPRVR_TOT_CNT && APPRVR_APPR_TOT_CNT)` inside the
    // Approved / In-Progress branches only. Enforced here at the single shared
    // badge so no caller can produce "Rejected 0/1" or "Pending 0/2".
    const showStep = !!step && (status === "approved" || status === "in_progress");
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-[6px] border px-[7px] text-wb-14-loose font-medium",
                s.bg,
                s.text,
                s.border,
                className,
            )}
        >
            {showStep ? `${text} ${step}` : text}
        </span>
    );
}
