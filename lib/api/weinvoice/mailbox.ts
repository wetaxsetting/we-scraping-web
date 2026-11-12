/*
 * Mailbox connections + email intake (screens 07 · 08).
 *
 * api mode (DATA_SOURCE === "api"):
 *   - email intake — backend interface-specification § "Mail, uploads" (DTOs `EmailMessageItem`,
 *     `EmailAddressResponse`):
 *       GET /email/messages?company_mst=&from=&to=&result=&page=&size= → loadEmails     (store.emails)
 *       GET /email/address?company_mst=                                → getEmailAddress
 *   - mailbox connections — backend record weinvoice-mailbox-connections-2026-11-12 (`MailboxItem`):
 *       GET    /mailboxes                                → loadMailboxes   (store.mailboxes)
 *       POST   /mailboxes                                → connectMailbox  (login test, saved only if it works)
 *       PUT    /mailboxes/{id}                           → updateMailbox   (blank password = keep the stored one)
 *       DELETE /mailboxes/{id}                           → disconnectMailbox
 *       POST   /mailboxes/{id}/scan → RequestAccepted    → scanMailbox     (polls GET /requests/{request_id})
 *       GET    /mailboxes/microsoft/authorize → {url}    → microsoftAuthorize (the browser then leaves for Microsoft;
 *              the backend callback returns to /sources/mailbox?ms=ok | ?ms=error&reason=…)
 *     Wire is snake_case (http.ts converts keys); `toMailbox` maps `MailboxItem` → `Mailbox` once.
 *
 * mock mode (default): nothing talks to a mail server; connecting validates the input and records
 * the mailbox. Secrets (app password / password) are checked for shape and then dropped — NEVER
 * written to the store or returned (§3.10). Incoming emails are simulated by generating a fictional
 * invoice XML for the working MST and running it through the shared de-dup import (§3.2).
 */

import { getInvoice, importParsed, requestFailure } from "@/lib/api/weinvoice/invoices";
import { MY_COMPANIES, SUPPLIERS, makeInvoice, type Company, type Mailbox } from "@/lib/api/weinvoice/mockData";
import { WeInvoiceApiError, waitForRequest, wiDelete, wiGet, wiPost, wiPut, type EngineRequest } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState, setState } from "@/lib/api/weinvoice/store";
import type { EmailMessage } from "@/lib/weinvoice/types";
import { hasFile, isNoCode } from "@/lib/weinvoice/types";
import { buildInvoiceXml, parseInvoiceXml } from "@/lib/weinvoice/xml";
import { sleep } from "@/lib/utils";

export type { Mailbox };
export type MailProvider = Mailbox["provider"];
export type MailboxScope = "one" | "all";
export type TlsMode = "ssl" | "starttls";
export type MailboxStatus = NonNullable<Mailbox["status"]>;

export const GMAIL_HOST = "imap.gmail.com";
export const DEFAULT_IMAP_PORT = 993;
export const DEFAULT_FOLDERS = ["INBOX"];

export function validateMailAddress(a: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.trim());
}

/** Google App Password: 16 letters, optionally typed as 4 groups separated by spaces. */
export function validateAppPassword(pw: string): boolean {
    return /^[A-Za-z]{16}$/.test(pw.replace(/\s+/g, ""));
}

/** Host name or IPv4 — letters, digits, dots and dashes, at least one dot. */
export function validateImapHost(h: string): boolean {
    return /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(h.trim());
}

export function validatePort(p: number | string): boolean {
    const n = typeof p === "number" ? p : Number(String(p).trim());
    return Number.isInteger(n) && n >= 1 && n <= 65535 && String(p).trim() !== "";
}

/** "INBOX, HDDT,,inbox" → ["INBOX", "HDDT"] (trimmed, empty dropped, case-insensitive de-dup); nothing → INBOX. */
export function parseFolders(s: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of s.split(",").map((x) => x.trim())) {
        if (f && !seen.has(f.toLowerCase())) {
            seen.add(f.toLowerCase());
            out.push(f);
        }
    }
    return out.length ? out : [...DEFAULT_FOLDERS];
}

/** A mailbox feeds the given MST when it applies to all of the user's MSTs or to exactly that one. */
export const appliesTo = (b: Mailbox, taxId: string): boolean => b.scope === "all" || b.taxId === taxId;

