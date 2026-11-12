import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/lib/axios", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/utils", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/utils")>()), sleep: () => Promise.resolve() }));

import { waitForRequest, wiDownload, wiGet, wiPost } from "@/lib/api/weinvoice/http";
import { camelize, snakify } from "@/lib/api/weinvoice/wire";

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });

beforeEach(() => h.request.mockReset());

describe("wire key conversion (draft rule)", () => {
    it("converts keys deeply, both ways, and leaves values alone", () => {
        const ui = { sellerTaxId: "0101", items: [{ vatRate: 10, name: "A_b" }], meta: { xmlDone: 1 } };
        const wire = snakify(ui);
        expect(wire).toEqual({ seller_tax_id: "0101", items: [{ vat_rate: 10, name: "A_b" }], meta: { xml_done: 1 } });
        expect(camelize(wire)).toEqual(ui);
    });
});

describe("wiGet / wiPost", () => {
    it("prefixes /api/v1/weinvoice, sends snake_case params/body and camelizes data", async () => {
        h.request.mockResolvedValueOnce(ok({ total_count: 2, rows: [{ seller_tax_id: "1" }] }));
        const r = await wiGet<{ totalCount: number; rows: { sellerTaxId: string }[] }>("/invoices", { companyMst: "0101", page: 0 });
        expect(h.request).toHaveBeenCalledWith({ method: "get", url: "/api/v1/weinvoice/invoices", params: { company_mst: "0101", page: 0 }, data: undefined });
        expect(r).toEqual({ totalCount: 2, rows: [{ sellerTaxId: "1" }] });

        h.request.mockResolvedValueOnce(ok(undefined));
        await expect(wiPost("/tags", { name: "A", tagColor: "#000" })).resolves.toBeUndefined();
        expect(h.request).toHaveBeenLastCalledWith(expect.objectContaining({ method: "post", data: { name: "A", tag_color: "#000" } }));
    });

    it("a 204 No Content answer to a write is success with no data", async () => {
        h.request.mockResolvedValueOnce({ status: 204, data: "" });
        await expect(wiPost("/notifications/read", { ids: ["a"] })).resolves.toBeUndefined();
    });

    it("maps status.error, a non-envelope 404 and no response to coded errors", async () => {
        h.request.mockResolvedValueOnce({ data: { status: { error: true, code: "WBE4031", message: "no" }, trace_id: "T" } });
        await expect(wiGet("/x")).rejects.toMatchObject({ code: "WBE4031", traceId: "T" });

        h.request.mockRejectedValueOnce(new AxiosError("404", "ERR_BAD_REQUEST", undefined, undefined, { status: 404, data: "<html>", statusText: "", headers: {}, config: {} as never }));
        await expect(wiGet("/x")).rejects.toMatchObject({ code: "HTTP_404" });

        h.request.mockRejectedValueOnce(new AxiosError("404", "ERR_BAD_REQUEST", undefined, undefined, { status: 404, data: { status: { error: true, code: "WBE_NOT_FOUND", message: "nf" } }, statusText: "", headers: {}, config: {} as never }));
        await expect(wiGet("/x")).rejects.toMatchObject({ code: "WBE_NOT_FOUND" });

        h.request.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
        await expect(wiGet("/x")).rejects.toMatchObject({ code: "WBE_NETWORK" });
    });
});

describe("waitForRequest — engine jobs", () => {
    it("polls GET /requests/{id} until the job leaves queued / running", async () => {
        h.request
            .mockResolvedValueOnce(ok({ request_id: "r1", status: "queued" }))
            .mockResolvedValueOnce(ok({ request_id: "r1", status: "running", step: "captcha" }))
            .mockResolvedValueOnce(ok({ request_id: "r1", status: "done", result: { ok: true } }));
        const steps: string[] = [];
        const r = await waitForRequest("r1", (x) => steps.push(x.status));
        expect(r).toMatchObject({ status: "done", result: { ok: true } });
        expect(steps).toEqual(["queued", "running", "done"]);
        expect(h.request).toHaveBeenCalledWith(expect.objectContaining({ url: "/api/v1/weinvoice/requests/r1" }));
    });
});

describe("wiDownload", () => {
    it("returns the blob with the Content-Disposition filename (RFC 5987)", async () => {
        h.request.mockResolvedValueOnce({ data: new Blob(["x"], { type: "application/zip" }), headers: { "content-disposition": "attachment; filename*=UTF-8''Ho%C3%A1_%C4%91%C6%A1n.zip" } });
        const r = await wiDownload("post", "/invoices/export/zip", { body: { ids: ["1"] }, fallbackName: "x.zip" });
        expect(r.fileName).toBe("Hoá_đơn.zip");
        expect(h.request).toHaveBeenCalledWith(expect.objectContaining({ responseType: "blob", data: { ids: ["1"] } }));
    });

    it("decodes a JSON error envelope sent instead of the file", async () => {
        const body = JSON.stringify({ status: { error: true, code: "WBE5001", message: "export failed" } });
        h.request.mockResolvedValueOnce({ data: new Blob([body], { type: "application/json" }), headers: {} });
        await expect(wiDownload("post", "/invoices/export/excel", { fallbackName: "x.xlsx" })).rejects.toMatchObject({ code: "WBE5001" });
    });
});
