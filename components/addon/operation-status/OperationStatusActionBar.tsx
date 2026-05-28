"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type OperationStatusActionBarProps = {
    onPrint?: () => void;
    onExport?: () => void;
    onUpdate?: () => void;
    onInquire?: () => void;
    /** True while a {@code POST /api/v1/addon/operation-status/refresh}
     *  batch is in flight (or held sticky immediately after). Disables
     *  Update + Inquire so the user can't fire a duplicate refresh on a
     *  fast resolve. */
    updating?: boolean;
    /** True while a {@code POST /api/v1/addon/operation-status/export}
     *  is in flight (or held sticky immediately after). Disables Print
     *  + Excel so the user can't double-trigger a slow download. */
    exporting?: boolean;
    className?: string;
};

/**
 * Top-right action cluster specific to Operation Status Inquiry — Excel and
 * Print icons, then a secondary white "Update" button, then the primary blue
 * "Inquire Operation Status" CTA. Kept local because the shared
 * `PageActionButtons` trio (list / print / excel) doesn't match this page's
 * icon pair + two-button layout.
 */
export default function OperationStatusActionBar({
    onPrint,
    onExport,
    onUpdate,
    onInquire,
    updating = false,
    exporting = false,
    className,
}: OperationStatusActionBarProps) {
    const { t } = useTranslation();

    const iconBtnClass = (busy: boolean) =>
        cn(
            "flex items-center justify-center rounded-md p-1 hover:bg-black/5",
            busy ? "cursor-wait opacity-60" : "cursor-pointer",
        );

    return (
        <div className={cn("flex flex-wrap items-center gap-3", className)}>
            {/* Tight icon cluster — matches the gap-1 spacing the shared
             *  `<PageActionButtons>` uses across the rest of the product
             *  (Account Inquiry / Approval Box). The outer gap-3 separates
             *  the icon group from the text buttons so Print + Excel read
             *  as a paired utility cluster, not detached glyphs floating
             *  far left of Update / Inquire. Order: Print · Excel · Update
             *  · Inquire (Print precedes Excel to mirror the shared
             *  `<PageActionButtons>` Print → Excel sequence). */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    aria-label={t("common.print")}
                    aria-busy={exporting || undefined}
                    onClick={onPrint}
                    disabled={exporting}
                    className={iconBtnClass(exporting)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-print.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                </button>

                <button
                    type="button"
                    aria-label={t("common.export_excel")}
                    aria-busy={exporting || undefined}
                    onClick={onExport}
                    disabled={exporting}
                    className={iconBtnClass(exporting)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-excel.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                </button>
            </div>

            <button
                type="button"
                onClick={onUpdate}
                aria-busy={updating || undefined}
                disabled={updating}
                className={cn(
                    "flex h-9 items-center justify-center rounded-md bg-white px-4 text-wb-14 font-medium text-wb-ink shadow-wb-btn",
                    updating
                        ? "cursor-wait opacity-60"
                        : "cursor-pointer hover:bg-black/[0.03]",
                )}
            >
                {t("common.update")}
            </button>

            <button
                type="button"
                onClick={onInquire}
                aria-busy={updating || undefined}
                disabled={updating}
                className={cn(
                    "flex h-9 items-center justify-center rounded-md bg-brand px-4 text-wb-14 font-medium text-white shadow-wb-brand-btn",
                    updating
                        ? "cursor-wait opacity-60"
                        : "cursor-pointer hover:bg-brand-hover",
                )}
            >
                {t("operation.inquire_cta")}
            </button>
        </div>
    );
}
