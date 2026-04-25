import { cn } from "@/lib/utils";

/**
 * Generic status pill for transaction / invoice / operation tables. Colours
 * reuse the Figma WB365 Red / Green / Blue ramps already wired as tokens in
 * `app/globals.css`. The approval-specific pill in payment/approval-box maps
 * to an enum; this one is label-only so callers can pass any short string.
 */

export type StatusPillVariant =
    | "success"
    | "pending"
    | "progress"
    | "failed"
    | "neutral";

type StatusPillProps = {
    label: string;
    variant: StatusPillVariant;
    className?: string;
};

const variantStyles: Record<StatusPillVariant, { bg: string; text: string; border: string }> = {
    success: {
        bg: "bg-wb-status-approved-bg",
        text: "text-wb-status-approved-text",
        border: "border-wb-status-approved-text/10",
    },
    pending: {
        bg: "bg-wb-status-pending-bg",
        text: "text-wb-status-pending-text",
        border: "border-wb-status-pending-text/10",
    },
    progress: {
        bg: "bg-wb-status-progress-bg",
        text: "text-wb-status-progress-text",
        border: "border-wb-status-progress-text/10",
    },
    failed: {
        bg: "bg-wb-status-rejected-bg",
        text: "text-wb-status-rejected-text",
        border: "border-wb-status-rejected-text/10",
    },
    neutral: {
        bg: "bg-wb-status-draft-bg",
        text: "text-wb-status-draft-text",
        border: "border-black/10",
    },
};

export default function StatusPill({ label, variant, className }: StatusPillProps) {
    const s = variantStyles[variant];
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
