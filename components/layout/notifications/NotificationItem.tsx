"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { NotificationRow } from "./types";

/*
 * Single notification row — header notification bell.
 * Layout: WeCMs logo avatar (white circle + blue mark) + content column
 * (sender name / timestamp on one row, message below). Unread rows carry the
 * brand-soft tint; read rows are white. The whole row is a button — clicking
 * marks the notification read and navigates to its link target.
 *
 * The message line is resolved from the backend's `messageCode` + the
 * snake_case `messageParams` via i18n; raw JSON is never displayed.
 */
type NotificationItemProps = {
    notification: NotificationRow;
    onClick: (notification: NotificationRow) => void;
};

export default function NotificationItem({ notification, onClick }: NotificationItemProps) {
    const { t } = useTranslation();
    const { senderName, messageCode, messageParams, time, read } = notification;

    /*
     * Resolve `payment_type` from the raw backend slug ("internal_transfer")
     * to the user-friendly label ("Internal Transfer") via the shared
     * `approval.type.*` keys before interpolation, so a message that
     * references {payment_type} never renders a raw slug. Falls back to the
     * slug itself when no matching key exists. Other params pass through
     * verbatim.
     */
    const renderParams = (() => {
        const slug = messageParams.payment_type;
        if (!slug) return messageParams;
        const key = `approval.type.${slug}`;
        const resolved = t(key);
        return { ...messageParams, payment_type: resolved === key ? slug : resolved };
    })();

    return (
        <button
            type="button"
            onClick={() => onClick(notification)}
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
                    <span className="truncate text-wb-13 font-semibold text-wb-ink">{senderName}</span>
                    <span className="shrink-0 whitespace-nowrap text-wb-13 font-medium text-wb-muted">
                        {time}
                    </span>
                </span>
                <span className="text-wb-13 font-medium text-wb-muted">
                    {t(messageCode, renderParams)}
                </span>
            </span>
        </button>
    );
}
