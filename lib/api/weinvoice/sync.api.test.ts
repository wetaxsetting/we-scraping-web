import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request, post: h.post } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
// Polling helpers sleep between calls — make them instant.
vi.mock("@/lib/utils", async (io) => ({ ...(await io<typeof import("@/lib/utils")>()), sleep: () => Promise.resolve() }));

import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { getState, resetState } from "@/lib/api/weinvoice/store";
import { addConnection, changePassword, getCompanyMeta, getDefaultCompanyMst, getQuotaMax, loadCompanies, loadSyncHistory, removeConnection, runSync, setDefaultCompany, updateConnection, type SyncProgress } from "@/lib/api/weinvoice/sync";

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

// Fixtures use the exact wire keys of the published DTOs (we-scraping-api domain/weinvoice/dto, Jackson SNAKE_CASE).
/** CompanyItem */
const COMPANY = { tax_id: "0101234567", company_name: "CÔNG TY A", username: "0101234567-U002", label: "HQ", status: "connected", status_message: null, has_password: true, default_company: true, last_sync_at: "2026-11-01T08:00:00Z", created_at: "2026-10-01T00:00:00Z" };
const companies = (...items: object[]) => ok({ companies: items, quota: { used: items.length, max: 5 } });
/** SyncRunItem */
const RUN_DONE = { id: "R1", request_id: "1", tax_id: "0101234567", company_name: "CÔNG TY A", direction: "both", from_month: "2026-10", to_month: "2026-10", started_at: "2026-11-05T01:00:00Z", duration_sec: 12, new_count: 3, updated_count: 1, xml_count: 4, status: "success", message: null, trigger: "manual" };
const page = (rows: object[], total = rows.length) => ok({ rows, total_count: total, page: 0, size: 200 });
/** SyncRunProgress */
const progress = (o: object) => ({ run_id: "R1", tax_id: "0101234567", status: "running", step: null, month: null, listed: null, xml_done: null, xml_total: null, error: null, run: null, ...o });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.post.mockReset();
    resetState();
});

describe("loadCompanies / loadSyncHistory (api)", () => {
    it("GET /companies → {companies[CompanyItem], quota} maps rows to GdtConnection and keeps quota.max", async () => {
        routes({ "GET /companies": ok({ companies: [COMPANY, { ...COMPANY, tax_id: "0109999003", default_company: false, status: "need_password", has_password: false, username: null }], quota: { used: 2, max: 3 } }) });
        await loadCompanies();
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/companies" });
        expect(getState().connections[0]).toEqual({ taxId: "0101234567", companyName: "CÔNG TY A", username: "0101234567-U002", label: "HQ", status: "connected", lastSyncAt: "2026-11-01T08:00:00Z", createdAt: "2026-10-01T00:00:00Z" });
        expect(getState().connections[1]).toMatchObject({ taxId: "0109999003", status: "expired", username: "0109999003" });
        expect(getQuotaMax()).toBe(3);
        expect(getDefaultCompanyMst()).toBe("0101234567");
        expect(getCompanyMeta("0109999003")).toEqual({ apiStatus: "need_password", statusMessage: "", hasPassword: false, defaultCompany: false });
    });

    it("pending / error keep the backend status + status_message in the meta", async () => {
        routes({ "GET /companies": companies({ ...COMPANY, status: "pending" }, { ...COMPANY, tax_id: "0109999003", status: "error", status_message: "Sai mật khẩu" }) });
        await loadCompanies();
        expect(getState().connections.map((c) => c.status)).toEqual(["error", "error"]);
        expect(getCompanyMeta("0101234567")?.apiStatus).toBe("pending");
        expect(getCompanyMeta("0109999003")).toMatchObject({ apiStatus: "error", statusMessage: "Sai mật khẩu" });
    });

    it("GET /sync-runs (page 0, size 200) fills history; cancelled / running → partial + marker; nulls → 0", async () => {
        routes({ "GET /sync-runs": page([RUN_DONE, { ...RUN_DONE, id: "R2", status: "cancelled" }, { ...RUN_DONE, id: "J7", request_id: null, status: "running", new_count: null, duration_sec: null, trigger: "schedule" }, { ...RUN_DONE, id: "R3", status: "failed", message: "Cục Thuế không phản hồi" }]) });
        await loadSyncHistory();
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/sync-runs", params: { page: 0, size: 200 } });
        expect(calls()[0].params).not.toHaveProperty("company_mst");
        const [a, b, c, d] = getState().history;
        expect(a).toMatchObject({ id: "R1", taxId: "0101234567", newCount: 3, xmlCount: 4, status: "success", fromMonth: "2026-10" });
        expect(a.message).toBeUndefined();
        expect(b).toMatchObject({ id: "R2", status: "partial", message: "cancelled" });
        expect(c).toMatchObject({ id: "J7", status: "partial", message: "running", newCount: 0, durationSec: 0, trigger: "schedule" });
        expect(d).toMatchObject({ id: "R3", status: "failed", message: "Cục Thuế không phản hồi" });
    });

    it("loadSyncHistory(mst) sends company_mst and replaces only that MST's rows; pages until total_count", async () => {
        resetState();
        routes({ "GET /sync-runs": page([RUN_DONE]) });
        await loadSyncHistory();
        const other = { ...RUN_DONE, id: "R5", tax_id: "0109999003", started_at: "2026-11-04T00:00:00Z" };
        h.request.mockReset();
        routes({ "GET /sync-runs": page([other]) });
        await loadSyncHistory("0109999003");
        expect(calls()[0].params).toMatchObject({ company_mst: "0109999003", page: 0, size: 200 });
        expect(getState().history.map((r) => r.id)).toEqual(["R1", "R5"]);

        h.request.mockReset();
        const full = Array.from({ length: 200 }, (_, i) => ({ ...RUN_DONE, id: `R${i + 10}` }));
        routes({ "GET /sync-runs": (c: Call) => (c.params?.page === 0 ? page(full, 201) : page([{ ...RUN_DONE, id: "R999" }], 201)) });
        await loadSyncHistory();
        expect(calls().map((c) => c.params?.page)).toEqual([0, 1]);
        expect(getState().history).toHaveLength(201);
    });

    it("propagates an error envelope as WeInvoiceApiError", async () => {
        routes({ "GET /companies": fail("WBE1003", "denied") });
        await expect(loadCompanies()).rejects.toMatchObject({ code: "WBE1003" });
        expect(getState().connections).toEqual([]);
    });
});

