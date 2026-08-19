"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createVatDeclaration } from "@/lib/api/addon";
import { vatDeclErrorMessage } from "./vatDeclErrors";
import { useDialog } from "@/components/shared/dialog";
import { ACTIVITY_CODES, ANNEX_ITEMS, YEAR_OPTIONS } from "./mockData";
import type { ActivityCode } from "./mockData";
import TaxFilingDropdown from "./TaxFilingDropdown";
import type { DeclarationPeriodMode } from "./types";


const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const QUARTERS = [1, 2, 3, 4] as const;

type Props = {
    open: boolean;
    onClose: () => void;
    onNext: (checkedAnnexes: Set<string>, declId: number) => void;
};

const CalendarIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
        <path d="M12 9H9.75C9.55109 9 9.36032 9.07902 9.21967 9.21967C9.07902 9.36032 9 9.55109 9 9.75V12C9 12.1989 9.07902 12.3897 9.21967 12.5303C9.36032 12.671 9.55109 12.75 9.75 12.75H12C12.1989 12.75 12.3897 12.671 12.5303 12.5303C12.671 12.3897 12.75 12.1989 12.75 12V9.75C12.75 9.55109 12.671 9.36032 12.5303 9.21967C12.3897 9.07902 12.1989 9 12 9ZM12 1.5V2.25H6V1.5C6 1.30109 5.92098 1.11032 5.78033 0.96967C5.63968 0.829018 5.44891 0.75 5.25 0.75C5.05109 0.75 4.86032 0.829018 4.71967 0.96967C4.57902 1.11032 4.5 1.30109 4.5 1.5V2.25H3.75C3.5534 2.2501 3.35875 2.28902 3.17722 2.36452C2.9957 2.44003 2.83087 2.55065 2.6922 2.69001C2.55353 2.82938 2.44375 2.99476 2.36915 3.17666C2.29455 3.35856 2.25661 3.5534 2.2575 3.75L2.25 14.25C2.25 14.6478 2.40804 15.0294 2.68934 15.3107C2.97064 15.592 3.35218 15.75 3.75 15.75H14.25C14.6475 15.7488 15.0283 15.5904 15.3093 15.3093C15.5904 15.0283 15.7488 14.6475 15.75 14.25V3.75C15.7488 3.35254 15.5904 2.9717 15.3093 2.69065C15.0283 2.4096 14.6475 2.25119 14.25 2.25H13.5V1.5C13.5 1.30109 13.421 1.11032 13.2803 0.96967C13.1397 0.829018 12.9489 0.75 12.75 0.75C12.5511 0.75 12.3603 0.829018 12.2197 0.96967C12.079 1.11032 12 1.30109 12 1.5V1.5ZM13.5 14.25H4.5C4.30109 14.25 4.11032 14.171 3.96967 14.0303C3.82902 13.8897 3.75 13.6989 3.75 13.5V6H14.25V13.5C14.25 13.6989 14.171 13.8897 14.0303 14.0303C13.8897 14.171 13.6989 14.25 13.5 14.25Z" fill="#525252"/>
    </svg>
);

