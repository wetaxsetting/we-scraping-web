import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request, post: h.post } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
// Polling helpers and mock delays sleep — make them instant.
vi.mock("@/lib/utils", async (io) => ({ ...(await io<typeof import("@/lib/utils")>()), sleep: () => Promise.resolve() }));

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
const fail = (code: string, message: string) => ({ data: { status: { error: true, code, message }, data: null } });

type Call = { method: string; url: string; params?: Record<string, unknown>; data?: Record<string, unknown> };
const calls = (): Call[] => h.request.mock.calls.map((c) => c[0] as Call);

/** Route responses by "METHOD url" (url without the base); a function value is called per request. */
function routes(map: Record<string, unknown | ((c: Call) => unknown)>) {
    h.request.mockImplementation(async (c: Call) => {
        const key = `${c.method.toUpperCase()} ${c.url.replace("/api/v1/weinvoice", "")}`;
        if (!(key in map)) throw new Error(`unexpected ${key}`);
        const v = map[key];
        return typeof v === "function" ? (v as (c: Call) => unknown)(c) : v;
    });
}

import { listProviders } from "@/lib/api/weinvoice/providers";

beforeEach(() => {
    h.request.mockReset();
});

/** One `ProviderItem` exactly as the backend serializes it (snake_case). */
const ITEM = {
    stt: 2,
    tax_id: "0104128565",
    name: "FPT",
    full_name: "Công ty TNHH Hệ thống thông tin FPT",
    web: "https://einvoice.fpt.com.vn",
    lookup_url: "https://tracuuhoadon.fpt.com.vn/",
    captcha_url: null,
    alt_lookup_urls: ["https://tracuu2.fpt.com.vn/"],
    verify: null,
    link_status: "ok",
    invoice_count: 4,
    auto_pdf: true,
};

describe("providers — api mode", () => {
    it("GET /providers?keyword=&link_status= → a plain array of ProviderItem (camelCased)", async () => {
        routes({ "GET /providers": ok([ITEM]) });
        const r = await listProviders({ keyword: " fpt ", linkStatus: "ok" });
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/providers", params: { keyword: "fpt", link_status: "ok" } });
        expect(r.totalCount).toBe(1);
        expect(r.rows[0]).toEqual({
            stt: 2,
            taxId: "0104128565",
            name: "FPT",
            fullName: "Công ty TNHH Hệ thống thông tin FPT",
            web: "https://einvoice.fpt.com.vn",
            lookupUrl: "https://tracuuhoadon.fpt.com.vn/",
            captchaUrl: null,
            altLookupUrls: ["https://tracuu2.fpt.com.vn/"],
            verify: null,
            linkStatus: "ok",
            invoiceCount: 4,
            autoPdf: true,
        });
    });

    it("missing link: lookup_url null, link_status missing; no filter → no params", async () => {
        routes({ "GET /providers": ok([{ ...ITEM, lookup_url: null, link_status: "missing", alt_lookup_urls: [] }]) });
        const r = await listProviders({ keyword: "  " });
        expect(calls()[0].params).toEqual({});
        expect(r.rows[0]).toMatchObject({ lookupUrl: null, linkStatus: "missing" });
    });

    it("empty catalogue; error → WeInvoiceApiError code (WBE_VALIDATION for a bad link_status)", async () => {
        routes({ "GET /providers": ok([]) });
        await expect(listProviders({})).resolves.toEqual({ rows: [], totalCount: 0 });
        routes({ "GET /providers": fail("WBE_VALIDATION", "link_status: must be ok, check or missing") });
        await expect(listProviders({})).rejects.toMatchObject({ code: "WBE_VALIDATION" });
    });
});
