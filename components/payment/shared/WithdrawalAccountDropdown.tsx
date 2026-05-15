"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiWithdrawalAccountRow } from "@/lib/types/api";
import { cn } from "@/lib/utils";

/**
 * ACCT_TYPE_CD → display label.
 */
const ACCT_TYPE_LABEL: Record<string, string> = {
    "03": "Current",   // VND
    "04": "Current",   // USD
    "05": "Savings",   // VND
    "06": "Savings",   // USD
    "07": "Current",   // KRW
    "08": "Savings",   // KRW
};

function acctTypeLabel(code: string): string {
    return ACCT_TYPE_LABEL[code] ?? "Savings";
}

export function formatWithdrawalAccount(a: ApiWithdrawalAccountRow): string {
    return `${a.bank_nm} ${a.acct_no} (${acctTypeLabel(a.acct_type_cd)} ${a.ccy_cd})`;
}

export function getWithdrawalAccountKey(a: ApiWithdrawalAccountRow): string {
    return `${a.bank_cd}|${a.acct_no}`;
}

type Props = {
    accounts: ApiWithdrawalAccountRow[];
    selectedKey: string;
    onSelect: (key: string) => void;
    emptyLabel: string;
    placeholderLabel: string;
    className?: string;
};

/**
 * Shared Withdrawal Account dropdown styled like the FilterDropdown.
 * Used in Excel upload modals for Internal Transfer, Overseas, etc.
 */
export default function WithdrawalAccountDropdown({
    accounts,
    selectedKey,
    onSelect,
    emptyLabel,
    placeholderLabel,
    className,
}: Props) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const selected = accounts.find((a) => getWithdrawalAccountKey(a) === selectedKey);
    const triggerLabel = selected ? formatWithdrawalAccount(selected)
        : accounts.length === 0 ? emptyLabel
        : placeholderLabel;
    const disabled = accounts.length === 0;

    useEffect(() => {
        if (!open) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cn("relative w-full", className)}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={placeholderLabel}
                className={cn(
                    "flex h-[var(--h-wb-filter-btn,32px)] w-full items-center justify-between gap-2 overflow-clip rounded-md bg-white px-2.5 shadow-wb-btn",
                    disabled
                        ? "cursor-not-allowed text-wb-muted"
                        : "cursor-pointer text-wb-ntrl-8",
                )}
            >
                <span className="flex-1 truncate text-left text-wb-13 font-medium">
                    {triggerLabel}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/pagination/ico-dropdown-chevron.svg"
                    alt=""
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 transition-transform",
                        open && "rotate-180",
                    )}
                />
            </button>
            {open && accounts.length > 0 && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-[calc(var(--h-wb-filter-btn,32px)+4px)] z-10 max-h-60 overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card"
                >
                    {accounts.map((a) => {
                        const key = getWithdrawalAccountKey(a);
                        const isSelected = key === selectedKey;
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onSelect(key);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                        isSelected
                                            ? "bg-brand-soft text-brand"
                                            : "text-wb-ink hover:bg-wb-bg-sidebar",
                                    )}
                                >
                                    {formatWithdrawalAccount(a)}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
