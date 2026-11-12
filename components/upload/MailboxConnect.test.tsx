import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), source: { DATA_SOURCE: "mock" as "mock" | "api" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("@/lib/utils", async (io) => ({ ...(await io<typeof import("@/lib/utils")>()), sleep: () => Promise.resolve() }));

import { MailboxConnect } from "@/components/upload/MailboxConnect";
import { DialogProvider } from "@/components/shared/dialog";
import { getState, resetState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });

const renderIt = () =>
    render(
        <LocaleProvider>
            <DialogProvider>
                <MailboxConnect />
            </DialogProvider>
        </LocaleProvider>,
    );
const tile = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
    h.request.mockReset();
    h.source.DATA_SOURCE = "mock";
    window.localStorage.setItem("wecms_locale", "VI");
    window.history.replaceState(null, "", "/sources/mailbox");
    resetState();
});

describe("MailboxConnect — tiles", () => {
    it("4 tiles; each shows its own panel", async () => {
        renderIt();
        expect(tile(/^Gmail/)).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText(/^Địa chỉ Gmail/)).toBeInTheDocument();
        expect(screen.queryByLabelText(/^Máy chủ IMAP/)).not.toBeInTheDocument();

        fireEvent.click(tile(/^Mail công ty \(IMAP\)/));
        expect(tile(/^Mail công ty \(IMAP\)/)).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText(/^Máy chủ IMAP/)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Cổng/)).toHaveValue("993");
        expect(screen.getByPlaceholderText("Mặc định là địa chỉ email")).toBeInTheDocument();

        fireEvent.click(tile(/^Outlook \/ Microsoft 365/));
        expect(screen.getByRole("button", { name: "Đăng nhập Microsoft" })).toBeInTheDocument();
        expect(screen.queryByLabelText(/^Mật khẩu/)).not.toBeInTheDocument();

        fireEvent.click(tile(/^Chuyển tiếp/));
        const taxId = getState().activeTaxId;
        expect(await screen.findByText(`hd-${taxId}@inbox.weinvoice.vn`)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Sao chép/ })).toBeEnabled();
    });

    it("lists the mailbox of the working MST with its status and actions", () => {
        renderIt();
        const row = screen.getByText("hoadon.anphat@gmail.example").closest("li") as HTMLElement;
        expect(within(row).getByText("Đã kết nối")).toBeInTheDocument();
        expect(within(row).getByRole("button", { name: /Quét ngay/ })).toBeInTheDocument();
        expect(within(row).getByRole("button", { name: /Sửa/ })).toBeInTheDocument();
        expect(within(row).getByRole("button", { name: /Ngắt kết nối/ })).toBeInTheDocument();
    });
});

describe("MailboxConnect — validation", () => {
    it("Gmail: empty form → address + password errors; a normal password → the 16-letter message; nothing saved", async () => {
        renderIt();
        const before = getState().mailboxes?.length;
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và kết nối" }));
        expect(await screen.findByText("Địa chỉ email không hợp lệ")).toBeInTheDocument();
        expect(screen.getByText("Nhập mật khẩu")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/^Địa chỉ Gmail/), { target: { value: "kt@gmail.com" } });
        fireEvent.change(screen.getByLabelText(/^Mật khẩu ứng dụng/), { target: { value: "matkhau123" } });
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và kết nối" }));
        expect(await screen.findByText(/16 chữ cái/)).toBeInTheDocument();
        expect(screen.queryByText("Địa chỉ email không hợp lệ")).not.toBeInTheDocument();
        expect(getState().mailboxes?.length).toBe(before);
    });

    it("IMAP: server and port are checked; a valid form connects and clears the password", async () => {
        renderIt();
        fireEvent.click(tile(/^Mail công ty \(IMAP\)/));
        fireEvent.change(screen.getByLabelText(/^Địa chỉ email/), { target: { value: "ketoan@congty.vn" } });
        fireEvent.change(screen.getByLabelText(/^Cổng/), { target: { value: "0" } });
        fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: "bi mat" } });
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và kết nối" }));
        expect(await screen.findByText(/Nhập máy chủ IMAP hợp lệ/)).toBeInTheDocument();
        expect(screen.getByText("Cổng là số từ 1 đến 65535")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/^Máy chủ IMAP/), { target: { value: "mail.congty.vn" } });
        fireEvent.change(screen.getByLabelText(/^Cổng/), { target: { value: "993" } });
        fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và kết nối" }));
        await waitFor(() => expect(getState().mailboxes?.some((m) => m.address === "ketoan@congty.vn" && m.provider === "imap")).toBe(true));
        expect(screen.getByLabelText(/^Mật khẩu/)).toHaveValue("");
        expect(JSON.stringify(getState())).not.toContain("bi mat");
        expect(h.request).not.toHaveBeenCalled();
    });
});

describe("MailboxConnect — api mode", () => {
    it("Microsoft return ?ms=error&reason=denied → error dialog, URL cleaned, list loaded from GET /mailboxes", async () => {
        h.source.DATA_SOURCE = "api";
        window.history.replaceState(null, "", "/sources/mailbox?ms=error&reason=denied");
        h.request.mockImplementation(async (c: { method: string; url: string }) => {
            if (c.method === "get" && c.url === "/api/v1/weinvoice/mailboxes") return ok([]);
            throw new Error(`unexpected ${c.method} ${c.url}`);
        });
        renderIt();
        expect(await screen.findByText(/Bạn đã huỷ hoặc không cấp quyền cho WeInvoice/)).toBeInTheDocument();
        expect(window.location.search).toBe("");
        await waitFor(() => expect(h.request).toHaveBeenCalledWith(expect.objectContaining({ method: "get", url: "/api/v1/weinvoice/mailboxes" })));
        expect(await screen.findByText("Chưa kết nối hộp thư nào")).toBeInTheDocument();
    });
});
