/**
 * Notification popup types — header notification bell (legacy comm_0192_007,
 * BLTB branch).
 *
 * In-memory (camelCase semantic) shape consumed by the popup + item. The
 * snake_case wire row (`ApiNotificationRow` in lib/types/api.ts) is translated
 * into this shape via `mapNotificationRow` in lib/api/mappers.ts at the API
 * boundary — components never see the wire row.
 *
 * The backend ships the rendered {@link title} / {@link content} (per-language
 * strings from `BLTB_NOTI_CONT_INFM`), so the visible message is rendered
 * directly — there is no i18n message-code resolution at render time.
 */

export type NotificationTab = "unread" | "all";

export interface NotificationRow {
    /** Stable React key — string form of {@link notificationId}. */
    id: string;
    /** Backend row id — path id for the mark-read call (mirrors {@link notiSeqNo}). */
    notificationId: number;
    /** Bulletin board code — composite-key segment, retained in state for a
     *  future composite-key mark-read API ({@code (bltbCd, notiSeqNo)}). */
    bltbCd: string;
    /** Per-tenant notification sequence (same value as {@link notificationId}). */
    notiSeqNo: number;
    /** Rendered title in the caller's language; "" when absent. */
    title: string;
    /** Rendered content in the caller's language; "" for approval notifications. */
    content: string;
    /** Sender display name — from `snd_name`; "" when absent. */
    senderName: string;
    /** Sender login id — from `snd_id`; null when absent. */
    senderId: string | null;
    /** Navigation payload JSON (opaque) — parsed safely on click. */
    notiJson: string | null;
    /** Legacy target screen (e.g. `comm_0193_001.act`) — mapped to a refactor route. */
    notiWsvc: string | null;
    /** Soft-deleted ({@code del_yn === 'Y'}) — click shows the deleted dialog. */
    deleted: boolean;
    /** Read state drives the row background (unread = brand-soft tint). */
    read: boolean;
    /** Raw creation timestamp — legacy `yyyyMMddHHmmss` **UTC** wire string
     *  (`reg_dtm`, falling back to `mod_dtm`); null when absent. Formatted at
     *  render time per the active locale via `formatUtcDtmByLanguage` so the
     *  date layout follows EN/KO/VI and the value is shifted UTC → display TZ.
     *  Raw-value-at-render — never pre-format in the mapper. */
    dateTimeRaw: string | null;
    /** Sender-image URL, or null. */
    userImgUrl: string | null;
}
