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
import {
    appliesTo,
    connectMailbox,
    connectMicrosoftDemo,
    disconnectMailbox,
    getEmailAddress,
    loadEmails,
    loadMailboxes,
    microsoftAuthorize,
    parseFolders,
    readMicrosoftReturn,
    scanMailbox,
    simulateIncomingEmail,
    stripMicrosoftReturn,
    toMailbox,
    updateMailbox,
    validateMailboxInput,
    type MailboxInput,
} from "@/lib/api/weinvoice/mailbox";
import { getState, resetState } from "@/lib/api/weinvoice/store";

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


/** One `MailboxItem` exactly as the backend serializes it (snake_case, upper-case enums). */
const ITEM = {
    id: 7,
    kind: "GMAIL",
    address: "kt@gmail.com",
    auth_type: "APP_PASSWORD",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    tls_mode: "SSL",
    login_id: "kt@gmail.com",
    folders: ["INBOX"],
    company_scope: "ONE",
    company_mst: MST,
    status: "CONNECTED",
    status_message: null,
    connected_at: "2026-11-12T08:00:00+07:00",
    last_scan_at: "20261112093000",
    last_scan_invoices: 3,
};
const IMAP_INPUT: MailboxInput = {
    provider: "imap",
    address: " ketoan@congty.vn ",
    password: "Mat Khau 1",
    imapHost: "mail.congty.vn",
    imapPort: "993",
    tlsMode: "starttls",
    loginId: "ketoan",
    folders: ["INBOX", "HDDT"],
    scope: "one",
    taxId: MST,
};
const GMAIL_INPUT: MailboxInput = { provider: "gmail", address: "kt@gmail.com", password: "abcd efgh ijkl mnop", folders: ["INBOX"], scope: "all", taxId: MST };

