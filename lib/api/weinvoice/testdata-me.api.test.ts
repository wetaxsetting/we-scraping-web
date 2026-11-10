import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
vi.mock("@/lib/api/weinvoice/remote", async (io) => ({ ...(await io<typeof import("@/lib/api/weinvoice/remote")>()), refreshAfterSync: h.refresh }));
vi.mock("@/lib/utils", async (io) => ({ ...(await io<typeof import("@/lib/utils")>()), sleep: () => Promise.resolve() }));

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });

type Call = { method: string; url: string; params?: Record<string, unknown>; data?: Record<string, unknown> };
const calls = (): Call[] => h.request.mock.calls.map((c) => c[0] as Call);

function routes(map: Record<string, unknown | ((c: Call) => unknown)>) {
    h.request.mockImplementation(async (c: Call) => {
        const key = `${c.method.toUpperCase()} ${c.url.replace("/api/v1/weinvoice", "")}`;
        if (!(key in map)) throw new Error(`unexpected ${key}`);
        const v = map[key];
        return typeof v === "function" ? (v as (c: Call) => unknown)(c) : v;
    });
}

import { setState } from "@/lib/api/weinvoice/store";
import { resetServerLang, rememberServerLang, saveLanguage, serverLocale } from "@/lib/api/weinvoice/me";
import { loadTestData, testDataAvailable } from "@/lib/api/weinvoice/testdata";

const MST = "0101234567";
/** Engine TEST_DATA result exactly as the backend serializes it (snake_case). */
const RESULT = {
    folder: "TestData", xml_total: 3, created: 1, merged: 1, duplicate: 1,
    errors: [{ file: "x.xml", error: "Không đọc được XML hóa đơn" }], new_tax_ids: ["0309999999"],
    codes_applied: 2, codes_unmatched: ["C26TAA-9"], pdf_attached: 1, pdf_unmatched: ["y.pdf"],
};
const request = (status: string, extra: object = {}) => ({ request_id: "41", type: "test_data", status, ...extra });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.refresh.mockReset().mockResolvedValue(undefined);
    resetServerLang();
    setState((s) => { s.activeTaxId = MST; });
});

describe("testdata (api)", () => {
    it("is available only when /me says test_data_enabled", async () => {
        routes({ "GET /me": ok({ test_data_enabled: true }) });
        expect(await testDataAvailable()).toEqual({ ok: true, folder: "TestData" });
        routes({ "GET /me": ok({ test_data_enabled: false }) });
        expect((await testDataAvailable()).ok).toBe(false);
    });

    it("is unavailable in mock mode without calling the backend", async () => {
        h.source.DATA_SOURCE = "mock";
        expect((await testDataAvailable()).ok).toBe(false);
        await expect(loadTestData()).rejects.toThrow("no_folder");
        expect(h.request).not.toHaveBeenCalled();
    });

    it("queues the load for the working MST, reports progress, maps the engine report, reloads invoices", async () => {
        let polls = 0;
        routes({
            "POST /test-data/load": ok({ request_id: "41", subject: MST }),
            "GET /requests/41": () => (++polls === 1 ? ok(request("running", { progress: { done: 1, total: 4 } })) : ok(request("partial", { result: RESULT }))),
        });
        const progress: string[] = [];
        const r = await loadTestData((m) => progress.push(m));
        expect(calls()[0].params).toEqual({ company_mst: MST });
        expect(progress).toContain("1/4");
        expect(r).toEqual({
            folder: "TestData", xmlTotal: 3, created: 2, duplicate: 1,
            errors: [{ file: "x.xml", error: "Không đọc được XML hóa đơn" }], newTaxIds: ["0309999999"],
            codesApplied: 2, codesUnmatched: ["C26TAA-9"], pdfAttached: 1, pdfUnmatched: ["y.pdf"],
        });
        expect(h.refresh).toHaveBeenCalledWith(MST);
    });

    it("surfaces the engine error (no_folder) and does not reload", async () => {
        routes({
            "POST /test-data/load": ok({ request_id: "41", subject: MST }),
            "GET /requests/41": ok(request("failed", { error: "no_folder" })),
        });
        await expect(loadTestData()).rejects.toThrow("no_folder");
        expect(h.refresh).not.toHaveBeenCalled();
    });
});

describe("language preference (api)", () => {
    it("remembers the /me language and skips saving the same value", async () => {
        expect(rememberServerLang("en")).toBe("EN");
        expect(serverLocale()).toBe("EN");
        await saveLanguage("EN");
        expect(h.request).not.toHaveBeenCalled();
    });

    it("saves a changed language as lowercase lang_cd", async () => {
        rememberServerLang("vi");
        routes({ "PUT /me/preferences": ok({ lang_cd: "ko" }) });
        await saveLanguage("KO");
        expect(calls()[0].data).toEqual({ lang_cd: "ko" });
        expect(serverLocale()).toBe("KO");
    });

    it("ignores unknown codes and does nothing in mock mode", async () => {
        expect(rememberServerLang("fr")).toBeNull();
        h.source.DATA_SOURCE = "mock";
        await saveLanguage("EN");
        expect(h.request).not.toHaveBeenCalled();
    });
});
