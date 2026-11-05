/*
 * Mailbox connections + email intake (screens 07 · 08).
 *
 * api mode (DATA_SOURCE === "api") — backend interface-specification § "Mail, uploads" (DTOs
 * `EmailMessageItem`, `EmailAddressResponse`):
 *   GET /email/messages?company_mst=&from=&to=&result=&page=&size= → loadEmails     (store.emails)
 *   GET /email/address?company_mst=                                → getEmailAddress
 *   GET /email/messages/{id} exists but is not used: screen 07 has no mail detail view.
 * Mailbox connections (`/mailboxes/*`, Gmail App Password / Outlook OAuth) are NOT part of the
 * published P1 API: in api mode nothing here calls HTTP for them — `loadMailboxes` resolves with an
 * empty list, the mutations refuse with `WBE_CLIENT_NOT_ON_SERVER`, and the screens show a "not
 * available on the server yet" state (`mailboxesAvailable()`).
 *
 * mock mode (default) — unchanged: nothing talks to Gmail / Microsoft; connecting only validates
 * the input format and records the mailbox; the app password is checked for shape and then dropped
 * — it is NEVER written to the store or returned (§3.10). Incoming emails are simulated by
 * generating a fictional invoice XML for the working MST and running it through the shared de-dup
 * import (§3.2).
 */

import { getInvoice, importParsed } from "@/lib/api/weinvoice/invoices";
import { MY_COMPANIES, SUPPLIERS, makeInvoice, type Company, type Mailbox } from "@/lib/api/weinvoice/mockData";
import { WeInvoiceApiError, wiGet } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState, setState } from "@/lib/api/weinvoice/store";
import type { EmailMessage } from "@/lib/weinvoice/types";
import { hasFile, isNoCode } from "@/lib/weinvoice/types";
import { buildInvoiceXml, parseInvoiceXml } from "@/lib/weinvoice/xml";
import { sleep } from "@/lib/utils";

export type MailProvider = Mailbox["provider"];

export function validateMailAddress(a: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.trim());
}

/** Google App Password: 16 letters, optionally typed as 4 groups separated by spaces. */
export function validateAppPassword(pw: string): boolean {
    return /^[A-Za-z]{16}$/.test(pw.replace(/\s+/g, ""));
}

type ConnectStep = "server" | "login" | "inbox";

/* ------------------------------------------------------------------ api mode */

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

/** Mailbox connections exist only in mock mode — `/mailboxes/*` is not in the published API. */
export const mailboxesAvailable = (): boolean => DATA_SOURCE !== "api";

const notOnServer = () => new WeInvoiceApiError("WBE_CLIENT_NOT_ON_SERVER", "Mailbox connections are not available on the server yet.");

/** API mode: no endpoint → an empty list, no HTTP call. No-op in mock mode. */
export async function loadMailboxes(): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    setState((s) => {
        s.mailboxes = [];
    });
}

/* ------------------------------------------------------------------ public API */

/**
 * Mock rules so the error paths can be demoed:
 *  - an app password containing "sai" → Gmail rejects the sign-in ("auth");
 *  - an address containing "noimap" → IMAP disabled ("imap_off").
 * API mode: refused without an HTTP call (not in the published API).
 */
export async function connectMailbox(
    p: { taxId: string; provider: MailProvider; address: string; appPassword?: string },
    onStep?: (s: ConnectStep) => void,
): Promise<{ ok: true; box: Mailbox } | { ok: false; error: "auth" | "imap_off" }> {
    const address = p.address.trim();
    if (DATA_SOURCE === "api") throw notOnServer();
    onStep?.("server");
    await sleep(500);
    if (p.provider === "gmail" && /noimap/i.test(address)) return { ok: false, error: "imap_off" };
    onStep?.("login");
    await sleep(600);
    if (p.provider === "gmail" && (!p.appPassword || !validateAppPassword(p.appPassword) || /sai/i.test(p.appPassword))) return { ok: false, error: "auth" };
    onStep?.("inbox");
    await sleep(400);
    const box: Mailbox = {
        id: `mbx-${Date.now()}`,
        taxId: p.taxId,
        provider: p.provider,
        address,
        method: p.provider === "gmail" ? "imap_app_password" : "oauth_graph",
        connectedAt: new Date().toISOString(),
    };
    // Only the mailbox metadata is kept — never the app password / token (§3.10).
    setState((s) => {
        s.mailboxes = [...(s.mailboxes ?? []).filter((m) => !(m.taxId === p.taxId && m.provider === p.provider)), box];
    });
    return { ok: true, box };
}

export async function disconnectMailbox(id: string): Promise<void> {
    if (DATA_SOURCE === "api") throw notOnServer();
    await sleep(200);
    setState((s) => {
        s.mailboxes = (s.mailboxes ?? []).filter((m) => m.id !== id);
    });
}

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

/** "Quét ngay": stamps the scan time and picks up one new email for the mailbox's MST. */
export async function scanMailbox(id: string): Promise<{ found: number }> {
    if (DATA_SOURCE === "api") throw notOnServer();
    const box = (getState().mailboxes ?? []).find((m) => m.id === id);
    if (!box) return { found: 0 };
    await sleep(900);
    const msg = await simulateIncomingEmail(box.taxId);
    setState((s) => {
        const m = (s.mailboxes ?? []).find((x) => x.id === id);
        if (m) m.lastScanAt = new Date().toISOString();
    });
    return { found: msg.invoiceRef && getInvoice(msg.invoiceRef) ? 1 : 0 };
}