/** Form input for connect / edit. The secret lives in this object only for the one call. */
export type MailboxInput = {
    provider: "gmail" | "imap";
    address: string;
    /** Required on connect; blank on edit = keep the stored secret. */
    password?: string;
    imapHost?: string;
    imapPort?: number | string;
    tlsMode?: TlsMode;
    loginId?: string;
    folders: string[];
    scope: MailboxScope;
    /** The working MST — sent as `company_mst` when `scope` is "one". */
    taxId: string;
};

export type MailboxField = "address" | "password" | "imapHost" | "imapPort";
export type MailboxFieldErrors = Partial<Record<MailboxField, "required" | "invalid">>;

/** Client-side rules of the connect / edit form (backend record § "Backend endpoints" re-checks them). */
export function validateMailboxInput(input: MailboxInput, mode: "create" | "edit"): MailboxFieldErrors {
    const e: MailboxFieldErrors = {};
    if (!validateMailAddress(input.address)) e.address = "invalid";
    const pw = input.password ?? "";
    if (!pw.trim()) {
        if (mode === "create") e.password = "required";
    } else if (input.provider === "gmail" && !validateAppPassword(pw)) e.password = "invalid";
    if (input.provider === "imap") {
        if (!(input.imapHost ?? "").trim()) e.imapHost = "required";
        else if (!validateImapHost(input.imapHost ?? "")) e.imapHost = "invalid";
        if (!validatePort(input.imapPort ?? DEFAULT_IMAP_PORT)) e.imapPort = "invalid";
    }
    return e;
}

type ConnectStep = "server" | "login" | "inbox";
export type ConnectResult = { ok: true; box: Mailbox } | { ok: false; error: "auth" | "imap_off" };

/* ------------------------------------------------------------------ api mode: email intake */

/** `EmailMessageItem.result`: matched · duplicate · unmatched (XML / PDF waiting for its invoice) · no_invoice · error. */
export type EmailResult = "matched" | "duplicate" | "unmatched" | "no_invoice" | "error";

/** `EmailMessageItem` (camelCased). */
export type EmailMessageRec = {
    id: string;
    receivedAt: string;
    from: string;
    subject: string;
    attachments: string[] | null;
    result: EmailResult;
    engineStatus: string | null;
    invoiceRef: string | null;
};

/**
 * A mail in the store. `EmailMessage.result` (lib/weinvoice/types.ts) has no `unmatched` / `error`:
 * those are stored as `no_invoice` (closest existing value — nothing landed on an invoice) and the
 * backend value is kept in `apiResult`, which the screen prefers for its label.
 */
export type EmailMessageRow = EmailMessage & { apiResult?: EmailResult; engineStatus?: string | null };

/** `EmailAddressResponse` (camelCased). `address` is null when no mail domain is configured. */
export type EmailAddressRec = { companyMst: string; address: string | null; configured: boolean };

type Page<T> = { rows: T[]; totalCount: number; page: number; size: number };

const PAGE_SIZE = 200; // backend max
// OPEN: no date window is applied — every mail of the MST is loaded (cap MAX_PAGES × PAGE_SIZE).
const MAX_PAGES = 25;

const toRow = (m: EmailMessageRec): EmailMessageRow => ({
    id: m.id,
    receivedAt: m.receivedAt,
    from: m.from,
    subject: m.subject,
    attachments: m.attachments ?? [],
    result: m.result === "unmatched" || m.result === "error" ? "no_invoice" : m.result,
    invoiceRef: m.invoiceRef ?? undefined,
    apiResult: m.result,
    engineStatus: m.engineStatus,
});

/** API mode: `GET /email/messages?company_mst=` (all pages) → store.emails. No-op in mock mode. */
export async function loadEmails(taxId: string): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    const rows: EmailMessageRec[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const res = await wiGet<Page<EmailMessageRec>>("/email/messages", { companyMst: taxId, page, size: PAGE_SIZE });
        const got = res?.rows ?? [];
        rows.push(...got);
        if (got.length < PAGE_SIZE || rows.length >= (res?.totalCount ?? 0)) break;
    }
    setState((s) => {
        s.emails = rows.map(toRow);
    });
}

/**
 * The working MST's receiving address `hd-<mst>@…` (`GET /email/address`). `configured: false`
 * (address null) when the server has no mail domain. Mock: the address the prototype showed.
 */