export default function NewVatDeclarationDialog({ open, onClose, onNext }: Props) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<DeclarationPeriodMode>("monthly");
    const [year, setYear] = useState("2026");
    // The period is held as its number, not its label. Deriving the number from
    // the label instead (indexOf) breaks the moment the label is translated —
    // indexOf returns -1 and the declaration is created for period 0.
    const [month, setMonth] = useState("1");
    const [quarter, setQuarter] = useState("1");
    const [industry, setIndustry] = useState<ActivityCode>("00");
    const [checkedAnnexes, setCheckedAnnexes] = useState<Set<string>>(
        () => new Set(ANNEX_ITEMS.filter((a) => a.defaultChecked).map((a) => a.id)),
    );
    const [loadGroup4, setLoadGroup4] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const dialog = useDialog();

    function toggleAnnex(id: string) {
        setCheckedAnnexes((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/45" onClick={onClose} />
            <div className="relative z-[51] w-full max-w-[1060px] rounded-2xl bg-white shadow-wb-card">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-wb-ntrl-4 px-6 py-5">
                    <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("tax_filing.new_dialog.title")}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    {/* Tabs: Monthly / Quarterly */}
                    <div className="mb-5 flex gap-0 border-b border-wb-ntrl-4">
                        {(["monthly", "quarterly"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={cn(
                                    "px-4 pb-2.5 text-wb-14 font-medium transition-colors",
                                    mode === m
                                        ? "border-b-2 border-brand text-brand"
                                        : "text-wb-ntrl-6 hover:text-wb-ink",
                                )}
                            >
                                {m === "monthly"
                                    ? t("tax_filing.new_dialog.tab_monthly")
                                    : t("tax_filing.new_dialog.tab_quarterly")}
                            </button>
                        ))}
                    </div>

                    {/* Declaration Period + Industry category */}
                    <div className="mb-5 flex flex-wrap items-end gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-wb-13 font-medium text-wb-ntrl-8">
                                {t("tax_filing.new_dialog.period_label")}
                                <span className="ml-0.5 text-wb-red-07">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                {/* Year picker — calendar icon INSIDE the dropdown trigger */}
                                <TaxFilingDropdown
                                    options={YEAR_OPTIONS}
                                    value={year}
                                    onChange={setYear}
                                    className="w-[110px]"
                                    trailingIcon={CalendarIcon}
                                    hideChevron
                                />
                                {/* Month or Quarter dropdown */}
                                {mode === "monthly" ? (
                                    <TaxFilingDropdown
                                        options={MONTHS.map((n) => ({
                                            value: String(n),
                                            label: t(`common.month.${n}`),
                                        }))}
                                        value={month}
                                        onChange={setMonth}
                                        className="w-[140px]"
                                    />
                                ) : (
                                    <TaxFilingDropdown
                                        options={QUARTERS.map((n) => ({
                                            value: String(n),
                                            label: t(`common.quarter.${n}`),
                                        }))}
                                        value={quarter}
                                        onChange={setQuarter}
                                        className="w-[130px]"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-1.5">
                            <label className="text-wb-13 font-medium text-wb-ntrl-8">
                                {t("tax_filing.new_dialog.industry_label")}
                                <span className="ml-0.5 text-wb-red-07">*</span>
                            </label>
                            <TaxFilingDropdown
                                options={ACTIVITY_CODES.map((code) => ({
                                    value: code,
                                    label: t(`tax_filing.new_dialog.industry.${code}`),
                                }))}
                                value={industry}
                                onChange={(v) => setIndustry(v as ActivityCode)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Annex table */}
                    <div className="mb-4 overflow-hidden rounded-md border border-wb-ntrl-4">
                        <table className="w-full table-fixed">
                            <colgroup>
                                <col className="w-10" />
                                <col className="w-[420px]" />
                                <col />
                            </colgroup>
                            <thead>
                                <tr className="border-b border-wb-ntrl-4 bg-wb-bg-sidebar">
                                    <th className="border-r border-wb-ntrl-4 px-3 py-2.5" />
                                    <th className="border-r border-wb-ntrl-4 px-3 py-2.5 text-left text-wb-13 font-semibold text-wb-dark">
                                        {t("tax_filing.new_dialog.annex_code")}
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-wb-13 font-semibold text-wb-dark">
                                        {t("tax_filing.new_dialog.filing_period")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ANNEX_ITEMS.map((item, i) => (
                                    <tr
                                        key={item.id}
                                        className={cn(
                                            "cursor-pointer hover:bg-wb-bg-sidebar",
                                            i < ANNEX_ITEMS.length - 1 && "border-b border-wb-ntrl-4",
                                        )}
                                        onClick={() => toggleAnnex(item.id)}
                                    >
                                        <td className="border-r border-wb-ntrl-4 px-3 py-3 text-center">
                                            <Checkbox
                                                checked={checkedAnnexes.has(item.id)}
                                                onCheckedChange={() => toggleAnnex(item.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="border-r border-wb-ntrl-4 px-3 py-3 text-wb-13 font-medium text-brand">
                                            {item.code}
                                        </td>
                                        <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                            {item.filingPeriod}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Load group 4 checkbox */}
                    <label className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                            checked={loadGroup4}
                            onCheckedChange={(v) => setLoadGroup4(Boolean(v))}
                        />
                        <span className="text-wb-13 font-medium text-wb-ink">
                            {t("tax_filing.new_dialog.load_group4")}
                        </span>
                    </label>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-wb-ntrl-4 px-6 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {t("tax_filing.new_dialog.close")}
                    </button>
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={async () => {
                            setSubmitting(true);
                            try {
                                const periodValue = Number(
                                    mode === "monthly" ? month : quarter,
                                );
                                const detail = await createVatDeclaration({
                                    period_type: mode === "monthly" ? "M" : "Q",
                                    period_value: periodValue,
                                    decl_year: Number(year),
                                    bsns_line_cd: industry,
                                    annex_bkbr_yn: checkedAnnexes.has("bkbr") ? "Y" : "N",
                                    annex_bkmv_yn: checkedAnnexes.has("bkmv") ? "Y" : "N",
                                    annex_reduce8_yn: checkedAnnexes.has("pl_142") ? "Y" : "N",
                                });
                                onNext(checkedAnnexes, detail.sid);
                            } catch (err: unknown) {
                                const e = err as { code?: string; message?: string };
                                dialog.open({
                                    type: "error",
                                    title: t("dialog.error"),
                                    description: vatDeclErrorMessage(e, t),
                                    errorCode: e?.code ?? "WBE9999",
                                });
                            } finally {
                                setSubmitting(false);
                            }
                        }}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {t("tax_filing.new_dialog.next")}
                    </button>
                </div>
            </div>
        </div>
    );
}
