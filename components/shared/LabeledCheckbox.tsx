"use client";

import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * shadcn `<Checkbox>` + optional label with a boolean `onChange` — the shape
 * every WeInvoice filter / table-selection checkbox uses. Clicks never
 * bubble to a clickable table row (`data-ignore-row-click`).
 */
export function LabeledCheckbox({
    checked,
    indeterminate,
    onChange,
    label,
    className,
    disabled,
}: {
    checked: boolean;
    indeterminate?: boolean;
    onChange: (next: boolean) => void;
    label?: ReactNode;
    className?: string;
    disabled?: boolean;
}) {
    return (
        <label
            data-ignore-row-click
            className={cn("inline-flex cursor-pointer items-center gap-2 select-none", disabled && "cursor-not-allowed opacity-50", className)}
            onClick={(e) => e.stopPropagation()}
        >
            <Checkbox
                checked={indeterminate ? "indeterminate" : checked}
                disabled={disabled}
                onCheckedChange={() => onChange(!checked)}
                className="cursor-pointer border-wb-ntrl-5"
            />
            {label != null && <span className="text-wb-13 font-medium text-wb-ink">{label}</span>}
        </label>
    );
}
