"use client";

import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Popover } from "@/components/shared/Popover";
import { cn } from "@/lib/utils";

/** Filter-row single select: 32px white outlined trigger + popover option list. */
export function Select<T extends string>({
    value,
    options,
    onChange,
    prefix,
    width,
    icon,
    highlight,
    fullWidth,
}: {
    fullWidth?: boolean;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    prefix?: string;
    /** Trigger width in px (computed per filter, not a token). */
    width?: number;
    icon?: ReactNode;
    highlight?: boolean;
}) {
    const cur = options.find((o) => o.value === value);
    return (
        <Popover
            rootClassName={fullWidth ? "w-full" : undefined}
            width={fullWidth ? undefined : width ? Math.max(width, 180) : 200}
            trigger={({ toggle, open }) => (
                <button
                    type="button"
                    onClick={toggle}
                    style={width && !fullWidth ? { width } : undefined}
                    className={cn(
                        fullWidth && "w-full",
                        "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-2 rounded-md bg-white px-2.5 text-wb-13 font-medium text-wb-ink shadow-wb-outline hover:bg-wb-bg-sidebar [&_svg]:size-4 [&_svg]:shrink-0",
                        (open || highlight) && "text-brand shadow-wb-focus",
                    )}
                >
                    {icon}
                    <span className="min-w-0 flex-1 truncate text-left">
                        {prefix && <span className="text-wb-ntrl-6">{prefix}: </span>}
                        {cur?.label}
                    </span>
                    <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
                </button>
            )}
        >
            {(close) => (
                <div className="custom-scrollbar-y max-h-[320px] overflow-auto py-1">
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                                onChange(o.value);
                                close();
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-wb-13 font-medium hover:bg-wb-bg-sidebar",
                                o.value === value ? "text-brand" : "text-wb-ink",
                            )}
                        >
                            <span className="flex-1">{o.label}</span>
                            {o.value === value && <Check className="size-4" />}
                        </button>
                    ))}
                </div>
            )}
        </Popover>
    );
}
