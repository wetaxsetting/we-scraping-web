"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ReportingAccountOption } from "./types";

type ReportingAccountSelectProps = {
    /** Currently selected option (rendered as "Code - Name" + breadcrumb).
     *  When `null`, the trigger shows the brand-blue "Select Account ↓"
     *  placeholder per Figma — matches the legacy `fnsh_0200_001` cell
     *  where `CHART_ACCT_CD === null` falls back to the literal string. */
    value: ReportingAccountOption | null;
    /** Full picker list. Sourced from `/api/v1/settings/chart-of-accounts`
     *  via the page-level loader so the popover stays presentational. */
    options: ReportingAccountOption[];
    onChange: (next: ReportingAccountOption) => void;
    /** Optional × clear handler — when supplied AND a value is
     *  currently assigned, the cell renders a small dark × button
     *  next to the trigger that nulls the Reporting Account. */
    onClear?: () => void;
    /** When true, the popover matches the trigger's measured width
     *  instead of the default fixed 280px. Used by the Organizer
     *  Settings dialog where each picker sits in a fixed-width table
     *  column and the dropdown list must align to the cell/trigger
     *  width. Defaults to false to preserve Transaction History's
     *  280px popover. */
    matchTriggerWidth?: boolean;
};

/**
 * Inline Reporting Account picker rendered in the Transaction History
 * table. Mirrors the live JEX cell pattern (`fnsh_0200_001` line 327)
 * plus the screenshot the PO shared:
 *
 *   • Trigger — "Select Account ↓" (brand blue) when unassigned, or
 *     two-line stack "Code - Name" / muted breadcrumb when assigned.
 *   • Popover  — portal-rendered, anchored beneath the trigger:
 *       row 1  Search input with a leading magnifier icon.
 *       row 2+ Flat list of "Code - Name" with a small breadcrumb sub-line
 *              (REVENUE, REVENUE > OTHERS, etc.). Search filters by code
 *              + name + breadcrumb (case-insensitive substring).
 *
 * Outside-click / ESC closes the popover. Selection commits via
 * `onChange` and closes immediately — there is no Save / Cancel pair
 * (matches the legacy single-click commit and the screenshot).
 *
 * Each cell owns its own popover instance so opening a new row's
 * picker closes any other open one — `closeAllReportingPickers` is
 * not needed because clicking the new trigger fires `mousedown` on a
 * different anchor, tripping the outside-click handler.
 */
export default function ReportingAccountSelect({
    value,
    options,
    onChange,
    onClear,
    matchTriggerWidth = false,
}: ReportingAccountSelectProps) {
    const { t } = useTranslation();

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    /** Full-width cell wrapper. The visible trigger is a content-width
     *  text button, so when `matchTriggerWidth` is on we measure this
     *  container (which fills the table column) to size the popover —
     *  otherwise the dropdown would shrink to the narrow link width. */
    const containerRef = useRef<HTMLDivElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

    // Reset the search box every time the popover opens so a stale
    // filter from the previous interaction doesn't hide the user's
    // current value.
    useEffect(() => {
        if (open) setSearch("");
    }, [open]);

    // Outside-click + ESC dismissal. Listening on `mousedown` (not
    // `click`) so the popover closes before the new trigger's
    // `onClick` toggles it back open — without this, clicking another
    // row's "Select Account" trigger would land on this handler first
    // and the second trigger would receive a click on a closed widget.
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
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
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
        return options.filter((o) => {
            return (
                o.code.toLowerCase().includes(q) ||
                o.name.toLowerCase().includes(q) ||
                (o.breadcrumb ?? "").toLowerCase().includes(q)
            );
        });
    }, [options, search]);

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        const anchorEl = matchTriggerWidth
            ? containerRef.current
            : triggerRef.current;
        const rect = anchorEl?.getBoundingClientRect() ?? null;
        setAnchorRect(rect);
        setOpen(true);
    };

    return (
        <>
            <div ref={containerRef} className="group/ra flex items-center gap-2 pr-6">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                className="flex max-w-full cursor-pointer flex-col items-start gap-0.5 text-left"
            >
                {value ? (
                    <>
                        <span className="flex items-center gap-0.5 text-wb-13 font-medium text-wb-ink">
                            <span className="truncate">
                                {value.code} - {value.name}
                            </span>
                            <ChevronDown
                                className="size-3.5 shrink-0"
                                strokeWidth={2}
                            />
                        </span>
                        {value.breadcrumb && (
                            <span className="block truncate text-wb-12 font-medium text-wb-ntrl-6">
                                {value.breadcrumb}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="flex items-center gap-0.5 text-wb-13 font-medium text-brand hover:underline">
                        <span>{t("txn_history.col.select_account")}</span>
                        <ChevronDown
                            className="size-3.5 shrink-0"
                            strokeWidth={2}
                        />
                    </span>
                )}
            </button>

            {/* × clear — only renders when a value is assigned AND
                an onClear handler is supplied. Matches the legacy
                affordance the PO requested: small dark filled circle
                with a white × glyph sitting to the right of the
                "Code - Name / breadcrumb" stack. */}
            {value && onClear && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                    }}
                    aria-label={t("txn_history.reporting_account.clear")}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-8 text-white opacity-0 transition-opacity hover:bg-wb-ink focus-visible:opacity-100 group-hover/ra:opacity-100"
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
                            "fixed z-[60] flex flex-col rounded-md border border-wb-ntrl-4 bg-white",
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
                        {/* Search row */}
                        <div className="border-b border-wb-ntrl-4 p-2">
                            <div className="flex h-8 items-center gap-1.5 rounded-md border border-brand px-2">
                                <Search
                                    className="size-3.5 shrink-0 text-wb-ntrl-6"
                                    strokeWidth={2}
                                />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t(
                                        "txn_history.reporting_account.search_placeholder",
                                    )}
                                    className="h-full min-w-0 flex-1 border-none bg-transparent text-wb-13 font-normal text-wb-ink placeholder:text-wb-ntrl-6 focus:outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Option list */}
                        <ul className="custom-scrollbar-y max-h-[260px] overflow-y-auto py-1">
                            {filteredOptions.length === 0 ? (
                                <li className="px-3 py-2 text-wb-13 font-medium text-wb-muted">
                                    {t("common.no_rows")}
                                </li>
                            ) : (
                                filteredOptions.map((opt) => {
                                    const isActive =
                                        value?.chartAcctSeqNo ===
                                        opt.chartAcctSeqNo;
                                    return (
                                        <li key={opt.chartAcctSeqNo}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onChange(opt);
                                                    setOpen(false);
                                                }}
                                                className={cn(
                                                    "flex w-full cursor-pointer flex-col items-start gap-0.5 border-b border-wb-ntrl-4 px-3 py-2 text-left last:border-b-0 hover:bg-wb-bg-sidebar",
                                                    isActive && "bg-wb-bg-active",
                                                )}
                                            >
                                                <span className="block w-full truncate text-wb-13 font-medium text-wb-ink">
                                                    {opt.code} - {opt.name}
                                                </span>
                                                {opt.breadcrumb && (
                                                    <span className="block w-full truncate text-wb-11 font-medium uppercase tracking-wide text-wb-ntrl-6">
                                                        {opt.breadcrumb}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    </div>,
                    document.body,
                )}
        </>
    );
}
