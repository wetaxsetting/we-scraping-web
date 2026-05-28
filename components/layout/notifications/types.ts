/**
 * Notification popup types — legacy notification panel.
 *
 * Static-UI only for now: rows are sourced from mockData.ts. When the API
 * lands, the same shape is produced by a mapper in lib/api/mappers.ts
 * (snake_case wire → camelCase semantic per the project naming rules).
 *
 * The avatar is not a per-row field: legacy notifications are system events
 * ("WeCMs added a new approval"), so every row renders the shared WeCMs logo
 * mark inside NotificationItem. A per-user avatar field can be added later.
 */

export type NotificationTab = "unread" | "all";

export interface NotificationRow {
    id: string;
    /** Sender display name — "WeCMs" for system events. */
    userName: string;
    /** i18n key for the message line, e.g. "notification.action.added". */
    actionKey: string;
    /** Absolute timestamp string, legacy format "yyyy/MM/dd HH:mm". */
    time: string;
    /** Read state drives the row background (unread = brand-soft tint). */
    read: boolean;
}
