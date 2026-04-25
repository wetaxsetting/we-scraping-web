"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { TransactionTypeFilter as Value } from "./types";

type TransactionTypeFilterProps = {
    value: Value;
    onChange: (next: Value) => void;
    className?: string;
};

const OPTIONS: { value: Value; labelKey: string }[] = [
    { value: "all", labelKey: "txn_history.filter.all_transactions" },
    { value: "deposit", labelKey: "txn_history.filter.deposit" },
    { value: "withdraw", labelKey: "txn_history.filter.withdraw" },
];

/**
 * Radio group for the transaction type filter (All / Deposit / Withdraw)
 * used in the Transaction History filter row. Native `<input type="radio">`
 * keeps keyboard + screen-reader behaviour for free; the label wraps the
 * input + custom dot so the whole chip is clickable.
 */
export default function TransactionTypeFilter({
    value,
    onChange,
    className,
}: TransactionTypeFilterProps) {
    const { t } = useTranslation();
    return (
        <div
            role="radiogroup"
            className={cn("flex items-center gap-4", className)}
        >
            {OPTIONS.map((opt) => {
                const checked = value === opt.value;
                return (
                    <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2"
                    >
                        <input
                            type="radio"
                            name="txn-type-filter"
                            value={opt.value}
                            checked={checked}
                            onChange={() => onChange(opt.value)}
                            className="peer sr-only"
                        />
                        <span
                            aria-hidden
                            className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                                checked
                                    ? "border-brand bg-white"
                                    : "border-wb-ntrl-4 bg-white",
                            )}
                        >
                            <span
                                className={cn(
                                    "block size-2 rounded-full transition-all",
                                    checked ? "bg-brand" : "bg-transparent",
                                )}
                            />
                        </span>
                        <span className="whitespace-nowrap text-wb-14-tight font-medium text-wb-ink">
                            {t(opt.labelKey)}
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
