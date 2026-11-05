"use client";

import { Select } from "@/components/shared/Select";
import type { PeriodKind } from "@/lib/api/weinvoice/checks";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PeriodValue = { kind: PeriodKind; n: number; year: number };

/** Tháng / Quý / Năm segmented control + number + year (Invoy "Kiểm tra" pages). */
export function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (v: PeriodValue) => void }) {
    const { t } = useTranslation();
    const max = value.kind === "month" ? 12 : value.kind === "quarter" ? 4 : 0;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md bg-wb-bg-sidebar p-0.5">
                {(["month", "quarter", "year"] as const).map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => onChange({ ...value, kind: k, n: k === "quarter" ? Math.min(4, Math.ceil(value.n / 3) || 1) : k === "month" ? Math.min(12, value.n) : 1 })}
                        className={cn("h-8 cursor-pointer rounded px-3 text-wb-13 font-semibold", value.kind === k ? "bg-white text-brand shadow-wb-btn" : "text-wb-ntrl-7")}
                    >
                        {t(`per.${k}`)}
                    </button>
                ))}
            </div>
            {max > 0 && (
                <Select
                    value={String(value.n)}
                    width={130}
                    options={Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: t(value.kind === "month" ? "per.month_n" : "per.quarter_n", { n: i + 1 }) }))}
                    onChange={(v) => onChange({ ...value, n: Number(v) })}
                />
            )}
            <Select value={String(value.year)} width={110} options={[2025, 2026].map((y) => ({ value: String(y), label: t("per.year_n", { n: y }) }))} onChange={(v) => onChange({ ...value, year: Number(v) })} />
        </div>
    );
}