export async function getEmailAddress(taxId: string): Promise<{ address: string | null; configured: boolean }> {
    if (DATA_SOURCE !== "api") return { address: mockEmailAddress(taxId), configured: true };
    const r = await wiGet<EmailAddressRec>("/email/address", { companyMst: taxId });
    return { address: r?.address ?? null, configured: !!r?.configured && !!r.address };
}

export function mockEmailAddress(taxId: string): string {
    return `hd-${taxId.replace("-", "")}@inbox.weinvoice.vn`;
}

/* ------------------------------------------------------------------ api mode: mailbox wire */

/** `MailboxItem` (camelCased by http.ts). Enum values arrive upper-case (`GMAIL`, `CONNECTED`, `SSL`, `ONE`). */
export type MailboxItemRec = {
    id: string | number;
    kind: string;
    address: string;
    authType?: string | null;
    imapHost?: string | null;
    imapPort?: number | null;
    tlsMode?: string | null;
    loginId?: string | null;
    folders?: string[] | null;
    companyScope?: string | null;
    companyMst?: string | null;
    status?: string | null;
    statusMessage?: string | null;
    connectedAt?: string | null;
    lastScanAt?: string | null;
    lastScanInvoices?: number | null;
};

const KIND: Record<string, MailProvider> = { GMAIL: "gmail", MICROSOFT: "outlook", IMAP: "imap" };
const METHOD: Record<string, Mailbox["method"]> = { APP_PASSWORD: "imap_app_password", OAUTH_MS: "oauth_ms", PASSWORD: "imap_password" };
const METHOD_OF: Record<MailProvider, Mailbox["method"]> = { gmail: "imap_app_password", outlook: "oauth_ms", imap: "imap_password" };
const STATUSES: readonly MailboxStatus[] = ["connected", "error", "expired"];

/** `yyyyMMddHHmmss` (UTC, as the DB stores every `*_dtm`) → ISO; the backend already sends ISO, anything else passes through. */
function toIso(v: string | null | undefined): string | undefined {
    if (!v) return undefined;
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(v);
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : v;
}

/** `MailboxItem` → the screen's `Mailbox`. Never carries a secret (the wire has none). */
export function toMailbox(w: MailboxItemRec): Mailbox {
    const provider = KIND[String(w.kind ?? "").toUpperCase()] ?? "imap";
    const scope: MailboxScope = String(w.companyScope ?? "").toUpperCase() === "ALL" ? "all" : "one";
    const status = String(w.status ?? "connected").toLowerCase() as MailboxStatus;
    const tls = String(w.tlsMode ?? "").toLowerCase();
    return {
        id: String(w.id),
        taxId: scope === "all" ? "" : (w.companyMst ?? ""),
        scope,
        provider,
        address: w.address,
        method: METHOD[String(w.authType ?? "").toUpperCase()] ?? METHOD_OF[provider],
        connectedAt: toIso(w.connectedAt) ?? "",
        lastScanAt: toIso(w.lastScanAt),
        lastScanInvoices: w.lastScanInvoices ?? null,
        status: STATUSES.includes(status) ? status : "connected",
        statusMessage: w.statusMessage ?? null,
        imapHost: w.imapHost ?? undefined,
        imapPort: w.imapPort ?? undefined,
        tlsMode: tls === "starttls" ? "starttls" : tls === "ssl" ? "ssl" : undefined,
        loginId: w.loginId ?? undefined,
        folders: w.folders?.length ? w.folders : [...DEFAULT_FOLDERS],
    };
}

/**
 * Request body of `POST /mailboxes` / `PUT /mailboxes/{id}` in camelCase (http.ts sends it snake_case).
 * Gmail: only address + app password (spaces removed) — host / port / TLS are fixed by the backend.
 * IMAP: host, port (993), TLS (SSL), login name only when typed (backend default = address).
 * `password` is omitted when blank (edit = keep the stored secret).
 */
export function toMailboxBody(input: MailboxInput): Record<string, unknown> {
    const body: Record<string, unknown> = { kind: input.provider === "gmail" ? "GMAIL" : "IMAP", address: input.address.trim() };
    const pw = input.provider === "gmail" ? (input.password ?? "").replace(/\s+/g, "") : (input.password ?? "");
    if (pw.trim()) body.password = pw;
    if (input.provider === "imap") {
        body.imapHost = (input.imapHost ?? "").trim();
        body.imapPort = Number(input.imapPort ?? DEFAULT_IMAP_PORT);
        body.tlsMode = (input.tlsMode ?? "ssl").toUpperCase();
        const login = (input.loginId ?? "").trim();
        if (login) body.loginId = login;
    }
    body.folders = input.folders.length ? input.folders : [...DEFAULT_FOLDERS];
    body.companyScope = input.scope === "all" ? "ALL" : "ONE";
    if (input.scope !== "all") body.companyMst = input.taxId;
    return body;
}

