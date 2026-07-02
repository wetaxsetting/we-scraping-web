"use client";

import { cn } from "@/lib/utils";
import { MEMO_COLORS } from "./mockData";
import type { MemoColor } from "./types";

/* ============================================================================
 *  Memo header color-tag picker (Figma 5549:24190-96).
 *
 *  Six 36×36 buttons, each a 24px PNG color tag. Exactly one is selected at
 *  a time; the active button paints `bg-brand-soft` (#f0f7ff) + a 4px
 *  `brand-03` (#b9dcfe) ring — matching the Figma `Button: Single` pressed
 *  state. Selection is local state only (no API).
 * ========================================================================== */

interface MemoCategoryTabsProps {
    selected: MemoColor;
    onSelect: (color: MemoColor) => void;
}

export default function MemoCategoryTabs({ selected, onSelect }: MemoCategoryTabsProps) {
    return (
        <div className="flex items-center justify-end gap-1.5">
            {MEMO_COLORS.map((opt) => {
                const active = selected === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onSelect(opt.value)}
                        aria-label={opt.label}
                        aria-pressed={active}
                        className={cn(
                            "flex cursor-pointer items-center justify-center rounded p-1.5 transition-all duration-150 ease-out",
                            active ? "bg-brand-soft ring-4 ring-brand-03" : "hover:bg-black/5",
                        )}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={opt.asset} alt="" aria-hidden className="size-6" />
                    </button>
                );
            })}
        </div>
    );
}
