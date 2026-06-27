"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FileCardProps = {
    name: string;
    size: string;
    /**
     * Optional click handler — left as a no-op stub for static UI. Real
     * download wiring lands when the API ships.
     */
    onDownload?: () => void;
    className?: string;
};

/**
 * Uploaded / download file chip rendered on every Payment detail page.
 * Static UI mirror of the live JEX file card — green Excel icon (the
 * `/assets/common/ico-excel.svg` asset, never a lucide substitute per
 * §8a), file name + size, trailing download button.
 *
 * Download button uses `/assets/common/ico-download.svg` with
 * `brightness-0 invert` so the dark-fill icon appears white on the
 * blue `bg-brand` circle. Never substitute a lucide icon here.
 */
export default function FileCard({
    name,
    size,
    onDownload,
    className,
}: FileCardProps) {
    const { t } = useTranslation();
    return (
        <div
            className={cn(
                "flex shrink-0 items-center gap-3 self-start rounded-md border border-wb-ntrl-4 bg-white p-3",
                className,
            )}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/common/ico-excel.svg"
                alt=""
                aria-hidden
                className="size-5 shrink-0"
            />
            <div className="flex min-w-0 flex-col">
                <span
                    className="truncate text-wb-13 font-semibold text-wb-ink"
                >
                    {name}
                </span>
                <span className="text-wb-12 font-medium text-wb-ntrl-6">
                    {size}
                </span>
            </div>
            <button
                type="button"
                aria-label={t("common.download")}
                onClick={onDownload}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand hover:bg-brand-hover"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/common/ico-download.svg"
                    alt=""
                    aria-hidden
                    className="size-4 brightness-0 invert"
                />
            </button>
        </div>
    );
}
