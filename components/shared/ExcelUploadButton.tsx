"use client";

import { cn } from "@/lib/utils";

/**
 * Settings-panel "Excel Upload" trigger button — the green chip with
 * the native-coloured Excel glyph that opens the per-feature
 * {@code <ExcelUploadDialog>}.
 *
 * <p>Single source of truth for the chrome documented in
 * <code>CLAUDE.md §3b.F</code> as the
 * <code>bg-[#1f7a4d] + hover:bg-[#196439]</code> Excel-action chip
 * (Figma brand-asset chrome — green colour does not map to a wb
 * token, so the hex stays inline inside this shared component).
 *
 * <p>Consumers: Settings &gt; Purpose, Settings &gt; VAS Account,
 * Settings &gt; Chart of Accounts. Adding the chip on a new Settings
 * panel means importing this component — never re-inlining the
 * style. (Settings &gt; Contacts intentionally uses a different green
 * shade and its own shadow per its own Figma frame; it keeps its
 * inline style and is the documented exception in §3b.F.)
 *
 * <p>Owns chrome only — the caller manages dialog open/close state,
 * upload handlers, and the per-feature label translation.
 */
export type ExcelUploadButtonProps = {
    /** Pre-translated button text (e.g. "Excel Upload"). */
    label: string;
    onClick: () => void;
    /** Caller-supplied extra classes (e.g. layout positioning).
     *  Merged via {@link cn} after the canonical chrome so callers
     *  cannot accidentally override the brand colours / shadow. */
    className?: string;
    /** Disables the trigger while a prior upload is mid-flight. */
    disabled?: boolean;
};

export default function ExcelUploadButton({
    label,
    onClick,
    className,
    disabled,
}: ExcelUploadButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-[#1f7a4d] px-3 text-wb-14 font-medium text-white shadow-wb-btn hover:bg-[#196439]",
                disabled && "cursor-not-allowed opacity-60 hover:bg-[#1f7a4d]",
                className,
            )}
        >
            {/* Native colours — NOT `brightness-0 invert` — per
                CLAUDE.md §8a. The green Excel mark is a branded
                asset, kept as the source SVG paints it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/common/ico-excel.svg"
                alt=""
                aria-hidden
                className="size-4"
            />
            {label}
        </button>
    );
}
