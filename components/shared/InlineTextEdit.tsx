"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";

import EditIcon from "@/components/shared/icons/EditIcon";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { useTranslation } from "@/lib/i18n";

type InlineTextEditProps = {
    /** Current persisted value (null/empty when unassigned). */
    value: string | null;
    /** Commit handler — fires on Enter or blur, only when the trimmed
     *  draft differs from the current value. The caller owns the API
     *  call + list refresh. */
    onCommit: (next: string) => void;
    /** Optional × clear handler — when supplied AND a value is present,
     *  the resting cell shows the same hover × as the dropdown pickers
     *  (clear-first flow). After clearing, the empty cell shows the hover
     *  pencil → input. When omitted, an assigned value shows the hover
     *  pencil to edit in place (backward-compatible). */
    onClear?: () => void;
    /** aria-label for the pencil trigger + the input. */
    ariaLabel: string;
    /** aria-label for the × clear button (only used when `onClear` set). */
    clearAriaLabel?: string;
    /** Placeholder shown inside the input while editing. */
    placeholder?: string;
    /** Max characters accepted by the input. Defaults to 200 (legacy
     *  `CONT` column length). */
    maxLength?: number;
};

/**
 * Inline free-text edit cell — the free-text sibling of the shared
 * {@link PurposeSelect} dropdown, built from the same Transaction History
 * affordance vocabulary:
 *
 *   • Resting — the value as plain text PLUS a small pencil button that
 *     only fades in on row hover (identical icon / size / colours to
 *     `PurposeSelect`'s hover pencil).
 *   • Editing — an `h-8` white input chip (same height / font / border as
 *     the dropdown chip). Commits on Enter or blur; Escape cancels and
 *     reverts. A no-op (unchanged value) just exits edit mode without
 *     calling {@link onCommit}.
 *
 * The parent must place this inside a `group/...`-less cell — the pencil
 * uses its own `group/inline` so the hover affordance is local to the
 * cell. Read-only cells should render plain text instead of this
 * component (the lock decision lives with the caller, not here).
 */
export default function InlineTextEdit({
    value,
    onCommit,
    onClear,
    ariaLabel,
    clearAriaLabel,
    placeholder,
    maxLength = 200,
}: InlineTextEditProps) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);

    const startEdit = () => {
        setDraft(value ?? "");
        setEditing(true);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const commit = () => {
        // Only fire onCommit when the trimmed draft actually changed —
        // mirrors the legacy `EditDescriptionDialog` no-op guard.
        if (draft.trim() !== (value ?? "").trim()) {
            onCommit(draft);
        }
        setEditing(false);
    };

    const cancel = () => {
        setDraft(value ?? "");
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={maxLength}
                aria-label={ariaLabel}
                placeholder={placeholder ?? t("common.search")}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancel();
                    }
                }}
                className="h-8 w-full rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink placeholder:text-wb-ntrl-6 focus:border-wb-ntrl-6 focus:outline-none"
            />
        );
    }

    const hasValue = (value ?? "").length > 0;

    return (
        <div className="group/inline flex h-8 w-full items-center justify-between gap-1">
            {/* Resting value — single-line ellipsis + the shared
                <EllipsisTooltip> on hover (only when actually truncated).
                Never the native `title` attribute, so no white browser
                tooltip. Empty value → no tooltip. */}
            <EllipsisTooltip
                text={value ?? ""}
                className="min-w-0 flex-1 text-wb-13 font-medium text-wb-ink"
            />
            {/* Resting affordance:
                  • value + onClear → × clear (clear-first); after clearing,
                    the empty cell falls back to the hover pencil → input.
                  • value, no onClear → pencil to edit in place.
                  • empty → pencil to start typing. */}
            {hasValue && onClear ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                    }}
                    aria-label={clearAriaLabel ?? ariaLabel}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/inline:opacity-100"
                >
                    <X className="size-3" strokeWidth={2.5} />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={startEdit}
                    aria-label={ariaLabel}
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-wb-bg-sidebar text-wb-ntrl-8 opacity-0 transition-opacity hover:bg-black/[0.06] focus-visible:opacity-100 group-hover/inline:opacity-100"
                >
                    <EditIcon className="size-3.5" />
                </button>
            )}
        </div>
    );
}
