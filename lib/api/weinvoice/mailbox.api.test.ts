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
import { connectMailbox, disconnectMailbox, getEmailAddress, loadEmails, loadMailboxes, mailboxesAvailable, scanMailbox, simulateIncomingEmail } from "@/lib/api/weinvoice/mailbox";
import { getState, resetState, setState } from "@/lib/api/weinvoice/store";

const MST = "0101234567";
/** One `EmailMessageItem` exactly as the backend serializes it (snake_case). */
const MAIL = { id: "41", received_at: "2026-11-04T09:00:00Z", from: "hoadon@ncc.vn", subject: "HĐ 12", attachments: ["a.xml", "a.pdf"], result: "matched", engine_status: "DONE", invoice_ref: "77" };
const page = (rows: unknown[], total = rows.length, p = 0, size = 200) => ok({ rows, total_count: total, page: p, size });

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.post.mockReset();
    resetState();
});

describe("email — api mode", () => {
    it("loadEmails: GET /email/messages?company_mst=&page=&size= (page {rows,total_count,page,size}) → store.emails", async () => {
        routes({ "GET /email/messages": page([MAIL]) });
        await loadEmails(MST);
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/email/messages", params: { company_mst: MST, page: 0, size: 200 } });
        expect(getState().emails).toEqual([
            { id: "41", receivedAt: "2026-11-04T09:00:00Z", from: "hoadon@ncc.vn", subject: "HĐ 12", attachments: ["a.xml", "a.pdf"], result: "matched", invoiceRef: "77", apiResult: "matched", engineStatus: "DONE" },
        ]);
    });

    it("loadEmails reads every page until total_count", async () => {
        const full = Array.from({ length: 200 }, (_, i) => ({ ...MAIL, id: `p0-${i}` }));
        routes({ "GET /email/messages": (c: Call) => (c.params?.page === 0 ? page(full, 201, 0) : page([{ ...MAIL, id: "last" }], 201, 1)) });
        await loadEmails(MST);
        expect(calls().map((c) => c.params?.page)).toEqual([0, 1]);
        expect(getState().emails).toHaveLength(201);
    });

    it("unmatched / error (no EmailMessage value) are stored as no_invoice with the backend value in apiResult; null fields tolerated", async () => {
        routes({
            "GET /email/messages": page([
                { ...MAIL, id: "1", result: "unmatched", invoice_ref: null },
                { ...MAIL, id: "2", result: "error", attachments: null, engine_status: null, invoice_ref: null },
                { ...MAIL, id: "3", result: "duplicate" },
                { ...MAIL, id: "4", result: "no_invoice", invoice_ref: null },
            ]),
        });
        await loadEmails(MST);
        expect(getState().emails.map((m) => [m.result, (m as { apiResult?: string }).apiResult, m.invoiceRef])).toEqual([
            ["no_invoice", "unmatched", undefined],
            ["no_invoice", "error", undefined],
            ["duplicate", "duplicate", "77"],
            ["no_invoice", "no_invoice", undefined],
        ]);
        expect(getState().emails[1].attachments).toEqual([]);
    });

    it("getEmailAddress: GET /email/address?company_mst → { address, configured }", async () => {
        routes({ "GET /email/address": ok({ company_mst: MST, address: `hd-${MST}@inbox.example`, configured: true }) });
        await expect(getEmailAddress(MST)).resolves.toEqual({ address: `hd-${MST}@inbox.example`, configured: true });
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/email/address", params: { company_mst: MST } });
    });

    it("getEmailAddress: no mail domain on the server → configured false, address null", async () => {
        routes({ "GET /email/address": ok({ company_mst: MST, address: null, configured: false }) });
        await expect(getEmailAddress(MST)).resolves.toEqual({ address: null, configured: false });
    });

    it("simulateIncomingEmail is refused against the backend", async () => {
        await expect(simulateIncomingEmail(MST)).rejects.toBeInstanceOf(WeInvoiceApiError);
        expect(h.request).not.toHaveBeenCalled();
    });

    it("a backend error is a WeInvoiceApiError with the backend code (WBE3002 MST not managed)", async () => {
        routes({ "GET /email/messages": fail("WBE3002", "MST không thuộc tenant") });
        await expect(loadEmails(MST)).rejects.toMatchObject({ code: "WBE3002" });
    });
});

/** `/mailboxes/*` is not in the published API: api mode never calls HTTP for it. */
describe("mailboxes — api mode (not on the server)", () => {
    it("loadMailboxes resolves with an empty list and sends no request", async () => {
        setState((s) => {
            s.mailboxes = [{ id: "b1", taxId: MST, provider: "gmail", address: "kt@gmail.com", method: "imap_app_password", connectedAt: "2026-11-01T00:00:00Z" }];
        });
        await loadMailboxes();
        expect(getState().mailboxes).toEqual([]);
        expect(mailboxesAvailable()).toBe(false);
        expect(h.request).not.toHaveBeenCalled();
    });

    it("connect / scan / disconnect refuse with WBE_CLIENT_NOT_ON_SERVER and send nothing", async () => {
        for (const op of [
            () => connectMailbox({ taxId: MST, provider: "gmail", address: "kt@gmail.com", appPassword: "abcdefghijklmnop" }),
            () => connectMailbox({ taxId: MST, provider: "outlook", address: "kt@outlook.com" }),
            () => scanMailbox("b1"),
            () => disconnectMailbox("b1"),
        ]) {
            await expect(op()).rejects.toMatchObject({ code: "WBE_CLIENT_NOT_ON_SERVER" });
        }
        expect(h.request).not.toHaveBeenCalled();
        expect(h.post).not.toHaveBeenCalled();
        expect(JSON.stringify(getState())).not.toContain("abcdefghijklmnop");
    });
});

describe("mailbox — mock mode", () => {
    it("loaders are no-ops and connect / disconnect stay in memory (no HTTP)", async () => {
        h.source.DATA_SOURCE = "mock";
        resetState();
        await loadEmails(MST);
        await loadMailboxes();
        expect(mailboxesAvailable()).toBe(true);
        const r = await connectMailbox({ taxId: MST, provider: "gmail", address: "kt@gmail.com", appPassword: "abcdefghijklmnop" });
        expect(r.ok).toBe(true);
        if (r.ok) await disconnectMailbox(r.box.id);
        await expect(getEmailAddress("0101-234567")).resolves.toEqual({ address: "hd-0101234567@inbox.weinvoice.vn", configured: true });
        expect(h.request).not.toHaveBeenCalled();
    });
});
