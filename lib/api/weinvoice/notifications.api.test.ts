import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);

import {
    getUnreadCount,
    listNotifications,
    markAllNotificationsRead,
    markNotificationsRead,
    notificationTarget,
    resetNotificationsMock,
    toNotification,
    type WireNotification,
} from "@/lib/api/weinvoice/notifications";
import { resetState } from "@/lib/api/weinvoice/store";

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
type Call = { method: string; url: string; params?: Record<string, unknown>; data?: Record<string, unknown> };
const calls = (): Call[] => h.request.mock.calls.map((c) => c[0] as Call);

const MST = "0101234567";
/** One `NotificationItem` exactly as the backend serializes it (snake_case). */
const PDF: WireNotification = {
    id: `PDF_READY|${MST}|-|2026111203`,
    type: "PDF_READY",
    company_mst: MST,
    company_name: "CÔNG TY TNHH VÍ DỤ",
    direction: null,
    count: 7,
    from_provider: 5,
    from_email: 2,
    months: null,
    mailbox_id: null,
    address: null,
    message: null,
    at: "2026-11-12T03:15:00Z",
    read: false,
    action: false,
};
const page = (items: WireNotification[], extra: Record<string, unknown> = {}) => ok({ items, unread_count: 3, total_count: 41, page: 0, size: 20, ...extra });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    resetNotificationsMock();
    resetState();
});