describe("addConnection (api)", () => {
    // The backend logs in to the GDT portal before saving and answers with the saved CompanyItem —
    // one call, no GET /requests polling (we-scraping-api docs/issues/weinvoice-gdt-login-test-synchronous-2026-11-06.md).
    it("POST /companies {company_mst, password, label} (no gdt_username) → saved CompanyItem → connected, no polling", async () => {
        const steps: string[] = [];
        routes({
            "POST /companies": ok(COMPANY),
            "GET /companies": companies(COMPANY),
        });
        const res = await addConnection({ taxId: " 0101234567 ", password: "secret", label: "HQ" }, (s) => steps.push(s));
        expect(res).toMatchObject({ ok: true, conn: { taxId: "0101234567", status: "connected" } });
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/companies" });
        expect(calls()[0].data).toEqual({ company_mst: "0101234567", password: "secret", label: "HQ" });
        expect(calls().map((c) => `${c.method} ${c.url}`)).toEqual(["post /api/v1/weinvoice/companies", "get /api/v1/weinvoice/companies"]);
        expect(steps).toEqual(["login"]);
        expect(JSON.stringify(getState())).not.toContain("secret");
    });

    it("sends gdt_username when given; omits a blank label", async () => {
        routes({
            "POST /companies": ok(COMPANY),
            "GET /companies": companies(COMPANY),
        });
        await addConnection({ taxId: "0101234567", password: "pw", label: " ", username: "0101234567-U002" });
        expect(calls()[0].data).toEqual({ company_mst: "0101234567", gdt_username: "0101234567-U002", password: "pw" });
    });

    it("WBE3027 (portal rejected the account) → wrong_password + the backend message; nothing added", async () => {
        routes({ "POST /companies": fail("WBE3027", "Cục Thuế từ chối tài khoản của MST 0101234567: Sai mật khẩu") });
        expect(await addConnection({ taxId: "0101234567", password: "x", label: "" }))
            .toEqual({ ok: false, error: "wrong_password", message: "Cục Thuế từ chối tài khoản của MST 0101234567: Sai mật khẩu" });
        expect(getState().connections).toEqual([]);
    });

    it("saved but the reload fails → still ok, built from the POST answer", async () => {
        routes({
            "POST /companies": ok(COMPANY),
            "GET /companies": fail("WBE9999", "boom"),
        });
        expect(await addConnection({ taxId: "0101234567", password: "pw", label: "" })).toMatchObject({ ok: true, conn: { taxId: "0101234567", status: "connected" } });
        expect(getState().connections.map((c) => c.taxId)).toEqual(["0101234567"]);
    });

    it.each([
        ["WBE3001", "invalid_tax_id"],
        ["WBE3003", "exists"],
        ["WBE3004", "quota"],
        ["WBE3028", "api"],
        ["WBE1003", "api"],
    ])("POST refused with %s → %s (message carries the code)", async (code, kind) => {
        routes({ "POST /companies": fail(code, "Bị từ chối") });
        expect(await addConnection({ taxId: "0101234567", password: "x", label: "" })).toEqual({ ok: false, error: kind, message: `Bị từ chối (${code})` });
    });

    it("rejects a malformed MST without calling the backend", async () => {
        expect(await addConnection({ taxId: "12", password: "x", label: "" })).toEqual({ ok: false, error: "invalid_tax_id" });
        expect(h.request).not.toHaveBeenCalled();
    });
});

