import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }), usePathname: () => "/dashboard" }));

import NotificationBell, { UNREAD_POLL_MS, badgeText } from "@/components/layout/NotificationBell";
import { DialogProvider } from "@/components/shared/dialog";
import { resetNotificationsMock } from "@/lib/api/weinvoice/notifications";
import { getState, resetState, setState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

const A = "0109000001";
const B = "0309000002";
const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
type Call = { method: string; url: string; params?: Record<string, unknown>; data?: Record<string, unknown> };
const calls = (): Call[] => h.request.mock.calls.map((c) => c[0] as Call);
const callsTo = (method: string, path: string) => calls().filter((c) => c.method === method && c.url === `/api/v1/weinvoice${path}`);

const ITEMS = [
    { id: "n1", type: "NEW_INVOICES", company_mst: B, company_name: "CÔNG TY B", direction: "ban", count: 12, months: ["2026-10"], at: new Date(Date.now() - 15 * 60_000).toISOString(), read: false, action: false },
    { id: "n2", type: "GDT_LOGIN_ERROR", company_mst: A, company_name: "CÔNG TY A", message: "Sai mật khẩu", at: new Date(Date.now() - 3 * 3600_000).toISOString(), read: true, action: true },
    { id: "n3", type: "PDF_READY", company_mst: A, company_name: "CÔNG TY A", count: 7, from_provider: 5, from_email: 2, at: new Date(Date.now() - 2 * 86400_000).toISOString(), read: false, action: false },
];

/** Default backend: unread count `unread`, list `items` (total = items.length), writes → 204. */
function backend(unread = 3, items: unknown[] = ITEMS, total = items.length) {
    h.request.mockImplementation(async (c: Call) => {
        const key = `${c.method.toUpperCase()} ${c.url.replace("/api/v1/weinvoice", "")}`;
        if (key === "GET /notifications/unread-count") return ok({ unread_count: unread });
        if (key === "GET /notifications") return ok({ items, unread_count: 2, total_count: total, page: c.params?.page ?? 0, size: 20 });
        if (key === "POST /notifications/read" || key === "POST /notifications/read-all") return { status: 204, data: "" };
        throw new Error(`unexpected ${key}`);
    });
}

const renderBell = () =>
    render(
        <LocaleProvider>
            <DialogProvider>
                <NotificationBell />
            </DialogProvider>
        </LocaleProvider>,
    );
const bell = () => screen.getByRole("button", { name: /Thông báo/ });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.push.mockReset();
    window.localStorage.setItem("wecms_locale", "VI");
    resetNotificationsMock();
    resetState();
    setState((s) => {
        s.connections = [
            { taxId: A, companyName: "CÔNG TY A", username: A, label: "", status: "connected", lastSyncAt: "", createdAt: "" },
            { taxId: B, companyName: "CÔNG TY B", username: B, label: "", status: "connected", lastSyncAt: "", createdAt: "" },
        ];
        s.activeTaxId = A;
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("badgeText", () => {
    it("hidden at 0, the number up to 99, 99+ above", () => {
        expect(badgeText(0)).toBeNull();
        expect(badgeText(7)).toBe("7");
        expect(badgeText(99)).toBe("99");
        expect(badgeText(100)).toBe("99+");
    });
});

describe("NotificationBell — api mode", () => {
    it("no badge when unread_count is 0", async () => {
        backend(0);
        renderBell();
        await waitFor(() => expect(callsTo("get", "/notifications/unread-count")).toHaveLength(1));
        expect(screen.queryByTestId("notif-badge")).not.toBeInTheDocument();
    });

    it("badge shows 99+ above 99", async () => {
        backend(150);
        renderBell();
        expect(await screen.findByTestId("notif-badge")).toHaveTextContent("99+");
    });

    it("polls unread-count every 60 s while visible, pauses while the tab is hidden", async () => {
        vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
        backend(1);
        renderBell();
        await waitFor(() => expect(callsTo("get", "/notifications/unread-count")).toHaveLength(1));
        await act(async () => {
            vi.advanceTimersByTime(UNREAD_POLL_MS);
        });
        await waitFor(() => expect(callsTo("get", "/notifications/unread-count")).toHaveLength(2));

        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        await act(async () => {
            vi.advanceTimersByTime(UNREAD_POLL_MS * 2);
        });
        expect(callsTo("get", "/notifications/unread-count")).toHaveLength(2);

        hidden.mockReturnValue(false);
        await act(async () => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await waitFor(() => expect(callsTo("get", "/notifications/unread-count")).toHaveLength(3));
        hidden.mockRestore();
    });

    it("opens on the working-MST filter and each chip sends its params", async () => {
        backend();
        renderBell();
        fireEvent.click(bell());
        expect(await screen.findByText("12 hóa đơn bán ra mới từ Cục Thuế")).toBeInTheDocument();
        expect(callsTo("get", "/notifications")[0].params).toEqual({ filter: "mst", company_mst: A, page: 0, size: 20 });
        // second line + PDF split + error message
        expect(screen.getByText(`${B} · Tháng 10/2026 · Xem hóa đơn`)).toBeInTheDocument();
        expect(screen.getByText("Đã lấy 7 PDF gốc · 5 từ nhà cung cấp, 2 từ email")).toBeInTheDocument();
        expect(screen.getByText(`${A} · CÔNG TY A · Cập nhật mật khẩu`)).toBeInTheDocument();
        expect(screen.getByText("10 phút trước")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "MST đang làm việc" })).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", { name: "Tất cả MST" }));
        await waitFor(() => expect(callsTo("get", "/notifications")).toHaveLength(2));
        expect(callsTo("get", "/notifications")[1].params).toEqual({ filter: "all", page: 0, size: 20 });

        fireEvent.click(screen.getByRole("button", { name: "Cần xử lý" }));
        await waitFor(() => expect(callsTo("get", "/notifications")).toHaveLength(3));
        expect(callsTo("get", "/notifications")[2].params).toEqual({ filter: "action", page: 0, size: 20 });
    });

    it("clicking an item marks it read, switches the working MST and opens the sales list", async () => {
        backend();
        renderBell();
        fireEvent.click(bell());
        fireEvent.click(await screen.findByText("12 hóa đơn bán ra mới từ Cục Thuế"));
        expect(h.push).toHaveBeenCalledWith("/invoices/sales");
        expect(getState().activeTaxId).toBe(B);
        await waitFor(() => expect(callsTo("post", "/notifications/read")).toHaveLength(1));
        expect(callsTo("post", "/notifications/read")[0].data).toEqual({ ids: ["n1"] });
        // badge re-read after the read call settles
        await waitFor(() => expect(callsTo("get", "/notifications/unread-count").length).toBeGreaterThanOrEqual(3));
    });

    it("an already-read GDT error goes to /sources/gdt without a read call or MST switch", async () => {
        backend();
        renderBell();
        fireEvent.click(bell());
        fireEvent.click(await screen.findByText("Cục Thuế từ chối mật khẩu"));
        expect(h.push).toHaveBeenCalledWith("/sources/gdt");
        expect(getState().activeTaxId).toBe(A);
        expect(callsTo("post", "/notifications/read")).toHaveLength(0);
    });

    it("navigation does not wait for (or fail on) the read call", async () => {
        backend();
        const base = h.request.getMockImplementation()!;
        h.request.mockImplementation(async (c: Call) => (c.url.endsWith("/notifications/read") ? Promise.reject(new Error("down")) : base(c)));
        renderBell();
        fireEvent.click(bell());
        fireEvent.click(await screen.findByText("Đã lấy 7 PDF gốc · 5 từ nhà cung cấp, 2 từ email"));
        expect(h.push).toHaveBeenCalledWith("/invoices/purchase");
    });

    it("read-all sends company_mst on the working-MST filter and none on Tất cả MST", async () => {
        backend();
        renderBell();
        fireEvent.click(bell());
        await screen.findByText("12 hóa đơn bán ra mới từ Cục Thuế");
        fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }));
        await waitFor(() => expect(callsTo("post", "/notifications/read-all")).toHaveLength(1));
        expect(callsTo("post", "/notifications/read-all")[0].data).toEqual({ company_mst: A });

        fireEvent.click(screen.getByRole("button", { name: "Tất cả MST" }));
        await waitFor(() => expect(callsTo("get", "/notifications")).toHaveLength(2));
        await screen.findByText("12 hóa đơn bán ra mới từ Cục Thuế");
        fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }));
        await waitFor(() => expect(callsTo("post", "/notifications/read-all")).toHaveLength(2));
        expect(callsTo("post", "/notifications/read-all")[1].data).toEqual({});
    });

    it("footer loads the next page into the same list", async () => {
        backend(3, ITEMS, 25);
        renderBell();
        fireEvent.click(bell());
        fireEvent.click(await screen.findByRole("button", { name: "Xem tất cả thông báo" }));
        await waitFor(() => expect(callsTo("get", "/notifications")).toHaveLength(2));
        expect(callsTo("get", "/notifications")[1].params).toEqual({ filter: "mst", company_mst: A, page: 1, size: 20 });
    });

    it("empty and error states", async () => {
        backend(0, []);
        renderBell();
        fireEvent.click(bell());
        expect(await screen.findByText("Chưa có thông báo")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Xem tất cả thông báo" })).not.toBeInTheDocument();

        h.request.mockImplementation(async (c: Call) => {
            if (c.url.endsWith("/unread-count")) return ok({ unread_count: 0 });
            throw new Error("network");
        });
        fireEvent.click(screen.getByRole("button", { name: "Tất cả MST" }));
        expect(await screen.findByText("Không tải được thông báo")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    });
});

describe("NotificationBell — mock mode", () => {
    it("shows fictional items for the working MST and navigates without any HTTP call", async () => {
        h.source.DATA_SOURCE = "mock";
        resetState(); // mock seed: working MST 0109876543
        renderBell();
        expect(await screen.findByTestId("notif-badge")).toBeInTheDocument();
        fireEvent.click(bell());
        fireEvent.click(await screen.findByText("12 hóa đơn mua vào mới từ Cục Thuế"));
        expect(h.push).toHaveBeenCalledWith("/invoices/purchase");
        expect(h.request).not.toHaveBeenCalled();
    });
});
