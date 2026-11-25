import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: h.push, replace: vi.fn() }),
    usePathname: () => "/invoices/purchase",
}));

import InvoiceListPage from "@/components/invoices/InvoiceListPage";
import { DialogProvider } from "@/components/shared/dialog";
import { resetState, setState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

// docs/features/weinvoice/weinvoice-invoice-downloads-v1-1-2026-11-25.md — UI Spec v1.1: download bar above the table,
// scope = whole filtered list when nothing is ticked, bulk PDF processed on the server, Excel missing-XML dialog,
// "Bảng kê gốc (CQT)".

const MST = "1201496252";
const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
const file = (name: string) => ({ data: new Blob(["x"], { type: "application/octet-stream" }), headers: { "content-disposition": `attachment; filename="${name}"` } });
type Call = { method: string; url: string; params?: Record<string, unknown>; data?: Record<string, unknown> };
const calls = () => h.request.mock.calls.map(([c]) => c as Call);
const callTo = (url: string) => calls().filter((c) => c.url === `/api/v1/weinvoice${url}`);

const row = (n: number, hasXml = true) => ({
    id: String(n), direction: "purchase", issue_date: "2026-11-16", template_no: "1", symbol: "C26TAA", number: String(n),
    seller_tax_id: "0300000009", seller_name: `NCC ${n}`, buyer_tax_id: MST, buyer_name: "Cty", partner_tax_id: "0300000009",
    partner_name: `NCC ${n}`, currency: "VND", exchange_rate: 1, pre_tax: 100, tax: 10, total: 110, total_vnd: 110,
    status: "original", kind: "normal", cqt_code: "M1", provider: null, provider_tax_id: null, provider_known: false,
    has_xml: hasXml, has_pdf: true, needs_lookup_code: false, tag_ids: [], source: "gdt", synced_at: "2026-11-16T08:00:00Z",
});

const doneJob = {
    job_id: "j1", mode: "merge", state: "done", step: "done", xml_done: 0, xml_total: 0, total: 2, done: 1, fallback: 1, failed: 0,
    loading: 0, items: [], failed_groups: [],
    fallback_groups: [{ reason: "no_lookup_code", count: 1, items: [] }],
    file_name: `${MST}_MUAVAO_01-01-2026-31-12-2026_NOI-PDF.zip`, file_ready: true, error: null,
};

let missingCoded = 0;
const serve = (cfg: Call) => {
    const u = cfg.url.replace("/api/v1/weinvoice", "");
    if (u === "/invoices/facets") return ok({ providers: [], statuses: [], kinds: [], needs_code: 0, partners: [] });
    if (u === "/invoices")
        return ok({
            rows: [row(1, false), row(2)],
            total_count: 2,
            page: 0,
            size: 20,
            kpis: { count: 2, pre_tax: 0, tax: 0, total: 0, missing_xml: missingCoded, no_code_missing_xml: 0, missing_xml_all: missingCoded, missing_pdf: 0 },
            incomplete_periods: [],
        });
    if (u === "/invoices/export/pdf-jobs") return ok(doneJob);
    if (u === "/invoices/export/pdf-jobs/j1/file") return file(doneJob.file_name);
    if (u === "/invoices/export/excel") return file("WeInvoice.xlsx");
    if (u === "/invoices/export/cqt-list") return file("bang-ke-goc-CQT.zip");
    return ok(null);
};

const renderPage = async () => {
    setState((s) => {
        s.activeTaxId = MST;
    });
    render(
        <LocaleProvider>
            <DialogProvider>
                <InvoiceListPage direction="purchase" />
            </DialogProvider>
        </LocaleProvider>,
    );
    await screen.findByText("NCC 1");
    return screen.getByTestId("dl-toolbar");
};

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.request.mockImplementation(async (cfg: Call) => serve(cfg));
    h.push.mockReset();
    missingCoded = 0;
    window.localStorage.setItem("wecms_locale", "VI");
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); // downloadBlob: no jsdom navigation
    resetState();
});

