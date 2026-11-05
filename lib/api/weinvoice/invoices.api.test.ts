import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request, post: h.post } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
// Polls (engine requests, uploads) must not wait in tests.
vi.mock("@/lib/utils", async (io) => ({ ...(await io<typeof import("@/lib/utils")>()), sleep: async () => undefined }));

import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { addFile, fetchMissingXml, getInvoice, importParsed, isDeletableFile, loadInvoiceDetail, loadInvoices, lookupHref, needsLookupCode, providerKeyOf, removeFile, setLookupCode, setTags, settleFollowUps } from "@/lib/api/weinvoice/invoices";
import { getState, resetState, setState } from "@/lib/api/weinvoice/store";
import type { Invoice } from "@/lib/weinvoice/types";
import type { ParsedXml } from "@/lib/weinvoice/xml";

const MST = "0100000001";
const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
const fail = (code: string, message = "Bad") => ({ data: { status: { error: true, code, message }, data: null } });

/** `InvoiceRow` exactly as the backend serializes it (Jackson SNAKE_CASE of the Java record). */
const wireRow = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    direction: "purchase",
    issue_date: "2026-03-01",
    template_no: "1",
    symbol: "C26TAA",
    number: "00000001",
    seller_tax_id: "0300000009",
    seller_name: "NCC",
    buyer_tax_id: MST,
    buyer_name: "Cty",
    partner_tax_id: "0300000009",
    partner_name: "NCC",
    currency: "VND",
    exchange_rate: 1,
    pre_tax: 100,
    tax: 10,
    total: 110,
    total_vnd: 110,
    status: "original",
    kind: "normal",
    cqt_code: "M1",
    provider: "MISA",
    provider_tax_id: "0101243150",
    provider_known: true,
    has_xml: true,
    has_pdf: false,
    needs_lookup_code: false,
    tag_ids: ["t1"],
    source: "gdt",
    synced_at: "2026-03-02T08:00:00Z",
    ...extra,
});

/** `InvoiceDetail` (party data under seller / buyer, lookup{}, items[], files[]). */
const wireDetail = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    company_mst: MST,
    direction: "purchase",
    issue_date: "2026-03-01",
    template_no: "1",
    symbol: "C26TAA",
    number: "00000001",
    invoice_title: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG",
    seller: { tax_id: "0300000009", name: "NCC", address: "HN", phone: null, email: null, bank_account: null, bank_name: null, citizen_id: null },
    buyer: { tax_id: MST, name: "Cty", address: "HCM", phone: null, email: null, bank_account: null, bank_name: null, citizen_id: null },
    currency: "VND",
    exchange_rate: 1,
    pre_tax: 100,
    tax: 10,
    discount: 0,
    total: 110,
    total_vnd: 110,
    total_in_words: "Một trăm mười đồng",
    payment_method: "TM/CK",
    status: "replacement",
    related_id: "inv-0",
    related: { relation: "replaces", id: "inv-0", template_no: "1", symbol: "C26TAA", number: "00000000", issue_date: "2026-02-01", reason: "Sai giá" },
    kind: "normal",
    cqt_code: "M1",
    provider: "MISA",
    provider_tax_id: "0101243150",
    provider_known: true,
    lookup: { code: "ABC", company_code: "CMP", url: "https://meinvoice.vn/tra-cuu/?sc=ABC", direct: true, manual: false, needs_code: false },
    items: [
        { line_no: 1, line_kind: 1, code: "H1", name: "Hàng", unit: "c", qty: 1, price: 100, discount: 0, amount: 100, vat_rate: 10, vat_rate_label: "10%", tax_amount: 10 },
        { line_no: 2, line_kind: 1, code: "H2", name: "Miễn", unit: "c", qty: 1, price: 0, discount: 0, amount: 0, vat_rate: -2, vat_rate_label: "KKKNT", tax_amount: 0 },
    ],
    taxes: [{ vat_rate_label: "10%", vat_rate: 10, pre_tax: 100, tax: 10 }],
    fees: [],
    signatures: { seller: "NCC", buyer: null, cqt: "TCT" },
    files: [
        { id: "xml", kind: "xml", name: "a.xml", size: 9, origin: "gdt", added_at: "2026-03-02T08:00:00Z", deletable: false, url: "/api/v1/weinvoice/invoices/inv-1/files/xml" },
        { id: "u5", kind: "attachment", name: "b.png", size: 3, origin: "upload", added_at: "2026-03-03T08:00:00Z", deletable: true, url: "/api/v1/weinvoice/invoices/inv-1/files/u5" },
    ],
    tag_ids: ["t1"],
    xml_task: { status: "done", attempts: 1, error_kind: null, error: null, next_run_at: null, updated_at: "2026-03-02T08:00:00Z" },
    pdf_task: null,
    warnings: [],
    source: "gdt",
    synced_at: "2026-03-02T08:00:00Z",
    ...extra,
});

