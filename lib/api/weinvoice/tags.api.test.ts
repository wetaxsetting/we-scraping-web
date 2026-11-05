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

import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { getState, resetState, setState } from "@/lib/api/weinvoice/store";
import { createTag, deleteTag, loadTags, tagUsage, updateTag } from "@/lib/api/weinvoice/tags";

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.post.mockReset();
    resetState();
});

describe("tags — api mode", () => {
    it("loadTags: GET /tags → store.tags with the backend usage count", async () => {
        routes({ "GET /tags": ok([{ id: "t1", name: "Đã kê khai", color: "#0060b9", invoice_count: 7 }]) });
        await loadTags();
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/tags" });
        expect(getState().tags).toEqual([{ id: "t1", name: "Đã kê khai", color: "#0060b9", invoiceCount: 7 }]);
        expect(tagUsage(getState().tags[0], [])).toBe(7);
    });

    it("createTag: POST /tags {name, color} then adds the backend tag", async () => {
        routes({ "POST /tags": ok({ id: "t9", name: "Mới", color: "#04662e", invoice_count: 0 }) });
        const tag = await createTag("  Mới ", "#04662e");
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/tags", data: { name: "Mới", color: "#04662e" } });
        expect(tag.id).toBe("t9");
        expect(getState().tags).toEqual([{ id: "t9", name: "Mới", color: "#04662e", invoiceCount: 0 }]);
    });

    it("updateTag: PATCH /tags/{id} with the patch only", async () => {
        setState((s) => {
            s.tags = [{ id: "t1", name: "A", color: "#000000" }];
        });
        routes({ "PATCH /tags/t1": ok({ id: "t1", name: "B", color: "#000000", invoice_count: 4 }) });
        await updateTag("t1", { name: "B" });
        expect(calls()[0]).toMatchObject({ method: "patch", data: { name: "B" } });
        expect(getState().tags[0]).toEqual({ id: "t1", name: "B", color: "#000000", invoiceCount: 4 });
    });

    it("deleteTag: DELETE /tags/{id}; a backend error leaves the store untouched", async () => {
        setState((s) => {
            s.tags = [{ id: "t1", name: "A", color: "#000000" }];
        });
        routes({ "DELETE /tags/t1": fail("WBE3013", "Không tìm thấy tag") });
        const err = await deleteTag("t1").catch((e) => e);
        expect(err).toBeInstanceOf(WeInvoiceApiError);
        expect((err as WeInvoiceApiError).code).toBe("WBE3013");
        expect(getState().tags).toHaveLength(1);

        routes({ "DELETE /tags/t1": ok(null) });
        await deleteTag("t1");
        expect(getState().tags).toHaveLength(0);
    });

    it("createTag failure (WBE3014 name taken) throws and adds nothing (no fake success)", async () => {
        routes({ "POST /tags": fail("WBE3014", "Tên tag đã tồn tại") });
        await expect(createTag("A")).rejects.toMatchObject({ code: "WBE3014" });
        expect(getState().tags).toHaveLength(0);
    });
});

describe("tags — mock mode", () => {
    it("makes no HTTP call and keeps the in-memory behaviour", async () => {
        h.source.DATA_SOURCE = "mock";
        resetState();
        const before = getState().tags.length;
        await loadTags();
        const tag = await createTag("Demo");
        await updateTag(tag.id, { color: "#525252" });
        expect(getState().tags).toHaveLength(before + 1);
        expect(getState().tags.at(-1)).toMatchObject({ name: "Demo", color: "#525252" });
        await deleteTag(tag.id);
        expect(getState().tags).toHaveLength(before);
        expect(h.request).not.toHaveBeenCalled();
    });
});
