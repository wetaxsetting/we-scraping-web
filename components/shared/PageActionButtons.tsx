"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PageActionButtonsProps = {
    /**
     * Show the list-view icon button. Must be explicitly set to `true` — icons
     * do NOT render by default so detail pages can't accidentally inherit the
     * full list-page toolbar.
     */
    showList?: boolean;
    /**
     * Show the print icon button. Opt-in only.
     */
    showPrint?: boolean;
    /**
     * Show the export-to-Excel icon button. Opt-in only.
     */
    showExcel?: boolean;
    onList?: () => void;
    onPrint?: () => void;
    onExport?: () => void;
    className?: string;
};

/**
 * Configurable utility-action icon bar (list / print / export-to-Excel).
 *
 * Icons are opt-in — `showList`, `showPrint`, `showExcel` all default to
 * `false`. Every call site must declare which icons it needs. This prevents
 * detail pages from accidentally inheriting the full list-page toolbar.
 *
 * List pages: pass `showList showPrint showExcel`.
 * Detail pages: pass `showList` only (Figma 8:599 — no print, no excel).
 *
 * Icon assets come from `/assets/common/`. Never substitute lucide icons
 * for toolbar actions.
 */
export default function PageActionButtons({
    showList = false,
    showPrint = false,
    showExcel = false,
    onList,
    onPrint,
    onExport,
    className,
}: PageActionButtonsProps) {
    const { t } = useTranslation();

    if (!showList && !showPrint && !showExcel) return null;

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {showList && (
                <button
                    type="button"
                    aria-label={t("common.open_list")}
                    onClick={onList}
                    className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-list.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                </button>
            )}
            {showPrint && (
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
            )}
            {showExcel && (
                <button
                    type="button"
                    aria-label={t("common.export_excel")}
                    onClick={onExport}
                    className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-excel.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                </button>
            )}
        </div>
    );
}
