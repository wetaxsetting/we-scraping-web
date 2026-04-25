import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
    id: string;
    label: string;
    labelSrOnly?: boolean;
    children: ReactNode;
    className?: string;
};

/**
 * Wraps a form control with its (visually hidden by default) label so screen
 * readers still announce the field.
 *
 * Inline error text is intentionally not rendered here: validation feedback
 * across the app flows through the shared dialog system (see `useDialog()`).
 * Red-border affordance for invalid fields is still provided via the input's
 * `aria-invalid` styling, not by this wrapper.
 */
export default function FormField({
    id,
    label,
    labelSrOnly = true,
    children,
    className,
}: FormFieldProps) {
    return (
        <div className={cn("flex flex-col gap-[6px]", className)}>
            <Label htmlFor={id} className={cn(labelSrOnly && "sr-only")}>
                {label}
            </Label>
            {children}
        </div>
    );
}
