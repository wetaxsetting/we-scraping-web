"use client";

import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type OptionItem = string | { value: string; label: string };

type Props = {
    options: OptionItem[];
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    /** Optional icon rendered inside the trigger, before the label. */
    leadingIcon?: React.ReactNode;
    /** Optional icon rendered inside the trigger, after the label (replaces ChevronDown when provided). */
    trailingIcon?: React.ReactNode;
    /** When true the default ChevronDown glyph is hidden. */
    hideChevron?: boolean;
    /**
     * Stable hook for the browser tests. The trigger gets `{testId}`, each
     * option gets `{testId}-option-{value}` — keyed by the option VALUE, never
     * its label, so a translation change or a copy edit cannot break a test for
     * a reason unrelated to the behaviour under test.
     */
    testId?: string;
};

function optValue(o: OptionItem) { return typeof o === "string" ? o : o.value; }
function optLabel(o: OptionItem) { return typeof o === "string" ? o : o.label; }

/**
 * Feature-local dropdown for Tax Filing period pickers and filter dropdowns.
 * Accepts plain string[] or { value, label }[] for localised option lists.
 */
export default function TaxFilingDropdown({ options, value, onChange, placeholder, className, leadingIcon, trailingIcon, hideChevron, testId }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const activeLabel = options.find((o) => optValue(o) === value);

    return (
        <div ref={ref} className={cn("relative", className)}>
            <button
                type="button"
                data-testid={testId}
                onClick={() => setOpen((o) => !o)}
                className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-wb-border bg-white px-3 text-wb-13 font-medium text-wb-ink hover:bg-black/[0.02]"
            >
                <span className="flex min-w-0 items-center gap-1.5">
                    {leadingIcon}
                    <span className="truncate">
                        {activeLabel ? optLabel(activeLabel) : (placeholder ?? value)}
                    </span>
                </span>
                {trailingIcon ?? (!hideChevron && <ChevronDown className="size-4 shrink-0 text-wb-ntrl-6" />)}
            </button>
            {open && (
                <div className="custom-scrollbar-y absolute top-full z-[200] mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card">
                    {options.map((opt) => (
                        <button
                            key={optValue(opt)}
                            type="button"
                            data-testid={testId ? `${testId}-option-${optValue(opt)}` : undefined}
                            onClick={() => { onChange(optValue(opt)); setOpen(false); }}
                            className="flex w-full items-center justify-between px-3 py-2 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-sidebar"
                        >
                            <span>{optLabel(opt)}</span>
                            {optValue(opt) === value && <Check className="size-4 shrink-0 text-brand" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
