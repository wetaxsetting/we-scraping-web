"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterSelectOption<T> = {
    value: T;
    /** Visible label inside the popover row. */
    label: string;
    /** Optional leading element (e.g. a country-flag `<img>`). */
    icon?: React.ReactNode;
};

type FilterSelectProps<T> = {
    /** Selected value — compared with `===` against `options[i].value`. */
    value: T;
    /** Options rendered in the popover, in display order. */
    options: FilterSelectOption<T>[];
    /** Selection setter. */
    onChange: (next: T) => void;
    /** ARIA label for the trigger button. */
    ariaLabel?: string;
    /** Width utility for the trigger. */
    triggerClassName?: string;
    /** Width utility for the popover (defaults to match the trigger). */
    popoverClassName?: string;
    /** Optional leading element inside the trigger (e.g. flag for the
     *  currency picker). When omitted the trigger renders just the
     *  selected option's `icon` (if any) + its `label`. */
    triggerPrefix?: React.ReactNode;
    /** Render the trigger label as a custom string instead of the
     *  selected option's `label`. Lets the consumer show e.g. just
     *  "VND" while the popover rows show "VND 🇻🇳". */
    triggerLabel?: string;
    /** Override the default chevron glyph (e.g. swap for a calendar
     *  icon on the Year picker, or a hamburger glyph on the Period
     *  picker — matches legacy `cash_0001_001` chrome). Pass `null` to
     *  hide the glyph entirely. */
    triggerIcon?: React.ReactNode | null;
    /** When true, the trigger renders flush (no border, no shadow) —
     *  suitable for embedding inside a wrapper card that owns the
     *  border. */
    flush?: boolean;
};

/**
 * Single-select dropdown with a popover list. Used by the Cash Flow
 * report's currency / year / period filters. Mirrors the legacy
 * `cash_0001_001` dropdowns (click → menu opens; clicking an option
 * commits and closes; outside-click dismisses).
 *
 * Local to the Cash Flow report for now — lift to
 * `components/shared/` if a second page adopts the same pattern (per
 * the two-call rule). The existing `<FilterDropdown>` shared chip is a
 * click-to-cycle trigger, not a popover, and intentionally stays
 * separate from this primitive.
 */
export default function FilterSelect<T>({
    value,
    options,
    onChange,
    ariaLabel,
    triggerClassName,
    popoverClassName,
    triggerPrefix,
    triggerLabel,
    triggerIcon,
    flush = false,
}: FilterSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onMouseDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [open]);

    const selected = options.find((o) => o.value === value);
    const displayLabel = triggerLabel ?? selected?.label ?? "";

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                className={cn(
                    "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center justify-between gap-2 px-3",
                    "text-wb-13 font-medium text-wb-ink",
                    flush
                        ? "bg-transparent hover:bg-black/[0.03]"
                        : "rounded-md border border-wb-ntrl-4 bg-white shadow-wb-btn hover:bg-black/[0.03]",
                    triggerClassName,
                )}
            >
                <span className="flex items-center gap-2 truncate">
                    {triggerPrefix ?? selected?.icon ?? null}
                    {displayLabel && <span className="truncate">{displayLabel}</span>}
                </span>
                {triggerIcon === null
                    ? null
                    : triggerIcon ?? (
                        <ChevronDown className="size-4 shrink-0 text-wb-ntrl-6" />
                    )}
            </button>

            {open && (
                <div
                    role="listbox"
                    className={cn(
                        "absolute left-0 top-[calc(100%+4px)] z-50",
                        "flex flex-col gap-0.5 rounded-md border border-wb-ntrl-4 bg-white p-1",
                        "shadow-[0_4px_12px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]",
                        "min-w-full",
                        popoverClassName,
                    )}
                >
                    {options.map((opt, i) => {
                        const isSelected = opt.value === value;
                        return (
                            <button
                                key={`${i}-${String(opt.value)}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "flex w-full cursor-pointer items-center justify-between gap-2",
                                    "rounded px-2 py-1.5 text-left",
                                    "text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-sidebar",
                                    isSelected && "text-brand",
                                )}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    {opt.icon}
                                    <span className="truncate">{opt.label}</span>
                                </span>
                                {isSelected && <Check className="size-3.5 shrink-0 text-brand" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
