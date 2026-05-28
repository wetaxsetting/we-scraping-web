"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import SmartOrganizerButton from "./SmartOrganizerButton";

type TransactionHistoryActionsProps = {
    /** Receives the list-icon's DOMRect so the caller can anchor the
     *  shared View Setting popover (CLAUDE.md §13). */
    onList?: (anchorRect: DOMRect) => void;
    onExport?: () => void;
    /** True while the page's Excel export request is in flight (or held
     *  sticky immediately after). Disables the Excel button so the user
     *  can't fire a duplicate download on a fast cached resolve. */
    exporting?: boolean;
    className?: string;
};

/**
 * Action toolbar for the Transaction History detail (Figma node
 * 989:22011). Figma shows only two icon buttons here — list view +
 * Excel export — followed by the Smart Organizer CTA. No print button
 * (unlike the general `PageActionButtons`), so we keep this page's
 * toolbar scoped to its own component.
 */
export default function TransactionHistoryActions({
    onList,
    onExport,
    exporting = false,
    className,
}: TransactionHistoryActionsProps) {
    const { t } = useTranslation();
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    aria-label={t("common.open_list")}
                    onClick={(e) =>
                        onList?.(e.currentTarget.getBoundingClientRect())
                    }
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-list.svg"
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
                    className={cn(
                        "flex size-7 items-center justify-center rounded-md hover:bg-black/5",
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
                </button>
            </div>
            <SmartOrganizerButton />
        </div>
    );
}
