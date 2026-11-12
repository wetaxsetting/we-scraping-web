/*
 * Header notifications (bell) — record docs/features/weinvoice/weinvoice-notifications-2026-11-12.md.
 *
 *  - mock mode (default): deterministic fictional items built from the store's companies
 *    (`connections`); read state kept in memory (resets on reload). Never real data.
 *  - api mode — backend record `weinvoice-notifications-2026-11-12` (we-scraping-api):
 *      GET  /notifications?company_mst=&filter=mst|all|action&page=&size=
 *           → { items: NotificationItem[], unread_count, total_count, page, size }
 *      GET  /notifications/unread-count → { unread_count }   (all of the user's MSTs; the bell polls it)
 *      POST /notifications/read     { ids }           → 204
 *      POST /notifications/read-all { company_mst? }  → 204
 *    Wire is snake_case; `toNotification` maps it to the UI shape exactly once.
 */
import { wiPost, wiRequest } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState } from "@/lib/api/weinvoice/store";

export type NotificationType = "NEW_INVOICES" | "XML_READY" | "PDF_READY" | "GDT_LOGIN_ERROR" | "MAILBOX_ERROR";
/** `mst` = the working MST only · `all` = every MST of the user · `action` = items that need action. */
export type NotificationFilter = "mst" | "all" | "action";
/** Engine direction code: `mua` = purchase, `ban` = sales. */

export type NotificationDirection = "mua" | "ban";

/** The backend sends `purchase` / `sales`; the engine codes `mua` / `ban` are accepted too. */
function toDirection(d: string | null | undefined): NotificationDirection | null {
    const v = (d ?? "").toLowerCase();
    if (v === "mua" || v === "purchase") return "mua";
    if (v === "ban" || v === "sales") return "ban";
    return null;
}

export type Notification = {
    id: string;
    type: NotificationType;
    companyMst: string | null;
    companyName: string | null;
    direction: NotificationDirection | null;
    count: number | null;
    fromProvider: number | null;
    fromEmail: number | null;
    /** `yyyy-MM` months of the invoices (NEW_INVOICES, max 3). */
    months: string[];
    mailboxId: string | null;
    address: string | null;
    message: string | null;
    /** ISO-8601 UTC instant of the latest event in the bucket. */
    at: string;
    read: boolean;
    /** true for the error types (GDT password refused, mailbox login failed). */
    action: boolean;
};

export type NotificationPage = { items: Notification[]; unreadCount: number; totalCount: number; page: number; size: number };

export const NOTIFICATION_PAGE_SIZE = 20;

/* ------------------------------------------------------------------ wire */

/** `NotificationItem` exactly as the backend serializes it. */
export type WireNotification = {
    id: string;
    type: string;
    company_mst?: string | null;
    company_name?: string | null;
    direction?: string | null;
    count?: number | null;
    from_provider?: number | null;
    from_email?: number | null;
    months?: string[] | null;
    mailbox_id?: string | number | null;
    address?: string | null;
    message?: string | null;
    at: string;
    read?: boolean | null;
    action?: boolean | null;
};
type WirePage = { items?: WireNotification[] | null; unread_count?: number | null; total_count?: number | null; page?: number | null; size?: number | null };

const ACTION_TYPES: NotificationType[] = ["GDT_LOGIN_ERROR", "MAILBOX_ERROR"];
const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Wire → UI. Unknown `type` values pass through as-is (rendered with a generic icon/text). */
export function toNotification(w: WireNotification): Notification {
    const type = w.type as NotificationType;
    return {
        id: String(w.id),
        type,
        companyMst: w.company_mst || null,
        companyName: w.company_name || null,
        direction: toDirection(w.direction),
        count: num(w.count),
        fromProvider: num(w.from_provider),
        fromEmail: num(w.from_email),
        months: Array.isArray(w.months) ? w.months.filter(Boolean) : [],
        mailboxId: w.mailbox_id === null || w.mailbox_id === undefined ? null : String(w.mailbox_id),
        address: w.address || null,
        message: w.message || null,
        at: w.at,
        read: !!w.read,
        action: w.action ?? ACTION_TYPES.includes(type),
    };
}

/* ------------------------------------------------------------------ mock */

/** Ids marked read in mock mode (in memory, resets on reload). */
let mockRead = new Set<string>();
/** Fixed anchor so mock ids and times stay stable for the life of the page. */
let mockAnchor = 0;

/** Test helper: forget the mock read state and re-anchor the mock times. */
export function resetNotificationsMock(): void {
    mockRead = new Set();
    mockAnchor = 0;
}

const minutesAgo = (m: number) => new Date(mockAnchor - m * 60_000).toISOString();

