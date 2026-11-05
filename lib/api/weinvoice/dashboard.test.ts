import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), source: { DATA_SOURCE: "mock" as "mock" | "api" } }));

vi.mock("@/lib/axios", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, get: h.get } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);

import { computeFromStore, getDashboard, toDashboardSummary } from "@/lib/api/weinvoice/dashboard";
import { getState, resetState } from "@/lib/api/weinvoice/store";
import type { DashboardResponseRec } from "@/lib/types/api";

const ACTIVE = "0109876543";

const REC: DashboardResponseRec = {
    company_mst: ACTIVE,
    year: 2026,
    kpis: { count: 10, sales_count: 4, purchase_count: 6, sales_total: 400, purchase_total: 600, out_vat: 40, in_vat: 60, vat_payable: 0 },
    months: [{ month: "2026-03", sales: 100, purchase: 200, sales_count: 1, purchase_count: 2 }],
    data_status: { missing_xml: 2, no_code_no_xml: 1, missing_pdf: 5, incomplete_periods: [{ month: "2026-10", got: 18, total: 26 }] },
    top_suppliers: [{ tax_id: "0106111222", name: "A", count: 3, total: 300 }],
    last_sync: { finished_at: "2026-10-30T08:15:00Z", status: "success" },
};

beforeEach(() => {
    h.get.mockReset();
    h.source.DATA_SOURCE = "mock";
    resetState();
});

describe("toDashboardSummary — backend DashboardResponse → screen shape", () => {
    it("maps every field once and fills the missing months with zeros", () => {
        const d = toDashboardSummary(REC);
        expect(d).toMatchObject({ count: 10, salesCount: 4, purchaseCount: 6, salesTotal: 400, purchaseTotal: 600, outVat: 40, inVat: 60, missingXml: 2, noCodeNoXml: 1, missingPdf: 5 });
        expect(d.months).toHaveLength(12);
        expect(d.months[2]).toEqual({ m: 3, sales: 100, purchase: 200 });
        expect(d.months[0]).toEqual({ m: 1, sales: 0, purchase: 0 });
        expect(d.incomplete).toEqual([{ month: "2026-10", fetched: 18, total: 26 }]);
        expect(d.lastSyncedAt).toBe("2026-10-30T08:15:00Z");
        expect(d.lastRun).toBeNull();
        expect(d.top).toEqual([{ taxId: "0106111222", name: "A", total: 300, count: 3 }]);
    });

    it("keeps a never-synced company as nulls", () => {
        const d = toDashboardSummary({ ...REC, last_sync: null, data_status: { ...REC.data_status, incomplete_periods: [{ month: "2026-09", got: null, total: null }] } });
        expect(d.lastSyncedAt).toBeNull();
        expect(d.incomplete).toEqual([{ month: "2026-09", fetched: 0, total: 0 }]);
    });
});

describe("computeFromStore — mock source", () => {
    it("excludes cancelled and replaced invoices and returns 12 months + top 5 sorted", () => {
        const d = computeFromStore(ACTIVE, 2026);
        const live = getState().invoices.filter(
            (i) => (i.direction === "purchase" ? i.buyerTaxId : i.sellerTaxId) === ACTIVE && i.issueDate.startsWith("2026") && i.status !== "cancelled" && i.status !== "replaced",
        );
        expect(d.count).toBe(live.length);
        expect(d.months).toHaveLength(12);
        expect(d.months.reduce((a, m) => a + m.sales + m.purchase, 0)).toBe(live.reduce((a, i) => a + i.total, 0));
        expect(d.top.length).toBeLessThanOrEqual(5);
        expect(d.top.map((p) => p.total)).toEqual([...d.top.map((p) => p.total)].sort((a, b) => b - a));
    });

    it("is what getDashboard returns while the data source is mock (no HTTP)", async () => {
        await expect(getDashboard(ACTIVE, 2026)).resolves.toEqual(computeFromStore(ACTIVE, 2026));
        expect(h.get).not.toHaveBeenCalled();
    });
});

describe("getDashboard — api source", () => {
    beforeEach(() => {
        h.source.DATA_SOURCE = "api";
    });

    it("calls GET /api/v1/weinvoice/dashboard with company_mst + year", async () => {
        h.get.mockResolvedValue({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data: REC } } as AxiosResponse);
        const d = await getDashboard(ACTIVE, 2026);
        expect(h.get).toHaveBeenCalledWith("/api/v1/weinvoice/dashboard", { params: { company_mst: ACTIVE, year: 2026 } });
        expect(d.count).toBe(10);
    });

    it("surfaces status.error as a DashboardError with the backend code", async () => {
        h.get.mockResolvedValue({ data: { status: { error: true, code: "WBE4031", message: "MST not in tenant" } } } as AxiosResponse);
        await expect(getDashboard(ACTIVE, 2026)).rejects.toMatchObject({ code: "WBE4031", message: "MST not in tenant" });
    });

    it("reports an endpoint that does not exist yet as HTTP_404, and no response as WBE_NETWORK", async () => {
        const notFound = new AxiosError("Request failed with status code 404", "ERR_BAD_REQUEST", undefined, undefined, { status: 404, data: "", statusText: "", headers: {}, config: {} as never });
        h.get.mockRejectedValueOnce(notFound);
        await expect(getDashboard(ACTIVE, 2026)).rejects.toMatchObject({ code: "HTTP_404" });
        h.get.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
        await expect(getDashboard(ACTIVE, 2026)).rejects.toMatchObject({ code: "WBE_NETWORK" });
    });
});
