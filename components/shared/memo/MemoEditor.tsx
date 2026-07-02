"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { Memo } from "./types";

/* ============================================================================
 *  One memo card — edit mode (Figma 5549:24325).
 *
 *  Author + a textarea seeded with the memo's current text + timestamp,
 *  and a Cancel / Save button pair. Cancel discards the draft (restores the
 *  original text by simply unmounting); Save commits the new text to local
 *  state. No API.
 *
 *  The textarea uses the documented `text-wb-14 + leading-[18px]` rhythm
 *  exception (the 14/18 pairing is not in the @theme scale) — matches
 *  Figma 5549:24329.
 * ========================================================================== */

interface MemoEditorProps {
    memo:     Memo;
    onCancel: () => void;
    onSave:   (id: string, text: string) => void;
}

export default function MemoEditor({ memo, onCancel, onSave }: MemoEditorProps) {
    const [text, setText] = useState(memo.message);
    const canSave = text.trim().length > 0;

    const handleSave = () => {
        if (!canSave) return;
        onSave(memo.id, text.trim());
    };

    return (
        <div className="flex w-full flex-col items-end justify-center gap-2 p-2">
            <div className="flex w-full flex-col gap-2">
                <div className="flex w-full flex-col gap-1">
                    <p className="text-wb-14 font-semibold leading-5 text-wb-ntrl-10">{memo.author}</p>

                    <textarea
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={4}
                        maxLength={200}
                        className="w-full resize-y rounded-sm bg-white px-2 pt-2 pb-4 text-wb-14 font-medium leading-[18px] text-wb-ntrl-8 shadow-wb-outline outline-none focus:shadow-wb-focus"
                    />
                </div>

                <p className="text-wb-14 font-medium leading-[18px] text-wb-ntrl-7 opacity-70">
                    {memo.datetime}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex cursor-pointer items-center justify-center rounded p-1 text-wb-12 font-medium tracking-wb-tight text-brand-hover hover:bg-black/5"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className={cn(
                        "flex items-center justify-center rounded p-1 text-wb-12 font-medium tracking-wb-tight text-white",
                        canSave
                            ? "cursor-pointer bg-brand shadow-wb-brand-btn hover:bg-brand-hover"
                            : "cursor-not-allowed bg-wb-ntrl-4",
                    )}
                >
                    Save
                </button>
            </div>
        </div>
    );
}