describe("notifications — api mode", () => {
    it("filter=mst: GET /notifications?filter=mst&company_mst=&page=0&size=20 → mapped page", async () => {
        h.request.mockResolvedValueOnce(page([PDF]));
        const r = await listNotifications({ filter: "mst", companyMst: MST });
        expect(calls()[0]).toEqual({ method: "get", url: "/api/v1/weinvoice/notifications", params: { filter: "mst", company_mst: MST, page: 0, size: 20 }, data: undefined });
        expect(r).toEqual({
            items: [
                {
                    id: `PDF_READY|${MST}|-|2026111203`,
                    type: "PDF_READY",
                    companyMst: MST,
                    companyName: "CÔNG TY TNHH VÍ DỤ",
                    direction: null,
                    count: 7,
                    fromProvider: 5,
                    fromEmail: 2,
                    months: [],
                    mailboxId: null,
                    address: null,
                    message: null,
                    at: "2026-11-12T03:15:00Z",
                    read: false,
                    action: false,
                },
            ],
            unreadCount: 3,
            totalCount: 41,
            page: 0,
            size: 20,
        });
    });

    it("filter=all and filter=action send no company_mst; page/size pass through", async () => {
        h.request.mockResolvedValue(page([]));
        await listNotifications({ filter: "all", companyMst: MST, page: 2, size: 20 });
        await listNotifications({ filter: "action", companyMst: MST });
        expect(calls()[0].params).toEqual({ filter: "all", page: 2, size: 20 });
        expect(calls()[1].params).toEqual({ filter: "action", page: 0, size: 20 });
    });

    it("filter=mst without a working MST returns an empty page and requests nothing", async () => {
        await expect(listNotifications({ filter: "mst" })).resolves.toMatchObject({ items: [], totalCount: 0 });
        expect(h.request).not.toHaveBeenCalled();
    });

    it("getUnreadCount: GET /notifications/unread-count → unread_count", async () => {
        h.request.mockResolvedValueOnce(ok({ unread_count: 128 }));
        await expect(getUnreadCount()).resolves.toBe(128);
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/notifications/unread-count" });
    });

    it("markNotificationsRead: POST /notifications/read {ids} — a 204 is success; no call for an empty list", async () => {
        h.request.mockResolvedValueOnce({ status: 204, data: "" });
        await expect(markNotificationsRead(["a", "b"])).resolves.toBeUndefined();
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/notifications/read", data: { ids: ["a", "b"] } });
        await markNotificationsRead([]);
        expect(h.request).toHaveBeenCalledTimes(1);
    });

    it("markAllNotificationsRead: with MST → {company_mst}; without → {}", async () => {
        h.request.mockResolvedValue({ status: 204, data: "" });
        await markAllNotificationsRead(MST);
        await markAllNotificationsRead();
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/notifications/read-all", data: { company_mst: MST } });
        expect(calls()[1]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/notifications/read-all", data: {} });
    });

    it("a backend error surfaces as WeInvoiceApiError with the code", async () => {
        h.request.mockResolvedValueOnce({ data: { status: { error: true, code: "WBE3002", message: "MST không thuộc tài khoản" }, data: null } });
        await expect(listNotifications({ filter: "all" })).rejects.toMatchObject({ code: "WBE3002" });
    });
});

describe("toNotification — wire mapper", () => {
    it("maps direction, months, mailbox id and defaults action for the error types", () => {
        const n = toNotification({ id: "x", type: "NEW_INVOICES", company_mst: MST, direction: "ban", count: 12, months: ["2026-10", "2026-09"], at: "2026-11-12T01:00:00Z" });
        expect(n).toMatchObject({ type: "NEW_INVOICES", direction: "ban", count: 12, months: ["2026-10", "2026-09"], read: false, action: false, fromProvider: null });
        // the backend wire uses purchase / sales
        expect(toNotification({ id: "p", type: "NEW_INVOICES", company_mst: MST, direction: "purchase", count: 1, at: "2026-11-12T01:00:00Z" }).direction).toBe("mua");
        expect(toNotification({ id: "s", type: "NEW_INVOICES", company_mst: MST, direction: "sales", count: 1, at: "2026-11-12T01:00:00Z" }).direction).toBe("ban");
        const m = toNotification({ id: "y", type: "MAILBOX_ERROR", company_mst: null, mailbox_id: 42, address: "kt@vidu.example", message: "AUTH failed", at: "2026-11-12T01:00:00Z" });
        expect(m).toMatchObject({ companyMst: null, mailboxId: "42", address: "kt@vidu.example", message: "AUTH failed", action: true });
        expect(toNotification({ id: "z", type: "XML_READY", direction: "x", at: "t", read: true }).direction).toBeNull();
    });
});

describe("notificationTarget", () => {
    const base = toNotification({ id: "1", type: "NEW_INVOICES", company_mst: MST, at: "t" });
    it("routes by type and direction", () => {
        expect(notificationTarget({ ...base, direction: "mua" })).toEqual({ href: "/invoices/purchase", companyMst: MST });
        expect(notificationTarget({ ...base, direction: "ban" })).toEqual({ href: "/invoices/sales", companyMst: MST });
        expect(notificationTarget({ ...base, type: "XML_READY", direction: null }).href).toBe("/invoices/purchase");
        expect(notificationTarget({ ...base, type: "PDF_READY", direction: "ban" }).href).toBe("/invoices/sales");
        expect(notificationTarget({ ...base, type: "GDT_LOGIN_ERROR" }).href).toBe("/sources/gdt");
        expect(notificationTarget({ ...base, type: "MAILBOX_ERROR" }).href).toBe("/sources/mailbox");
    });
});

describe("notifications — mock mode", () => {
    beforeEach(() => {
        h.source.DATA_SOURCE = "mock";
        resetState();
    });

    it("builds deterministic items from the store's companies, never calling the backend", async () => {
        const a = await listNotifications({ filter: "all" });
        const b = await listNotifications({ filter: "all" });
        expect(a.items.map((n) => n.id)).toEqual(b.items.map((n) => n.id));
        expect(a.totalCount).toBeGreaterThan(0);
        const mine = await listNotifications({ filter: "mst", companyMst: "0109876543" });
        expect(mine.items.every((n) => n.companyMst === "0109876543")).toBe(true);
        const action = await listNotifications({ filter: "action" });
        expect(action.items.length).toBeGreaterThan(0);
        expect(action.items.every((n) => n.action)).toBe(true);
        expect(h.request).not.toHaveBeenCalled();
    });

    it("keeps read state in memory: read one, then read-all for one MST, then for all", async () => {
        const total = await getUnreadCount();
        const first = (await listNotifications({ filter: "all" })).items[0];
        await markNotificationsRead([first.id]);
        expect(await getUnreadCount()).toBe(total - 1);
        await markAllNotificationsRead("0109876543");
        expect((await listNotifications({ filter: "mst", companyMst: "0109876543" })).unreadCount).toBe(0);
        expect(await getUnreadCount()).toBeGreaterThan(0);
        await markAllNotificationsRead();
        expect(await getUnreadCount()).toBe(0);
    });

    it("pages zero-based by size", async () => {
        const all = await listNotifications({ filter: "all", size: 2 });
        const p1 = await listNotifications({ filter: "all", size: 2, page: 1 });
        expect(all.items).toHaveLength(2);
        expect(p1.items[0].id).not.toBe(all.items[0].id);
    });
});
