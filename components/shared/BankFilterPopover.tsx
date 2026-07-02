"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type BankFilterOption = {
    /** Internal bank code. */
    bankCd: string;
    /** Bank display name (e.g. "Shinhan VN", "BIDV"). */
    bankNm: string;
    /** Account number — the `(bankCd, acctNo)` pair is the selection key. */
    acctNo: string;
};

export type BankFilterValue = {
    bankCd: string;
    acctNo: string;
};

type Props = {
    /** Available accounts. */
    options: BankFilterOption[];
    /** Selected accounts — empty means "All Banks" (no filter). */
    value: BankFilterValue[];
    /** Selection setter. */
    onChange: (next: BankFilterValue[]) => void;
    /** Loading flag — disables the trigger while accounts load. */
    loading?: boolean;
    /** Drop the trigger's own border / shadow when nested inside a
     *  filter-row card that owns the chrome. */
    flush?: boolean;
    /** Override the trigger min-width / chrome. */
    triggerClassName?: string;
};

/**
 * Shared "All Banks" multi-select picker (legacy `cash_0001_001` parity). A
 * single chip trigger that opens a checkable list of (bank, account) pairs:
 * empty selection shows the localized "All Banks" label; a single selection
 * shows `bankNm · acctNo`; multiple show "N selected".
 *
 * Lifted out of the Cash Flow report to `components/shared/` when Daily
 * Financial (HS) became the second consumer (two-call rule). i18n-driven via
 * the generic `report.bank_filter.*` namespace so no consumer owns the labels.
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

    const triggerLabel = useMemo(() => {
        if (value.length === 0) return t("report.bank_filter.all_banks");
        if (value.length === 1) {
            const o = options.find(
                (x) => x.bankCd === value[0].bankCd && x.acctNo === value[0].acctNo,
            );
            return o ? `${o.bankNm} · ${o.acctNo}` : t("report.bank_filter.n_selected", { n: 1 });
        }
        return t("report.bank_filter.n_selected", { n: value.length });
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
                aria-label={t("report.bank_filter.aria_label")}
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
                                {t("report.bank_filter.all_banks")}
                            </span>
                            <CheckboxGlyph checked={allSelected} />
                        </button>

                        {options.map((opt) => {
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

                        {options.length === 0 && (
                            <p className="px-3 py-3 text-center text-wb-12 text-wb-muted">
                                {t("report.bank_filter.no_accounts")}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

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
