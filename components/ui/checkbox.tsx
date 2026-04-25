"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
    return (
        <CheckboxPrimitive.Root
            ref={ref}
            data-slot="checkbox"
            className={cn(
                "peer size-4 shrink-0 rounded-[4px] border border-input bg-background shadow-xs outline-none transition-shadow",
                "focus-visible:border-[var(--color-brand)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-brand)]/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[state=checked]:bg-[var(--color-brand)] data-[state=checked]:border-[var(--color-brand)] data-[state=checked]:text-white",
                "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="flex items-center justify-center text-current transition-none"
            >
                <CheckIcon className="size-3.5" />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});

export { Checkbox };
