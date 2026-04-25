"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import IconInput from "@/components/auth/IconInput";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    /** Icon shown on the left of the input. */
    iconSrc?: string;
    /** A11y label for the show/hide toggle. */
    toggleShowLabel?: string;
    /** A11y label for the hide toggle state. */
    toggleHideLabel?: string;
};

/**
 * Password input with a leading lock icon and a trailing
 * show/hide toggle. Keeps the toggle's visibility state local
 * so consumers never have to re-implement it.
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
    {
        iconSrc = "/images/login/ico-lock.svg",
        toggleShowLabel = "Show password",
        toggleHideLabel = "Hide password",
        ...props
    },
    ref,
) {
    const [visible, setVisible] = useState(false);
    return (
        <IconInput
            ref={ref}
            iconSrc={iconSrc}
            type={visible ? "text" : "password"}
            hasEndAdornment
            endAdornment={
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? toggleHideLabel : toggleShowLabel}
                    aria-pressed={visible}
                    className="flex size-[22px] items-center justify-center rounded text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 lg:size-[24px]"
                >
                    {visible ? (
                        <EyeOff className="size-[18px] lg:size-[20px]" />
                    ) : (
                        <Eye className="size-[18px] lg:size-[20px]" />
                    )}
                </button>
            }
            {...props}
        />
    );
});

export default PasswordInput;