/** `InvoiceFileItem`. */
const wireFile = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, kind, name: `x.${kind}`, size: 6, origin: "upload", added_at: "2026-03-03T08:00:00Z", deletable: true, url: `/api/v1/weinvoice/invoices/inv-1/files/${id}`, ...extra });

/** `FileUploadResult`. */
const uploadResult = (status: string, reasons: string[] = [], file: unknown = null, requestId: string | null = null) => ({ status, reasons, file, request_id: requestId });

/** Answer requests by URL (method + path). */
const route = (table: Record<string, unknown>) =>
    h.request.mockImplementation(async (c: { method: string; url: string }) => {
        const hit = table[`${c.method} ${c.url}`];
        if (hit === undefined) throw new Error(`unrouted ${c.method} ${c.url}`);
        return typeof hit === "function" ? (hit as () => unknown)() : hit;
    });

const seed = (patch: Partial<Invoice> = {}) =>
    setState((s) => {
        s.invoices.push({
            id: "inv-1",
            direction: "purchase",
            issueDate: "2026-03-01",
            templateNo: "1",
            symbol: "C26TAA",
            number: "00000001",
            sellerTaxId: "0300000009",
            sellerName: "NCC",
            sellerAddress: "",
            buyerTaxId: MST,
            buyerName: "Cty",
            buyerAddress: "",
            currency: "VND",
            preTax: 100,
            tax: 10,
            total: 110,
            status: "original",
            cqtCode: "M1",
            provider: "",
            lookupCode: "",
            lookupUrl: "",
            paymentMethod: "",
            items: [],
            files: [{ id: "f-up", kind: "attachment", name: "a.png", size: 1, origin: "upload", addedAt: "" }],
            tags: [],
            source: "gdt",
            syncedAt: "",
            ...patch,
        });
    });

const calls = () => h.request.mock.calls.map(([c]) => c as { method: string; url: string; params?: Record<string, unknown>; data?: unknown });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.post.mockReset();
    resetState();
});

