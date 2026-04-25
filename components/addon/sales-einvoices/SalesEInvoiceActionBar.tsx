"use client";

import { ChevronDown, RotateCw } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SalesEInvoiceActionBarProps = {
    onPrint?: () => void;
    onExport?: () => void;
    onUpdate?: () => void;
    className?: string;
};

/**
 * Figma 9194:6859 — the Sales e-Invoices page has its own action group that
 * diverges from the shared `PageActionButtons`: print icon, vertical divider,
 * excel button with chevron dropdown, and a raised "Update" button with a
 * refresh glyph. Kept local to this feature so the shared trio used by other
 * pages (list / print / excel) isn't forced to grow a dropdown + CTA.
 */
export default function SalesEInvoiceActionBar({
    onPrint,
    onExport,
    onUpdate,
    className,
}: SalesEInvoiceActionBarProps) {
    const { t } = useTranslation();

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

                <button
                    type="button"
                    aria-label={t("common.export_excel")}
                    onClick={onExport}
                    className="flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-wb-bg-sidebar p-1 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-excel.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                    <ChevronDown
                        aria-hidden
                        className="size-5 text-wb-ink"
                        strokeWidth={2}
                    />
                </button>
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
