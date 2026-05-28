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
    /**
     * Click handler for the list-view icon. The icon's `DOMRect` is passed
     * so callers that anchor a popover (e.g. View Setting per CLAUDE.md
     * §13) can position relative to the trigger. Existing call sites that
     * ignore the argument continue to work unchanged.
     */
    onList?: (anchorRect: DOMRect) => void;
    onPrint?: () => void;
    onExport?: () => void;
    /**
     * True while the page's Excel export request is in flight (or held
     * sticky immediately after). Disables Print + Excel and renders them
     * in a cursor-wait, dim state so the user can't fire a duplicate
     * download on a fast resolve. List stays interactive because it
     * opens a local popover, not an API call. Opt-in — defaults to
     * false so existing call sites are unaffected.
     */
    exporting?: boolean;
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
    exporting = false,
    className,
}: PageActionButtonsProps) {
    const { t } = useTranslation();

    if (!showList && !showPrint && !showExcel) return null;

    const exportIconBtnClass = cn(
        "flex items-center justify-center rounded-md p-1 hover:bg-black/5",
        exporting ? "cursor-wait opacity-60" : "cursor-pointer",
    );

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {showList && (
                <button
                    type="button"
                    aria-label={t("common.open_list")}
                    onClick={(e) =>
                        onList?.(e.currentTarget.getBoundingClientRect())
                    }
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
                    aria-busy={exporting || undefined}
                    onClick={onPrint}
                    disabled={exporting}
                    className={exportIconBtnClass}
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
                    aria-busy={exporting || undefined}
                    onClick={onExport}
                    disabled={exporting}
                    className={exportIconBtnClass}
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
