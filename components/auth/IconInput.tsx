import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
    /** Path to the leading icon SVG (rendered on the left of the input). */
    iconSrc: string;
    /** Optional right-aligned slot — e.g. a password show/hide button. */
    endAdornment?: ReactNode;
    /** Present when the adornment reserves horizontal space for its button. */
    hasEndAdornment?: boolean;
};

/**
 * Login-style input with a leading icon and an optional trailing
 * adornment slot. Standardizes the icon-input pattern used across
 * the auth surface so sizing, padding, and focus treatment stay
 * consistent with the Figma WB365 spec.
 */
const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
    { iconSrc, endAdornment, hasEndAdornment, className, ...props },
    ref,
) {
    const reserveRight = hasEndAdornment ?? Boolean(endAdornment);
    /*
     * Compact text field — Figma WB365 Text Field (1218:15744) baseline at
     * 15px text per the user's "compact form" pass:
     *   container: pl-[36px] py-[10px] gap-[6px] rounded-[6px]
     *              shadow-[0_0_0_1px_#d4d4d4]
     *   leading icon: size-[18px] (was 24 at 18px text)
     *   trailing icon (eye): size-[18px]
     *   text/placeholder: text-wb-15 medium #a3a3a3
     *   final height = 10 + 20 (15px line-height) + 10 = 40px
     * Height-40 fits the rebalanced auth-screen at Tablet 800h with no scroll.
     */
    return (
        <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={iconSrc}
                alt=""
                aria-hidden={true}
                className="pointer-events-none absolute top-1/2 left-[10px] size-[18px] -translate-y-1/2"
            />
            <Input
                ref={ref}
                className={cn(
                    "h-[40px] rounded-[6px] bg-white pl-[36px] text-wb-15 font-medium tracking-wb-tight shadow-wb-outline placeholder:text-wb-15 placeholder:font-medium placeholder:text-wb-ntrl-5 focus-visible:shadow-wb-focus focus-visible:ring-0",
                    reserveRight ? "pr-[36px]" : "pr-[12px]",
                    className,
                )}
                {...props}
            />
            {endAdornment && (
                <div className="absolute top-1/2 right-[10px] -translate-y-1/2">
                    {endAdornment}
                </div>
            )}
        </div>
    );
});

export default IconInput;
