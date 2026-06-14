"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { NotificationRow } from "./types";

/*
 * Single notification row — header notification bell.
 * Layout: WeCMs logo avatar (white circle + blue mark) + content column
 * (sender name / timestamp on one row, message below). Unread rows carry the
 * brand-soft tint; read rows are white. The whole row is a button — clicking
 * marks the notification read and navigates (or shows the deleted dialog).
 *
 * The message is rendered directly from the backend's legacy-faithful
 * `title` (primary line) + `content` (secondary line, when present). Both are
 * already-localized strings from `BLTB_NOTI_CONT_INFM`; there is no i18n
 * message-code resolution. A safe fallback shows only when BOTH are empty.
 */
type NotificationItemProps = {
    notification: NotificationRow;
    onClick: (notification: NotificationRow) => void;
};

export default function NotificationItem({ notification, onClick }: NotificationItemProps) {
    const { t } = useTranslation();
    const { senderName, title, content, time, read } = notification;

    const hasTitle = title.length > 0;
    const hasContent = content.length > 0;

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
                    <span className="truncate text-wb-13 font-semibold text-wb-ink">
                        {senderName || t("notification.sender_fallback")}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-wb-13 font-medium text-wb-muted">
                        {time}
                    </span>
                </span>

                {/* Title — primary message line. */}
                {hasTitle && (
                    <span className="text-wb-13 font-medium text-wb-ink" title={title}>
                        {title}
                    </span>
                )}

                {/* Content — secondary line, only when the backend carries one
                 *  (approval notifications store ""). */}
                {hasContent && (
                    <span className="text-wb-13 font-normal text-wb-muted" title={content}>
                        {content}
                    </span>
                )}

                {/* Fallback — only when BOTH title and content are empty so the
                 *  row never renders a blank message line. */}
                {!hasTitle && !hasContent && (
                    <span className="text-wb-13 font-medium text-wb-muted">
                        {t("notification.untitled")}
                    </span>
                )}
            </span>
        </button>
    );
}