describe("label / default / password / delete (api)", () => {
    beforeEach(async () => {
        routes({ "GET /companies": companies(COMPANY, { ...COMPANY, tax_id: "0109999003", default_company: false }) });
        await loadCompanies();
        h.request.mockReset();
    });

    it("PATCH /companies/{mst} {label} → CompanyItem replaces the store row", async () => {
        routes({ "PATCH /companies/0101234567": ok({ ...COMPANY, label: "Chi nhánh" }) });
        await updateConnection("0101234567", { label: "Chi nhánh" });
        expect(calls()[0]).toMatchObject({ method: "patch", url: "/api/v1/weinvoice/companies/0101234567" });
        expect(calls()[0].data).toEqual({ label: "Chi nhánh" });
        expect(getState().connections[0].label).toBe("Chi nhánh");
    });

    it("setDefaultCompany → PATCH {default_company: true}; the default moves", async () => {
        routes({ "PATCH /companies/0109999003": ok({ ...COMPANY, tax_id: "0109999003", default_company: true }) });
        await setDefaultCompany("0109999003");
        expect(calls()[0].data).toEqual({ default_company: true });
        expect(getDefaultCompanyMst()).toBe("0109999003");
        expect(getCompanyMeta("0101234567")?.defaultCompany).toBe(false);
    });

    it("PUT /companies/{mst}/password {password} → saved CompanyItem → reloads; no polling", async () => {
        routes({
            "PUT /companies/0101234567/password": ok(COMPANY),
            "GET /companies": companies(COMPANY),
        });
        await expect(changePassword("0101234567", "newpw")).resolves.toBeUndefined();
        expect(calls()[0]).toMatchObject({ method: "put" });
        expect(calls()[0].data).toEqual({ password: "newpw" });
        expect(calls()).toHaveLength(2);
    });

    it("PUT …/password rejected by the portal (WBE3027) throws with the backend message", async () => {
        routes({ "PUT /companies/0101234567/password": fail("WBE3027", "Cục Thuế từ chối: Sai mật khẩu") });
        const err = await changePassword("0101234567", "bad").catch((e) => e);
        expect(err).toBeInstanceOf(WeInvoiceApiError);
        expect(err).toMatchObject({ code: "WBE3027", message: "Cục Thuế từ chối: Sai mật khẩu" });
    });

    it("DELETE /companies/{mst} (data null) removes it; a failure leaves the store untouched", async () => {
        routes({ "DELETE /companies/0101234567": fail("WBE1003", "boom") });
        await expect(removeConnection("0101234567")).rejects.toMatchObject({ code: "WBE1003" });
        expect(getState().connections).toHaveLength(2);
        routes({ "DELETE /companies/0101234567": ok(null) });
        await removeConnection("0101234567");
        expect(getState().connections.map((c) => c.taxId)).toEqual(["0109999003"]);
        expect(getCompanyMeta("0101234567")).toBeUndefined();
    });
});

