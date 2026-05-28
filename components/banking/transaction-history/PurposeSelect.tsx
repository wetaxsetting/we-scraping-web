"use client";

import { ChevronDown, Pencil, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { PurposeOption } from "./types";

type PurposeSelectProps = {
    /** Currently picked option (null when the row is unassigned). */
    value: PurposeOption | null;
    /** Flat picker list — root + child nodes of `BUSI_USAG_SET_INFM`. */
    options: PurposeOption[];
    /** Most-recently-picked `use_usag_cd` list for the active user.
     *  Surfaces a "RECENT" section in the popover when non-empty. */
    recentUseUsagCds: string[];
    onChange: (next: PurposeOption) => void;
    /** Optional × clear handler — when supplied AND a value is assigned,
     *  the cell renders the same small dark × button as the Reporting
     *  Account picker. */
    onClear?: () => void;
    /** When true, the cell always renders the dropdown chip (no hover
     *  pencil affordance, no resting plain-text view). Used by the
     *  Organizer Settings dialog where every row is permanently in
     *  edit mode — there is no "resting" state to hide the trigger
     *  behind. Defaults to false to preserve Transaction History's
     *  hover-only chrome. */
    alwaysEditable?: boolean;
    /** When true, the popover matches the trigger's measured width
     *  instead of the default fixed 280px (Organizer Settings — the
     *  dropdown list must align to the fixed-width column / trigger).
     *  Defaults to false to preserve Transaction History's 280px. */
    matchTriggerWidth?: boolean;
};

/**
 * Inline Purpose picker rendered in the Transaction History table.
 * Mirrors the legacy `fnsh_0200_001` cell pattern + the second
 * screenshot the PO shared:
 *
 *   • Trigger — "Select Purpose ↓" (brand blue) when unassigned, or
 *     "Code Name" with chevron when assigned.
 *   • Popover  — search input on top, a "RECENT" section listing the
 *     last 5 picks (legacy `USER_USAG_USE_HIS` flavor), then the full
 *     "Purpose" section in `disp_ord` order.
 *
 * Outside-click / ESC closes. Picking commits immediately + closes.
 */
export default function PurposeSelect({
    value,
    options,
    recentUseUsagCds,
    onChange,
    onClear,
    alwaysEditable = false,
    matchTriggerWidth = false,
}: PurposeSelectProps) {
    const { t } = useTranslation();

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const [open, setOpen] = useState(false);
    const [editingState, setEditing] = useState(false);
    // `alwaysEditable` consumers (Organizer Settings) treat every row as
    // permanently in edit mode — the chip never falls back to resting.
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
        return options.filter(
            (o) =>
                o.code.toLowerCase().includes(q) ||
                o.name.toLowerCase().includes(q),
        );
    }, [options, search]);

    // Build the "RECENT" section — preserve recents order, drop entries
    // that no longer resolve to an active option (purpose deleted from
    // Settings, etc.), and intersect with the search filter.
    const recentOptions = useMemo(() => {
        if (recentUseUsagCds.length === 0) return [];
        const byCd = new Map<string, PurposeOption>();
        for (const o of options) byCd.set(o.useUsagCd, o);
        const q = search.trim().toLowerCase();
        const out: PurposeOption[] = [];
        for (const cd of recentUseUsagCds) {
            const opt = byCd.get(cd);
            if (!opt) continue;
            if (
                q &&
                !opt.code.toLowerCase().includes(q) &&
                !opt.name.toLowerCase().includes(q)
            ) {
                continue;
            }
            out.push(opt);
        }
        return out;
    }, [options, recentUseUsagCds, search]);

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        // Anchor the popover directly under the pencil button — the
        // Figma frame the PO shared (image 1) drops the dropdown from
        // the pencil, not from the full cell width.
        const rect = triggerRef.current?.getBoundingClientRect() ?? null;
        setAnchorRect(rect);
        setOpen(true);
    };

    return (
        <>
            {/* Two-state affordance:
                  Resting (editing=false) — cell shows just the picked
                  value (or nothing) PLUS a small pencil button that
                  only fades in on hover.
                  Editing (editing=true) — cell switches to a white
                  rounded select-input chip with a chevron; the dropdown
                  popover opens beneath it. Closing the popover (pick,
                  outside-click, ESC) drops back to resting. */}
            <div className="group/pp relative flex h-8 items-center">
                {editing ? (
                    <button
                        ref={triggerRef}
                        type="button"
                        onClick={toggle}
                        aria-label={t("txn_history.col.select_purpose")}
                        className="flex h-8 w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-wb-ntrl-4 bg-white px-2 text-left hover:border-wb-ntrl-6"
                    >
                        <span
                            className={cn(
                                "min-w-0 flex-1 truncate text-wb-13 font-medium",
                                value ? "text-wb-ink" : "text-wb-ntrl-6",
                            )}
                        >
                            {value ? `${value.code} ${value.name}` : ""}
                        </span>
                        <ChevronDown
                            className="size-3.5 shrink-0 text-wb-ntrl-8"
                            strokeWidth={2}
                        />
                    </button>
                ) : (
                    <div className="flex w-full items-center justify-between gap-1">
                        <span
                            className={cn(
                                "min-w-0 flex-1 truncate text-wb-13 font-medium text-wb-ink",
                                !value && "text-transparent",
                            )}
                        >
                            {value ? `${value.code} ${value.name}` : ""}
                        </span>
                        {/* When a value IS assigned the resting affordance
                            is the × clear button (matches the Figma frame
                            shared by the PO — pencil only appears when the
                            cell is empty). Clearing falls back to the
                            empty resting state; the pencil then takes
                            over as the hover affordance again. */}
                        {value ? (
                            onClear && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClear();
                                    }}
                                    aria-label={t("txn_history.purpose.clear")}
                                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/pp:opacity-100"
                                >
                                    <X className="size-3" strokeWidth={2.5} />
                                </button>
                            )
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(true);
                                    // Defer the popover open by one frame so
                                    // the chip has actually mounted before
                                    // `triggerRef.current.getBoundingClientRect()`
                                    // resolves the dropdown anchor.
                                    requestAnimationFrame(() => {
                                        const rect =
                                            triggerRef.current?.getBoundingClientRect() ??
                                            null;
                                        setAnchorRect(rect);
                                        setOpen(true);
                                    });
                                }}
                                aria-label={t("txn_history.col.select_purpose")}
                                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-wb-bg-sidebar text-wb-ntrl-8 opacity-0 transition-opacity hover:bg-black/[0.06] focus-visible:opacity-100 group-hover/pp:opacity-100"
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
                        aria-label={t("txn_history.purpose.clear")}
                        className="absolute right-7 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/pp:opacity-100"
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
                        className={cn(
                            "fixed z-[60] flex flex-col rounded border border-wb-ntrl-4 bg-white",
                            !matchTriggerWidth && "w-[280px]",
                            "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.08)]",
                        )}
                        style={{
                            top: `${anchorRect.bottom + 4}px`,
                            left: `${anchorRect.left}px`,
                            ...(matchTriggerWidth
                                ? {
                                      width: `${anchorRect.width}px`,
                                      minWidth: `${anchorRect.width}px`,
                                  }
                                : {}),
                        }}
                    >
                        {/* Search row — Figma image 1 shows ~12px outer
                           padding around the search input. No divider
                           between the search row and the sections below. */}
                        <div className="p-3 pb-2">
                            <div className="flex h-8 items-center gap-1.5 rounded-md border border-wb-ntrl-4 px-2 focus-within:border-wb-ntrl-6">
                                <Search
                                    className="size-3.5 shrink-0 text-wb-ntrl-6"
                                    strokeWidth={2}
                                />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t("common.search")}
                                    className="h-full min-w-0 flex-1 border-none bg-transparent text-wb-13 font-normal text-wb-ink placeholder:text-wb-ntrl-6 focus:outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Sections */}
                        <div className="custom-scrollbar-y max-h-[320px] overflow-y-auto pb-1">
                            {recentOptions.length > 0 && (
                                <Section
                                    title={t("txn_history.purpose.recent")}
                                    options={recentOptions}
                                    activeUseUsagCd={value?.useUsagCd ?? null}
                                    onPick={(opt) => {
                                        onChange(opt);
                                        setOpen(false);
                                        setEditing(false);
                                    }}
                                />
                            )}

                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-2 text-wb-13 font-medium text-wb-muted">
                                    {t("common.no_rows")}
                                </div>
                            ) : (
                                <Section
                                    title={t("txn_history.col.purpose")}
                                    options={filteredOptions}
                                    activeUseUsagCd={value?.useUsagCd ?? null}
                                    onPick={(opt) => {
                                        onChange(opt);
                                        setOpen(false);
                                        setEditing(false);
                                    }}
                                />
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}

function Section({
    title,
    options,
    activeUseUsagCd,
    onPick,
}: {
    title: string;
    options: PurposeOption[];
    activeUseUsagCd: string | null;
    onPick: (opt: PurposeOption) => void;
}) {
    return (
        <div>
            <div className="px-3 pb-1 pt-2 text-wb-11 font-medium uppercase tracking-wide text-wb-ntrl-6">
                {title}
            </div>
            <ul>
                {options.map((opt) => {
                    const isActive = activeUseUsagCd === opt.useUsagCd;
                    return (
                        <li key={opt.useUsagCd}>
                            <button
                                type="button"
                                onClick={() => onPick(opt)}
                                className={cn(
                                    "flex w-full cursor-pointer items-baseline gap-1 px-3 py-1.5 text-left text-wb-13 leading-5 hover:bg-wb-bg-sidebar",
                                    isActive && "bg-wb-bg-active",
                                )}
                            >
                                <span className="font-semibold text-wb-ink">
                                    {opt.code}
                                </span>
                                <span className="truncate font-normal text-wb-ink">
                                    {opt.name}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
