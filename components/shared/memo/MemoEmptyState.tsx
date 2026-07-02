"use client";

import { FileText } from "lucide-react";

/* ============================================================================
 *  Memo empty state — shown when the list has no memos.
 *
 *  Empty document icon + "No memos yet. Add one below.", centered both
 *  vertically and horizontally in the scrollable list region. Mirrors the
 *  live drawer's empty state.
 * ========================================================================== */

export default function MemoEmptyState() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
            <FileText className="size-10 text-wb-ntrl-5" strokeWidth={1.4} />
            <p className="text-wb-13 font-medium text-wb-ntrl-6">No memos yet. Add one below.</p>
        </div>
    );
}
