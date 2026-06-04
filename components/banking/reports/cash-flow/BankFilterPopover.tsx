"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type BankFilterOption = {
    /** Internal bank code used on the wire. */
    bankCd: string;
    /** Bank display name (e.g. "BIDV"). */
    bankNm: string;
    /** Account number — the `(bankCd, acctNo)` pair is what ships in
     *  the request's `bankFilters[]` array. */
    acctNo: string;
};

export type BankFilterValue = {
    bankCd: string;
    acctNo: string;
};

type Props = {
    /** Available accounts pulled from {@code /api/v1/banking/accounts}. */
    options: BankFilterOption[];
    /** Selected accounts — empty means "All Banks" (no filter on the wire). */
    value: BankFilterValue[];
    /** Selection setter. */
    onChange: (next: BankFilterValue[]) => void;
    /** Loading flag — disables the trigger while accounts load on mount. */
    loading?: boolean;
    /** Drop the trigger's own border / shadow when nested inside a
     *  filter-row card that owns the chrome. */
    flush?: boolean;
    /** Override the trigger min-width. */
    triggerClassName?: string;
};

const ALL_KEY = "__all__";

/**
 * Mirrors the legacy `cash_0001_001` "All Banks" picker — a single chip
 * trigger that opens a checkable list of (bank, account) pairs. Empty
 * selection shows the localized "All Banks" label; non-empty shows
 * "N selected".
 *
 * Wire contract: each selected entry maps 1:1 to one element in the
 * request's `bankFilters` array (see backend §3.10 — the filter is
 * permissive, matching any entry by `bank_cd` OR `acct_no` OR both).
 *
 * Local to the Cash Flow report for now — lift to
 * `components/shared/` if a second page needs the same picker (per the
 * two-call rule).
 */
export default function BankFilterPopover({
    options,
    value,
    onChange,
    loading = false,
    flush = false,
    triggerClassName,
}: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        function onMouseDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [open]);

    const selectedKeys = useMemo(() => {
        return new Set(value.map((v) => `${v.bankCd}::${v.acctNo}`));
    }, [value]);

    const filteredOptions = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => {
            return (
                o.bankNm.toLowerCase().includes(q) ||
                o.acctNo.toLowerCase().includes(q) ||
                o.bankCd.toLowerCase().includes(q)
            );
        });
    }, [options, search]);

    const triggerLabel = useMemo(() => {
        if (value.length === 0) return t("report.cash_flow.field.all_banks");
        if (value.length === 1) {
            const o = options.find(
                (x) => x.bankCd === value[0].bankCd && x.acctNo === value[0].acctNo,
            );
            return o ? `${o.bankNm} · ${o.acctNo}` : t("report.cash_flow.field.n_selected", { n: 1 });
        }
        return t("report.cash_flow.field.n_selected", { n: value.length });
    }, [value, options, t]);

    function toggle(option: BankFilterOption) {
        const key = `${option.bankCd}::${option.acctNo}`;
        if (selectedKeys.has(key)) {
            onChange(value.filter((v) => `${v.bankCd}::${v.acctNo}` !== key));
        } else {
            onChange([...value, { bankCd: option.bankCd, acctNo: option.acctNo }]);
        }
    }

    function selectAll() {
        onChange([]);
    }

    const allSelected = value.length === 0;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => !loading && setOpen((o) => !o)}
                disabled={loading}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={t("report.cash_flow.field.bank_filter")}
                className={cn(
                    "flex h-[var(--h-wb-filter-btn)] min-w-[160px] cursor-pointer items-center justify-between gap-2 px-3",
                    "text-wb-13 font-medium text-wb-ink",
                    flush
                        ? "bg-transparent hover:bg-black/[0.03]"
                        : "rounded-md border border-wb-ntrl-4 bg-white shadow-wb-btn hover:bg-black/[0.03]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    triggerClassName,
                )}
            >
                <span className="truncate">{triggerLabel}</span>
                <ChevronDown className="size-4 shrink-0 text-wb-ntrl-6" />
            </button>

            {open && (
                <div
                    role="listbox"
                    className={cn(
                        // `w-full` resolves against the `relative` wrapper,
                        // which shrink-wraps to the trigger button — so the
                        // menu width === trigger width, anchored at `left-0`.
                        // Long bank names truncate (see option spans) instead
                        // of widening the menu.
                        "absolute left-0 top-[calc(100%+4px)] z-50",
                        "flex w-full flex-col rounded-md border border-wb-ntrl-4 bg-white",
                        "shadow-[0_4px_12px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]",
                    )}
                >
                    <div className="custom-scrollbar-y max-h-[320px] overflow-y-auto py-1">
                        {/* "All Banks" row — clears the selection. */}
                        <button
                            type="button"
                            onClick={selectAll}
                            className={cn(
                                "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2",
                                "text-left text-wb-13 font-medium text-wb-ink",
                                "hover:bg-wb-bg-sidebar",
                                allSelected && "bg-brand-soft",
                            )}
                        >
                            <span className="min-w-0 flex-1 truncate">
                                {t("report.cash_flow.field.all_banks")}
                            </span>
                            <CheckboxGlyph checked={allSelected} />
                        </button>

                        {filteredOptions.map((opt) => {
                            const key = `${opt.bankCd}::${opt.acctNo}`;
                            const selected = selectedKeys.has(key);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggle(opt)}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2",
                                        "text-left text-wb-13 font-medium text-wb-ink",
                                        "hover:bg-wb-bg-sidebar",
                                        selected && "bg-brand-soft",
                                    )}
                                >
                                    <span className="min-w-0 flex-1 truncate">
                                        {opt.bankNm} {opt.acctNo}
                                    </span>
                                    <CheckboxGlyph checked={selected} />
                                </button>
                            );
                        })}

                        {filteredOptions.length === 0 && (
                            <p className="px-3 py-3 text-center text-wb-12 text-wb-muted">
                                {t("report.cash_flow.field.no_accounts")}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export { ALL_KEY };

function CheckboxGlyph({ checked }: { checked: boolean }) {
    return (
        <span
            className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border",
                checked
                    ? "border-brand bg-brand text-white"
                    : "border-wb-ntrl-4 bg-white",
            )}
            aria-hidden="true"
        >
            {checked && <Check className="size-3" strokeWidth={3} />}
        </span>
    );
}
