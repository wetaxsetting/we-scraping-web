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
    | "neutral"
    | "warning";

type StatusPillProps = {
    label: string;
    variant: StatusPillVariant;
    /** `md` (default, 14px) for list tables; `sm` (12px) for dense WeInvoice cells. */
    size?: "sm" | "md";
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
    warning: {
        bg: "bg-wb-warn-bg",
        text: "text-wb-warn-text",
        border: "border-wb-warn-border/40",
    },
};

export default function StatusPill({ label, variant, size = "md", className }: StatusPillProps) {
    const s = variantStyles[variant];
    return (
        <span
            className={cn(
                "inline-flex items-center whitespace-nowrap rounded-md border px-[7px] py-0.5 font-medium",
                size === "sm" ? "text-wb-12" : "text-wb-14-loose",
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

export { StatusPill };