describe("loadInvoices — GET /invoices (InvoiceListResponse)", () => {
    it("one pass for both directions (direction blank), size 200, pages until total_count; replaces the MST's year + incomplete periods", async () => {
        setState((s) => {
            s.incomplete = [{ taxId: MST, month: "2026-01", fetched: 1, total: 2 }];
        });
        seed({ id: "stale" });
        seed({ id: "other-year", issueDate: "2025-05-01" });
        h.request
            .mockResolvedValueOnce(ok({ rows: [wireRow("p1"), wireRow("s1", { direction: "sales", seller_tax_id: MST, buyer_tax_id: "0300000008" })], total_count: 3, page: 0, size: 200, kpis: {}, incomplete_periods: [{ month: "2026-02", got: 3, total: 5 }] }))
            .mockResolvedValueOnce(ok({ rows: [wireRow("p2", { has_pdf: true, has_xml: false })], total_count: 3, page: 1, size: 200, kpis: {}, incomplete_periods: [{ month: "2026-02", got: 3, total: 5 }] }));

        await loadInvoices(MST, 2026);

        const c = calls();
        expect(c).toHaveLength(2);
        expect(c[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/invoices", params: { company_mst: MST, from: "2026-01-01", to: "2026-12-31", page: 0, size: 200 } });
        expect(c[0].params).not.toHaveProperty("direction");
        expect(c[1].params).toMatchObject({ page: 1 });
        const st = getState();
        expect(st.invoices.map((i) => i.id).sort()).toEqual(["other-year", "p1", "p2", "s1"]);
        expect(getInvoice("p1")).toMatchObject({ direction: "purchase", sellerTaxId: "0300000009", preTax: 100, total: 110, tags: ["t1"], items: [], providerTaxId: "0101243150", syncedAt: "2026-03-02T08:00:00Z" });
        expect(getInvoice("s1")!.direction).toBe("sales");
        expect(st.incomplete).toEqual([{ taxId: MST, month: "2026-02", fetched: 3, total: 5 }]);
    });

    it("has_xml / has_pdf become marker files (ids of the engine copies) so hasFile() works", async () => {
        h.request.mockResolvedValueOnce(ok({ rows: [wireRow("p1", { has_xml: true, has_pdf: true })], total_count: 1, page: 0, size: 200, kpis: {}, incomplete_periods: [] }));
        await loadInvoices(MST, 2026);
        expect(getInvoice("p1")!.files.map((f) => [f.id, f.kind])).toEqual([["xml", "xml"], ["pdf", "pdf"]]);
        expect(getInvoice("p1")!.files.every((f) => !isDeletableFile(f))).toBe(true);
    });

    it("needs_lookup_code / provider_known drive the provider pill (rows carry no lookup code)", async () => {
        h.request.mockResolvedValueOnce(
            ok({ rows: [wireRow("a", { needs_lookup_code: true }), wireRow("b", { provider_known: false, provider_tax_id: "0999999999" })], total_count: 2, page: 0, size: 200, kpis: {}, incomplete_periods: [] }),
        );
        await loadInvoices(MST, 2026);
        expect(needsLookupCode(getInvoice("a")!)).toBe(true);
        expect(providerKeyOf(getInvoice("a")!)).toBe("0101243150");
        expect(needsLookupCode(getInvoice("b")!)).toBe(false);
        expect(providerKeyOf(getInvoice("b")!)).toBe("");
    });

    it("error envelope → WeInvoiceApiError, store untouched", async () => {
        seed();
        h.request.mockResolvedValueOnce(fail("WBE3002"));
        await expect(loadInvoices(MST, 2026)).rejects.toMatchObject({ code: "WBE3002" });
        expect(getInvoice("inv-1")).toBeDefined();
    });
});

describe("loadInvoiceDetail — GET /invoices/{id} (InvoiceDetail)", () => {
    it("maps seller/buyer, lookup{}, items (KKKNT → −1), files[] and tag_ids in one call", async () => {
        seed();
        route({ "get /api/v1/weinvoice/invoices/inv-1": ok(wireDetail("inv-1")) });
        const inv = await loadInvoiceDetail("inv-1");
        expect(calls().map((c) => c.url)).toEqual(["/api/v1/weinvoice/invoices/inv-1"]);
        expect(inv).toMatchObject({
            sellerTaxId: "0300000009",
            sellerAddress: "HN",
            buyerTaxId: MST,
            buyerAddress: "HCM",
            paymentMethod: "TM/CK",
            status: "replacement",
            relatedId: "inv-0",
            lookupCode: "ABC",
            lookupCompany: "CMP",
            lookupUrl: "https://meinvoice.vn/tra-cuu/?sc=ABC",
            tags: ["t1"],
        });
        expect(inv!.items.map((i) => i.vatRate)).toEqual([10, -1]);
        // The backend `url` needs the Bearer token → not kept; files are read through the authenticated download.
        expect(inv!.files.map((f) => ({ id: f.id, origin: f.origin, url: f.url, addedAt: f.addedAt }))).toEqual([
            { id: "xml", origin: "gdt", url: undefined, addedAt: "2026-03-02T08:00:00Z" },
            { id: "u5", origin: "upload", url: undefined, addedAt: "2026-03-03T08:00:00Z" },
        ]);
        expect(inv!.files.map(isDeletableFile)).toEqual([false, true]);
        expect(lookupHref(inv!)).toEqual({ url: "https://meinvoice.vn/tra-cuu/?sc=ABC", direct: true });
        expect(needsLookupCode(inv!)).toBe(false);
        expect(getState().invoices).toHaveLength(1);
    });

    it("WBE3005 (not found / other tenant) → WeInvoiceApiError", async () => {
        h.request.mockResolvedValueOnce(fail("WBE3005", "Invoice not found"));
        await expect(loadInvoiceDetail("x")).rejects.toMatchObject({ code: "WBE3005", message: "Invoice not found" });
    });
});

describe("POST /invoices/{id}/files (FileUploadResult)", () => {
    const blob = new File(["%PDF-1"], "x.pdf", { type: "application/pdf" });
    const meta = { id: "", kind: "pdf" as const, name: "x.pdf", size: 6, origin: "upload" as const, addedAt: "" };

    it("needs_confirm returns reasons[]; the next attempt resends every confirm (repeatable field)", async () => {
        seed();
        h.post.mockResolvedValueOnce(ok(uploadResult("needs_confirm", ["pdf_exists", "pdf_not_matched"])));
        expect(await addFile("inv-1", meta, { blob })).toEqual({ ok: false, needsConfirm: ["pdf_exists", "pdf_not_matched"] });
        const [url, form] = h.post.mock.calls[0] as [string, FormData];
        expect(url).toBe("/api/v1/weinvoice/invoices/inv-1/files");
        expect(form.get("kind")).toBe("pdf");
        expect((form.get("file") as File).name).toBe("x.pdf");
        expect(form.getAll("confirm")).toEqual([]);

        h.post.mockResolvedValueOnce(ok(uploadResult("ok", [], wireFile("u9", "pdf"))));
        expect(await addFile("inv-1", meta, { blob, confirm: ["replace", "attach_anyway"] })).toEqual({ ok: true });
        expect((h.post.mock.calls[1][1] as FormData).getAll("confirm")).toEqual(["replace", "attach_anyway"]);
        expect(getInvoice("inv-1")!.files.map((f) => f.id)).toEqual(["f-up", "u9"]);
    });

    it("duplicate (record already has an XML) → { duplicate }", async () => {
        seed();
        h.post.mockResolvedValueOnce(ok(uploadResult("duplicate")));
        const xml = new File(["<HDon/>"], "a.xml", { type: "application/xml" });
        expect(await addFile("inv-1", { ...meta, kind: "xml", name: "a.xml" }, { blob: xml })).toEqual({ ok: false, duplicate: true });
    });

    it("ok with request_id (matching XML handed to the engine) → file stored now, record reloaded when the request ends", async () => {
        seed();
        h.post.mockResolvedValueOnce(ok(uploadResult("ok", [], wireFile("u3", "xml"), "41")));
        route({
            "get /api/v1/weinvoice/requests/41": ok({ request_id: "41", type: "import", status: "done", step: null, error: null }),
            "get /api/v1/weinvoice/invoices/inv-1": ok(wireDetail("inv-1")),
        });
        const xml = new File(["<HDon/>"], "a.xml", { type: "application/xml" });
        expect(await addFile("inv-1", { ...meta, kind: "xml", name: "a.xml" }, { blob: xml })).toEqual({ ok: true });
        expect(getInvoice("inv-1")!.files.some((f) => f.id === "u3")).toBe(true);
        await settleFollowUps();
        expect(calls().map((c) => c.url)).toEqual(["/api/v1/weinvoice/requests/41", "/api/v1/weinvoice/invoices/inv-1"]);
        expect(getInvoice("inv-1")!.lookupCode).toBe("ABC");
    });

    it("WBE3008 / WBE3009 surface as WeInvoiceApiError", async () => {
        seed();
        h.post.mockResolvedValueOnce(fail("WBE3008", "Not a PDF"));
        await expect(addFile("inv-1", meta, { blob })).rejects.toMatchObject({ code: "WBE3008" });
    });
});

describe("other record mutations", () => {
    it("removeFile → DELETE /invoices/{id}/files/{file_id}", async () => {
        seed();
        h.request.mockResolvedValueOnce(ok(null));
        await removeFile("inv-1", "f-up");
        expect(calls()[0]).toMatchObject({ method: "delete", url: "/api/v1/weinvoice/invoices/inv-1/files/f-up" });
        expect(getInvoice("inv-1")!.files).toEqual([]);
    });

    it("removeFile WBE3007 (engine file) keeps the file and throws the backend code", async () => {
        seed({ files: [{ id: "xml", kind: "xml", name: "a.xml", size: 1, origin: "gdt", addedAt: "" }] });
        h.request.mockResolvedValueOnce(fail("WBE3007", "Engine file cannot be deleted"));
        const err = await removeFile("inv-1", "xml").catch((e) => e);
        expect(err).toBeInstanceOf(WeInvoiceApiError);
        expect(err.code).toBe("WBE3007");
        expect(getInvoice("inv-1")!.files).toHaveLength(1);
    });

    it("setLookupCode → PUT /invoices/{id}/lookup-code {code, company_code} → {request_id, subject}; reloads now and after the request", async () => {
        seed();
        route({
            "put /api/v1/weinvoice/invoices/inv-1/lookup-code": ok({ request_id: "52", subject: "inv-1" }),
            "get /api/v1/weinvoice/invoices/inv-1": ok(wireDetail("inv-1", { lookup: { code: "K123", company_code: "CMP", url: null, direct: false, manual: true, needs_code: false } })),
            "get /api/v1/weinvoice/requests/52": ok({ request_id: "52", type: "fetch_pdf", status: "partial", step: "download", error: null }),
        });
        await setLookupCode("inv-1", " K123 ", "CMP");
        expect(calls()[0]).toMatchObject({ method: "put", url: "/api/v1/weinvoice/invoices/inv-1/lookup-code", data: { code: "K123", company_code: "CMP" } });
        expect(getInvoice("inv-1")!.lookupCode).toBe("K123");
        await settleFollowUps();
        expect(calls().map((c) => `${c.method} ${c.url}`)).toEqual([
            "put /api/v1/weinvoice/invoices/inv-1/lookup-code",
            "get /api/v1/weinvoice/invoices/inv-1",
            "get /api/v1/weinvoice/requests/52",
            "get /api/v1/weinvoice/invoices/inv-1",
        ]);
    });

    it("setLookupCode WBE3020 (invalid code / link) → throws, nothing saved", async () => {
        seed();
        h.request.mockResolvedValueOnce(fail("WBE3020"));
        await expect(setLookupCode("inv-1", "??")).rejects.toMatchObject({ code: "WBE3020" });
        expect(getInvoice("inv-1")!.lookupCode).toBe("");
    });
});

describe("list actions", () => {
    it("fetchMissingXml → POST {company_mst, ids} → FetchXmlResult; waits for request_id, then reloads the year", async () => {
        seed();
        setState((s) => {
            s.activeTaxId = MST;
        });
        route({
            "post /api/v1/weinvoice/invoices/fetch-missing-xml": ok({ queued: 1, skipped_no_code: 1, skipped_other: 0, request_id: "60" }),
            "get /api/v1/weinvoice/requests/60": ok({ request_id: "60", type: "fetch_xml", status: "done", step: null, progress: { done: 1 }, error: null }),
            "get /api/v1/weinvoice/invoices": ok({ rows: [wireRow("inv-1")], total_count: 1, page: 0, size: 200, kpis: {}, incomplete_periods: [] }),
        });
        const progress = vi.fn();
        expect(await fetchMissingXml(["inv-1", "k-1"], progress)).toEqual({ fetched: 1, skippedNoCode: 1 });
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/invoices/fetch-missing-xml", data: { company_mst: MST, ids: ["inv-1", "k-1"] } });
        expect(calls().map((c) => c.url)).toContain("/api/v1/weinvoice/invoices");
        expect(progress).toHaveBeenCalledWith(1);
        expect(progress).toHaveBeenLastCalledWith(2);
        expect(getInvoice("inv-1")!.files.map((f) => f.id)).toEqual(["xml"]);
    });

    it("fetchMissingXml without request_id (nothing fetchable) makes one call", async () => {
        route({ "post /api/v1/weinvoice/invoices/fetch-missing-xml": ok({ queued: 0, skipped_no_code: 2, skipped_other: 0, request_id: null }) });
        expect(await fetchMissingXml(["a", "b"])).toEqual({ fetched: 0, skippedNoCode: 2 });
        expect(calls()).toHaveLength(1);
    });

    it("fetchMissingXml failed request → WeInvoiceApiError with the backend text", async () => {
        route({
            "post /api/v1/weinvoice/invoices/fetch-missing-xml": ok({ queued: 1, skipped_no_code: 0, skipped_other: 0, request_id: "61" }),
            "get /api/v1/weinvoice/requests/61": ok({ request_id: "61", status: "failed", error: "GDT login failed" }),
        });
        await expect(fetchMissingXml(["a"])).rejects.toMatchObject({ code: "WBE_REQUEST_FAILED", message: "GDT login failed" });
    });

    it("setTags → PUT /invoices/tags {ids, tag_id, on} → {count}, then updates the cache", async () => {
        seed();
        h.request.mockResolvedValueOnce(ok({ count: 1 }));
        await setTags(["inv-1"], "t1", true);
        expect(calls()[0]).toMatchObject({ method: "put", url: "/api/v1/weinvoice/invoices/tags", data: { ids: ["inv-1"], tag_id: "t1", on: true } });
        expect(getInvoice("inv-1")!.tags).toEqual(["t1"]);
    });

    it("setTags failure does not tag locally", async () => {
        seed();
        h.request.mockResolvedValueOnce(fail("WBE3013"));
        await expect(setTags(["inv-1"], "t1", true)).rejects.toMatchObject({ code: "WBE3013" });
        expect(getInvoice("inv-1")!.tags).toEqual([]);
    });
});

describe("importParsed — POST /uploads + GET /uploads/{upload_id} (UploadResponse)", () => {
    const parsed = {} as ParsedXml;
    const upload = (outcome: string | null, extra: Record<string, unknown> = {}) => ({
        upload_id: "77",
        company_mst: MST,
        request_id: "90",
        status: outcome ? "done" : "queued",
        error: null,
        created_at: "2026-11-05T08:00:00Z",
        files: [{ file_no: 1, name: "a.xml", size: 7, outcome, message: null, invoice_id: null, seller_tax_id: "0300000009", buyer_tax_id: MST, partner_name: "NCC", total: 110, pdf_status: null, processed_at: null, ...extra }],
    });

    it("multipart `company_mst` + `files` (not files[]); polls until the outcome, then loads the invoice", async () => {
        h.post.mockResolvedValueOnce(ok(upload(null)));
        route({
            "get /api/v1/weinvoice/uploads/77": ok(upload("merged", { invoice_id: "inv-7" })),
            "get /api/v1/weinvoice/invoices/inv-7": ok(wireDetail("inv-7")),
        });
        const res = await importParsed(parsed, "<HDon/>", "a.xml", MST, "upload");
        const [url, form] = h.post.mock.calls[0] as [string, FormData];
        expect(url).toBe("/api/v1/weinvoice/uploads");
        expect((form.get("files") as File).name).toBe("a.xml");
        expect(form.get("files[]")).toBeNull();
        expect(form.get("company_mst")).toBe(MST);
        expect(res).toMatchObject({ outcome: "merged", invoice: { id: "inv-7" } });
    });

    it("foreign → { outcome: foreign }; error → WeInvoiceApiError with the file message", async () => {
        h.post.mockResolvedValueOnce(ok(upload("foreign")));
        expect(await importParsed(parsed, "<x/>", "a.xml", MST, "upload")).toEqual({ outcome: "foreign" });
        expect(h.request).not.toHaveBeenCalled();

        h.post.mockResolvedValueOnce(ok(upload("error", { message: "Not a readable e-invoice XML" })));
        const err = await importParsed(parsed, "<x/>", "a.xml", MST, "upload").catch((e) => e);
        expect(err).toBeInstanceOf(WeInvoiceApiError);
        expect(err).toMatchObject({ code: "WBE_UPLOAD_ERROR", message: "Not a readable e-invoice XML" });
    });
});

describe("mock mode", () => {
    it("loaders are no-ops and mutations make no HTTP call", async () => {
        h.source.DATA_SOURCE = "mock";
        resetState();
        const before = getState().invoices.length;
        await loadInvoices(MST, 2026);
        const inv = getState().invoices[0];
        await setTags([inv.id], "t-x", true);
        await setLookupCode(inv.id, "CODE1");
        await loadInvoiceDetail(inv.id);
        expect(await addFile(inv.id, { id: "m1", kind: "attachment", name: "n.txt", size: 1, origin: "upload", addedAt: "" })).toEqual({ ok: true });
        expect(h.request).not.toHaveBeenCalled();
        expect(h.post).not.toHaveBeenCalled();
        expect(getState().invoices.length).toBe(before);
        expect(getInvoice(inv.id)!.lookupCode).toBe("CODE1");
    });
});

describe("kpisFor — VND totals (backend rule: foreign currency × exchange rate)", () => {
    it("uses total_vnd / exchange_rate for USD invoices", async () => {
        const { kpisFor } = await import("@/lib/api/weinvoice/invoices");
        const { setState } = await import("@/lib/api/weinvoice/store");
        const base = { direction: "purchase", issueDate: "2026-05-01", buyerTaxId: "0101", sellerTaxId: "0202", status: "original", files: [], items: [], tags: [] };
        const usd = { ...base, id: "u", currency: "USD", preTax: 100, tax: 10, total: 110, exchangeRate: 25000, totalVnd: 2_750_000 };
        const vnd = { ...base, id: "v", currency: "VND", preTax: 1000, tax: 100, total: 1100 };
        setState((s) => {
            s.invoices = [usd, vnd] as never;
        });
        const k = kpisFor("0101", "2026-01-01", "2026-12-31", [usd, vnd] as never);
        expect(k.total).toBe(2_750_000 + 1100);
        expect(k.preTax).toBe(100 * 25000 + 1000);
        expect(k.purchaseTotal).toBe(2_750_000 + 1100);
    });
});
