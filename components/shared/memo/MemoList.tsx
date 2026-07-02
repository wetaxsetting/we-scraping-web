"use client";

import MemoEditor from "./MemoEditor";
import MemoEmptyState from "./MemoEmptyState";
import MemoItem from "./MemoItem";
import type { Memo } from "./types";

/* ============================================================================
 *  Memo list — the drawer's scrollable middle region (Figma 5549:24210).
 *
 *  Renders each memo as a read-mode MemoItem, or as an inline MemoEditor
 *  when it is the one being edited. Shows MemoEmptyState (centered) when
 *  there are no memos. This is the ONLY region that scrolls — header and
 *  footer stay fixed (see MemoDrawer).
 * ========================================================================== */

interface MemoListProps {
    memos:     Memo[];
    editingId: string | null;
    onEdit:    (id: string) => void;
    onDelete:  (id: string) => void;
    onCancel:  () => void;
    onSave:    (id: string, text: string) => void;
}

export default function MemoList({
    memos,
    editingId,
    onEdit,
    onDelete,
    onCancel,
    onSave,
}: MemoListProps) {
    if (memos.length === 0) {
        return (
            <div data-memo-scroll className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-2">
                <MemoEmptyState />
            </div>
        );
    }

    return (
        <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-2">
            <ul className="flex flex-col gap-1">
                {memos.map((memo) => (
                    <li key={memo.id}>
                        {editingId === memo.id ? (
                            <MemoEditor memo={memo} onCancel={onCancel} onSave={onSave} />
                        ) : (
                            <MemoItem memo={memo} onEdit={onEdit} onDelete={onDelete} />
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
