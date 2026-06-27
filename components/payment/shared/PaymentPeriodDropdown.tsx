"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import DateField from "@/components/shared/DateField";
import { formatDateLang } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Period filter dropdown shared by every Payment list page that mirrors
 * legacy `pymn_*` / `resl_0001_001` filter chrome — four canonical
 * options: Last 30 / 90 / 180 Days + Enter Manually.
 *
 * <p>When the user selects "Enter Manually" the dropdown opens an
 * inline popover with two {@code <DateField>} chips (From / To) plus
 * Cancel / Save. Save emits {@code onManualRangeChange} carrying the
 * chosen `(fromDate, toDate)` pair in `yyyymmdd` format AND flips
 * {@code period} to `"manual"`. The trigger then renders the chosen
 * range as `"DD-MM-YYYY ~ DD-MM-YYYY"` so the window stays visible at
 * a glance. Cancel discards the draft.
 *
 * <p>Pages that don't wire {@code onManualRangeChange} have the
 * "Enter Manually" option hidden — the dropdown falls back to the
 * three preset choices (matches the legacy behaviour of pages that
 * never exposed a manual range).
 */

export type PeriodKey = "30d" | "90d" | "180d" | "manual";
export type ManualDateRange = { fromDate: string; toDate: string };

type PaymentPeriodDropdownProps = {
    /** Current period selection. */
    period: PeriodKey;
    /** Fires when the user picks a preset OR commits a manual range. */
    onPeriodChange: (period: PeriodKey) => void;
    /** Current manual range (yyyymmdd) when `period === "manual"`. */
    manualRange?: ManualDateRange;
    /** Fires when the user commits a manual range via Save. When
     *  omitted, the "Enter Manually" option is hidden. */
    onManualRangeChange?: (range: ManualDateRange) => void;
    /** Override the trigger button width. Defaults to `--w-wb-st-period`. */
    width?: string;
};

export default function PaymentPeriodDropdown({
    period,
    onPeriodChange,
    manualRange,
    onManualRangeChange,
    width = "var(--w-wb-st-period)",
}: PaymentPeriodDropdownProps) {
    const { t, locale } = useTranslation();
    const [open, setOpen]               = useState(false);
    const [manualPopover, setManualPop] = useState(false);
    const [draftFrom, setDraftFrom]     = useState<string>("");
    const [draftTo, setDraftTo]         = useState<string>("");
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open && !manualPopover) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) {
                setOpen(false);
                setManualPop(false);
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setOpen(false);
                setManualPop(false);
            }
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, manualPopover]);

    const baseOptions: Array<{ value: PeriodKey; label: string }> = [
        { value: "30d",  label: t("payment.internal.filter.last_30_days")  },
        { value: "90d",  label: t("payment.internal.filter.last_90_days")  },
        { value: "180d", label: t("payment.internal.filter.last_180_days") },
    ];
    const options: Array<{ value: PeriodKey; label: string }> = onManualRangeChange
        ? [...baseOptions, { value: "manual", label: t("payment.internal.filter.enter_manually") }]
        : baseOptions;

    const triggerLabel = (() => {
        if (period === "manual") {
            if (manualRange) {
                return `${formatDateLang(manualRange.fromDate, locale)} ~ ${formatDateLang(manualRange.toDate, locale)}`;
            }
            return t("payment.internal.filter.enter_manually");
        }
        return options.find((o) => o.value === period)?.label ?? options[0].label;
    })();

    function selectOption(value: PeriodKey) {
        if (value === "manual") {
            const today = isoFromYyyymmdd(yyyymmddToday());
            setDraftFrom(manualRange ? isoFromYyyymmdd(manualRange.fromDate) : today);
            setDraftTo(manualRange ? isoFromYyyymmdd(manualRange.toDate) : today);
            setOpen(false);
            setManualPop(true);
            return;
        }
        onPeriodChange(value);
        setOpen(false);
    }

    function saveManual() {
        if (!draftFrom || !draftTo) return;
        if (draftFrom > draftTo) return;
        if (onManualRangeChange) {
            onManualRangeChange({
                fromDate: yyyymmddFromIso(draftFrom),
                toDate:   yyyymmddFromIso(draftTo),
            });
        }
        onPeriodChange("manual");
        setManualPop(false);
    }

    return (
        <div ref={rootRef} className="relative" style={{ width }}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md bg-white px-2 shadow-wb-btn"
            >
                <span className="flex-1 truncate text-left text-wb-14-tight font-medium text-wb-ntrl-8">
                    {triggerLabel}
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    // z-30 (not z-10) so the popover paints above any
                    // sibling sticky `<thead>` in a sibling scroll
                    // container. Inside a modal the dropdown and the
                    // table are siblings of `<DialogContent>` — both at
                    // z-10 means the later DOM node (the table thead)
                    // wins and clips the popover. Same fix applies to
                    // the manual popover below.
                    className="absolute left-0 right-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-30 rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === period;
                        return (
                            <li key={opt.value}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => selectOption(opt.value)}
                                    className={cn(
                                        "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                        isSelected
                                            ? "bg-brand-soft text-brand"
                                            : "text-wb-ink hover:bg-wb-bg-sidebar",
                                    )}
                                >
                                    {opt.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            {manualPopover && (
                <div
                    className="absolute left-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-40 flex flex-col gap-3 rounded-md border border-wb-ntrl-4 bg-white p-3 shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                    style={{ minWidth: 360 }}
                >
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <DateField value={draftFrom} onChange={setDraftFrom} />
                        </div>
                        <span className="text-wb-13 font-medium text-wb-ntrl-6">~</span>
                        <div className="flex-1">
                            <DateField
                                value={draftTo}
                                onChange={setDraftTo}
                                minIso={draftFrom || undefined}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setManualPop(false)}
                            className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/5"
                        >
                            {t("dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={saveManual}
                            disabled={!draftFrom || !draftTo || draftFrom > draftTo}
                            className={cn(
                                "flex h-8 items-center rounded-md px-3 text-wb-13 font-medium text-white shadow-wb-brand-btn",
                                draftFrom && draftTo && draftFrom <= draftTo
                                    ? "cursor-pointer bg-brand hover:bg-brand-hover"
                                    : "cursor-not-allowed bg-wb-ntrl-4",
                            )}
                        >
                            {t("dialog.save")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Today as `yyyymmdd` in the user's local timezone. */
export function yyyymmddToday(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** `yyyymmdd` (8 char) → ISO `YYYY-MM-DD`. Empty string on bad input. */
export function isoFromYyyymmdd(raw: string): string {
    if (!raw || raw.length !== 8) return "";
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** ISO `YYYY-MM-DD` → `yyyymmdd`. Empty string on bad input. */
export function yyyymmddFromIso(iso: string): string {
    if (!iso || iso.length !== 10) return "";
    return iso.replace(/-/g, "");
}

/** `yyyymmdd` → `DD-MM-YYYY` for the trigger label. */
export function dmyFromYyyymmdd(raw: string): string {
    if (!raw || raw.length !== 8) return raw ?? "";
    return `${raw.slice(6, 8)}-${raw.slice(4, 6)}-${raw.slice(0, 4)}`;
}
