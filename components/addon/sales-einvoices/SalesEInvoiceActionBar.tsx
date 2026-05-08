"use client";

import { ChevronDown, ChevronUp, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SalesEInvoiceActionBarProps = {
    onPrint?: () => void;
    /** Triggered by the "Download Excel with List" menu row — calls the
     *  page's existing list-export flow (POST /api/v1/addon/einvoices/export). */
    onExport?: () => void;
    /** Triggered by the "Download Excel with Details" menu row. Wired by
     *  the page wrapper to either a real detail-export endpoint when the
     *  backend lands one, or a "not implemented" dialog stop-gap until then.
     *  See the deferred-feature note below. */
    onExportDetails?: () => void;
    onUpdate?: () => void;
    /** When true, the Excel button is disabled (and rendered with a
     *  reduced-opacity hint) so a slow download can't be triggered
     *  twice. Wired by the Sales / Bill pages while
     *  {@code useExcelExport} is running. */
    exporting?: boolean;
    className?: string;
};

/**
 * Figma 9194:6859 — the Sales e-Invoices page has its own action group that
 * diverges from the shared `PageActionButtons`: print icon, vertical divider,
 * Excel button + chevron that opens a two-row popover ("Download Excel with
 * List" / "Download Excel with Details") matching the legacy `einv_0001_000`
 * UI, and a raised "Update" button with a refresh glyph. Kept local to this
 * feature so the shared trio used by other pages (list / print / excel)
 * isn't forced to grow a dropdown + CTA.
 *
 * <p>Click-outside + ESC dismiss mirror {@link InvoiceStatusFilter}'s pattern.
 */
export default function SalesEInvoiceActionBar({
    onPrint,
    onExport,
    onExportDetails,
    onUpdate,
    exporting = false,
    className,
}: SalesEInvoiceActionBarProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Click-outside dismiss — same pattern as InvoiceStatusFilter.
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    // ESC dismiss.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    // Close the menu on a successful export trigger so the spinner state
    // (driven by `exporting` from the page) is the only visible feedback.
    const handleListClick = () => {
        if (exporting) return;
        setOpen(false);
        onExport?.();
    };
    const handleDetailsClick = () => {
        if (exporting) return;
        setOpen(false);
        onExportDetails?.();
    };

    return (
        <div className={cn("flex items-center gap-6", className)}>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    aria-label={t("common.print")}
                    onClick={onPrint}
                    className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-print.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                </button>

                {/* Figma 9194:6868 — vertical divider between print and excel */}
                <span
                    aria-hidden
                    className="block h-[18px] w-px bg-wb-border-sidebar"
                />

                <div ref={ref} className="relative">
                    <button
                        type="button"
                        aria-label={t("common.export_excel")}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        aria-busy={exporting || undefined}
                        onClick={() => setOpen((prev) => !prev)}
                        disabled={exporting}
                        className={cn(
                            "flex items-center justify-center gap-1 rounded-lg bg-wb-bg-sidebar p-1 hover:bg-black/5",
                            exporting ? "cursor-wait opacity-60" : "cursor-pointer",
                        )}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-excel.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                        {open ? (
                            <ChevronUp
                                aria-hidden
                                className="size-5 text-wb-ink"
                                strokeWidth={2}
                            />
                        ) : (
                            <ChevronDown
                                aria-hidden
                                className="size-5 text-wb-ink"
                                strokeWidth={2}
                            />
                        )}
                    </button>

                    {open && (
                        <ul
                            role="menu"
                            aria-label={t("common.export_excel")}
                            className="absolute right-0 top-full z-20 mt-1 w-[260px] overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                        >
                            <ExcelMenuRow
                                label={t("common.download_excel_with_list")}
                                onClick={handleListClick}
                                disabled={exporting}
                            />
                            <ExcelMenuRow
                                label={t("common.download_excel_with_details")}
                                onClick={handleDetailsClick}
                                disabled={exporting}
                            />
                        </ul>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={onUpdate}
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-4 shadow-wb-btn"
            >
                <RotateCw aria-hidden className="size-5 text-brand" strokeWidth={2} />
                <span className="text-wb-14 font-medium tracking-wb-tight text-brand">
                    {t("common.update")}
                </span>
            </button>
        </div>
    );
}

type ExcelMenuRowProps = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
};

function ExcelMenuRow({ label, onClick, disabled }: ExcelMenuRowProps) {
    return (
        <li role="none">
            <button
                type="button"
                role="menuitem"
                onClick={onClick}
                disabled={disabled}
                className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                    disabled ? "cursor-wait opacity-60" : "cursor-pointer",
                )}
            >
                <span className="whitespace-nowrap">{label}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/common/ico-download.svg"
                    alt=""
                    aria-hidden
                    className="size-4 shrink-0"
                />
            </button>
        </li>
    );
}
