import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/invoices/purchase",
}));

import InvoiceListPage from "@/components/invoices/InvoiceListPage";
import { DialogProvider } from "@/components/shared/dialog";
import { hydrate } from "@/lib/api/weinvoice/remote";
import { resetState, setState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

// docs/issues/weinvoice-invoice-list-server-paging-2026-11-18.md — large MSTs loaded the whole year before the list
// showed anything; now the list asks the server for one page, newest first, and asks again on every page change.

const MST = "1201496252";
const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
type Call = { method: string; url: string; params?: Record<string, unknown> };
const calls = () => h.request.mock.calls.map(([c]) => c as Call);
const listCalls = () => calls().filter((c) => c.url === "/api/v1/weinvoice/invoices");

const row = (n: number) => ({
    id: String(n), direction: "purchase", issue_date: "2026-11-16", template_no: "1", symbol: "C26TAA", number: String(n),
    seller_tax_id: "0300000009", seller_name: `NCC ${n}`, buyer_tax_id: MST, buyer_name: "Cty", partner_tax_id: "0300000009",
    partner_name: `NCC ${n}`, currency: "VND", exchange_rate: 1, pre_tax: 100, tax: 10, total: 110, total_vnd: 110,
    status: "original", kind: "normal", cqt_code: "M1", provider: null, provider_tax_id: null, provider_known: false,
    has_xml: true, has_pdf: true, needs_lookup_code: false, tag_ids: [], source: "gdt", synced_at: "2026-11-16T08:00:00Z",
});

const serve = (cfg: Call) => {
    if (cfg.url === "/api/v1/weinvoice/invoices/facets") return ok({ providers: [], statuses: [], kinds: [], needs_code: 0, partners: [] });
    if (cfg.url === "/api/v1/weinvoice/invoices") {
        const page = Number(cfg.params?.page ?? 0);
        return ok({
            rows: [row(page * 20 + 1), row(page * 20 + 2)],
            total_count: 851,
            page,
            size: 20,
            kpis: { count: 851, pre_tax: 0, tax: 0, total: 0, missing_xml: 0, no_code_missing_xml: 226, missing_xml_all: 226, missing_pdf: 229, period_sales_count: 246, period_purchase_count: 846 },
            incomplete_periods: [],
        });
    }
    return ok(null);
};

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.request.mockImplementation(async (cfg: Call) => serve(cfg));
    window.localStorage.setItem("wecms_locale", "VI");
    resetState();
});

describe("InvoiceListPage (api) — server paging", () => {
    it("asks for page 0 newest first, shows the server KPIs, asks for page 1 on 'next page'", async () => {
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

        expect(await screen.findByText("NCC 1")).toBeInTheDocument();
        expect(listCalls()[0].params).toMatchObject({ company_mst: MST, direction: "purchase", page: 0, size: 20, sort_field: "issueDate", sort_direction: "desc" });
        expect(screen.getByText("226")).toBeInTheDocument(); // card "Thiếu XML" from the server
        expect(screen.getByText(/Thiếu PDF: 229/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Next page" }));
        expect(await screen.findByText("NCC 21")).toBeInTheDocument();
        await waitFor(() => expect(listCalls().some((c) => c.params?.page === 1)).toBe(true));
        expect(listCalls().every((c) => Number(c.params?.size) === 20)).toBe(true); // never the 200-row year loader
    });

    it("hydrate() no longer downloads the year of invoices", async () => {
        h.request.mockImplementation(async (cfg: Call) => {
            if (cfg.url === "/api/v1/weinvoice/companies") return ok({ companies: [{ tax_id: MST, company_name: "Cty", status: "connected" }], quota: { used: 1, max: null } });
            if (cfg.url === "/api/v1/weinvoice/me") return ok({ working_company_mst: MST });
            return serve(cfg);
        });
        await hydrate();
        expect(calls().some((c) => c.url === "/api/v1/weinvoice/invoices")).toBe(false);
    });
});
