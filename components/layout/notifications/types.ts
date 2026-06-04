/**
 * Notification popup types — header notification bell (legacy comm_0192_007).
 *
 * In-memory (camelCase semantic) shape consumed by the popup + item. The
 * snake_case wire row (`ApiNotificationRow` in lib/types/api.ts) is translated
 * into this shape via `mapNotificationRow` in lib/api/mappers.ts at the API
 * boundary — components never see the wire row.
 *
 * The visible message line is NOT stored; it is resolved at render time from
 * `messageCode` (+ `messageParams`) via the i18n `t(...)` function, per the
 * Phase-1 backend contract (notification.* keys). The avatar is the shared
 * WeCMs logo mark (system events), so it is not a per-row field.
 */

export type NotificationTab = "unread" | "all";

export interface NotificationRow {
    /** Stable React key — string form of {@link notificationId}. */
    id: string;
    /** Backend row id — path id for the mark-read call. */
    notificationId: number;
    /** Producer discriminator (e.g. "APPROVAL_REQUEST"). */
    notiType: string;
    /** Referenced source id (APPR_SEQ_NO for approval requests); may be null. */
    sourceId: string | null;
    /** i18n key for the message line (e.g. "notification.approval.requested"). */
    messageCode: string;
    /** Interpolation params for {@link messageCode} (snake_case keys, verbatim
     *  from the wire jsonb: sender_name / doc_no / title / payment_type). */
    messageParams: Record<string, string>;
    /** Refactor slug route (+ params) the bell navigates to on click. */
    linkTarget: string | null;
    /** Read state drives the row background (unread = brand-soft tint). */
    read: boolean;
    /** Display timestamp ("YYYY-MM-DD HH:mm", display timezone). */
    time: string;
    /** Sender display name — "WeCMs" for system events / when absent. */
    senderName: string;
}
