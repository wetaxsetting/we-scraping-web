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

import { adoptUpload, deleteUpload, uploadFiles, uploadSettled } from "@/lib/api/weinvoice/uploads";

const MST = "0101234567";
/** `UploadResponse.FileItem` exactly as the backend serializes it (snake_case). */
const FILE_NEW = { file_no: 1, name: "a.xml", size: 2048, outcome: "new", message: null, invoice_id: "77", seller_tax_id: "0104128565", buyer_tax_id: MST, partner_name: "NCC A", total: 1100000, pdf_status: "missing", processed_at: "2026-11-05T02:00:00Z" };
const FILE_FOREIGN = { file_no: 2, name: "b.zip", size: 900, outcome: "foreign", message: null, invoice_id: null, seller_tax_id: "0104128565", buyer_tax_id: "0309999999", partner_name: "CÔNG TY B", total: 500, pdf_status: null, processed_at: "2026-11-05T02:00:01Z" };
const PENDING = (f: object) => ({ ...f, outcome: null, invoice_id: null, seller_tax_id: null, buyer_tax_id: null, partner_name: null, total: null, pdf_status: null, processed_at: null });
const upload = (status: string, files: object[], error: string | null = null) => ({ upload_id: "u1", company_mst: MST, request_id: "900", status, error, created_at: "2026-11-05T01:59:59Z", files });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.post.mockReset();
});

describe("uploads — api mode", () => {
    it("uploadFiles: ONE multipart POST /uploads (company_mst + files repeated), then polls GET /uploads/{id} until the request finished", async () => {
        h.post.mockResolvedValue(ok(upload("queued", [PENDING(FILE_NEW), PENDING(FILE_FOREIGN)])));
        let polls = 0;
        routes({ "GET /uploads/u1": () => ok(++polls < 2 ? upload("running", [FILE_NEW, PENDING(FILE_FOREIGN)]) : upload("done", [FILE_NEW, FILE_FOREIGN])) });
        const files = [new File(["<x/>"], "a.xml", { type: "text/xml" }), new File(["PK"], "b.zip", { type: "application/zip" })];
        const seen: (string | null)[] = [];
        const u = await uploadFiles(MST, files, (x) => seen.push(x.status), 0);

        expect(h.post).toHaveBeenCalledTimes(1);
        const [url, form] = h.post.mock.calls[0] as [string, FormData];
        expect(url).toBe("/api/v1/weinvoice/uploads");
        expect(form.getAll("files").map((f) => (f as File).name)).toEqual(["a.xml", "b.zip"]);
        expect(form.getAll("files[]")).toEqual([]);
        expect(form.get("company_mst")).toBe(MST);
        expect(polls).toBe(2);
        expect(seen).toEqual(["queued", "running", "done"]);
        expect(u).toMatchObject({ uploadId: "u1", companyMst: MST, requestId: "900", status: "done" });
        expect(u.files[0]).toEqual({ fileNo: 1, name: "a.xml", size: 2048, outcome: "new", message: null, invoiceId: "77", sellerTaxId: "0104128565", buyerTaxId: MST, partnerName: "NCC A", total: 1100000, pdfStatus: "missing", processedAt: "2026-11-05T02:00:00Z" });
        expect(u.files[1]).toMatchObject({ outcome: "foreign", buyerTaxId: "0309999999", invoiceId: null });
    });

    it("uploadSettled: finished = done · partial · failed · cancelled", () => {
        expect(["queued", "running", null].map((status) => uploadSettled({ status: status as never }))).toEqual([false, false, false]);
        expect(["done", "partial", "failed", "cancelled"].map((status) => uploadSettled({ status: status as never }))).toEqual([true, true, true, true]);
    });

    it("a failed batch with no per-file outcome throws with the request error", async () => {
        h.post.mockResolvedValue(ok(upload("queued", [PENDING(FILE_NEW)])));
        routes({ "GET /uploads/u1": ok(upload("failed", [PENDING(FILE_NEW)], "engine crashed")) });
        await expect(uploadFiles(MST, [new File(["x"], "a.xml")], undefined, 0)).rejects.toMatchObject({ code: "WBE_REQUEST_FAILED", message: "engine crashed" });
    });

    it("upload refused (WBE3025 unsupported type) → WeInvoiceApiError code, no poll", async () => {
        h.post.mockResolvedValue(fail("WBE3025", "Không hỗ trợ tệp a.txt"));
        await expect(uploadFiles(MST, [new File(["x"], "a.txt")])).rejects.toMatchObject({ code: "WBE3025" });
        expect(h.request).not.toHaveBeenCalled();
    });

    it("adoptUpload: POST /uploads/{id}/adopt {company_mst} → {request_id, subject} → wait (partial counts as finished) → re-read", async () => {
        routes({
            "POST /uploads/u1/adopt": ok({ request_id: "901", subject: "0309999999" }),
            "GET /requests/901": ok({ request_id: "901", type: "import", status: "partial", error: null }),
            "GET /uploads/u1": ok(upload("done", [FILE_NEW, { ...FILE_FOREIGN, outcome: "new", invoice_id: "78" }])),
        });
        const u = await adoptUpload("u1", "0309999999", 0);
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/uploads/u1/adopt", data: { company_mst: "0309999999" } });
        expect(calls().map((c) => `${c.method} ${c.url.replace("/api/v1/weinvoice", "")}`)).toEqual(["post /uploads/u1/adopt", "get /requests/901", "get /uploads/u1"]);
        expect(u.files.map((f) => f.outcome)).toEqual(["new", "new"]);
    });

    it("adoptUpload: WBE3026 (no file for that MST) and an engine failure both throw", async () => {
        routes({ "POST /uploads/u1/adopt": fail("WBE3026", "Không có tệp nào của MST 0309999999") });
        await expect(adoptUpload("u1", "0309999999", 0)).rejects.toMatchObject({ code: "WBE3026" });

        h.request.mockReset();
        routes({ "POST /uploads/u1/adopt": ok({ request_id: "901", subject: "0309999999" }), "GET /requests/901": ok({ request_id: "901", status: "failed", error: "Đã đủ số MST" }) });
        await expect(adoptUpload("u1", "0309999999", 0)).rejects.toMatchObject({ code: "WBE_REQUEST_FAILED", message: "Đã đủ số MST" });
    });

    it("deleteUpload: DELETE /uploads/{id} → null", async () => {
        routes({ "DELETE /uploads/u1": ok(null) });
        await deleteUpload("u1");
        expect(calls()[0]).toMatchObject({ method: "delete", url: "/api/v1/weinvoice/uploads/u1" });
    });
});
