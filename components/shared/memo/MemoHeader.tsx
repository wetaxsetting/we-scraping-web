"use client";

import { X } from "lucide-react";

import MemoCategoryTabs from "./MemoCategoryTabs";
import type { MemoColor } from "./types";

/* ============================================================================
 *  Memo drawer header (Figma 5549:24186).
 *
 *  Left  — close (X) button + "Memo" title.
 *  Right — six color-tag category buttons (MemoCategoryTabs).
 *  Fixed at the top of the drawer; never scrolls.
 * ========================================================================== */

interface MemoHeaderProps {
    selectedColor: MemoColor;
    onSelectColor: (color: MemoColor) => void;
    onClose:       () => void;
}

export default function MemoHeader({ selectedColor, onSelectColor, onClose }: MemoHeaderProps) {
    return (
        <div className="flex shrink-0 items-center justify-between px-2 py-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex cursor-pointer items-center justify-center rounded p-1 text-wb-ink hover:bg-black/5"
                >
                    <X className="size-4" strokeWidth={1.8} />
                </button>
                <p className="text-wb-16 font-semibold text-wb-ink">Memo</p>
            </div>

            <MemoCategoryTabs selected={selectedColor} onSelect={onSelectColor} />
        </div>
    );
}
