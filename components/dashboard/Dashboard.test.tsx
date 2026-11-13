import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn(), source: { DATA_SOURCE: "mock" as "mock" | "api" } }));

vi.mock("@/lib/axios", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, get: h.get, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard" }));

import Dashboard from "@/components/dashboard/Dashboard";
import { DialogProvider } from "@/components/shared/dialog";
import { computeFromStore } from "@/lib/api/weinvoice/dashboard";
import { hydrate } from "@/lib/api/weinvoice/remote";
import { resetState, setState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";

const renderDashboard = () =>
    render(
        <LocaleProvider>
            <DialogProvider>
                <Dashboard />
            </DialogProvider>
        </LocaleProvider>,
    );

beforeEach(() => {
    h.get.mockReset();
    h.request.mockReset();
    h.source.DATA_SOURCE = "mock";
    window.localStorage.setItem("wecms_locale", "VI");
    resetState();
});

describe("Dashboard screen", () => {
    it("renders the KPI cards from the mock source", async () => {
        renderDashboard();
        const expected = computeFromStore("0109876543", 2026);
        expect(await screen.findByText(expected.count.toLocaleString("vi-VN"))).toBeInTheDocument();
        expect(h.get).not.toHaveBeenCalled();
    });

    it("API source: shows the error card with the code, and retries on demand", async () => {
        h.source.DATA_SOURCE = "api";
        h.get.mockRejectedValueOnce(new AxiosError("Request failed with status code 404", "ERR_BAD_REQUEST", undefined, undefined, { status: 404, data: "", statusText: "", headers: {}, config: {} as never }));
        renderDashboard();
        expect(await screen.findByText(/HTTP_404/)).toBeInTheDocument();
        expect(h.get).toHaveBeenCalledWith("/api/v1/weinvoice/dashboard", { params: { company_mst: "0109876543", year: 2026 } });

        h.get.mockResolvedValueOnce({
            data: {
                status: { error: false, code: "WBI0000", message: "OK" },
                data: {
                    company_mst: "0109876543",
                    year: 2026,
                    kpis: { count: 4321, sales_count: 1, purchase_count: 2, sales_total: 1, purchase_total: 2, out_vat: 0, in_vat: 0, vat_payable: 0 },
                    months: [],
                    data_status: { missing_xml: 0, no_code_no_xml: 0, missing_pdf: 0, incomplete_periods: [] },
                    top_suppliers: [],
                    last_sync: null,
                },
            },
        } as AxiosResponse);
        fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
        await waitFor(() => expect(screen.getByText("4.321")).toBeInTheDocument());
    });

    it("API source: waits for the working MST instead of requesting company_mst=''", async () => {
        h.source.DATA_SOURCE = "api";
        setState((st) => {
            st.activeTaxId = "";
        });
        renderDashboard();
        expect(await screen.findByRole("status")).toBeInTheDocument();
        expect(h.get).not.toHaveBeenCalled();
    });

    // docs/bugs/weinvoice-dashboard-without-tax-code-fix-2026-11-13.md — a new account (no tax code) got a
    // "companyMst must not be blank" banner and an endless spinner.
    it("API source: an account without any tax code gets the connect-MST empty state, and no MST-scoped request", async () => {
        h.source.DATA_SOURCE = "api";
        setState((st) => {
            st.activeTaxId = "";
            st.connections = [];
        });
        const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
        h.request.mockImplementation(async (c: { url: string }) => {
            const path = c.url.replace("/api/v1/weinvoice", "");
            if (path === "/companies") return ok({ companies: [], quota: { max: 5 } });
            if (path === "/me") return ok({ working_company_mst: null });
            if (path === "/tags") return ok([]);
            if (path === "/sync-runs") return ok({ rows: [], total_count: 0, page: 0, size: 200 });
            throw new Error(`unexpected ${path}`);
        });
        await hydrate();
        renderDashboard();

        expect(await screen.findByText("Chưa có MST nào")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Thêm MST" })).toHaveAttribute("href", "/sources/gdt?add=1");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        const paths = h.request.mock.calls.map((c) => (c[0] as { url: string }).url);
        expect(paths.some((u) => u.includes("/email/messages") || u.includes("/invoices"))).toBe(false);
        expect(h.get).not.toHaveBeenCalled();
    });
});
