"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { fetchVasAccountLookup } from "@/lib/api/vasAccount";
import type { ApiVasAccountLookupRow } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * VAS Account typeahead picker for Edit Bank Account dialog (Batch B).
 * Mirrors legacy `comm_1002_001` — the WSVC that powers the VAS Account
 * select on the legacy edit dialog.
 *
 * Loads all active VAS accounts in one shot (`GET /api/v1/settings/vas-account/lookup`)
 * on first open, then filters client-side as the user types. Capped at
 * 500 rows server-side; for tenants beyond that the picker truncates
 * silently — the next stabilisation pass will paginate when a real
 * tenant grows beyond that ceiling.
 *
 * Shape mirrors `AccountTypeDropdown` in the same dialog so the visual
 * rhythm matches the other form controls.
 */
export type VasAccountSelection = {
    seqNo: number;
    code: string;
    name: string;
};

type VasAccountPickerProps = {
    /** Currently selected mapping. `null` = no VAS mapping (cleared). */
    value: VasAccountSelection | null;
    /** Fires when the user picks a row or clears the selection. */
    onChange: (next: VasAccountSelection | null) => void;
};

export default function VasAccountPicker({ value, onChange }: VasAccountPickerProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<ApiVasAccountLookupRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    /** Combobox query — what's currently typed in the trigger's input.
     *  Empty string means "show selected value" (or placeholder); any
     *  non-empty string filters the list and replaces the chip label. */
    const [query, setQuery] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch once on first open, then cache the result for the dialog's
    // lifetime. The full lookup is cheap (≤ 500 rows of 3 fields each)
    // and client-side filtering keeps keystrokes responsive.
    //
    // IMPORTANT: deps are `[open]` only. Including `items` / `loading`
    // would trigger the effect's cleanup (cancelled = true) every time
    // those flip — which means the very fetch that just SET them gets
    // its callback ignored, and the picker stays stuck on "Loading…".
    // The early-return on `loading` + `items` is enough idempotency.
    useEffect(() => {
        if (!open) return;
        if (items !== null || loading) return;
        let cancelled = false;
        setLoading(true);
        setError(false);
        fetchVasAccountLookup()
            .then((res) => {
                if (!cancelled) setItems(res.items);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Sync the typed query with the dropdown's open/close state.
    //   - On OPEN: seed the input with the selected "code + name"
    //     (e.g. "333 Test") — same shape as the dropdown rows — so the
    //     user can edit / Backspace from there.
    //   - On CLOSE: clear the query so the chip snaps back to showing
    //     the selected value (or placeholder when nothing's picked).
    useEffect(() => {
        if (open) {
            setQuery(value ? formatLabel(value.code, value.name) : "");
        } else {
            setQuery("");
        }
    }, [open, value]);

    // Outside-click closes.
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const placeholder = t("settings.bank_account.edit.vas_placeholder");

    /** Filtered + sorted list. Substring match on either code or name
     *  (case insensitive); when no query is typed, every row shows. */
    const rows = useMemo(() => {
        const all = items ?? [];
        const q = query.trim().toLowerCase();
        if (!q) return all;
        return all.filter(
            (it) =>
                it.vas_acct_cd.toLowerCase().includes(q) ||
                it.vas_acct_nm.toLowerCase().includes(q),
        );
    }, [items, query]);

    /** Trigger input value.
     *  - When the dropdown is OPEN, the input always reflects what the
     *    user has typed — even an empty string. Snapping back to the
     *    selected value's code while typing would make Backspace look
     *    broken (delete the last char → instantly see the selected
     *    code again).
     *  - When the dropdown is CLOSED, show the selected "code + name"
     *    (same shape as the dropdown rows) so the chip mirrors the
     *    list entry. */
    const inputValue = open
        ? query
        : value
            ? formatLabel(value.code, value.name)
            : "";

    return (
        <div ref={ref} className="relative inline-block w-full">
            {/* Combobox trigger — styled to match `ClearableInput`
               (nickname/description) so the row reads as a row of
               consistent inputs. Flat shadow-wb-outline ring, brand
               focus glow, X clear button absolutely positioned on the
               right edge, chevron sits between the value and the X. */}
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                placeholder={placeholder}
                onChange={(e) => {
                    setQuery(e.target.value);
                    if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        setQuery("");
                        setOpen(false);
                    } else if (e.key === "ArrowDown" && !open) {
                        setOpen(true);
                    }
                }}
                className={cn(
                    "h-8 w-full rounded-md bg-white py-2 pl-2 text-wb-14 font-medium leading-4 text-wb-ntrl-8",
                    "shadow-wb-outline outline-none",
                    "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                    // Reserve right padding for X + chevron (X = 16px,
                    // chevron = 16px, gap/padding = ~12px → pr-11).
                    value ? "pr-11" : "pr-7",
                )}
            />
            {value && (
                <button
                    type="button"
                    aria-label={t("settings.bank_account.edit.vas_clear")}
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(null);
                        setQuery("");
                        inputRef.current?.focus();
                    }}
                    className="absolute right-7 top-1/2 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-wb-ntrl-4 text-white hover:bg-wb-ntrl-6"
                >
                    <X className="size-2.5" strokeWidth={2.5} />
                </button>
            )}
            <button
                type="button"
                onClick={() => {
                    setOpen((prev) => !prev);
                    inputRef.current?.focus();
                }}
                aria-label={open ? "Close" : "Open"}
                className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center text-wb-ntrl-8"
            >
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={2}
                    aria-hidden
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-y-auto overflow-x-hidden rounded-md bg-white p-2 shadow-[0px_0px_0.5px_0px_rgba(0,0,0,0.22),0px_1px_1px_0px_rgba(0,0,0,0.06),0px_4px_10px_0px_rgba(0,0,0,0.15)] custom-scrollbar-y"
                >
                    {loading && (
                        <li className="flex h-7 items-center px-2 text-wb-13 font-medium text-wb-ntrl-6">
                            {t("common.loading")}
                        </li>
                    )}
                    {!loading && error && (
                        <li className="flex h-7 items-center px-2 text-wb-13 font-medium text-wb-red-07">
                            {t("dialog.error")}
                        </li>
                    )}
                    {!loading && !error && rows.length === 0 && (
                        <li className="flex h-7 items-center px-2 text-wb-13 font-medium text-wb-ntrl-6">
                            {t("settings.bank_account.edit.vas_empty")}
                        </li>
                    )}
                    {!loading &&
                        !error &&
                        rows.map((it, i) => {
                            const selected = value?.seqNo === it.vas_acct_seq_no;
                            return (
                                <li
                                    key={it.vas_acct_seq_no}
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => {
                                        onChange({
                                            seqNo: it.vas_acct_seq_no,
                                            code:  it.vas_acct_cd,
                                            name:  it.vas_acct_nm,
                                        });
                                        setQuery("");
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex h-7 w-full min-w-0 cursor-pointer items-center rounded p-2 text-wb-13 font-medium hover:bg-wb-bg-active",
                                        i > 0 && "mt-0.5",
                                        selected ? "text-brand-hover" : "text-wb-ntrl-8",
                                    )}
                                >
                                    <span className="block w-full truncate whitespace-nowrap">
                                        {it.vas_acct_cd} {it.vas_acct_nm}
                                    </span>
                                </li>
                            );
                        })}
                </ul>
            )}
        </div>
    );
}

/** Compose the chip / dropdown row label. Same shape on both surfaces
 *  so opening the picker shows the selected entry sitting on top of the
 *  identically-formatted list of options. */
function formatLabel(code: string, name: string): string {
    return name ? `${code} ${name}` : code;
}
