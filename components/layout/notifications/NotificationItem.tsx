"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { NotificationRow } from "./types";

/*
 * Single notification row — legacy notification panel.
 * Layout: WeCMs logo avatar (white circle + blue mark) + content column
 * (name / timestamp on one row, message below). Unread rows carry the
 * brand-soft tint; read rows are white. The whole row is a button so a
 * future "mark read / open approval" action can hang off it.
 */
type NotificationItemProps = {
    notification: NotificationRow;
};

export default function NotificationItem({ notification }: NotificationItemProps) {
    const { t } = useTranslation();
    const { userName, actionKey, time, read } = notification;

    return (
        <button
            type="button"
            className={cn(
                "flex w-full cursor-pointer items-start gap-3 border-b border-wb-border-sidebar px-5 py-3 text-left transition-colors last:border-b-0",
                read ? "bg-white hover:bg-brand-soft" : "bg-brand-soft hover:bg-brand-softer",
            )}
        >
            {/* WeCMs system logo — white circle + blue mark, matching legacy */}
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-wb-border-sidebar bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/header/logo-mark.svg" alt="" aria-hidden className="h-4 w-auto" />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-wb-13 font-semibold text-wb-ink">{userName}</span>
                    <span className="shrink-0 whitespace-nowrap text-wb-13 font-medium text-wb-muted">
                        {time}
                    </span>
                </span>
                <span className="text-wb-13 font-medium text-wb-muted">{t(actionKey)}</span>
            </span>
        </button>
    );
}
