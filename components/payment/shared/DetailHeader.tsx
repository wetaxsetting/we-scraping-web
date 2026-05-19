"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DetailHeaderProps = {
    /** Parent list label rendered before the chevron — e.g. "Scheduled Payment". */
    listTitle: string;
    /** File name / row identifier rendered after the chevron — already
     * pre-formatted, e.g. `WeCMS_Vendor_Payment_upload_EN (22)`. */
    subtitle: string;
    /** Route the Back button returns to — typically the parent list page. */
    backHref: string;
    className?: string;
};

/**
 * Breadcrumb-style page header for every Payment detail page. Renders the
 * parent list title in muted weight, a chevron separator, then the file
 * name / row identifier in semi-bold ink — mirrors the live JEX layout
 * (`Scheduled Payment > WeCMS_Vendor_Payment_upload_EN (22)`).
 *
 * The right slot pins a Back button that navigates to the parent list page.
 * Reused by every Sprint 2 detail screen — do not re-implement the title +
 * back-button pattern per page.
 */
export default function DetailHeader({
    listTitle,
    subtitle,
    backHref,
    className,
}: DetailHeaderProps) {
    const { t } = useTranslation();
    return (
        <div
            className={cn(
                "flex shrink-0 flex-wrap items-center justify-between gap-3 pt-4 md:pt-6",
                className,
            )}
        >
            <h1 className="flex flex-wrap items-center gap-2 text-wb-18 tracking-wb-tight text-wb-dark">
                <Link href={backHref} className="font-medium text-wb-ntrl-6 hover:text-wb-brand">
                    {listTitle}
                </Link>
                <ChevronLeft
                    aria-hidden
                    className="size-4 shrink-0 rotate-180 text-wb-ntrl-5"
                    strokeWidth={2}
                />
                <span className="font-semibold">{subtitle}</span>
            </h1>
            <Link
                href={backHref}
                className="flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-neutral-50"
            >
                <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
                {t("common.back")}
            </Link>
        </div>
    );
}
