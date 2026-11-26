import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);

import {
    createVatDeclaration,
    listAnnex,
    listVatDeclarations,
    lockVatDeclaration,
    saveVatDeclaration,
    syncVatDeclaration,
} from "@/lib/api/weinvoice/vatDeclarations";

// docs/features/weinvoice/weinvoice-vat-declaration-engine-invoices-2026-11-25.md — the WeCMS VAT declaration
// module on the engine invoices, one book per working MST: /companies/{mst}/vat-declarations.

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
type Call = { method: string; url: string; params?: Record<string, unknown>; data?: Record<string, unknown> };
const calls = (): Call[] => h.request.mock.calls.map((c) => c[0] as Call);

const MST = "0319232069";
const BASE = `/api/v1/weinvoice/companies/${MST}/vat-declarations`;
const DETAIL = {
    sid: 7, period_type: "M", period_value: 10, decl_year: 2026, period_label: "10/2026", status: "DRAFT",
    tp_name: "CÔNG TY TNHH VÍ DỤ", tp_tax_code: MST, activity_code: "00", activity_name: "x",
    from_dt: "2026-10-01", to_dt: "2026-10-31",
    indicators: { ct22: "0", ct32: "2200000", ct33: "176000", ct32a: "0", ct39a: "0", ct40: "176000" },
};

beforeEach(() => {
    h.request.mockReset();
    h.source.DATA_SOURCE = "api";
});

describe("VAT declarations of the working MST", () => {
    it("lists the MST's declarations of a year", async () => {
        h.request.mockResolvedValueOnce(ok({ rows: [{ sid: 7, period_type: "M", period_value: 10, decl_year: 2026, status: "LOCKED", tax_amount: "176000" }], total_count: 1 }));
        const r = await listVatDeclarations(MST, { year: 2026 });
        expect(calls()[0]).toMatchObject({ method: "get", url: BASE, params: { year: 2026, page: 0, size: 50 } });
        expect(r.rows[0]).toMatchObject({ sid: 7, periodType: "M", periodValue: 10, declYear: 2026, taxAmount: "176000" });
    });

    it("creates a period with the business line, wire snake_case", async () => {
        h.request.mockResolvedValueOnce(ok(DETAIL));
        const d = await createVatDeclaration(MST, { periodType: "M", periodValue: 10, declYear: 2026, bsnsLineCd: "00" });
        expect(calls()[0]).toMatchObject({ method: "post", url: BASE, data: { period_type: "M", period_value: 10, decl_year: 2026, bsns_line_cd: "00" } });
        expect(d.indicators.ct32a).toBe("0");
        expect(d.tpTaxCode).toBe(MST);
    });

    it("saves only the edited cells (an omitted cell stays derived by the backend)", async () => {
        h.request.mockResolvedValueOnce(ok(DETAIL));
        await saveVatDeclaration(MST, 7, { ct22: "1500000", ct39a: "0" });
        expect(calls()[0]).toMatchObject({ method: "put", url: `${BASE}/7`, data: { ct22: "1500000", ct39a: "0" } });
        expect(Object.keys(calls()[0].data ?? {})).toEqual(["ct22", "ct39a"]);
    });

    it("sync / lock / unlock hit their endpoints", async () => {
        h.request.mockResolvedValue(ok(DETAIL));
        await syncVatDeclaration(MST, 7);
        await lockVatDeclaration(MST, 7, true);
        await lockVatDeclaration(MST, 7, false);
        expect(calls().map((c) => `${c.method} ${c.url}`)).toEqual([`post ${BASE}/7/sync`, `put ${BASE}/7/lock`, `delete ${BASE}/7/lock`]);
    });

    it("annex list sends annex_type and a zero-based page", async () => {
        h.request.mockResolvedValueOnce(ok({ rows: [], total_count: 0, total_pages: 0, page_number: 1, page_size: 20, tax_groups: [], grand_total: { group_cd: "TOTAL", row_count: 0, total_sply_amt: "0", total_vat_amt: "0", total_reduced_amt: "0" } }));
        const p = await listAnnex(MST, 7, { annexType: "REDUCE8", search: "cước", page: 1, size: 20 });
        expect(calls()[0]).toMatchObject({ method: "get", url: `${BASE}/7/annex/invoices`, params: { annex_type: "REDUCE8", search: "cước", page: 1, size: 20 } });
        expect(p.grandTotal.groupCd).toBe("TOTAL");
    });

    it("mock mode never calls the server", async () => {
        h.source.DATA_SOURCE = "mock";
        await expect(listVatDeclarations(MST)).rejects.toMatchObject({ code: "WBE3000" });
        expect(h.request).not.toHaveBeenCalled();
    });
});