/** Deterministic fictional items for each company in the store. */
function mockItems(): Notification[] {
    if (!mockAnchor) mockAnchor = Date.now();
    const base = { companyName: null, direction: null, count: null, fromProvider: null, fromEmail: null, months: [], mailboxId: null, address: null, message: null, read: false, action: false };
    const out: Notification[] = [];
    getState().connections.forEach((c, i) => {
        const mst = c.taxId;
        const step = i * 95;
        const co = { ...base, companyMst: mst, companyName: c.companyName };
        out.push(
            { ...co, id: `NEW_INVOICES|${mst}|mua|mock`, type: "NEW_INVOICES", direction: "mua", count: 12 - i * 3, months: ["2026-10"], at: minutesAgo(12 + step) },
            { ...co, id: `XML_READY|${mst}|-|mock`, type: "XML_READY", count: 10 - i * 2, at: minutesAgo(40 + step) },
            { ...co, id: `PDF_READY|${mst}|-|mock`, type: "PDF_READY", count: 7 - i, fromProvider: 5 - i, fromEmail: 2, at: minutesAgo(70 + step) },
            { ...co, id: `NEW_INVOICES|${mst}|ban|mock`, type: "NEW_INVOICES", direction: "ban", count: 4, months: ["2026-10", "2026-09"], at: minutesAgo(26 * 60 + step) },
        );
        if (c.status !== "connected") {
            out.push({ ...co, id: `GDT_LOGIN_ERROR|${mst}|-|mock`, type: "GDT_LOGIN_ERROR", message: "Tài khoản hoặc mật khẩu không đúng", action: true, at: minutesAgo(3 * 60 + step) });
        }
        if (i === 0) {
            out.push({ ...co, id: `MAILBOX_ERROR|${mst}|-|mock`, type: "MAILBOX_ERROR", mailboxId: "mb-demo-1", address: "ketoan@anphat.example", message: "Đăng nhập IMAP thất bại", action: true, at: minutesAgo(5 * 60) });
        }
    });
    return out.map((n) => ({ ...n, read: mockRead.has(n.id) })).sort((a, b) => b.at.localeCompare(a.at));
}

function mockFilter(items: Notification[], filter: NotificationFilter, companyMst?: string): Notification[] {
    if (filter === "mst") return items.filter((n) => n.companyMst === companyMst);
    if (filter === "action") return items.filter((n) => n.action);
    return items;
}

/* ------------------------------------------------------------------ API */

/**
 * One page of notifications. `filter=mst` needs the working MST (`companyMst`); without one the page is
 * empty and nothing is requested. `page` is zero-based.
 */
export async function listNotifications(opts: { filter: NotificationFilter; companyMst?: string; page?: number; size?: number }): Promise<NotificationPage> {
    const page = opts.page ?? 0;
    const size = opts.size ?? NOTIFICATION_PAGE_SIZE;
    if (opts.filter === "mst" && !opts.companyMst) return { items: [], unreadCount: 0, totalCount: 0, page, size };

    if (DATA_SOURCE === "api") {
        const params: Record<string, unknown> = { filter: opts.filter, page, size };
        if (opts.filter === "mst") params.companyMst = opts.companyMst;
        const w = await wiRequest<WirePage>("get", "/notifications", { params, raw: true });
        return {
            items: (w?.items ?? []).map(toNotification),
            unreadCount: w?.unread_count ?? 0,
            totalCount: w?.total_count ?? 0,
            page: w?.page ?? page,
            size: w?.size ?? size,
        };
    }

    const all = mockFilter(mockItems(), opts.filter, opts.companyMst);
    return { items: all.slice(page * size, (page + 1) * size), unreadCount: all.filter((n) => !n.read).length, totalCount: all.length, page, size };
}

/** Unread items across all of the user's MSTs (the bell badge). */
export async function getUnreadCount(): Promise<number> {
    if (DATA_SOURCE === "api") {
        const w = await wiRequest<{ unread_count?: number | null }>("get", "/notifications/unread-count", { raw: true });
        return w?.unread_count ?? 0;
    }
    return mockItems().filter((n) => !n.read).length;
}

/** Mark the given items read. Unknown ids are ignored (backend: max 100 per call). */
export async function markNotificationsRead(ids: string[]): Promise<void> {
    if (!ids.length) return;
    if (DATA_SOURCE === "api") {
        await wiPost("/notifications/read", { ids });
        return;
    }
    ids.forEach((id) => mockRead.add(id));
}

/** Mark everything read — for one MST when `companyMst` is given, else for all of the user's MSTs. */
export async function markAllNotificationsRead(companyMst?: string): Promise<void> {
    if (DATA_SOURCE === "api") {
        await wiPost("/notifications/read-all", companyMst ? { companyMst } : {});
        return;
    }
    mockItems()
        .filter((n) => !companyMst || n.companyMst === companyMst)
        .forEach((n) => mockRead.add(n.id));
}

/**
 * Where a click on the item goes, and which MST must be the working MST there.
 * NEW_INVOICES / XML_READY / PDF_READY → the purchase / sales list (unknown direction → purchase);
 * GDT_LOGIN_ERROR → /sources/gdt; MAILBOX_ERROR → /sources/mailbox.
 */
export function notificationTarget(n: Notification): { href: string; companyMst: string | null } {
    switch (n.type) {
        case "GDT_LOGIN_ERROR":
            return { href: "/sources/gdt", companyMst: n.companyMst };
        case "MAILBOX_ERROR":
            return { href: "/sources/mailbox", companyMst: n.companyMst };
        default:
            return { href: n.direction === "ban" ? "/invoices/sales" : "/invoices/purchase", companyMst: n.companyMst };
    }
}