function upsertBox(box: Mailbox) {
    setState((s) => {
        const rest = (s.mailboxes ?? []).filter((m) => m.id !== box.id && m.address.toLowerCase() !== box.address.toLowerCase());
        s.mailboxes = [...rest, box];
    });
}

/* ------------------------------------------------------------------ public API: mailboxes */

/** API mode: `GET /mailboxes` → store.mailboxes (every mailbox of the user). No-op in mock mode. */
export async function loadMailboxes(): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    const res = await wiGet<MailboxItemRec[] | { rows?: MailboxItemRec[] } | null>("/mailboxes");
    const rows = Array.isArray(res) ? res : (res?.rows ?? []);
    setState((s) => {
        s.mailboxes = rows.map(toMailbox);
    });
}

/**
 * "Kiểm tra và kết nối" for Gmail / IMAP. api mode: `POST /mailboxes` — the backend logs in once
 * through the engine and saves only on success; a refused login is a `WeInvoiceApiError` carrying
 * the server's message (thrown, like every other api-mode failure).
 *
 * Mock rules so the error paths can be demoed:
 *  - a password containing "sai" → the server rejects the sign-in ("auth");
 *  - an address containing "noimap" → IMAP disabled ("imap_off").
 */
export async function connectMailbox(input: MailboxInput, onStep?: (s: ConnectStep) => void): Promise<ConnectResult> {
    if (DATA_SOURCE === "api") {
        const box = toMailbox(await wiPost<MailboxItemRec>("/mailboxes", toMailboxBody(input)));
        upsertBox(box);
        return { ok: true, box };
    }
    return mockSave(input, undefined, onStep);
}

/** Edit a Gmail / IMAP mailbox — `PUT /mailboxes/{id}`; a blank password keeps the stored one (still re-tested). */
export async function updateMailbox(id: string, input: MailboxInput, onStep?: (s: ConnectStep) => void): Promise<ConnectResult> {
    if (DATA_SOURCE === "api") {
        const box = toMailbox(await wiPut<MailboxItemRec>(`/mailboxes/${encodeURIComponent(id)}`, toMailboxBody(input)));
        upsertBox(box);
        return { ok: true, box };
    }
    return mockSave(input, id, onStep);
}

async function mockSave(input: MailboxInput, id: string | undefined, onStep?: (s: ConnectStep) => void): Promise<ConnectResult> {
    const address = input.address.trim();
    const pw = input.password ?? "";
    onStep?.("server");
    await sleep(500);
    if (/noimap/i.test(address)) return { ok: false, error: "imap_off" };
    onStep?.("login");
    await sleep(600);
    if (pw.trim() ? /sai/i.test(pw) || (input.provider === "gmail" && !validateAppPassword(pw)) : !id) return { ok: false, error: "auth" };
    onStep?.("inbox");
    await sleep(400);
    const prev = id ? (getState().mailboxes ?? []).find((m) => m.id === id) : undefined;
    const box: Mailbox = {
        id: id ?? `mbx-${Date.now()}`,
        taxId: input.scope === "all" ? "" : input.taxId,
        scope: input.scope,
        provider: input.provider,
        address,
        method: METHOD_OF[input.provider],
        connectedAt: prev?.connectedAt ?? new Date().toISOString(),
        lastScanAt: prev?.lastScanAt,
        lastScanInvoices: prev?.lastScanInvoices ?? null,
        status: "connected",
        statusMessage: null,
        folders: input.folders.length ? input.folders : [...DEFAULT_FOLDERS],
        ...(input.provider === "imap"
            ? { imapHost: (input.imapHost ?? "").trim(), imapPort: Number(input.imapPort ?? DEFAULT_IMAP_PORT), tlsMode: input.tlsMode ?? "ssl", loginId: (input.loginId ?? "").trim() || address }
            : {}),
    };
    // Only the mailbox metadata is kept — never the password (§3.10).
    upsertBox(box);
    return { ok: true, box };
}

