"use client";

import { ChevronDown, Pencil, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ContactOption } from "./types";

type ContactSelectProps = {
    /** Currently picked option (null when the row is unassigned). */
    value: ContactOption | null;
    /** Active Contact picker list. */
    options: ContactOption[];
    /** Most-recently-picked `trcoKey` list for the active user. */
    recentTrcoKeys: string[];
    onChange: (next: ContactOption) => void;
    /** Optional clear handler — when supplied AND a value is
     *  assigned, the cell renders a hover-only × button. */
    onClear?: () => void;
    /** When true, render the dropdown chip permanently — no hover
     *  pencil affordance, no resting plain-text view. See
     *  PurposeSelect's `alwaysEditable` for the same contract. */
    alwaysEditable?: boolean;
    /** When true, the popover matches the trigger's measured width
     *  instead of the default fixed 280px (Organizer Settings — the
     *  dropdown list must align to the fixed-width column / trigger).
     *  Defaults to false to preserve Transaction History's 280px. */
    matchTriggerWidth?: boolean;
};

/**
 * Inline Contact picker rendered in the Transaction History table.
 * Mirrors `<VasAccountSelect>` 1:1 (same two-state cell — pencil on
 * hover when empty, value + × on hover when assigned — and the same
 * dropdown body: search + RECENT + full list).
 *
 * Row rendering: `<handTrcoKey> - <name>` (e.g. `00501 - ABC Co.`).
 * Mirrors legacy `fnsh_0200_001` which writes
 * `RCV_PAY_TRCO_KEY` + `RCV_PAY_TRCO_NM` together at pick time, so
 * the cell stays stable even when the master contact is renamed.
 */
export default function ContactSelect({
    value,
    options,
    recentTrcoKeys,
    onChange,
    onClear,
    alwaysEditable = false,
    matchTriggerWidth = false,
}: ContactSelectProps) {
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
        return options.filter(
            (o) =>
                o.handTrcoKey.toLowerCase().includes(q) ||
                o.name.toLowerCase().includes(q),
        );
    }, [options, search]);

    const recentOptions = useMemo(() => {
        if (recentTrcoKeys.length === 0) return [];
        const byKey = new Map<string, ContactOption>();
        for (const o of options) byKey.set(o.trcoKey, o);
        const q = search.trim().toLowerCase();
        const out: ContactOption[] = [];
        for (const k of recentTrcoKeys) {
            const opt = byKey.get(k);
            if (!opt) continue;
            if (
                q &&
                !opt.handTrcoKey.toLowerCase().includes(q) &&
                !opt.name.toLowerCase().includes(q)
            ) {
                continue;
            }
            out.push(opt);
        }
        return out;
    }, [options, recentTrcoKeys, search]);

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        const rect = triggerRef.current?.getBoundingClientRect() ?? null;
        setAnchorRect(rect);
        setOpen(true);
    };

    return (
        <>
            <div className="group/ct relative flex h-8 items-center">
                {editing ? (
                    <button
                        ref={triggerRef}
                        type="button"
                        onClick={toggle}
                        aria-label={t("txn_history.col.select_contact")}
                        className="flex h-8 w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-wb-ntrl-4 bg-white px-2 text-left hover:border-wb-ntrl-6"
                    >
                        <span
                            className={cn(
                                "min-w-0 flex-1 truncate text-wb-13 font-medium",
                                value ? "text-wb-ink" : "text-wb-ntrl-6",
                            )}
                        >
                            {value
                                ? `${value.handTrcoKey} - ${value.name}`
                                : t("txn_history.contact.placeholder")}
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
                            {value
                                ? `${value.handTrcoKey} - ${value.name}`
                                : ""}
                        </span>
                        {value ? (
                            onClear && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClear();
                                    }}
                                    aria-label={t("txn_history.contact.clear")}
                                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/ct:opacity-100"
                                >
                                    <X className="size-3" strokeWidth={2.5} />
                                </button>
                            )
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(true);
                                    requestAnimationFrame(() => {
                                        const rect =
                                            triggerRef.current?.getBoundingClientRect() ??
                                            null;
                                        setAnchorRect(rect);
                                        setOpen(true);
                                    });
                                }}
                                aria-label={t("txn_history.col.select_contact")}
                                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-wb-bg-sidebar text-wb-ntrl-8 opacity-0 transition-opacity hover:bg-black/[0.06] focus-visible:opacity-100 group-hover/ct:opacity-100"
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
                        aria-label={t("txn_history.contact.clear")}
                        className="absolute right-7 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/ct:opacity-100"
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

                        <div className="custom-scrollbar-y max-h-[320px] overflow-y-auto pb-1">
                            {recentOptions.length > 0 && (
                                <Section
                                    title={t("txn_history.contact.recent")}
                                    options={recentOptions}
                                    activeTrcoKey={value?.trcoKey ?? null}
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
                                    title={t("txn_history.col.contact_name")}
                                    options={filteredOptions}
                                    activeTrcoKey={value?.trcoKey ?? null}
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
    activeTrcoKey,
    onPick,
}: {
    title: string;
    options: ContactOption[];
    activeTrcoKey: string | null;
    onPick: (opt: ContactOption) => void;
}) {
    return (
        <div>
            <div className="px-3 pb-1 pt-2 text-wb-11 font-medium uppercase tracking-wide text-wb-ntrl-6">
                {title}
            </div>
            <ul>
                {options.map((opt) => {
                    const isActive = activeTrcoKey === opt.trcoKey;
                    return (
                        <li key={opt.trcoKey}>
                            <button
                                type="button"
                                onClick={() => onPick(opt)}
                                className={cn(
                                    "flex w-full cursor-pointer items-baseline gap-1 px-3 py-1.5 text-left text-wb-13 leading-5 hover:bg-wb-bg-sidebar",
                                    isActive && "bg-wb-bg-active",
                                )}
                            >
                                <span className="font-semibold text-wb-ink">
                                    {opt.handTrcoKey}
                                </span>
                                <span className="font-normal text-wb-ntrl-8">-</span>
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
