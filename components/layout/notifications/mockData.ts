import type { NotificationRow } from "./types";

/*
 * Static sample notifications — legacy content shape ("WeCMs" / "Added a new
 * approval." / absolute yyyy/MM/dd HH:mm timestamps). Replace with a real
 * fetcher (useApiData + lib/api/mappers) once the backend endpoint lands.
 *
 * The lists are intentionally long so the panel shows a legacy-length list
 * and the inner scroll area is exercised.
 */
const ADDED = "notification.action.added";

/** "Unread" tab sample — all unread (legacy shows every row light-blue). */
export const UNREAD_NOTIFICATIONS: NotificationRow[] = [
    { id: "u1", userName: "WeCMs", actionKey: ADDED, time: "2026/05/26 09:52", read: false },
    { id: "u2", userName: "WeCMs", actionKey: ADDED, time: "2026/05/21 15:49", read: false },
    { id: "u3", userName: "WeCMs", actionKey: ADDED, time: "2026/03/02 11:04", read: false },
    { id: "u4", userName: "WeCMs", actionKey: ADDED, time: "2026/03/02 10:45", read: false },
    { id: "u5", userName: "WeCMs", actionKey: ADDED, time: "2026/03/02 10:14", read: false },
    { id: "u6", userName: "WeCMs", actionKey: ADDED, time: "2026/03/02 09:57", read: false },
    { id: "u7", userName: "WeCMs", actionKey: ADDED, time: "2026/03/02 09:53", read: false },
    { id: "u8", userName: "WeCMs", actionKey: ADDED, time: "2026/02/27 16:48", read: false },
    { id: "u9", userName: "WeCMs", actionKey: ADDED, time: "2026/02/27 15:38", read: false },
    { id: "u10", userName: "WeCMs", actionKey: ADDED, time: "2026/02/27 15:10", read: false },
    { id: "u11", userName: "WeCMs", actionKey: ADDED, time: "2026/02/27 14:35", read: false },
];

/** "All" tab sample — unread set plus older, already-read rows (white bg). */
export const ALL_NOTIFICATIONS: NotificationRow[] = [
    ...UNREAD_NOTIFICATIONS,
    { id: "a12", userName: "WeCMs", actionKey: ADDED, time: "2026/02/27 11:20", read: true },
    { id: "a13", userName: "WeCMs", actionKey: ADDED, time: "2026/02/26 17:02", read: true },
    { id: "a14", userName: "WeCMs", actionKey: ADDED, time: "2026/02/26 14:48", read: true },
    { id: "a15", userName: "WeCMs", actionKey: ADDED, time: "2026/02/26 09:31", read: true },
    { id: "a16", userName: "WeCMs", actionKey: ADDED, time: "2026/02/25 16:12", read: true },
    { id: "a17", userName: "WeCMs", actionKey: ADDED, time: "2026/02/25 10:05", read: true },
];

/** Static unread badge count for the bell trigger. */
export const UNREAD_COUNT = ALL_NOTIFICATIONS.filter((n) => !n.read).length;