describe("InvoiceListPage — v1.1 download bar", () => {
    it("moves the downloads out of the header into the bar, with whole-list counts", async () => {
        const bar = await renderPage();
        expect(within(bar).getByText("Tick checkbox để chọn hoá đơn cụ thể, hoặc dùng nút bên phải để tải toàn bộ.")).toBeInTheDocument();
        expect(within(bar).getByRole("button", { name: /Tải PDF \(2\)/ })).toBeInTheDocument();
        expect(within(bar).getByRole("button", { name: /Excel \(2\)/ })).toBeInTheDocument();
        expect(within(bar).getByRole("button", { name: /Bảng kê gốc \(CQT\)/ })).toBeInTheDocument();
        expect(within(bar).getByRole("button", { name: /Tải XML tất cả \(2\)/ })).toBeInTheDocument();
        expect(within(bar).queryByRole("button", { name: /Gắn tag/ })).toBeNull();
        // only one Excel button on the page (the header lost its copy)
        expect(screen.getAllByRole("button", { name: /Excel \(/ })).toHaveLength(1);
    });

    it("ticking a row switches the bar to the selection", async () => {
        const bar = await renderPage();
        const rowEl = screen.getByText("NCC 2").closest("tr") as HTMLElement;
        fireEvent.click(within(rowEl).getByRole("checkbox"));
        expect(await within(bar).findByText("Đã chọn 1 hoá đơn — các nút bên phải áp dụng cho hoá đơn đã chọn.")).toBeInTheDocument();
        expect(within(bar).getByRole("button", { name: /Gắn tag \(1\)/ })).toBeInTheDocument();
        expect(within(bar).getByRole("button", { name: /Tải XML đã chọn \(1\)/ })).toBeInTheDocument();

        fireEvent.click(within(bar).getByRole("button", { name: /Excel \(1\)/ }));
        await waitFor(() => expect(callTo("/invoices/export/excel")).toHaveLength(1));
        expect(callTo("/invoices/export/excel")[0].data).toMatchObject({ company_mst: MST, direction: "purchase", ids: ["2"] });
    });

    it("bulk PDF: starts a server job for the whole filtered list and downloads the one ZIP", async () => {
        const bar = await renderPage();
        fireEvent.click(within(bar).getByRole("button", { name: /Tải PDF \(2\)/ }));
        fireEvent.click(within(screen.getByTestId("pdf-menu")).getByText("Nối tất cả thành 1 file PDF"));

        await waitFor(() => expect(callTo("/invoices/export/pdf-jobs")).toHaveLength(1));
        const body = callTo("/invoices/export/pdf-jobs")[0].data!;
        expect(body).toMatchObject({ company_mst: MST, mode: "merge" });
        expect(body.ids).toBeUndefined(); // nothing ticked → the server takes the filter
        expect(body.filter).toMatchObject({ direction: "purchase", from: expect.any(String), to: expect.any(String) });

        const result = await screen.findByTestId("pdf-result");
        await waitFor(() => expect(callTo("/invoices/export/pdf-jobs/j1/file")).toHaveLength(1));
        expect(within(result).getByText("1 hoá đơn không có PDF gốc — đã dùng bản thể hiện")).toBeInTheDocument();
        // user decision 2026-11-25: "Quét email", not "Quét Gmail"
        fireEvent.click(within(result).getByRole("button", { name: "Quét email để lấy mã tra cứu cho HĐ chưa tải được" }));
        expect(h.push).toHaveBeenCalledWith("/sources/mailbox");
    });

    it("Excel with coded invoices missing XML asks with two choices; 'Xuất ngay' exports the whole list", async () => {
        missingCoded = 1;
        const bar = await renderPage();
        fireEvent.click(within(bar).getByRole("button", { name: /Excel \(2\)/ }));
        const ask = await screen.findByTestId("excel-ask");
        expect(within(ask).getByText(/1 hoá đơn có XML ở Cục Thuế nhưng chưa tải về WeInvoice/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Đồng bộ + xuất đầy đủ" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Xuất ngay (thiếu 1 HĐ)" }));
        await waitFor(() => expect(callTo("/invoices/export/excel")).toHaveLength(1));
        expect(callTo("/invoices/export/excel")[0].data?.ids).toBeUndefined();
    });

    it("Bảng kê gốc (CQT) asks the server for the ZIP of the filtered list", async () => {
        const bar = await renderPage();
        fireEvent.click(within(bar).getByRole("button", { name: /Bảng kê gốc \(CQT\)/ }));
        await waitFor(() => expect(callTo("/invoices/export/cqt-list")).toHaveLength(1));
        expect(callTo("/invoices/export/cqt-list")[0].data).toMatchObject({ company_mst: MST, direction: "purchase" });
        expect(await screen.findByText("Đã tải bảng kê gốc CQT (2 hoá đơn)")).toBeInTheDocument();
    });

    it("mock build without invoices: the bar buttons are disabled", async () => {
        h.source.DATA_SOURCE = "mock";
        setState((s) => {
            s.activeTaxId = MST;
        });
        render(
            <LocaleProvider>
                <DialogProvider>
                    <InvoiceListPage direction="purchase" />
                </DialogProvider>
            </LocaleProvider>,
        );
        const bar = screen.getByTestId("dl-toolbar");
        expect(within(bar).getByRole("button", { name: /Tải PDF \(0\)/ })).toBeDisabled();
    });
});
