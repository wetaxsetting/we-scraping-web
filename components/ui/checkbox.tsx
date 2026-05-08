"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * shadcn/Radix checkbox primitive. Supports three states:
 *   - `checked={false}`              — empty box
 *   - `checked={true}`               — brand bg + check glyph
 *   - `checked="indeterminate"`      — brand bg + minus glyph
 *
 * The indeterminate visual is opt-in: callers that pass a boolean only
 * never see the minus state. Used by every "select all on page" header
 * (Operation Status, future Permission dialogs, …) to mirror the
 * partial-selection visual the legacy WeCMS system shows.
 */
const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
    return (
        <CheckboxPrimitive.Root
            ref={ref}
            data-slot="checkbox"
            className={cn(
                // `group/cb` so the Indicator children can read the
                // Root's data-state via Tailwind's named-group syntax
                // (`group-data-[state=…]/cb:block`).
                "group/cb peer size-4 shrink-0 rounded-[4px] border border-input bg-background shadow-xs outline-none transition-shadow",
                "focus-visible:border-[var(--color-brand)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-brand)]/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[state=checked]:bg-[var(--color-brand)] data-[state=checked]:border-[var(--color-brand)] data-[state=checked]:text-white",
                "data-[state=indeterminate]:bg-[var(--color-brand)] data-[state=indeterminate]:border-[var(--color-brand)] data-[state=indeterminate]:text-white",
                "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="flex items-center justify-center text-current transition-none"
            >
                {/* Radix renders the Indicator for both `checked` and
                   `indeterminate` states; the data-state attribute on the
                   Root tells Tailwind which glyph to show. */}
                <CheckIcon
                    className="hidden size-3.5 group-data-[state=checked]/cb:block"
                    strokeWidth={3}
                />
                <MinusIcon
                    className="hidden size-3.5 group-data-[state=indeterminate]/cb:block"
                    strokeWidth={3}
                />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});

export { Checkbox };