describe("mailboxes — api mode (/mailboxes*)", () => {
    it("loadMailboxes: GET /mailboxes (MailboxItem[]) → store.mailboxes via toMailbox", async () => {
        routes({ "GET /mailboxes": ok([ITEM]) });
        await loadMailboxes();
        expect(calls()).toHaveLength(1);
        expect(calls()[0]).toMatchObject({ method: "get", url: "/api/v1/weinvoice/mailboxes" });
        expect(getState().mailboxes).toEqual([
            {
                id: "7",
                taxId: MST,
                scope: "one",
                provider: "gmail",
                address: "kt@gmail.com",
                method: "imap_app_password",
                connectedAt: "2026-11-12T08:00:00+07:00",
                lastScanAt: "2026-11-12T09:30:00Z",
                lastScanInvoices: 3,
                status: "connected",
                statusMessage: null,
                imapHost: "imap.gmail.com",
                imapPort: 993,
                tlsMode: "ssl",
                loginId: "kt@gmail.com",
                folders: ["INBOX"],
            },
        ]);
    });

    it("toMailbox: Microsoft / ALL / EXPIRED, IMAP / STARTTLS, unknown status and empty folders tolerated", () => {
        // toMailbox reads the camelCased record (http.ts camelizes before the mapper)
        const ms = toMailbox({ id: 1, kind: "MICROSOFT", address: "kt@outlook.com", authType: "OAUTH_MS", companyScope: "ALL", companyMst: null, status: "EXPIRED", statusMessage: "invalid_grant" });
        expect(ms).toMatchObject({ provider: "outlook", method: "oauth_ms", scope: "all", taxId: "", status: "expired", statusMessage: "invalid_grant" });
        const imap = toMailbox({ id: 9, kind: "IMAP", address: "a@b.vn", authType: "PASSWORD", tlsMode: "STARTTLS", status: "WHATEVER", folders: [], companyScope: "ONE", companyMst: MST, connectedAt: null });
        expect(imap).toMatchObject({ id: "9", provider: "imap", method: "imap_password", tlsMode: "starttls", status: "connected", folders: ["INBOX"], taxId: MST, connectedAt: "" });
        expect(imap.lastScanAt).toBeUndefined();
        expect(appliesTo(ms, "0000000000")).toBe(true);
        expect(appliesTo(imap, "0000000000")).toBe(false);
    });

    it("connect IMAP: POST /mailboxes with the snake_case body; the saved row lands in the store, the password does not", async () => {
        routes({
            "POST /mailboxes": ok({ ...ITEM, id: 8, kind: "IMAP", address: "ketoan@congty.vn", auth_type: "PASSWORD", imap_host: "mail.congty.vn", tls_mode: "STARTTLS", login_id: "ketoan", folders: ["INBOX", "HDDT"], last_scan_at: null, last_scan_invoices: null }),
        });
        const r = await connectMailbox(IMAP_INPUT);
        expect(calls()[0]).toMatchObject({ method: "post", url: "/api/v1/weinvoice/mailboxes" });
        expect(calls()[0].data).toEqual({
            kind: "IMAP",
            address: "ketoan@congty.vn",
            password: "Mat Khau 1",
            imap_host: "mail.congty.vn",
            imap_port: 993,
            tls_mode: "STARTTLS",
            login_id: "ketoan",
            folders: ["INBOX", "HDDT"],
            company_scope: "ONE",
            company_mst: MST,
        });
        expect(r.ok && r.box).toMatchObject({ id: "8", provider: "imap", tlsMode: "starttls", loginId: "ketoan" });
        expect(getState().mailboxes?.map((m) => m.id)).toContain("8");
        expect(JSON.stringify(getState())).not.toContain("Mat Khau 1");
    });

    it("connect Gmail: app password without spaces, no host/port/TLS/login, ALL → no company_mst", async () => {
        routes({ "POST /mailboxes": ok({ ...ITEM, company_scope: "ALL", company_mst: null }) });
        await connectMailbox(GMAIL_INPUT);
        expect(calls()[0].data).toEqual({ kind: "GMAIL", address: "kt@gmail.com", password: "abcdefghijklmnop", folders: ["INBOX"], company_scope: "ALL" });
        expect(JSON.stringify(getState())).not.toContain("abcdefghijklmnop");
    });

    it("update without password: PUT /mailboxes/{id} with no `password` key (backend keeps the stored secret)", async () => {
        routes({ "PUT /mailboxes/8": ok({ ...ITEM, id: 8, kind: "IMAP" }) });
        await updateMailbox("8", { ...IMAP_INPUT, password: "", loginId: "" });
        expect(calls()[0]).toMatchObject({ method: "put", url: "/api/v1/weinvoice/mailboxes/8" });
        expect(calls()[0].data).not.toHaveProperty("password");
        expect(calls()[0].data).not.toHaveProperty("login_id");
        expect(calls()[0].data).toMatchObject({ kind: "IMAP", imap_host: "mail.congty.vn", company_scope: "ONE", company_mst: MST });
    });

    it("a refused login is a WeInvoiceApiError carrying the server message; nothing is stored", async () => {
        routes({ "POST /mailboxes": fail("WBE3030", "Máy chủ mail từ chối đăng nhập: AUTHENTICATIONFAILED") });
        await expect(connectMailbox(IMAP_INPUT)).rejects.toMatchObject({ code: "WBE3030", message: "Máy chủ mail từ chối đăng nhập: AUTHENTICATIONFAILED" });
        expect(getState().mailboxes).toEqual([]);
    });

    it("disconnect: DELETE /mailboxes/{id} and the row leaves the store", async () => {
        routes({ "GET /mailboxes": ok([ITEM]), "DELETE /mailboxes/7": ok(null) });
        await loadMailboxes();
        await disconnectMailbox("7");
        expect(calls()[1]).toMatchObject({ method: "delete", url: "/api/v1/weinvoice/mailboxes/7" });
        expect(getState().mailboxes).toEqual([]);
    });

    it("scan: POST /mailboxes/{id}/scan → poll GET /requests/{request_id} → reload; found = last_scan_invoices", async () => {
        let polls = 0;
        routes({
            "POST /mailboxes/7/scan": ok({ request_id: "r1", subject: "kt@gmail.com" }),
            "GET /requests/r1": () => ok({ request_id: "r1", type: "mail_scan", status: polls++ === 0 ? "running" : "done" }),
            "GET /mailboxes": ok([{ ...ITEM, last_scan_invoices: 5 }]),
        });
        await expect(scanMailbox("7")).resolves.toEqual({ found: 5 });
        expect(calls().map((c) => `${c.method} ${c.url}`)).toEqual([
            "post /api/v1/weinvoice/mailboxes/7/scan",
            "get /api/v1/weinvoice/requests/r1",
            "get /api/v1/weinvoice/requests/r1",
            "get /api/v1/weinvoice/mailboxes",
        ]);
    });

    it("scan: a failed engine request throws WBE_REQUEST_FAILED with the engine error", async () => {
        routes({
            "POST /mailboxes/7/scan": ok({ request_id: "r2" }),
            "GET /requests/r2": ok({ request_id: "r2", status: "failed", error: "LOGIN failed" }),
        });
        await expect(scanMailbox("7")).rejects.toMatchObject({ code: "WBE_REQUEST_FAILED", message: "LOGIN failed" });
    });

    it("Microsoft authorize: GET /mailboxes/microsoft/authorize?company_scope=&company_mst=&folders= → url", async () => {
        routes({ "GET /mailboxes/microsoft/authorize": ok({ url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?x=1" }) });
        await expect(microsoftAuthorize({ scope: "one", taxId: MST, folders: ["INBOX", "HDDT"] })).resolves.toEqual({ ok: true, url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?x=1" });
        expect(calls()[0].params).toEqual({ company_scope: "ONE", company_mst: MST, folders: "INBOX,HDDT" });
        await microsoftAuthorize({ scope: "all", taxId: MST, folders: [] });
        expect(calls()[1].params).toEqual({ company_scope: "ALL", folders: "INBOX" });
    });

    it("Microsoft authorize: 'not configured' → { ok: false, reason: not_configured }; any other error is thrown", async () => {
        routes({ "GET /mailboxes/microsoft/authorize": fail("WBE3031", "Microsoft sign-in is not configured") });
        await expect(microsoftAuthorize({ scope: "one", taxId: MST, folders: ["INBOX"] })).resolves.toMatchObject({ ok: false, reason: "not_configured" });
        routes({ "GET /mailboxes/microsoft/authorize": fail("WBE3002", "MST không thuộc tenant") });
        await expect(microsoftAuthorize({ scope: "one", taxId: MST, folders: ["INBOX"] })).rejects.toMatchObject({ code: "WBE3002" });
    });

    it("the mock-only Microsoft consent is refused against the backend", async () => {
        await expect(connectMicrosoftDemo({ address: "a@outlook.com", scope: "one", taxId: MST, folders: ["INBOX"] })).rejects.toMatchObject({ code: "WBE_CLIENT_MOCK_ONLY" });
        expect(h.request).not.toHaveBeenCalled();
    });
});

describe("mailbox helpers", () => {
    it("readMicrosoftReturn: ?ms=ok / ?ms=error&reason= / nothing", () => {
        expect(readMicrosoftReturn("?ms=ok")).toEqual({ status: "ok" });
        expect(readMicrosoftReturn("?ms=error&reason=denied")).toEqual({ status: "error", reason: "denied" });
        expect(readMicrosoftReturn("?ms=error")).toEqual({ status: "error", reason: "unknown" });
        expect(readMicrosoftReturn("?tab=x")).toBeNull();
    });

    it("stripMicrosoftReturn keeps the path, other params and the hash", () => {
        expect(stripMicrosoftReturn("http://app.local/sources/mailbox?ms=error&reason=x&tab=2#list")).toBe("/sources/mailbox?tab=2#list");
        expect(stripMicrosoftReturn("http://app.local/sources/mailbox?ms=ok")).toBe("/sources/mailbox");
    });

    it("parseFolders trims, drops empties, de-dups case-insensitively, defaults to INBOX", () => {
        expect(parseFolders(" INBOX, HDDT,,inbox ")).toEqual(["INBOX", "HDDT"]);
        expect(parseFolders(" , ")).toEqual(["INBOX"]);
    });

    it("validateMailboxInput: create needs a password; edit does not; Gmail needs 16 letters; IMAP needs host + port", () => {
        expect(validateMailboxInput({ ...GMAIL_INPUT, password: "" }, "create")).toEqual({ password: "required" });
        expect(validateMailboxInput({ ...GMAIL_INPUT, password: "" }, "edit")).toEqual({});
        expect(validateMailboxInput({ ...GMAIL_INPUT, password: "my gmail password" }, "create")).toEqual({ password: "invalid" });
        expect(validateMailboxInput({ ...IMAP_INPUT, address: "x@", imapHost: "", imapPort: "70000" }, "create")).toEqual({ address: "invalid", imapHost: "required", imapPort: "invalid" });
        expect(validateMailboxInput({ ...IMAP_INPUT, imapHost: "mail congty" }, "create")).toEqual({ imapHost: "invalid" });
        expect(validateMailboxInput(IMAP_INPUT, "create")).toEqual({});
    });
});

describe("mailbox — mock mode", () => {
    it("loaders are no-ops; connect / edit / scan / disconnect stay in memory (no HTTP), secrets never stored", async () => {
        h.source.DATA_SOURCE = "mock";
        resetState();
        await loadEmails(MST);
        await loadMailboxes();
        const r = await connectMailbox({ ...GMAIL_INPUT, scope: "one" });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.box).toMatchObject({ provider: "gmail", taxId: MST, status: "connected" });
        const e = await updateMailbox(r.box.id, { ...GMAIL_INPUT, scope: "one", password: "", folders: ["INBOX", "HDDT"] });
        expect(e.ok && e.box.folders).toEqual(["INBOX", "HDDT"]);
        const imap = await connectMailbox(IMAP_INPUT);
        expect(imap.ok && imap.box).toMatchObject({ provider: "imap", imapHost: "mail.congty.vn", tlsMode: "starttls", loginId: "ketoan" });
        const bad = await connectMailbox({ ...IMAP_INPUT, password: "sai-mat-khau" });
        expect(bad).toEqual({ ok: false, error: "auth" });
        const ms = await connectMicrosoftDemo({ address: "kt@outlook.com", scope: "all", taxId: MST, folders: ["INBOX"] });
        expect(ms).toMatchObject({ provider: "outlook", scope: "all", taxId: "" });
        const scan = await scanMailbox(r.box.id);
        expect(scan.found).toBeGreaterThanOrEqual(0);
        expect(getState().mailboxes?.find((m) => m.id === r.box.id)?.lastScanAt).toBeTruthy();
        await disconnectMailbox(r.box.id);
        expect(getState().mailboxes?.some((m) => m.id === r.box.id)).toBe(false);
        await expect(getEmailAddress("0101-234567")).resolves.toEqual({ address: "hd-0101234567@inbox.weinvoice.vn", configured: true });
        expect(JSON.stringify(getState())).not.toMatch(/abcd ?efgh|Mat Khau 1|sai-mat-khau/);
        expect(h.request).not.toHaveBeenCalled();
    });
});
