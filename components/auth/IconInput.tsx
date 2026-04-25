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
    return (
        <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={iconSrc}
                alt=""
                aria-hidden={true}
                className="pointer-events-none absolute top-1/2 left-[12px] size-[22px] -translate-y-1/2 lg:size-[24px]"
            />
            <Input
                ref={ref}
                className={cn(
                    "h-[52px] rounded-[6px] bg-white pl-[42px] text-wb-16 font-medium tracking-wb-tighter shadow-wb-outline placeholder:text-wb-16 placeholder:text-wb-ntrl-5 focus-visible:shadow-wb-focus focus-visible:ring-0 lg:h-[56px] lg:pl-[44px] lg:text-wb-18 lg:placeholder:text-wb-18 2xl:h-[60px]",
                    reserveRight ? "pr-[48px] lg:pr-[52px]" : "pr-[12px]",
                    className,
                )}
                {...props}
            />
            {endAdornment && (
                <div className="absolute top-1/2 right-[12px] -translate-y-1/2">
                    {endAdornment}
                </div>
            )}
        </div>
    );
});

export default IconInput;
