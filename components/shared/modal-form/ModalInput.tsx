"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared text input for feature dialogs (New Firm Banking, Change Password,
 * future Settings forms). One source of truth for the Figma input chrome —
 * `h-8`, `text-wb-14 / 500`, `rounded-md`, `shadow-wb-outline`, brand focus
 * ring, and the disabled / read-only treatment. Extracted from the New Firm
 * Banking dialog (two-call rule — see wecms-web/CLAUDE.md §"Common
 * Reusability Rule").
 *
 * It is a thin `forwardRef` wrapper around a native `<input>` and spreads all
 * native props, so it works equally with a controlled `value` / `onChange`
 * pair (New Firm Banking) and a React Hook Form `{...register(...)}` spread
 * (Change Password) — RHF's ref reaches the underlying input through the
 * forwarded ref.
 */
const ModalInput = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(function ModalInput({ className, type = "text", ...props }, ref) {
    return (
        <input
            ref={ref}
            type={type}
            className={cn(
                "h-8 w-full rounded-md bg-white px-2 text-wb-14 font-medium leading-4 text-wb-ntrl-8 placeholder:text-wb-ntrl-5",
                "shadow-wb-outline outline-none",
                "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                "disabled:cursor-not-allowed disabled:bg-wb-bg-sidebar",
                className,
            )}
            {...props}
        />
    );
});

export default ModalInput;
