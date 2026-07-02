"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import MemoFooter from "./MemoFooter";
import MemoHeader from "./MemoHeader";
import MemoList from "./MemoList";
import { CURRENT_USER, MOCK_MEMOS } from "./mockData";
import type { MemoColor, Memo } from "./types";

/* ============================================================================
 *  Memo drawer — right-edge slide-in panel (Figma 5549:24184 + 5549:24278).
 *
 *  DUAL MODE:
 *   • STATIC (preview) — when no `memos` prop is supplied. Owns all state in
 *     local React `useState` (seeded from MOCK_MEMOS); add / edit / delete /
 *     color are local-only and lost on reload. This is what /memo-preview
 *     renders — unchanged behavior.
 *   • WIRED — when `memos` is supplied the drawer becomes controlled: the
 *     list, the row color, and the loading flag come from props, and every
 *     mutation is delegated to the `onAddMemo` / `onEditMemo` / `onDeleteMemo`
 *     / `onSelectColor` callbacks (the parent owns fetch + persistence). The
 *     header color acts as the ROW color (all memos on the row share it) —
 *     legacy `getMemoPopup2` behavior.
 *
 *  Animation: 250 ms slide-in on mount + backdrop fade. On close the panel
 *  slides back out and calls `onClose` only after the transition ends so
 *  the parent unmounts it after the visual is gone. ESC closes; a backdrop
 *  click also closes (matches the shipped preview surface).
 * ========================================================================== */

const ANIM_MS = 250;

interface MemoDrawerProps {
    onClose: () => void;
    /** Wired mode — the controlled memo list. Omit for static preview. */
    memos?: Memo[];
    /** Row-level sticker color (wired mode). Every memo on the row shares it. */
    selectedColor?: MemoColor;
    /** Initial-fetch flag (wired mode) — shows a loading line while empty. */
    loading?: boolean;
    /** Add a comment with the current row color (wired mode). */
    onAddMemo?: (text: string, color: MemoColor) => void;
    /** Edit one memo's text (wired mode). */
    onEditMemo?: (id: string, text: string) => void;
    /** Delete one memo (wired mode). */
    onDeleteMemo?: (id: string) => void;
    /** Change the row-level color (wired mode). */
    onSelectColor?: (color: MemoColor) => void;
}

/** `dd-MM-yyyy HH:mm` — matches the seed rows' display format. Uses the
 *  browser clock (client component) so a freshly-added memo is stamped now. */
function nowStamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MemoDrawer({
    onClose,
    memos: wiredMemos,
    selectedColor: wiredColor,
    loading = false,
    onAddMemo,
    onEditMemo,
    onDeleteMemo,
    onSelectColor,
}: MemoDrawerProps) {
    // Controlled (wired) when the parent supplies a memo list.
    const wired = wiredMemos !== undefined;

    /* ── Animation phase ─────────────────────────────────────────── */
    const [phase, setPhase] = useState<"entering" | "open" | "exiting">("entering");
    useEffect(() => {
        const id = requestAnimationFrame(() => setPhase("open"));
        return () => cancelAnimationFrame(id);
    }, []);

    const requestClose = useCallback(() => {
        setPhase("exiting");
        window.setTimeout(onClose, ANIM_MS);
    }, [onClose]);

    /* ── State ───────────────────────────────────────────────────── */
    // Static-mode list + row color live locally; wired-mode reads from props.
    const [localMemos, setLocalMemos] = useState<Memo[]>(MOCK_MEMOS);
    const [localColor, setLocalColor] = useState<MemoColor>("yellow");
    // Composer draft + which memo is being edited are UI-only in both modes.
    const [draft, setDraft] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const seqRef = useRef(0);

    const memos = wired ? (wiredMemos as Memo[]) : localMemos;
    const selectedColor = wired ? (wiredColor ?? "yellow") : localColor;

    /* ── Body scroll lock + ESC ──────────────────────────────────── */
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") requestClose();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener("keydown", onKey);
        };
    }, [requestClose]);

    /* ── Handlers — delegate in wired mode, mutate local state otherwise ── */
    const selectColor = (color: MemoColor) => {
        if (wired) onSelectColor?.(color);
        else setLocalColor(color);
    };

    const addMemo = () => {
        const text = draft.trim();
        if (!text) return;
        if (wired) {
            onAddMemo?.(text, selectedColor);
            setDraft("");
            return;
        }
        seqRef.current += 1;
        const memo: Memo = {
            id:       `new-${seqRef.current}`,
            author:   CURRENT_USER,
            message:  text,
            datetime: nowStamp(),
        };
        setLocalMemos((prev) => [...prev, memo]);
        setDraft("");
        // Scroll the new memo into view once it renders at the bottom.
        requestAnimationFrame(() => {
            const el = listRef.current?.querySelector("[data-memo-scroll]") as HTMLElement | null;
            el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
    };

    const startEdit  = (id: string) => setEditingId(id);
    const cancelEdit = () => setEditingId(null);

    const saveEdit = (id: string, text: string) => {
        if (wired) onEditMemo?.(id, text);
        else setLocalMemos((prev) => prev.map((m) => (m.id === id ? { ...m, message: text } : m)));
        setEditingId(null);
    };

    const deleteMemo = (id: string) => {
        if (wired) {
            // Parent owns the confirm dialog + refetch; keep edit state sane.
            onDeleteMemo?.(id);
        } else {
            setLocalMemos((prev) => prev.filter((m) => m.id !== id));
        }
        setEditingId((cur) => (cur === id ? null : cur));
    };

    const isVisible = phase === "open";

    if (typeof document === "undefined") return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                aria-hidden
                onClick={requestClose}
                className={cn(
                    "fixed inset-0 z-40 bg-black/45 transition-opacity duration-[250ms] ease-out",
                    isVisible ? "opacity-100" : "opacity-0",
                )}
            />

            {/* Drawer */}
            <aside
                role="dialog"
                aria-label="Memo"
                className={cn(
                    "fixed right-0 top-0 z-50 flex h-screen w-[440px] max-w-[calc(100vw-32px)] flex-col gap-6",
                    "rounded-l-2xl border-l border-wb-border-sidebar bg-white pt-6 pb-16 shadow-2xl",
                    "transition-transform duration-[250ms] ease-out will-change-transform",
                    isVisible ? "translate-x-0" : "translate-x-full",
                )}
            >
                <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-8">
                    <MemoHeader
                        selectedColor={selectedColor}
                        onSelectColor={selectColor}
                        onClose={requestClose}
                    />
                    {wired && loading && memos.length === 0 ? (
                        <div className="flex min-h-0 flex-1 items-center justify-center px-2">
                            <p className="text-wb-13 font-medium text-wb-ntrl-6">Loading…</p>
                        </div>
                    ) : (
                        <MemoList
                            memos={memos}
                            editingId={editingId}
                            onEdit={startEdit}
                            onDelete={deleteMemo}
                            onCancel={cancelEdit}
                            onSave={saveEdit}
                        />
                    )}
                </div>

                <MemoFooter value={draft} onChange={setDraft} onSubmit={addMemo} />
            </aside>
        </>,
        document.body,
    );
}