/** Mock only: the simulated Microsoft consent ("Cho phép (demo)"). api mode signs in through `microsoftAuthorize`. */
export async function connectMicrosoftDemo(p: { address: string; scope: MailboxScope; taxId: string; folders: string[] }): Promise<Mailbox> {
    if (DATA_SOURCE === "api") throw new WeInvoiceApiError("WBE_CLIENT_MOCK_ONLY", "Simulated Microsoft sign-in is not available against the backend.");
    await sleep(300);
    const address = p.address.trim();
    const prev = (getState().mailboxes ?? []).find((m) => m.address.toLowerCase() === address.toLowerCase());
    const box: Mailbox = {
        id: prev?.id ?? `mbx-${Date.now()}`,
        taxId: p.scope === "all" ? "" : p.taxId,
        scope: p.scope,
        provider: "outlook",
        address,
        method: "oauth_ms",
        connectedAt: new Date().toISOString(),
        lastScanAt: prev?.lastScanAt,
        lastScanInvoices: prev?.lastScanInvoices ?? null,
        status: "connected",
        statusMessage: null,
        folders: p.folders.length ? p.folders : [...DEFAULT_FOLDERS],
    };
    upsertBox(box);
    return box;
}

export async function disconnectMailbox(id: string): Promise<void> {
    if (DATA_SOURCE === "api") await wiDelete(`/mailboxes/${encodeURIComponent(id)}`);
    else await sleep(200);
    setState((s) => {
        s.mailboxes = (s.mailboxes ?? []).filter((m) => m.id !== id);
    });
}

const SCAN_FINISHED = new Set<EngineRequest["status"]>(["done", "partial"]);

/**
 * "Quét ngay". api mode: `POST /mailboxes/{id}/scan` → engine request `MAIL_SCAN` → poll
 * `GET /requests/{request_id}` → reload the list; `found` = the mailbox's `last_scan_invoices`
 * after the scan. A failed / cancelled request throws (`WBE_REQUEST_FAILED` with the engine error).
 * Mock: stamps the scan time and picks up one new email for the mailbox's MST.
 */
export async function scanMailbox(id: string, onProgress?: (r: EngineRequest) => void): Promise<{ found: number }> {
    if (DATA_SOURCE === "api") {
        const res = await wiPost<{ requestId: string; subject?: string | null } | null>(`/mailboxes/${encodeURIComponent(id)}/scan`);
        if (res?.requestId) {
            const r = await waitForRequest(res.requestId, onProgress);
            if (!SCAN_FINISHED.has(r.status)) throw requestFailure(r);
        }
        await loadMailboxes();
        const box = (getState().mailboxes ?? []).find((m) => m.id === id);
        return { found: box?.lastScanInvoices ?? 0 };
    }
    const box = (getState().mailboxes ?? []).find((m) => m.id === id);
    if (!box) return { found: 0 };
    await sleep(900);
    const msg = await simulateIncomingEmail(box.taxId || getState().activeTaxId);
    const found = msg.invoiceRef && getInvoice(msg.invoiceRef) ? 1 : 0;
    setState((s) => {
        const m = (s.mailboxes ?? []).find((x) => x.id === id);
        if (m) {
            m.lastScanAt = new Date().toISOString();
            m.lastScanInvoices = found;
            m.status = "connected";
            m.statusMessage = null;
        }
    });
    return { found };
}

/* ------------------------------------------------------------------ Microsoft sign-in */

/** The mailbox list lives on the backend (api mode) — screens load it with `loadMailboxes`. */
export const mailboxesRemote = (): boolean => DATA_SOURCE === "api";

/** Microsoft sign-in is simulated (consent dialog) in mock mode, a real redirect in api mode. */
export const microsoftSignInIsDemo = (): boolean => !mailboxesRemote();

export type MicrosoftAuthorizeResult = { ok: true; url: string } | { ok: false; reason: "not_configured"; message: string };

/**
 * OPEN (backend record): the "Microsoft sign-in is not configured" business error has no named code
 * yet — it is recognised by its message (EN / VI / KO) or an empty `url`. Other failures are thrown.
 */
const NOT_CONFIGURED = /not\s+configured|chưa\s+(được\s+)?cấu\s+hình|설정되지|구성되지/i;

