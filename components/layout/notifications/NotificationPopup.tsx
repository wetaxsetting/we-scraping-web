"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import NotificationItem from "./NotificationItem";
import NotificationSearch from "./NotificationSearch";
import NotificationTabs from "./NotificationTabs";
import { ALL_NOTIFICATIONS, UNREAD_COUNT, UNREAD_NOTIFICATIONS } from "./mockData";
import type { NotificationTab } from "./types";

/*
 * Notification dropdown — Figma node 12346:43819.
 *
 * Self-contained header chrome that owns its own bell trigger, mirroring
 * <ProfileMenu> (the sibling header dropdown). Because it follows the same
 * `relative` wrapper + `absolute` card pattern that ProfileMenu already proves
 * works in this header, the card is never clipped by a parent overflow.
 *
 * Static UI only: rows come from mockData, the keyword search and "Read All"
 * are UI-only, and tab switching filters the in-memory mock (no API yet).
 */
export default function NotificationPopup() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<NotificationTab>("unread");
    const [query, setQuery] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Outside-click + ESC close — identical handling to ProfileMenu so both
    // header dropdowns dismiss the same way.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Static tab switching — "Unread" shows the unread sample, "All" shows the
    // full sample. No API filtering. The keyword search stays UI-only for now.
    const rows = useMemo(
        () => (tab === "unread" ? UNREAD_NOTIFICATIONS : ALL_NOTIFICATIONS),
        [tab],
    );

    return (
        <div ref={wrapperRef} className="relative">
            {/* Bell trigger — same visual chrome as the previous static bell,
               now opening the popup + carrying the unread badge. */}
            <button
                type="button"
                aria-label={t("nav.notifications")}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="relative flex cursor-pointer items-center justify-center rounded-full p-1 transition-opacity hover:bg-white/10 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/header/ico-bell.svg" alt="" aria-hidden className="size-6" />
                {UNREAD_COUNT > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-wb-red-07 px-1 text-wb-10 font-bold leading-none text-white">
                        {UNREAD_COUNT > 99 ? "99+" : UNREAD_COUNT}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={t("notification.title")}
                    /*
                     * Legacy notification drawer: a flat right-docked panel, not
                     * a centered modal. Pinned with `fixed` flush to the viewport
                     * right edge (right-0), opening directly below the 48px header
                     * and running to the bottom of the viewport. The list scrolls
                     * internally. The header is sticky (not transformed), so
                     * `fixed` anchors to the viewport; outside-click still works
                     * because the panel stays a DOM child of the wrapper.
                     */
                    className="fixed right-0 top-[var(--h-wb-header)] bottom-0 z-50 flex w-[405px] max-w-[calc(100vw-16px)] flex-col overflow-hidden border-l border-wb-border-sidebar bg-white shadow-[0_4px_5px_0_rgba(0,0,0,0.1)] duration-150 animate-in fade-in-0 slide-in-from-top-1"
                >
                    {/* Title + close */}
                    <div className="flex shrink-0 items-center justify-between px-5 py-3">
                        <h2 className="text-wb-18 font-bold leading-normal text-wb-ink">
                            {t("notification.title")}
                        </h2>
                        <button
                            type="button"
                            aria-label={t("notification.close")}
                            onClick={() => setOpen(false)}
                            className="flex cursor-pointer items-center justify-center rounded-md p-1 text-wb-ink transition-colors hover:bg-black/5"
                        >
                            <X className="size-5" strokeWidth={2} />
                        </button>
                    </div>

                    {/* Tabs + Read All */}
                    <div className="flex shrink-0 items-center justify-between border-b border-wb-border-sidebar px-5 py-2.5">
                        <NotificationTabs value={tab} onChange={setTab} />
                        <button
                            type="button"
                            className="flex cursor-pointer items-center rounded-md bg-brand px-2 py-2 text-wb-14 font-medium leading-4 tracking-wb-tight text-white shadow-wb-brand-btn transition-colors hover:bg-brand-hover"
                        >
                            {t("notification.read_all")}
                        </button>
                    </div>

                    {/* Search */}
                    <div className="shrink-0 px-5 pb-[13px] pt-[13px]">
                        <NotificationSearch value={query} onChange={setQuery} />
                    </div>

                    {/* List — the only scroll area */}
                    <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
                        {rows.length === 0 ? (
                            <p className="px-5 py-10 text-center text-wb-13 font-medium text-wb-muted">
                                {t("notification.empty")}
                            </p>
                        ) : (
                            rows.map((n) => <NotificationItem key={n.id} notification={n} />)
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
