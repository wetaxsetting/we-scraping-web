"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared sidebar menu row — the single source of truth for every nav entry
 * across Banking / Payment / Add-on / Settings rails. Icon size, text
 * style, spacing, padding and state colours live here so individual rails
 * cannot drift out of sync.
 *
 * Three render modes, selected by the caller:
 *
 * 1. Link row (default)        — `href` set, no `expandable`.
 * 2. Expandable parent row     — `expandable`, no `href`. The chevron
 *    rotates when `isExpanded`; the row is a plain `<button>` that fires
 *    `onToggle` (no navigation). Used for groups like Transaction History
 *    that host a nested account list.
 * 3. Disabled placeholder      — neither `href` nor `expandable`.
 *
 * Child rows inside an expandable group pass `indent` to reserve space for
 * the chevron column so labels align visually with the parent label.
 */

export type SidebarMenuItemProps = {
    label: string;
    /** Leading icon — SVG asset path. Use this for the per-module rails. */
    icon?: string;
    /**
     * Leading icon — pre-rendered React node. Used by the mobile drawer's MENU
     * section to render the shared `HeaderIcons` (Banking / Payment / Add-on /
     * Settings) at sidebar size without forking the row chrome. Mutually
     * exclusive with `icon`; if both are supplied, `iconNode` wins.
     */
    iconNode?: React.ReactNode;
    href?: string;
    active?: boolean;
    /** Render the chevron-only glyph used by non-expandable link rows. */
    chevron?: boolean;
    /** Marks this row as an expand/collapse trigger (no navigation). */
    expandable?: boolean;
    /** Expansion state — only meaningful when `expandable` is true. */
    isExpanded?: boolean;
    /** Fires when the expandable row is clicked. Ignored otherwise. */
    onToggle?: () => void;
    /**
     * Indent the row so its label aligns with sibling rows that carry an
     * icon. Child account items pass `indent` to line up under the parent.
     */
    indent?: boolean;
    onClick?: () => void;
};

export default function SidebarMenuItem({
    label,
    icon,
    iconNode,
    href,
    active = false,
    chevron = false,
    expandable = false,
    isExpanded = false,
    onToggle,
    indent = false,
    onClick,
}: SidebarMenuItemProps) {
    const interactive = Boolean(href) || expandable || Boolean(onClick);
    const rowClass = cn(
        // Layout: icon + label + optional chevron, left-aligned, 8 px gap
        // between cells, rounded 6px pill, 10 px horizontal / 8 px vertical
        // padding. Height is driven by content + py, so rows stay consistent
        // across modules even when labels wrap.
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
        active
            ? "bg-wb-bg-active"
            : interactive
                ? "cursor-pointer hover:bg-black/5"
                : "cursor-default opacity-60",
    );

    const inner = (
        <>
            {/* 20 × 20 icon slot keeps every glyph vertically centred and
               row heights identical regardless of the SVG's native bounds.
               Width/height is fixed — shrink-0 guards against flex squash.
               For indented child rows we render an empty slot of the same
               size so labels line up under the parent label. */}
            {iconNode ? (
                <span className="flex size-5 shrink-0 items-center justify-center">
                    {iconNode}
                </span>
            ) : icon ? (
                <span className="flex size-5 shrink-0 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon} alt="" aria-hidden className="size-5" />
                </span>
            ) : indent ? (
                <span aria-hidden className="size-5 shrink-0" />
            ) : null}
            <span
                className={cn(
                    // `min-w-0` lets `flex-1` actually shrink — without it a
                    // `whitespace-nowrap` label has min-content width and can
                    // push the row past the 211px drawer edge on a narrow
                    // mobile viewport. `truncate` keeps the visual unchanged
                    // for the labels that fit today and degrades gracefully
                    // (single-line ellipsis) if a future label is longer.
                    "min-w-0 flex-1 truncate text-wb-13 font-medium",
                    active ? "text-brand" : "text-wb-ink",
                )}
            >
                {label}
            </span>
            {(chevron || expandable) && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src="/assets/sidebar/ico-chevron.svg"
                    alt=""
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 transition-transform",
                        // Expandable rows rotate 0° when open, -90° when
                        // closed (chevron points down when open, right when
                        // closed). Non-expandable chevron rows keep the
                        // legacy "-90°" right-pointing glyph.
                        expandable
                            ? isExpanded
                                ? "rotate-0"
                                : "-rotate-90"
                            : "-rotate-90",
                    )}
                />
            )}
        </>
    );

    if (expandable) {
        return (
            <button
                type="button"
                aria-expanded={isExpanded}
                onClick={onToggle}
                className={rowClass}
            >
                {inner}
            </button>
        );
    }

    if (href) {
        return (
            <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={onClick}
                className={rowClass}
            >
                {inner}
            </Link>
        );
    }

    // Interactive button without navigation — used by the drawer's MENU >
    // Settings row, which opens the shared Settings modal instead of routing.
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={rowClass}>
                {inner}
            </button>
        );
    }

    return (
        <button type="button" disabled className={rowClass}>
            {inner}
        </button>
    );
}