/** `GET /mailboxes/microsoft/authorize?company_scope=&company_mst=&folders=` → the Microsoft sign-in URL. */
export async function microsoftAuthorize(p: { scope: MailboxScope; taxId: string; folders: string[] }): Promise<MicrosoftAuthorizeResult> {
    if (DATA_SOURCE !== "api") throw new WeInvoiceApiError("WBE_CLIENT_API_ONLY", "Microsoft sign-in needs the backend.");
    const params: Record<string, string> = { companyScope: p.scope === "all" ? "ALL" : "ONE", folders: (p.folders.length ? p.folders : DEFAULT_FOLDERS).join(",") };
    if (p.scope !== "all") params.companyMst = p.taxId;
    try {
        const r = await wiGet<{ url?: string | null } | null>("/mailboxes/microsoft/authorize", params);
        if (!r?.url) return { ok: false, reason: "not_configured", message: "" };
        return { ok: true, url: r.url };
    } catch (err) {
        if (err instanceof WeInvoiceApiError && (err.code === "WBE3032" || NOT_CONFIGURED.test(err.message))) return { ok: false, reason: "not_configured", message: err.message };
        throw err;
    }
}

export type MicrosoftReturn = { status: "ok" } | { status: "error"; reason: string };

/** The backend callback sends the browser back with `?ms=ok` or `?ms=error&reason=<short code>`. */
export function readMicrosoftReturn(search: string): MicrosoftReturn | null {
    const q = new URLSearchParams(search);
    const ms = q.get("ms");
    if (ms === "ok") return { status: "ok" };
    if (ms === "error") return { status: "error", reason: (q.get("reason") ?? "").slice(0, 64) || "unknown" };
    return null;
}

/** The same URL (path + remaining query + hash) without `ms` / `reason` — for `history.replaceState`. */
export function stripMicrosoftReturn(href: string): string {
    const u = new URL(href, "http://localhost");
    u.searchParams.delete("ms");
    u.searchParams.delete("reason");
    const q = u.searchParams.toString();
    return `${u.pathname}${q ? `?${q}` : ""}${u.hash}`;
}

/* ------------------------------------------------------------------ mock email simulation */

function companyFor(taxId: string): Company {
    const known = MY_COMPANIES.find((c) => c.taxId === taxId);
    if (known) return known;
    const conn = getState().connections.find((c) => c.taxId === taxId);
    return { taxId, name: conn?.companyName ?? taxId, address: "", username: taxId, label: conn?.label ?? "" };
}

/**
 * Demo helper behind "Mô phỏng nhận 1 email" (mock mode only — the button does not exist in api
 * mode): one email with an invoice XML attached, imported with the same de-dup rule as every
 * other channel (§3.2). Every third email re-sends an invoice that is still missing its XML, so
 * the "Ghép vào HĐ có sẵn" result shows up too.
 */
export async function simulateIncomingEmail(taxId: string, via?: string): Promise<EmailMessage> {
    if (DATA_SOURCE === "api") throw new WeInvoiceApiError("WBE_CLIENT_MOCK_ONLY", "Simulated email is not available against the backend.");
    const st = getState();
    const company = companyFor(taxId);
    const seq = st.emails.length;
    const missingXml = st.invoices.find((i) => i.direction === "purchase" && i.buyerTaxId === taxId && !isNoCode(i) && !hasFile(i, "xml"));
    const source = seq % 3 === 1 && missingXml ? missingXml : makeInvoice(company, SUPPLIERS[seq % SUPPLIERS.length], "purchase", new Date().toISOString().slice(0, 10));
    const raw = buildInvoiceXml(source);
    const fileName = `${source.sellerTaxId}_${source.templateNo}${source.symbol}_${source.number}.xml`;
    const res = await importParsed(parseInvoiceXml(raw), raw, fileName, taxId, "email");
    const msg: EmailMessage = {
        id: `mail-${Date.now()}`,
        receivedAt: new Date().toISOString(),
        from: via ?? `hoadon@${source.sellerTaxId}.example`,
        subject: `Hoá đơn điện tử số ${source.number} - ${source.sellerName}`,
        attachments: [fileName],
        result: res.outcome === "foreign" ? "no_invoice" : res.outcome === "merged" ? "matched" : res.outcome,
        invoiceRef: res.outcome === "foreign" ? undefined : res.invoice.id,
    };
    setState((s) => {
        s.emails.unshift(msg);
    });
    return msg;
}
