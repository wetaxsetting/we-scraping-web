"use client";

import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type MenuEntitlementRowProps = {
    /** Optional leading icon — used by section-header rows (Banking, …). */
    icon?: ReactNode;
    /** Row label rendered in the left column. Spans columns 1+2 of the
     *  parent grid via `col-span-2`. */
    label: string;
    /** Set to `false` to suppress the bottom border (last row of a panel). */
    bordered?: boolean;
    /** Bumps font weight to semibold — used for the top "Allow full
     *  menu access" row + every section header. */
    bold?: boolean;
    /** Controlled checkbox state. Edit mode binds it to the panel's
     *  draft set; view mode renders read-only via `disabled`. */
    checked?: boolean;
    /** Edit-mode toggle handler. Omit to render disabled (view mode). */
    onCheckedChange?: (checked: boolean) => void;
    /** Disable the checkbox without changing visual weight — used for
     *  view mode. */
    disabled?: boolean;
};

/**
 * Single permission row that spans the parent grid's category + item
 * columns and lays a checkbox in the third column. Used for:
 *   · the top "Allow full menu access" row (no icon)
 *   · each section header (Banking, Payment, Add-on Service, Settings)
 *
 * Per-group sub-item rows live inside `<MenuEntitlementSection>` and
 * use the grid directly (so the category cell can `grid-row: span N`
 * over its items).
 */
export default function MenuEntitlementRow({
    icon,
    label,
    bordered = true,
    bold = true,
    checked,
    onCheckedChange,
    disabled = false,
}: MenuEntitlementRowProps) {
    const borderClass = bordered ? "border-b border-wb-ntrl-3" : "";
    return (
        <>
            <div
                className={cn(
                    "col-span-2 flex items-center gap-2 py-3 pr-3 text-wb-13 text-wb-ink",
                    bold ? "font-semibold" : "font-medium",
                    borderClass,
                )}
            >
                {icon}
                <span>{label}</span>
            </div>
            <div className={cn("flex items-center justify-end py-3 pr-2", borderClass)}>
                <Checkbox
                    aria-label={label}
                    checked={checked}
                    onCheckedChange={
                        onCheckedChange
                            ? (v) => onCheckedChange(v === true)
                            : undefined
                    }
                    disabled={disabled || !onCheckedChange}
                />
            </div>
        </>
    );
}
