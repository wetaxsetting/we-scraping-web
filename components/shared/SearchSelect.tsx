"use client";

import { ChevronDown, Pencil, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One option in the shared search-dropdown. `id` is the stable backend
 * key; `label` is the already-formatted display string the domain wrapper
 * composes (e.g. `"ACC-01 - REVENUE"`, `"40 Loan Repaid"`, `"222 - ABC"`,
 * a bare contact name). The dropdown is label-agnostic — search, ellipsis,
 * and the active-row highlight all work off `id` + `label`.
 */
export type SearchSelectOption = { id: string; label: string };

type SearchSelectProps = {
    /** Currently picked option (null when unassigned). */
    value: SearchSelectOption | null;
    /** Full option list (already formatted by the domain wrapper). */
    options: SearchSelectOption[];
    /** Most-recently-picked ids for the active user — surfaces a RECENT
     *  section above the main list when non-empty. Defaults to none. */
    recentIds?: string[];
    /** Main section heading — rendered verbatim (title case), e.g.
     *  "Purpose", "VAS Account", "Reporting Account", "Contact Name". */
    sectionTitle: string;
    /** RECENT section heading — rendered UPPERCASE per Figma. Defaults to
     *  the shared `common.recent` label. */
    recentTitle?: string;
    /** Search box placeholder. Defaults to the shared `common.search`. */
    searchPlaceholder?: string;
    /** aria-label for the trigger affordance + the option listbox. */
    ariaLabel: string;
    /** aria-label for the × clear button (only used when `onClear` set). */
    clearAriaLabel?: string;
    /** Placeholder shown inside the editing chip when no value is picked
     *  (e.g. "Select account"). Empty by default. */
    placeholder?: string;
    onChange: (next: SearchSelectOption) => void;
    /** Optional × clear handler — when supplied AND a value is assigned,
     *  the resting cell shows the hover × (clear-first flow). When omitted,
     *  an assigned value shows the hover pencil instead so the dropdown can
     *  be re-opened to pick a different value (used where the backend has
     *  no clear endpoint, e.g. Card Transactions' Reporting Account). */
    onClear?: () => void;
    /** When true, the cell always renders the dropdown chip (no hover
     *  pencil / resting plain-text view). Used by the Organizer Settings
     *  dialog where every row is permanently in edit mode. */
    alwaysEditable?: boolean;
    /** When true, the popover matches the trigger's measured width instead
     *  of the default fixed 280px (Organizer Settings — the dropdown must
     *  align to the fixed-width column). */
    matchTriggerWidth?: boolean;
    /** When true, the cell renders the picked value as plain, read-only
     *  text — no pencil / × / chevron affordance, no dropdown, no click
     *  handler. Used by Transaction History for CONFIRMED rows, where the
     *  Purpose / VAS / Contact classification is locked until the user
     *  clicks Undo (legacy `fnsh_0002_001` parity). Takes precedence over
     *  `alwaysEditable`. Defaults false. */
    readOnly?: boolean;
};

/**
 * Shared inline search-dropdown — the single component behind every
 * editable code+name picker in the app (Reporting Account, Purpose, VAS
 * Account, Contact Name) across Transaction History, Card Transactions,
 * and the Smart Organizer settings dialog. Replaces the four near-identical
 * `*Select` components, which are now thin adapters that map their domain
 * option type → {@link SearchSelectOption} and supply the section title +
 * labels.
 *
 * <p>Dropdown panel mirrors Figma `1983:20746` exactly — rounded-md panel
 * with the 3-layer ambient shadow, a borderless search row, a RECENT
 * section (when recents exist), then the typed section. Rows are single
 * line with ellipsis + a native `title` tooltip on overflow.
 *
 * <p>Trigger is the Transaction History clear-first affordance:
 *   • empty → hover pencil to assign;
 *   • assigned + `onClear` → value text + hover × (clear, then re-pick);
 *   • assigned, no `onClear` → value text + hover pencil (re-open);
 *   • editing → white chip + chevron, popover open beneath.
 * Outside-click / ESC closes; picking commits immediately + closes.
 */
export default function SearchSelect({
    value,
    options,
    recentIds = [],
    sectionTitle,
    recentTitle,
    searchPlaceholder,
    ariaLabel,
    clearAriaLabel,
    placeholder = "",
    onChange,
    onClear,
    alwaysEditable = false,
    matchTriggerWidth = false,
    readOnly = false,
}: SearchSelectProps) {
    const { t } = useTranslation();

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const [open, setOpen] = useState(false);
    const [editingState, setEditing] = useState(false);
    const editing = alwaysEditable || editingState;
    const [search, setSearch] = useState("");
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (open) setSearch("");
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                triggerRef.current?.contains(target) ||
                popoverRef.current?.contains(target)
            ) {
                return;
            }
            setOpen(false);
            setEditing(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                setEditing(false);
            }
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const filteredOptions = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, search]);

    // RECENT — preserve recents order, drop ids that no longer resolve to
    // an active option, and intersect with the search filter.
    const recentOptions = useMemo(() => {
        if (recentIds.length === 0) return [];
        const byId = new Map<string, SearchSelectOption>();
        for (const o of options) byId.set(o.id, o);
        const q = search.trim().toLowerCase();
        const out: SearchSelectOption[] = [];
        for (const id of recentIds) {
            const opt = byId.get(id);
            if (!opt) continue;
            if (q && !opt.label.toLowerCase().includes(q)) continue;
            out.push(opt);
        }
        return out;
    }, [options, recentIds, search]);

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        const rect = triggerRef.current?.getBoundingClientRect() ?? null;
        setAnchorRect(rect);
        setOpen(true);
    };

    /** Enter edit mode from a resting affordance + open the popover —
     *  deferred one frame so the chip (which carries `triggerRef`) has
     *  mounted before its rect is measured for the dropdown anchor. */
    const startEdit = () => {
        setEditing(true);
        requestAnimationFrame(() => {
            const rect = triggerRef.current?.getBoundingClientRect() ?? null;
            setAnchorRect(rect);
            setOpen(true);
        });
    };

    const commit = (opt: SearchSelectOption) => {
        onChange(opt);
        setOpen(false);
        setEditing(false);
    };

    // Read-only (confirmed row) — plain locked text, no affordances, no
    // dropdown, no handlers. Legacy `fnsh_0002_001` renders the confirmed
    // classification as static text until the user clicks Undo. Kept in the
    // same h-8 box so a Confirm/Undo toggle doesn't shift row height.
    if (readOnly) {
        return (
            <div className="flex h-8 items-center">
                <EllipsisTooltip
                    text={value ? value.label : ""}
                    className={cn(
                        "min-w-0 flex-1 text-wb-13 font-medium text-wb-ink",
                        !value && "text-transparent",
                    )}
                />
            </div>
        );
    }

    return (
        <>
            <div className="group/ss relative flex h-8 items-center">
                {editing ? (
                    <button
                        ref={triggerRef}
                        type="button"
                        onClick={toggle}
                        aria-label={ariaLabel}
                        className="flex h-8 w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-wb-ntrl-4 bg-white px-2 text-left hover:border-wb-ntrl-6"
                    >
                        {/* Editing-mode trigger label — keep single-line
                            truncation; no native `title` (the open dropdown
                            already lists the full labels, and an interactive
                            tooltip must not nest inside this toggle button). */}
                        <span
                            className={cn(
                                "min-w-0 flex-1 truncate text-wb-13 font-medium",
                                value ? "text-wb-ink" : "text-wb-ntrl-6",
                            )}
                        >
                            {value ? value.label : placeholder}
                        </span>
                        <ChevronDown className="size-3.5 shrink-0 text-wb-ntrl-8" strokeWidth={2} />
                    </button>
                ) : (
                    <div className="flex w-full items-center justify-between gap-1">
                        {/* Resting display value — single-line truncation
                            (the control is h-8) with the shared
                            <EllipsisTooltip> on hover. Replaces the legacy
                            native `title` so every consumer (Banking
                            Transaction History pickers + Payment) shows the
                            common dark tooltip instead of the browser one. */}
                        <EllipsisTooltip
                            text={value ? value.label : ""}
                            className={cn(
                                "min-w-0 flex-1 text-wb-13 font-medium text-wb-ink",
                                !value && "text-transparent",
                            )}
                        />
                        {/* Resting affordance:
                              • value + onClear  → × clear (clear-first)
                              • value, no onClear → pencil re-open
                              • empty            → pencil to assign */}
                        {value && onClear ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClear();
                                }}
                                aria-label={clearAriaLabel ?? ariaLabel}
                                className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/ss:opacity-100"
                            >
                                <X className="size-3" strokeWidth={2.5} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={startEdit}
                                aria-label={ariaLabel}
                                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-wb-bg-sidebar text-wb-ntrl-8 opacity-0 transition-opacity hover:bg-black/[0.06] focus-visible:opacity-100 group-hover/ss:opacity-100"
                            >
                                <Pencil className="size-3.5" strokeWidth={2} />
                            </button>
                        )}
                    </div>
                )}

                {editing && value && onClear && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                            setEditing(false);
                            setOpen(false);
                        }}
                        aria-label={clearAriaLabel ?? ariaLabel}
                        className="absolute right-7 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/ss:opacity-100"
                    >
                        <X className="size-3" strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {open && anchorRect &&
                createPortal(
                    <div
                        ref={popoverRef}
                        role="dialog"
                        aria-label={ariaLabel}
                        // Figma 1983:20746 — rounded-md panel, 3-layer ambient
                        // shadow (no border), inner p-1. Capped at 250px (the
                        // Figma frame is 236×250): the search row stays pinned
                        // and the section list scrolls inside the cap.
                        className={cn(
                            "fixed z-[60] flex max-h-[250px] flex-col rounded-md bg-white p-1",
                            !matchTriggerWidth && "w-[280px]",
                            "shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_2px_0px_rgba(0,0,0,0.1),0px_6px_20px_0px_rgba(0,0,0,0.1)]",
                        )}
                        style={{
                            top: `${anchorRect.bottom + 4}px`,
                            left: `${anchorRect.left}px`,
                            ...(matchTriggerWidth
                                ? { width: `${anchorRect.width}px`, minWidth: `${anchorRect.width}px` }
                                : {}),
                        }}
                    >
                        {/* Pinned, borderless search row (Figma 1983:20753). */}
                        <div className="flex shrink-0 items-center gap-1 rounded-md p-2">
                            <Search className="size-4 shrink-0 text-wb-muted" strokeWidth={2} aria-hidden />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={searchPlaceholder ?? t("common.search")}
                                className="h-4 min-w-0 flex-1 border-none bg-transparent p-0 text-wb-13 font-medium tracking-wb-tight text-wb-ink placeholder:text-wb-muted focus:outline-none"
                                autoFocus
                            />
                        </div>

                        {/* Scrollable section list — RECENT (when present) then
                            the typed section. Scrolls within the 250px cap so
                            the popup never grows past the Figma frame. */}
                        <div className="custom-scrollbar-y flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                            {recentOptions.length > 0 && (
                                <Section
                                    title={recentTitle ?? t("common.recent")}
                                    uppercase
                                    options={recentOptions}
                                    activeId={value?.id ?? null}
                                    onPick={commit}
                                />
                            )}

                            {filteredOptions.length === 0 ? (
                                <div className="px-2 pb-1 pt-2 text-wb-13 font-medium text-wb-muted">
                                    {t("common.no_rows")}
                                </div>
                            ) : (
                                <Section
                                    title={sectionTitle}
                                    options={filteredOptions}
                                    activeId={value?.id ?? null}
                                    onPick={commit}
                                />
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}

/** One titled section (RECENT or the typed list). Figma 1983:20778 /
 *  1983:20794 — title row (`pt-2 pb-1 px-2`, 12px medium ntrl-05) over a
 *  `gap-0.5` list of single-line rows (`p-2 rounded`, 13px medium ntrl-08,
 *  ellipsis + shared <EllipsisTooltip> on hover). */
function Section({
    title,
    uppercase = false,
    options,
    activeId,
    onPick,
}: {
    title: string;
    uppercase?: boolean;
    options: SearchSelectOption[];
    activeId: string | null;
    onPick: (opt: SearchSelectOption) => void;
}) {
    return (
        <div className="flex flex-col">
            <div className="flex items-center px-2 pb-1 pt-2">
                <span
                    className={cn(
                        "min-w-0 flex-1 truncate text-wb-12 font-medium leading-4 tracking-wb-tight text-wb-ntrl-5",
                        uppercase && "uppercase",
                    )}
                >
                    {title}
                </span>
            </div>
            <ul className="flex flex-col gap-0.5">
                {options.map((opt) => {
                    const isActive = activeId === opt.id;
                    return (
                        <li key={opt.id}>
                            <button
                                type="button"
                                onClick={() => onPick(opt)}
                                className={cn(
                                    "flex w-full cursor-pointer items-center rounded p-2 text-left hover:bg-wb-bg-sidebar",
                                    isActive && "bg-wb-bg-active",
                                )}
                            >
                                <EllipsisTooltip
                                    text={opt.label}
                                    className="min-w-0 flex-1 text-wb-13 font-medium tracking-wb-tight text-wb-ntrl-8"
                                />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
