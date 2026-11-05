import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), download: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request, post: h.post } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("@/lib/utils", async (io) => ({ ...(await io<typeof import("@/lib/utils")>()), downloadBlob: h.download, sleep: async () => undefined }));

import { engineAvailable, fetchOriginalPdf, storeUploadedPdf } from "@/lib/api/weinvoice/original";
import { getState, resetState, setState } from "@/lib/api/weinvoice/store";
import { buildZip, exportExcel } from "@/lib/weinvoice/exporter";
import type { Invoice } from "@/lib/weinvoice/types";

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });
const fail = (code: string) => ({ data: { status: { error: true, code, message: "Bad" }, data: null } });
const inv = { id: "inv-1", files: [] } as unknown as Invoice;
/** jsdom's Blob has no arrayBuffer(); give the %PDF- sniff something to read. */
const pdfLike = (text: string, name: string) => Object.assign(new File([text], name), { slice: () => ({ arrayBuffer: async () => new TextEncoder().encode(text.slice(0, 5)).buffer }) }) as File;
const calls = () => h.request.mock.calls.map(([c]) => c as { method: string; url: string; data?: unknown; responseType?: string });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.post.mockReset();
    h.download.mockReset();
    resetState();
    setState((s) => {
        s.activeTaxId = "0100000001";
    });
});

