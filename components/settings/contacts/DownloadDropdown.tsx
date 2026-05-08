"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ContactLocation } from "./types";

type DownloadDropdownProps = {
    onSelect?: (kind: ContactLocation) => void;
};

/**
 * "Download" split dropdown for the Contacts panel — Figma 9194:9772.
 *
 * Trigger button shows the Excel icon + "Download" label + a chevron;
 * clicking it opens a 130px-wide menu with two options that mirror the
 * filter checkboxes (Local Contacts / Overseas Contacts). The Figma
 * frame ships the trigger only — option labels are derived from the
 * existing locale convention (`settings.contacts.location.{local|overseas}`)
 * suffixed with " Contacts" for clarity.
 *
 * Static UI only: `onSelect` fires the chosen kind so a future
 * download handler can hang off this prop without restructuring the
 * panel.
 */
export default function DownloadDropdown({ onSelect }: DownloadDropdownProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const handlePick = (kind: ContactLocation) => {
        onSelect?.(kind);
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="inline-flex h-[var(--h-wb-filter-btn)] w-[160px] cursor-pointer items-center justify-between gap-1 rounded-md bg-white px-2 text-wb-14 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
            >
                <span className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-excel.svg"
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                    {t("settings.contacts.download")}
                </span>
                <ChevronDown
                    className={cn(
                        "size-4 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={2}
                />
            </button>

            {open && (
                <ul
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-1 w-[160px] overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    <li role="none">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => handlePick("local")}
                            className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active"
                        >
                            {t("settings.contacts.download_local")}
                        </button>
                    </li>
                    <li role="none">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => handlePick("overseas")}
                            className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-active"
                        >
                            {t("settings.contacts.download_overseas")}
                        </button>
                    </li>
                </ul>
            )}
        </div>
    );
}
