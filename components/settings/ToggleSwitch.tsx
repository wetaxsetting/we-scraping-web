"use client";

import { cn } from "@/lib/utils";

type ToggleTone = "warning" | "brand";

type ToggleSwitchProps = {
    checked: boolean;
    onChange?: (next: boolean) => void;
    ariaLabel: string;
    disabled?: boolean;
    /**
     * Active-state colour. `warning` (orange) is the Purpose-panel default;
     * `brand` (blue) matches Figma 134:17061 for the Firm Banking Settings
     * automation rows. Pick the variant the closest Figma frame shows —
     * never inline a custom hex.
     */
    tone?: ToggleTone;
};

/**
 * Pure-Tailwind ON/OFF switch matching the Figma settings spec —
 * 32 × 18 pill, white 14 × 14 thumb sliding 14 px across. Built as a
 * semantic `role="switch"` button so assistive tech reports its state
 * correctly. Active colour is selected via the `tone` prop.
 */
export default function ToggleSwitch({
    checked,
    onChange,
    ariaLabel,
    disabled,
    tone = "warning",
}: ToggleSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange?.(!checked)}
            className={cn(
                "relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
                checked ? (tone === "brand" ? "bg-brand" : "bg-wb-warning") : "bg-wb-ntrl-4",
                disabled && "cursor-not-allowed opacity-60",
            )}
        >
            <span
                className={cn(
                    "pointer-events-none inline-block size-[14px] rounded-full bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.2)] transition-transform",
                    checked ? "translate-x-[16px]" : "translate-x-[2px]",
                )}
            />
        </button>
    );
}