describe("original PDF (api mode)", () => {
    it("engineAvailable is true", async () => {
        expect(await engineAvailable()).toBe(true);
    });

    it("POST /invoices/{id}/original-pdf → {request_id, subject} → waits on the engine request → reloads the record", async () => {
        h.request.mockImplementation(async (c: { method: string; url: string }) => {
            if (c.url === "/api/v1/weinvoice/invoices/inv-1/original-pdf") return ok({ request_id: "r1", subject: "inv-1" });
            if (c.url === "/api/v1/weinvoice/requests/r1") return ok({ request_id: "r1", type: "fetch_pdf", status: "done", step: "download_pdf", error: null });
            return ok({
                id: "inv-1",
                direction: "purchase",
                status: "original",
                provider_known: true,
                files: [{ id: "pdf", kind: "pdf", name: "a.pdf", size: 1234, origin: "vendor", added_at: "2026-11-05T08:00:00Z", deletable: false, url: "/api/v1/weinvoice/invoices/inv-1/files/pdf" }],
            });
        });
        const steps: number[] = [];
        const res = await fetchOriginalPdf(inv, (i) => steps.push(i));
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/invoices/inv-1/original-pdf" });
        expect(calls()[2]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/invoices/inv-1" });
        // The backend url is an authenticated API path → not kept (read through the download).
        expect(res).toEqual({ ok: true, url: "", bytes: 1234 });
        expect(steps).toEqual([1]);
        expect(getState().invoices[0].files[0].id).toBe("pdf");
    });

    it("failed request (error is the backend text) / finished without a PDF / HTTP error → ok:false (no fake success)", async () => {
        h.request.mockResolvedValueOnce(ok({ request_id: "r2", subject: "inv-1" })).mockResolvedValueOnce(ok({ request_id: "r2", status: "failed", error: "Portal down" }));
        expect(await fetchOriginalPdf(inv)).toEqual({ ok: false, error: "WBE_REQUEST_FAILED", detail: "Portal down" });
        h.request
            .mockResolvedValueOnce(ok({ request_id: "r3", subject: "inv-1" }))
            .mockResolvedValueOnce(ok({ request_id: "r3", status: "partial", error: "no PDF on portal" }))
            .mockResolvedValueOnce(ok({ id: "inv-1", direction: "purchase", status: "original", files: [] }));
        expect(await fetchOriginalPdf(inv)).toEqual({ ok: false, error: "WBE_NO_PDF", detail: "no PDF on portal" });
        h.request.mockResolvedValueOnce(fail("WBE3005"));
        expect(await fetchOriginalPdf(inv)).toMatchObject({ ok: false, error: "WBE3005" });
    });

    it("storeUploadedPdf rejects non-PDF bytes, uploads a real PDF and passes reasons[] / confirms through", async () => {
        expect(await storeUploadedPdf(pdfLike("hello", "a.pdf"), "base", { invoiceId: "inv-1" })).toEqual({ error: "not_pdf" });
        expect(h.post).not.toHaveBeenCalled();
        h.post.mockResolvedValueOnce(ok({ status: "needs_confirm", reasons: ["pdf_not_matched"], file: null, request_id: null }));
        expect(await storeUploadedPdf(pdfLike("%PDF-1.7", "a.pdf"), "base", { invoiceId: "inv-1" })).toEqual({ needsConfirm: ["pdf_not_matched"] });
        expect(h.post.mock.calls[0][0]).toBe("/api/v1/weinvoice/invoices/inv-1/files");
        h.post.mockResolvedValueOnce(ok({ status: "ok", reasons: [], file: { id: "u2", kind: "pdf", name: "a.pdf", size: 8, origin: "upload", added_at: "t", deletable: true, url: "/x" }, request_id: null }));
        expect(await storeUploadedPdf(pdfLike("%PDF-1.7", "a.pdf"), "base", { invoiceId: "inv-1", confirm: ["attach_anyway"] })).toEqual({ url: "", persisted: true });
        expect((h.post.mock.calls[1][1] as FormData).getAll("confirm")).toEqual(["attach_anyway"]);
    });
});

describe("exports (api mode)", () => {
    const blobRes = (name: string) => ({ data: new Blob(["PK"], { type: "application/zip" }), headers: { "content-disposition": `attachment; filename="${name}"` } });

    it("exportExcel → POST /invoices/export/excel with the InvoiceFilter body (snake_case) and downloads the backend file", async () => {
        h.request.mockResolvedValueOnce(blobRes("HD.xlsx"));
        const res = await exportExcel([inv], "fallback.xlsx", { direction: "purchase", from: "2026-01-01", to: "2026-12-31" });
        expect(calls()[0]).toMatchObject({
            method: "post",
            url: "/api/v1/weinvoice/invoices/export/excel",
            responseType: "blob",
            data: { company_mst: "0100000001", direction: "purchase", from: "2026-01-01", to: "2026-12-31", ids: ["inv-1"] },
        });
        expect(res).toEqual({ ok: true, fileName: "HD.xlsx" });
        expect(h.download).toHaveBeenCalledWith(expect.any(Blob), "HD.xlsx");
    });

    it("buildZip → POST /invoices/export/zip {company_mst, ids, mode, include ⊆ xml·pdf·summary}; `rendered` is never sent", async () => {
        h.request.mockResolvedValueOnce(blobRes("WI.zip"));
        const res = await buildZip([inv], { mode: "by_month", xml: true, rendered: true, summary: true, pdf: true });
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/invoices/export/zip", data: { company_mst: "0100000001", ids: ["inv-1"], mode: "by_month", include: ["xml", "pdf", "summary"] } });
        expect(res).toMatchObject({ missing: 0, fileName: "WI.zip" });
        expect(res.blob).toBeInstanceOf(Blob);
    });

    it("buildZip with only `rendered` selected sends nothing (an empty include would default to xml + pdf)", async () => {
        await expect(buildZip([inv], { mode: "flat", xml: false, rendered: true, summary: false, pdf: false })).rejects.toMatchObject({ code: "WBE_VALIDATION" });
        expect(h.request).not.toHaveBeenCalled();
    });

    it("WBE3021 (Excel above the row limit) comes back as a JSON envelope on the blob response", async () => {
        h.request.mockResolvedValueOnce({ data: new Blob([JSON.stringify({ status: { error: true, code: "WBE3021", message: "Too many rows" }, data: null })], { type: "application/json" }), headers: {} });
        await expect(exportExcel([inv], "x.xlsx")).rejects.toMatchObject({ code: "WBE3021" });
        expect(h.download).not.toHaveBeenCalled();
    });

    it("export error → rejects with the backend code", async () => {
        h.request.mockRejectedValueOnce(Object.assign(new Error("Network Error"), { isAxiosError: true }));
        await expect(exportExcel([inv], "x.xlsx")).rejects.toMatchObject({ code: "WBE_NETWORK" });
        expect(h.download).not.toHaveBeenCalled();
    });
});

describe("mock mode", () => {
    it("no HTTP: engine unavailable, Excel server_only", async () => {
        h.source.DATA_SOURCE = "mock";
        expect(await engineAvailable()).toBe(false);
        expect(await fetchOriginalPdf(inv)).toEqual({ ok: false, error: "engine_unavailable" });
        expect(await exportExcel([inv], "x.xlsx")).toEqual({ ok: false, reason: "server_only" });
        expect(h.request).not.toHaveBeenCalled();
        expect(h.post).not.toHaveBeenCalled();
    });
});
