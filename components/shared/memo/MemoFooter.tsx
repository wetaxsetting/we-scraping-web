"use client";

import { Send, X } from "lucide-react";

import { cn } from "@/lib/utils";

/* ============================================================================
 *  Memo composer footer (Figma 5549:24261 / 5549:24342).
 *
 *  A single-line comment input with an inline clear (X) button (shown only
 *  when there is text) + a paper-plane Send button. Send is disabled and
 *  greyed while the input is empty, enabled brand-blue once text exists.
 *  Fixed at the bottom of the drawer; never scrolls. Enter submits. No API.
 * ========================================================================== */

interface MemoFooterProps {
    value:    string;
    onChange: (value: string) => void;
    onSubmit: () => void;
}

export default function MemoFooter({ value, onChange, onSubmit }: MemoFooterProps) {
    const canSend = value.trim().length > 0;

    return (
        <div className="flex shrink-0 flex-col px-4">
            <div className="flex w-full items-center gap-2 pt-6">
                <div className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-sm bg-white px-2 shadow-wb-outline focus-within:shadow-wb-focus">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && canSend) {
                                e.preventDefault();
                                onSubmit();
                            }
                        }}
                        placeholder="Add comment"
                        maxLength={200}
                        className="min-w-0 flex-1 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
                    />
                    {canSend && (
                        <button
                            type="button"
                            onClick={() => onChange("")}
                            aria-label="Clear"
                            className="flex shrink-0 cursor-pointer items-center justify-center text-wb-ntrl-5 hover:text-wb-ntrl-6"
                        >
                            <X className="size-4" strokeWidth={1.8} />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!canSend}
                    aria-label="Send"
                    className={cn(
                        "flex shrink-0 items-center justify-center rounded-sm p-2 text-white",
                        canSend
                            ? "cursor-pointer bg-brand shadow-wb-brand-btn hover:bg-brand-hover"
                            : "cursor-not-allowed bg-wb-ntrl-4 shadow-wb-outline",
                    )}
                >
                    <Send className="size-4" strokeWidth={1.8} />
                </button>
            </div>
        </div>
    );
}
