import type { AxiosError } from "axios";

import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiNotificationListResponse,
    ApiResponse,
    ApiUnreadCountResponse,
} from "@/lib/types/api";

/**
 * Notification module API client. Wraps the four Phase-1 endpoints delivered
 * by `wecms-api/.../domain/notification`:
 *
 *   GET /api/v1/notifications?read_type=U|A&page&size
 *   GET /api/v1/notifications/unread-count
 *   PUT /api/v1/notifications/{notificationId}/read
 *   PUT /api/v1/notifications/read-all
 *
 * Every call goes through the shared {@link api} Axios instance so the JWT
 * interceptor + 401 session-expired re-auth bus apply uniformly. Business
 * errors arrive as `{ status: { error: true, code, message } }` with HTTP 200;
 * the helpers unwrap the envelope into an {@link ApiCallError} so callers can
 * branch on `code` and surface it in the global system error dialog.
 *
 * All endpoints are scoped server-side to the JWT-bound tenant + user — the
 * client never sends a recipient or biz_key.
 */

const BASE = "/api/v1/notifications";

export type NotificationReadType = "U" | "A";

function unwrap<T>(res: { data: ApiResponse<T> }): T {
    const body = res.data;
    if (body.status.error || body.data === undefined) {
        throw new ApiCallError(body.status.code, body.status.message);
    }
    return body.data;
}

function rethrow(err: unknown): never {
    if (err instanceof ApiCallError) throw err;
    const e = err as AxiosError<ApiResponse<unknown>>;
    const head = e.response?.data?.status;
    if (head) throw new ApiCallError(head.code, head.message);
    throw new ApiCallError("NETWORK", e.message ?? "Network error");
}

/** List the caller's notifications. `readType` "U" = unread tab, "A" / omitted = all. */
export async function fetchNotifications(params: {
    readType?: NotificationReadType;
    page?: number;
    size?: number;
} = {}): Promise<ApiNotificationListResponse> {
    try {
        const res = await api.get<ApiResponse<ApiNotificationListResponse>>(BASE, {
            params: {
                read_type: params.readType ?? "A",
                page: params.page ?? 0,
                size: params.size ?? 50,
            },
        });
        return unwrap(res);
    } catch (err) {
        rethrow(err);
    }
}

/** Unread count for the header-bell badge. */
export async function fetchUnreadCount(): Promise<ApiUnreadCountResponse> {
    try {
        const res = await api.get<ApiResponse<ApiUnreadCountResponse>>(`${BASE}/unread-count`);
        return unwrap(res);
    } catch (err) {
        rethrow(err);
    }
}

/** Mark one notification read (idempotent). */
export async function markNotificationRead(notificationId: number): Promise<void> {
    try {
        const res = await api.put<ApiResponse<null>>(
            `${BASE}/${encodeURIComponent(String(notificationId))}/read`,
        );
        if (res.data.status.error) {
            throw new ApiCallError(res.data.status.code, res.data.status.message);
        }
    } catch (err) {
        rethrow(err);
    }
}

/** Mark every unread notification for the caller read. */
export async function markAllNotificationsRead(): Promise<void> {
    try {
        const res = await api.put<ApiResponse<null>>(`${BASE}/read-all`);
        if (res.data.status.error) {
            throw new ApiCallError(res.data.status.code, res.data.status.message);
        }
    } catch (err) {
        rethrow(err);
    }
}
