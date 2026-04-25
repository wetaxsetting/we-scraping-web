"use client";

import { cn } from "@/lib/utils";

export type CurrencyScope = "all" | "vnd" | "fcy";

type CurrencyScopeToggleProps = {
    value: CurrencyScope;
    onChange: (next: CurrencyScope) => void;
    labels?: Partial<Record<CurrencyScope, string>>;
    className?: string;
};

const DEFAULT_ORDER: CurrencyScope[] = ["all", "fcy", "vnd"];

/**
 * Currency-scope radio group reused on every Banking report filter row
 * ("All Currency / FCY / VND"). Uses the shared wb-14 filter typography
 * and the brand-blue dot that appears in the Figma report frames.
 */
export default function CurrencyScopeToggle({
    value,
    onChange,
    labels,
    className,
}: CurrencyScopeToggleProps) {
    const fallback: Record<CurrencyScope, string> = {
        all: "All Currency",
        vnd: "VND",
        fcy: "FCY",
    };
    return (
        <div className={cn("flex flex-wrap items-center gap-4", className)}>
            {DEFAULT_ORDER.map((key) => {
                const active = key === value;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        className="flex cursor-pointer items-center gap-2.5"
                        aria-pressed={active}
                    >
                        <span
                            className={cn(
                                "relative flex size-[18px] shrink-0 items-center justify-center rounded-full border bg-white",
                                active
                                    ? "border-brand"
                                    : "border-wb-ntrl-4",
                            )}
                        >
                            {active && (
                                <span className="size-2 rounded-full bg-brand" />
                            )}
                        </span>
                        <span className="text-wb-14-tight font-medium text-wb-ntrl-8">
                            {labels?.[key] ?? fallback[key]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