describe("runSync (api)", () => {
    const opts = { taxId: "0101234567", direction: "both" as const, fromMonth: "2026-10", toMonth: "2026-10" };

    it("POST /sync-runs → [{request_id: R<n>, subject}] → polls GET /sync-runs/{run_id} → returns `run`", async () => {
        let poll = 0;
        const seq = [
            progress({ status: "queued" }),
            progress({ status: "running", step: "list", month: "2026-10", listed: 4, xml_done: 0, xml_total: 4 }),
            progress({ status: "done", step: "done", listed: 4, xml_done: 4, xml_total: 4, run: RUN_DONE }),
        ];
        routes({
            "POST /sync-runs": ok([{ request_id: "R1", subject: "0101234567" }]),
            "GET /sync-runs/R1": () => ok(seq[Math.min(poll++, 2)]),
            "GET /sync-runs": page([RUN_DONE]),
            "GET /companies": companies(COMPANY),
        });
        const seen: SyncProgress[] = [];
        const run = await runSync(opts, (p) => seen.push(p));
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/sync-runs" });
        expect(calls()[0].data).toEqual({ company_msts: ["0101234567"], direction: "both", from_month: "2026-10", to_month: "2026-10", trigger: "manual" });
        expect(seen.map((p) => p.step)).toEqual(["login", "list", "done"]);
        expect(seen[1]).toMatchObject({ month: "2026-10", listed: 4, xmlTotal: 4 });
        expect(seen.every((p) => p.captcha === undefined)).toBe(true);
        expect(run).toMatchObject({ id: "R1", status: "success", newCount: 3, xmlCount: 4 });
        expect(getState().history).toHaveLength(1);
    });

    it("bulk trigger is sent; a failed run without `run` uses the request status + error", async () => {
        routes({
            "POST /sync-runs": ok([{ request_id: "R2", subject: "0101234567" }]),
            "GET /sync-runs/R2": ok(progress({ run_id: "R2", status: "failed", step: "login", error: "Cục Thuế từ chối đăng nhập" })),
            "GET /sync-runs": page([]),
            "GET /companies": companies(COMPANY),
        });
        const run = await runSync({ ...opts, trigger: "bulk" }, () => {});
        expect(calls()[0].data).toMatchObject({ trigger: "bulk" });
        expect(run).toMatchObject({ id: "R2", status: "failed", message: "Cục Thuế từ chối đăng nhập", trigger: "bulk", fromMonth: "2026-10" });
    });

    it("signal.cancelled → POST /sync-runs/{run_id}/cancel once, returns the cancelled run as partial", async () => {
        let poll = 0;
        const signal = { cancelled: false };
        routes({
            "POST /sync-runs": ok([{ request_id: "R9", subject: "0101234567" }]),
            "GET /sync-runs/R9": () => {
                poll++;
                if (poll === 1) signal.cancelled = true;
                return ok(poll < 3 ? progress({ run_id: "R9", status: "running", step: "list", listed: 1 }) : progress({ run_id: "R9", status: "cancelled", step: "list", run: { ...RUN_DONE, id: "R9", status: "cancelled" } }));
            },
            "POST /sync-runs/R9/cancel": ok({ request_id: "9", type: "sync", status: "running", cancel_requested: true }),
            "GET /sync-runs": page([]),
            "GET /companies": companies(),
        });
        const run = await runSync(opts, () => {}, signal);
        expect(calls().filter((c) => c.url.endsWith("/cancel"))).toHaveLength(1);
        expect(run).toMatchObject({ id: "R9", status: "partial", message: "cancelled" });
    });

    it("cancel answered WBE3012 (already finished) → keeps polling for the result", async () => {
        let poll = 0;
        const signal = { cancelled: true };
        routes({
            "POST /sync-runs": ok([{ request_id: "R8", subject: "0101234567" }]),
            "GET /sync-runs/R8": () => ok(poll++ === 0 ? progress({ run_id: "R8", status: "running", step: "xml" }) : progress({ run_id: "R8", status: "done", step: "done", run: { ...RUN_DONE, id: "R8" } })),
            "POST /sync-runs/R8/cancel": fail("WBE3012", "Đã kết thúc"),
            "GET /sync-runs": page([]),
            "GET /companies": companies(COMPANY),
        });
        expect(await runSync(opts, () => {}, signal)).toMatchObject({ id: "R8", status: "success" });
    });

    it.each(["WBE3016", "WBE3023", "WBE3024"])("POST /sync-runs refused with %s → throws with the backend code", async (code) => {
        routes({ "POST /sync-runs": fail(code, "Từ chối") });
        await expect(runSync(opts, () => {})).rejects.toMatchObject({ code, message: "Từ chối" });
    });
});

describe("mock mode", () => {
    it("loaders and mutations make no HTTP call", async () => {
        h.source.DATA_SOURCE = "mock";
        resetState();
        await loadCompanies();
        await loadSyncHistory();
        await loadSyncHistory("0101234567");
        await setDefaultCompany("0101234567");
        const taxId = getState().connections[0].taxId;
        await updateConnection(taxId, { label: "x" });
        await changePassword(taxId, "pw");
        expect(getState().connections[0]).toMatchObject({ label: "x", status: "connected" });
        expect(h.request).not.toHaveBeenCalled();
        expect(h.post).not.toHaveBeenCalled();
    });
});
