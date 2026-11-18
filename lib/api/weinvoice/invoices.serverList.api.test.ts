import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);

import { getInvoice, invoiceFacets, listInvoiceIds, listInvoices, loadInvoicesByIds } from "@/lib/api/weinvoice/invoices";
import { getState, resetState } from "@/lib/api/weinvoice/store";

// docs/issues/weinvoice-invoice-list-server-paging-2026-11-18.md — the list loads one page at a time from the server
// instead of the whole year.

const MST = "0318793907";
const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
const calls = () => h.request.mock.calls.map(([c]) => c as { method: string; url: string; params?: Record<string, unknown> });

const row = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    direction: "sales",
    issue_date: "2026-11-16",
    template_no: "1",
    symbol: "C26MMC",
    number: id,
    seller_tax_id: MST,
    seller_name: "Cty",
    buyer_tax_id: "0300000009",
    buyer_name: "Khách",
    partner_tax_id: "0300000009",
    partner_name: "Khách",
    currency: "VND",
    exchange_rate: 1,
    pre_tax: 100,
    tax: 10,
    total: 110,
    total_vnd: 110,
    status: "original",
    kind: "cash_register",
    cqt_code: null,
    provider: null,
    provider_tax_id: null,
    provider_known: false,
    has_xml: false,
    has_pdf: false,
    needs_lookup_code: false,
    tag_ids: [],
    source: "gdt",
    synced_at: "2026-11-16T08:00:00Z",
    ...extra,
});

const QUERY = {
    taxId: MST,
    direction: "sales" as const,
    from: "2026-01-01",
    to: "2026-12-31",
    keyword: "  pacific ",
    missingXml: "all" as const,
    xml: "has" as const,
    pdf: "missing" as const,
    statuses: ["original", "cancelled"] as ("original" | "cancelled")[],
    kind: "cash_register" as const,
    tagIds: ["3", "4"],
    provider: "__needcode",
    excludeTaxIds: ["0300000001", "0300000002"],
    sort: { field: "issueDate" as const, dir: "desc" as const },
};

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    resetState();
});

describe("listInvoices (api) — one server page", () => {
    it("sends every filter, the 0-based page and size; maps the server KPIs; caches only that page", async () => {
        h.request.mockResolvedValueOnce(
            ok({
                rows: [row("101"), row("102")],
                total_count: 64189,
                page: 2,
                size: 20,
                kpis: {
                    count: 64189, pre_tax: 1000, tax: 100, total: 1100,
                    missing_xml: 60232, no_code_missing_xml: 29, missing_xml_all: 60261, missing_pdf: 60563,
                    sales_count: 64189, purchase_count: 0, period_sales_count: 64189, period_purchase_count: 111,
                    sales_total: 1100, purchase_total: 0,
                },
                incomplete_periods: [{ month: "2026-10", got: 5, total: 9 }],
            }),
        );

        const r = await listInvoices({ ...QUERY, page: 3, size: 20 });

        const [c] = calls();
        expect(c).toMatchObject({ method: "get", url: "/api/v1/weinvoice/invoices" });
        expect(c.params).toEqual({
            company_mst: MST,
            direction: "sales",
            from: "2026-01-01",
            to: "2026-12-31",
            keyword: "pacific",
            xml: "missing_all", // the "HĐ thiếu XML" chip wins over the XML select
            pdf: "missing",
            statuses: "original,cancelled",
            kind: "cash_register",
            tag_ids: "3,4",
            provider: "needs_code",
            exclude_tax_ids: "0300000001,0300000002",
            sort_field: "issueDate",
            sort_direction: "desc",
            page: 2,
            size: 20,
        });
        expect(r.totalCount).toBe(64189);
        expect(r.kpis).toMatchObject({ count: 64189, missingXml: 60261, missingPdf: 60563, salesCount: 64189, purchaseCount: 111 });
        expect(r.missingXmlCoded).toBe(60232);
        expect(r.incomplete).toEqual([{ month: "2026-10", fetched: 5, total: 9 }]);
        expect(r.rows.map((i) => i.id)).toEqual(["101", "102"]);
        expect(getState().invoices.map((i) => i.id)).toEqual(["101", "102"]); // the page only, not the year
    });

    it("older backend without missing_xml_all / period counts: coded + no-code, and the filtered counts", async () => {
        h.request.mockResolvedValueOnce(ok({ rows: [], total_count: 0, page: 0, size: 20, kpis: { missing_xml: 3, no_code_missing_xml: 2, sales_count: 4, purchase_count: 0 }, incomplete_periods: [] }));
        const r = await listInvoices({ taxId: MST, direction: "sales", from: "2026-01-01", to: "2026-12-31", page: 1, size: 20 });
        expect(r.kpis).toMatchObject({ missingXml: 5, salesCount: 4, purchaseCount: 0 });
        expect(calls()[0].params).toMatchObject({ page: 0 });
        // no value = not sent (axios drops undefined params)
        expect(calls()[0].params?.xml).toBeUndefined();
        expect(calls()[0].params?.provider).toBeUndefined();
    });
});

describe("select all / facets / rows by id (api)", () => {
    it("listInvoiceIds → GET /invoices/ids with the same filters, no page", async () => {
        h.request.mockResolvedValueOnce(ok(["9", "8"]));
        expect(await listInvoiceIds({ ...QUERY, provider: "__none", missingXml: "coded" })).toEqual(["9", "8"]);
        const [c] = calls();
        expect(c.url).toBe("/api/v1/weinvoice/invoices/ids");
        expect(c.params).toMatchObject({ provider: "no_code", xml: "missing_coded" });
        expect(c.params).not.toHaveProperty("page");
    });

    it("invoiceFacets → provider options (unknown / none counted together), needs-code count, partners", async () => {
        h.request.mockResolvedValueOnce(
            ok({
                providers: [
                    { key: "0101243150", name: "MISA", known: true, count: 7 },
                    { key: "0999999999", name: null, known: false, count: 2 },
                    { key: "no_code", name: null, known: false, count: 3 },
                ],
                statuses: [],
                kinds: [],
                needs_code: 4,
                partners: [{ tax_id: "0300000001", name: "Alpha", count: 9 }, { tax_id: "0300000002", name: null, count: 1 }],
            }),
        );
        const f = await invoiceFacets(MST, "purchase", "2026-01-01", "2026-12-31");
        expect(calls()[0]).toMatchObject({ url: "/api/v1/weinvoice/invoices/facets", params: { company_mst: MST, direction: "purchase", from: "2026-01-01", to: "2026-12-31" } });
        expect(f.providers).toEqual([{ key: "0101243150", label: expect.any(String), n: 7 }]);
        expect(f.none).toBe(5);
        expect(f.needsCode).toBe(4);
        expect(f.partners).toEqual([{ taxId: "0300000001", name: "Alpha" }, { taxId: "0300000002", name: "0300000002" }]);
    });

    it("loadInvoicesByIds → GET /invoices?ids= (comma list), rows cached", async () => {
        h.request.mockResolvedValueOnce(ok({ rows: [row("7"), row("9")], total_count: 2, page: 0, size: 2, kpis: {}, incomplete_periods: [] }));
        await loadInvoicesByIds(MST, ["7", "9", "7"]);
        expect(calls()[0].params).toMatchObject({ company_mst: MST, ids: "7,9", page: 0, size: 2 });
        expect(getInvoice("9")).toBeDefined();
    });
});
