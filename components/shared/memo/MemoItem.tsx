"use client";

import { Pencil, Trash2 } from "lucide-react";

import type { Memo } from "./types";

/* ============================================================================
 *  One memo card — read mode (Figma 5549:24211 / 5549:24221).
 *
 *  Author (14/600) + message (14/500) + timestamp (14/500, 70% opacity),
 *  with Edit (pencil) and Delete (trash) icon buttons on the meta row.
 *  Both buttons flip local state only — no API.
 * ========================================================================== */

interface MemoItemProps {
    memo:     Memo;
    onEdit:   (id: string) => void;
    onDelete: (id: string) => void;
}

export default function MemoItem({ memo, onEdit, onDelete }: MemoItemProps) {
    // Author-only gate (wired mode). `undefined` = editable (static preview).
    const canEdit = memo.canEdit !== false;
    return (
        <div className="flex w-full items-center rounded-sm bg-white p-2">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-col gap-1">
                    <p className="text-wb-14 font-semibold leading-5 text-wb-ntrl-10">{memo.author}</p>
                    <p className="text-wb-14 font-medium leading-5 break-words text-wb-ntrl-10">
                        {memo.message}
                    </p>
                </div>

                <div className="flex items-start justify-between">
                    <p className="text-wb-14 font-medium leading-[18px] text-wb-ntrl-7 opacity-70">
                        {memo.datetime}
                    </p>

                    {canEdit && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onEdit(memo.id)}
                                aria-label="Edit memo"
                                className="flex cursor-pointer items-center justify-center rounded bg-white p-1 shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                <Pencil className="size-4 text-wb-ink" strokeWidth={1.8} />
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(memo.id)}
                                aria-label="Delete memo"
                                className="flex cursor-pointer items-center justify-center rounded bg-white p-1 shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                <Trash2 className="size-4 text-wb-ink" strokeWidth={1.8} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
