/*
 * Invoice data access (screens 04 "Hoá đơn mua vào / bán ra" and 05 "Chi tiết hoá đơn").
 *
 *  - mock (default): works over the in-memory store seeded from mockData.ts.
 *  - api (DATA_SOURCE === "api"): the store is a client cache. `loadInvoices` fills it from
 *    `GET /invoices`; `loadInvoiceDetail` merges `GET /invoices/{id}`; every mutation calls its
 *    endpoint FIRST and updates the store from the response (errors throw WeInvoiceApiError).
 *    Contract: backend interface specification § "Invoices (screens 04, 05)" + DTOs `InvoiceRow`,
 *    `InvoiceDetail`, `InvoiceFileItem`, `IncompletePeriod`, `FileUploadResult`, `FetchXmlResult`,
 *    `LookupCodeRequest`, `UploadResponse` (we-scraping-api `domain/weinvoice/dto`, published 2026-11-05).
 *
 * Signatures are the UI Spec v1.0 "join points" — screens do not change between the two modes.
 *
 * Business rules implemented here (02_Yeu_cau_nghiep_vu.md):
 *  §3.1 direction & working MST · §3.2 de-dup key (seller MST + template +
 *  symbol + number without leading zeros) · §3.3 K / M invoice kinds ·
 *  §3.4 provider from <MSTTCGP> + lookup link.
 */

import {
    invoiceKey,
    isCashRegister,
    isNoCode,
    type Direction,
    type Invoice,
    type InvoiceFile,
    type InvoiceSource,
    type InvoiceStatus,
} from "@/lib/weinvoice/types";
import { findProvider, originalInvoiceUrl } from "@/lib/weinvoice/providers";
import { buildInvoiceXml, type ParsedXml } from "@/lib/weinvoice/xml";
import { getState, setState } from "@/lib/api/weinvoice/store";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { WeInvoiceApiError, waitForRequest, wiDelete, wiDownload, wiGet, wiPost, wiPut, wiUpload, type EngineRequest } from "@/lib/api/weinvoice/http";
import { downloadBlob, sleep } from "@/lib/utils";

export type FileFilter = "all" | "has" | "missing";

export type InvoiceQuery = {
    taxId: string;
    direction: Direction;
    from: string; // yyyy-mm-dd
    to: string;
    keyword?: string;
    missingXmlOnly?: boolean;
    xml?: FileFilter;
    pdf?: FileFilter;
    statuses?: InvoiceStatus[]; // empty = all
    kind?: "all" | "normal" | "cash_register" | "no_code";
    tagIds?: string[];

    provider?: string;
    excludeTaxIds?: string[];
    sort?: { field: SortField; dir: "asc" | "desc" };
    page: number; // 1-based (UI) — API will be 0-based like WeCMS
    size: number;
};

export type SortField = "issueDate" | "number" | "partner" | "preTax" | "tax" | "total";

export type InvoiceKpis = {
    count: number;
    preTax: number;
    tax: number;
    total: number;
    missingXml: number;
    missingPdf: number;
    salesCount: number;
    purchaseCount: number;
    salesTotal: number;
    purchaseTotal: number;
};

export type InvoicePage = {
    rows: Invoice[];
    totalCount: number;
    kpis: InvoiceKpis;

    allIds: string[];
};

export function partnerOf(inv: Invoice) {
    return inv.direction === "purchase"
        ? { taxId: inv.sellerTaxId, name: inv.sellerName }
        : { taxId: inv.buyerTaxId, name: inv.buyerName };
}

function companyInvoices(taxId: string): Invoice[] {
    return getState().invoices.filter((i) => (i.direction === "purchase" ? i.buyerTaxId : i.sellerTaxId) === taxId);
}

/** Catalogue key of the issuing provider (its tax ID), "" when unknown. */
export function providerKeyOf(inv: Invoice): string {
    const x = inv as ApiInvoice;
    // api mode: the backend says whether it knows the provider (`provider_known`), keyed by its MST.
    if (x.providerKnown !== undefined) return x.providerKnown ? (inv.providerTaxId ?? "") : "";
    if (inv.providerTaxId && findProvider(inv.providerTaxId)) return inv.providerTaxId;
    return findProvider(inv.provider)?.taxId ?? "";
}

/** Provider requires a lookup code the XML did not carry (e.g. BKAV) → "!" pill, manual entry (§3.4). */
export function needsLookupCode(inv: Invoice): boolean {
    // api mode: list rows carry no lookup code — the backend flag (`needs_lookup_code` / `lookup.needs_code`) decides.
    const flag = (inv as ApiInvoice).needsLookupCode;
    if (typeof flag === "boolean") return flag;
    return !!providerKeyOf(inv) && !inv.lookupCode;
}

/** Whether the file record may offer "delete" (§3.5): api mode → backend `deletable`; mock → user uploads / email files. */
export function isDeletableFile(f: InvoiceFile): boolean {
    const flag = (f as ApiFile).deletable;
    if (typeof flag === "boolean") return flag;
    return f.origin === "upload" || f.origin === "email";
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
const hasKind = (inv: Invoice, kind: InvoiceFile["kind"]) => inv.files.some((f) => f.kind === kind);

export function filterInvoices(q: Omit<InvoiceQuery, "page" | "size">): Invoice[] {
    const kw = q.keyword ? fold(q.keyword.trim()) : "";
    const rows = companyInvoices(q.taxId).filter((i) => {
        if (i.direction !== q.direction) return false;
        if (i.issueDate < q.from || i.issueDate > q.to) return false;
        if (q.missingXmlOnly && (hasKind(i, "xml") || !i.cqtCode)) return false;
        if (q.xml === "has" && !hasKind(i, "xml")) return false;
        if (q.xml === "missing" && hasKind(i, "xml")) return false;
        if (q.pdf === "has" && !hasKind(i, "pdf")) return false;
        if (q.pdf === "missing" && hasKind(i, "pdf")) return false;
        if (q.statuses?.length && !q.statuses.includes(i.status)) return false;
        if (q.kind === "cash_register" && !isCashRegister(i)) return false;
        if (q.kind === "no_code" && !isNoCode(i)) return false;
        if (q.kind === "normal" && (isCashRegister(i) || isNoCode(i))) return false;
        if (q.tagIds?.length && !q.tagIds.some((t) => i.tags.includes(t))) return false;
        if (q.provider && q.provider !== "all") {
            const k = providerKeyOf(i);
            if (q.provider === "__none" ? !!k : q.provider === "__needcode" ? !needsLookupCode(i) : k !== q.provider) return false;
        }
        if (q.excludeTaxIds?.length && q.excludeTaxIds.includes(partnerOf(i).taxId)) return false;
        if (kw) {
            const p = partnerOf(i);
            const hay = fold([i.number, String(Number(i.number)), i.symbol, `${i.templateNo}${i.symbol}`, p.taxId, p.name, i.cqtCode, i.lookupCode, ...i.items.map((x) => x.name)].join(" "));
            if (!hay.includes(kw)) return false;
        }
        return true;
    });
    const sort = q.sort ?? { field: "issueDate" as SortField, dir: "desc" as const };
    const val = (i: Invoice): string | number =>
        sort.field === "issueDate" ? i.issueDate + i.number : sort.field === "number" ? Number(i.number) : sort.field === "partner" ? partnerOf(i).name : i[sort.field];
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
        const x = val(a);
        const y = val(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
}

/** Cancelled / replaced invoices do not count toward amounts. */
const counts = (i: Invoice) => i.status !== "cancelled" && i.status !== "replaced";

/**
 * Amount in VND for KPIs (backend rule: foreign-currency invoices × their exchange rate). API rows carry
 * `total_vnd` / `exchange_rate`; mock invoices are all VND (rate 1).
 */
function toVnd(i: Invoice, field: "preTax" | "tax" | "total"): number {
    const x = i as ApiInvoice;
    if (field === "total" && x.totalVnd != null) return x.totalVnd;
    const rate = i.currency !== "VND" && x.exchangeRate ? x.exchangeRate : 1;
    return i[field] * rate;
}

export function kpisFor(taxId: string, from: string, to: string, rows: Invoice[]): InvoiceKpis {
    const live = rows.filter(counts);
    const all = companyInvoices(taxId).filter((i) => i.issueDate >= from && i.issueDate <= to && counts(i));
    const sales = all.filter((i) => i.direction === "sales");
    const purchase = all.filter((i) => i.direction === "purchase");
    const sum = (xs: Invoice[], f: (i: Invoice) => number) => xs.reduce((s, i) => s + f(i), 0);
    return {
        count: rows.length,
        preTax: sum(live, (i) => toVnd(i, "preTax")),
        tax: sum(live, (i) => toVnd(i, "tax")),
        total: sum(live, (i) => toVnd(i, "total")),
        missingXml: rows.filter((i) => i.cqtCode && !hasKind(i, "xml")).length,
        missingPdf: rows.filter((i) => !hasKind(i, "pdf")).length,
        salesCount: sales.length,
        purchaseCount: purchase.length,
        salesTotal: sum(sales, (i) => toVnd(i, "total")),
        purchaseTotal: sum(purchase, (i) => toVnd(i, "total")),
    };
}

/**
 * Client-side over the cached store in BOTH modes. The spec also offers server-side filtering
 * (`GET /invoices` with every filter, `/invoices/facets`, `/invoices/ids`), but the list screen calls
 * filterInvoices / kpisFor synchronously; in api mode `loadInvoices` caches the whole year for the
 * working MST, so the screen keeps reading the cache instead of becoming an async list.
 */
export async function listInvoices(q: InvoiceQuery): Promise<InvoicePage> {
    const rows = filterInvoices(q);
    return {
        rows: rows.slice((q.page - 1) * q.size, q.page * q.size),
        totalCount: rows.length,
        kpis: kpisFor(q.taxId, q.from, q.to, rows),
        allIds: rows.map((r) => r.id),
    };
}

export function getInvoice(id: string): Invoice | undefined {
    return getState().invoices.find((i) => i.id === id);
}

export function getInvoices(ids: string[]): Invoice[] {
    const set = new Set(ids);
    return getState().invoices.filter((i) => set.has(i.id));
}

function patchInvoice(id: string, fn: (inv: Invoice) => void) {
    setState((s) => {
        const inv = s.invoices.find((i) => i.id === id);
        if (inv) fn(inv);
    });
}

export async function setTags(ids: string[], tagId: string, on: boolean): Promise<void> {
    if (DATA_SOURCE === "api") await wiPut("/invoices/tags", { ids, tagId, on });
    const set = new Set(ids);
    setState((s) => {
        for (const inv of s.invoices) {
            if (!set.has(inv.id)) continue;
            const has = inv.tags.includes(tagId);
            if (on && !has) inv.tags.push(tagId);
            if (!on && has) inv.tags = inv.tags.filter((t) => t !== tagId);
        }
    });
}

/** `confirm` values of POST /invoices/{id}/files — repeatable: every answer given so far is resent. */
export type AddFileConfirm = "attach_anyway" | "replace";
/**
 * `needsConfirm` carries the backend `reasons[]` (spec § "Upload rules"): `pdf_not_matched` (answer
 * `attach_anyway`), `pdf_exists` (`replace`), `xml_key_mismatch` (`attach_anyway`). `duplicate` = the
 * record already has an XML. Mock mode always answers `{ ok: true }`.
 */
export type AddFileResult = { ok: true } | { ok: false; needsConfirm: string[] } | { ok: false; duplicate: true };

const mergeFile = (inv: Invoice, file: InvoiceFile) => {
    inv.files = [...inv.files.filter((f) => f.kind === "attachment" || f.kind !== file.kind), file];
};

/**
 * Adds a file to the record; a new PDF / XML replaces the previous one of the same kind (§3.5).
 * api mode: `POST /invoices/{id}/files` (multipart `kind`, `file`, `confirm` repeated) with `opts.blob`
 * (or the XML `content`). `ok` stores the returned `file`; a matching XML also returns a `request_id`
 * (engine import) — the record is reloaded when that request finishes.
 */
export async function addFile(id: string, file: InvoiceFile, opts: { blob?: Blob; confirm?: AddFileConfirm[] } = {}): Promise<AddFileResult> {
    if (DATA_SOURCE === "api") {
        const blob = opts.blob ?? (file.content !== undefined ? new Blob([file.content], { type: "application/xml" }) : undefined);
        if (!blob) throw new WeInvoiceApiError("WBE_CLIENT_NO_FILE", "No file content to upload.");
        const form = new FormData();
        form.append("kind", file.kind);
        form.append("file", blob instanceof File ? blob : new File([blob], file.name, { type: blob.type }));
        for (const c of new Set(opts.confirm ?? [])) form.append("confirm", c);
        const res = await wiUpload<FileUploadResultWire | null>(`/invoices/${encodeURIComponent(id)}/files`, form);
        if (res?.status === "needs_confirm") return { ok: false, needsConfirm: res.reasons ?? [] };
        if (res?.status === "duplicate") return { ok: false, duplicate: true };
        if (res?.file) {
            const stored = normalizeFile(res.file);
            patchInvoice(id, (inv) => mergeFile(inv, stored));
            // The server decides the final file list (an uploaded PDF replaces the provider PDF, the GDT copy
            // drops out): reload it now so the record and the viewer follow without reopening the modal. An XML
            // handed to the engine (request_id) is reloaded when that request ends instead.
            if (!res.requestId) void loadInvoiceDetail(id).catch(() => undefined);
        } else await loadInvoiceDetail(id);
        if (res?.requestId) followRequest(id, res.requestId);
        return { ok: true };
    }
    patchInvoice(id, (inv) => mergeFile(inv, file));
    return { ok: true };
}

/**
 * Lookup code typed by the user (code or whole link). api mode: `PUT /invoices/{id}/lookup-code`
 * `{code, company_code?}` → `{request_id, subject}` — the backend saves the code and queues a PDF fetch
 * with it. The record is reloaded at once (the code is saved) and again when the engine request ends;
 * the caller is not held for the PDF fetch (it stays `queued` until the engine worker picks it up).
 */
export async function setLookupCode(id: string, code: string, companyCode?: string): Promise<void> {
    if (DATA_SOURCE === "api") {
        const res = await wiPut<RequestAcceptedWire | null>(`/invoices/${encodeURIComponent(id)}/lookup-code`, { code: code.trim(), companyCode: companyCode || undefined });
        patchInvoice(id, (inv) => {
            inv.lookupCode = code.trim();
        });
        // Best effort: the PUT succeeded; a failed re-read must not report the save as failed.
        await loadInvoiceDetail(id).catch(() => undefined);
        if (res?.requestId) followRequest(id, res.requestId);
        return;
    }
    patchInvoice(id, (inv) => {
        inv.lookupCode = code.trim();
    });
}

/** Only files the user uploaded / received by email may be removed (§3.5); api mode: the backend decides (`WBE3007`). */
export async function removeFile(id: string, fileId: string): Promise<void> {
    const inv = getInvoice(id);
    const f = inv?.files.find((x) => x.id === fileId);
    if (!f) return;
    if (DATA_SOURCE === "api") await wiDelete(`/invoices/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`);
    else if (!isDeletableFile(f)) throw new Error("protected_file");
    patchInvoice(id, (x) => {
        x.files = x.files.filter((y) => y.id !== fileId);
    });
}

/** XML of the record: the uploaded original when we have it, otherwise a rendering of the record. */
export function xmlContent(inv: Invoice): string | null {
    const f = inv.files.find((x) => x.kind === "xml");
    if (!f) return null;
    return f.content ?? buildInvoiceXml(inv);
}

/**
 * Save one file of the record. api mode: `GET /invoices/{id}/files/{file_id}` (any kind). mock: the XML
 * text (`xmlContent`) — PDFs are opened through their object URL instead.
 */
export async function downloadInvoiceFile(inv: Invoice, file: InvoiceFile): Promise<void> {
    if (DATA_SOURCE === "api") {
        const { blob, fileName } = await wiDownload("get", `/invoices/${encodeURIComponent(inv.id)}/files/${encodeURIComponent(file.id)}`, { fallbackName: file.name });
        downloadBlob(blob, fileName);
        return;
    }
    const x = file.kind === "xml" ? (file.content ?? xmlContent(inv)) : null;
    if (x) downloadBlob(new Blob([x], { type: "application/xml" }), file.name);
}

/**
 * api mode: the file as a session object URL (for the PDF viewer). The backend `url` is an API path
 * that needs the Bearer token, so it cannot be used as an `<iframe src>`; the caller revokes the URL.
 */
export async function invoiceFileObjectUrl(invoiceId: string, file: Pick<InvoiceFile, "id" | "name" | "kind">): Promise<string> {
    const { blob } = await wiDownload("get", `/invoices/${encodeURIComponent(invoiceId)}/files/${encodeURIComponent(file.id)}`, { fallbackName: file.name });
    return URL.createObjectURL(file.kind === "pdf" ? new Blob([blob], { type: "application/pdf" }) : blob);
}

/** PDFs the viewer tries, in order: uploaded → provider original → GDT copy; files the server lacks are left out. */
export function pdfCandidates(inv: Pick<Invoice, "files" | "gdtPdf">): InvoiceFile[] {
    const pdfs = inv.files.filter((f) => f.kind === "pdf" && !f.missing);
    const ordered = [...pdfs.filter((f) => f.origin === "upload"), ...pdfs.filter((f) => f.origin !== "upload")];
    return inv.gdtPdf && !inv.gdtPdf.missing ? [...ordered, inv.gdtPdf] : ordered;
}

/** "0106111222_1C26THH_00000123" — base name shared by every file of the record. */
export function fileBaseName(inv: Invoice): string {
    return `${inv.sellerTaxId}_${inv.templateNo}${inv.symbol}_${inv.number}`;
}

/** Fetch the GDT XML for invoices that have a GDT code but no XML yet (mock: ~0.3 s each). */
export async function fetchMissingXml(ids: string[], onProgress?: (done: number) => void): Promise<{ fetched: number; skippedNoCode: number }> {
    if (DATA_SOURCE === "api") {
        // `{company_mst, ids}` → `{queued, skipped_no_code, skipped_other, request_id}`; no request when nothing is fetchable.
        const companyMst = getState().activeTaxId || workingMstOf(ids);
        const res = await wiPost<FetchXmlResultWire | null>("/invoices/fetch-missing-xml", { companyMst, ids });
        const queued = res?.queued ?? 0;
        if (res?.requestId) {
            // OPEN: the spec does not name the `progress{}` keys of a fetch_xml request — `done` is read when present.
            const r = await waitForRequest(res.requestId, (p) => {
                const done = Number(p.progress?.done);
                if (Number.isFinite(done)) onProgress?.(Math.min(done, ids.length));
            });
            if (!FINISHED.has(r.status)) throw requestFailure(r);
            await reloadInvoicesOf(companyMst, ids);
        }
        onProgress?.(ids.length);
        return { fetched: queued, skippedNoCode: res?.skippedNoCode ?? 0 };
    }
    let fetched = 0;
    let skippedNoCode = 0;
    let done = 0;
    for (const id of ids) {
        const inv = getInvoice(id);
        if (inv && !inv.cqtCode) skippedNoCode++;
        else if (inv && !hasKind(inv, "xml")) {
            await sleep(250);
            const now = new Date().toISOString();
            await addFile(id, { id: `${id}-xml-${Date.now()}`, kind: "xml", name: `${fileBaseName(inv)}.xml`, size: 9_000, origin: "gdt", addedAt: now });
            fetched++;
        }
        onProgress?.(++done);
    }
    return { fetched, skippedNoCode };
}

export type ImportOutcome = "new" | "merged" | "duplicate";

/** De-dup import used by upload / email / XML viewer (§3.2). */
export async function importParsed(
    parsed: ParsedXml,
    raw: string,
    fileName: string,
    activeTaxId: string,
    source: "upload" | "email",
): Promise<{ outcome: ImportOutcome; invoice: Invoice } | { outcome: "foreign" }> {
    if (DATA_SOURCE === "api") return importViaUpload(raw, fileName, activeTaxId);
    const managed = new Set(getState().connections.map((c) => c.taxId));
    const direction: Direction | null =
        parsed.buyerTaxId === activeTaxId ? "purchase" : parsed.sellerTaxId === activeTaxId ? "sales" : managed.has(parsed.buyerTaxId) ? "purchase" : managed.has(parsed.sellerTaxId) ? "sales" : null;
    if (!direction) return { outcome: "foreign" };

    const now = new Date().toISOString();
    const xmlFile: InvoiceFile = { id: `xml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind: "xml", name: fileName, size: raw.length, origin: source, addedAt: now, content: raw };
    const key = invoiceKey(parsed);
    const existing = getState().invoices.find((i) => invoiceKey(i) === key);
    if (existing) {
        if (hasKind(existing, "xml")) return { outcome: "duplicate", invoice: existing };
        await addFile(existing.id, xmlFile);
        return { outcome: "merged", invoice: getInvoice(existing.id)! };
    }
    const provider = findProvider(parsed.providerTaxId ?? parsed.provider);
    const invoice: Invoice = {
        ...parsed,
        id: `inv-u${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        direction,
        status: parsed.status ?? ("original" as InvoiceStatus),
        provider: provider?.name ?? parsed.provider ?? "",
        providerTaxId: provider?.taxId ?? parsed.providerTaxId,
        lookupCode: parsed.lookupCode ?? "",
        lookupUrl: provider?.lookupUrl ?? "",
        files: [xmlFile],
        tags: [],
        source,
        syncedAt: now,
    };
    setState((s) => {
        s.invoices.unshift(invoice);
    });
    return { outcome: "new", invoice };
}

/** Link behind the ↗ on the provider pill: the original invoice when possible, else the provider lookup page (§3.4). */
export function lookupHref(inv: Invoice): { url: string; direct: boolean } {
    // api mode (detail loaded): the backend resolved the link — `lookup{url, direct}`.
    const direct = (inv as ApiInvoice).lookupDirect;
    if (direct !== undefined && inv.lookupUrl) return { url: inv.lookupUrl, direct };
    const key = providerKeyOf(inv);
    const hit = originalInvoiceUrl(key, inv.lookupCode, { company: inv.lookupCompany ?? inv.sellerTaxId, sellerTaxId: inv.sellerTaxId, buyerTaxId: inv.buyerTaxId, number: inv.number });
    if (hit) return hit;
    return { url: inv.lookupUrl || findProvider(key)?.lookupUrl || "", direct: false };
}

/* ======================================================================================
 * API mode — wire shapes (camelCase after wire.ts camelize) and loaders.
 * Source: interface specification § "Invoices (screens 04, 05)" + the Java DTOs named below.
 * ==================================================================================== */

/** `InvoiceRow` — one list row. Amounts: `total` in the invoice currency, `total_vnd` = total × `exchange_rate`. */
type InvoiceRowWire = {
    id: string;
    direction: Direction;
    issueDate: string;
    templateNo: string | null;
    symbol: string | null;
    number: string | null;
    sellerTaxId: string | null;
    sellerName: string | null;
    buyerTaxId: string | null;
    buyerName: string | null;
    partnerTaxId?: string | null;
    partnerName?: string | null;
    currency: string | null;
    exchangeRate?: number | null;
    preTax: number | null;
    tax: number | null;
    total: number | null;
    totalVnd?: number | null;
    status: InvoiceStatus;
    kind?: "normal" | "cash_register" | "no_code" | null;
    cqtCode: string | null;
    provider: string | null;
    providerTaxId: string | null;
    providerKnown: boolean;
    hasXml: boolean;
    hasPdf: boolean;
    needsLookupCode: boolean;
    tagIds: string[] | null;
    source: InvoiceSource | null;
    syncedAt: string | null;
};

/** `IncompletePeriod` — a month whose GDT list was only partly fetched. */
type IncompletePeriodWire = { month: string; got: number | null; total: number | null };

/** `InvoiceListResponse` — page `{rows, total_count, page, size}` + `kpis` (`InvoiceKpis`, VND) + `incomplete_periods`. */
type InvoiceListWire = {
    rows: InvoiceRowWire[] | null;
    totalCount: number;
    page: number;
    size: number;
    kpis?: unknown;
    incompletePeriods?: IncompletePeriodWire[] | null;
};

/** `InvoiceFileItem` — origin gdt · vendor · email · upload; `url` is an authenticated API path. */
type InvoiceFileWire = {
    id: string;
    /** `pdf_gdt` = the GDT copy of the PDF (printed from the GDT view page), listed only while there is no provider original. */
    kind: InvoiceFile["kind"] | "pdf_gdt";
    name: string | null;
    size: number | null;
    origin: InvoiceFile["origin"] | null;
    addedAt: string | null;
    deletable: boolean;
    url?: string | null;
};

type PartyWire = { taxId?: string | null; name?: string | null; address?: string | null };

/** `InvoiceDetail.Item` — `vat_rate`: 0 / 5 / 8 / 10, −1 = KCT, −2 = KKKNT, other percentages as their number. */
type InvoiceItemWire = {
    lineNo: number;
    lineKind?: number | null;
    code?: string | null;
    name: string | null;
    unit: string | null;
    qty: number | null;
    price: number | null;
    discount?: number | null;
    amount: number | null;
    vatRate: number | null;
    vatRateLabel?: string | null;
    taxAmount?: number | null;
};

/** `InvoiceDetail` — the row fields (party data under `seller` / `buyer`) plus the full record. */
type InvoiceDetailWire = {
    id: string;
    companyMst?: string;
    direction: Direction;
    issueDate: string;
    templateNo: string | null;
    symbol: string | null;
    number: string | null;
    seller?: PartyWire | null;
    buyer?: PartyWire | null;
    currency: string | null;
    exchangeRate?: number | null;
    preTax: number | null;
    tax: number | null;
    total: number | null;
    totalVnd?: number | null;
    paymentMethod?: string | null;
    status: InvoiceStatus;
    relatedId?: string | null;
    cqtCode: string | null;
    provider: string | null;
    providerTaxId: string | null;
    providerKnown: boolean;
    lookup?: { code?: string | null; companyCode?: string | null; url?: string | null; direct?: boolean; manual?: boolean; needsCode?: boolean } | null;
    items?: InvoiceItemWire[] | null;
    files?: InvoiceFileWire[] | null;
    tagIds?: string[] | null;
    source: InvoiceSource | null;
    syncedAt: string | null;
};

/** `FileUploadResult` of `POST /invoices/{id}/files`. */
type FileUploadResultWire = { status: "ok" | "needs_confirm" | "duplicate"; reasons: string[] | null; file: InvoiceFileWire | null; requestId: string | null };

/** `RequestAccepted` — engine work queued. */
type RequestAcceptedWire = { requestId: string; subject?: string | null };

/** `FetchXmlResult` of `POST /invoices/fetch-missing-xml`. */
type FetchXmlResultWire = { queued: number; skippedNoCode: number; skippedOther: number; requestId: string | null };

/** `UploadResponse` of `POST /uploads` and `GET /uploads/{upload_id}` (only the fields read here). */
type UploadResponseWire = {
    uploadId: string;
    status?: string | null;
    error?: string | null;
    files: { fileNo: number; name: string; outcome: "new" | "merged" | "duplicate" | "foreign" | "error" | "pdf_pending" | null; message?: string | null; invoiceId?: string | null }[] | null;
};

/**
 * Backend fields with no slot in the UI `Invoice` type (lib/weinvoice/types.ts is not edited here).
 * They ride along on the cached record (structuredClone keeps them) and are read through this type.
 */
export type ApiInvoice = Invoice & {
    providerKnown?: boolean;
    needsLookupCode?: boolean;
    lookupDirect?: boolean;
    exchangeRate?: number | null;
    totalVnd?: number | null;
};
type ApiFile = InvoiceFile & { deletable?: boolean };

/** `size` max 200 (spec § Conventions → Paging). */
const INVOICE_PAGE_SIZE = 200;
const UPLOAD_POLL_MS = 1000;
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
/** Finished engine-request states (`partial` = finished with some failures). */
const FINISHED = new Set<EngineRequest["status"]>(["done", "partial"]);

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const str = (v: string | null | undefined) => v ?? "";
/** The UI type knows −1 (KCT) only; KKKNT (−2) is shown as KCT, as lib/weinvoice/xml.ts already does for uploaded XML. */
const vatRateOf = (v: number | null | undefined) => (v === null || v === undefined ? 0 : v < 0 ? -1 : Number(v));

/** Engine request that ended failed / cancelled → WeInvoiceApiError (`error` is the backend text). */
export function requestFailure(r: EngineRequest): WeInvoiceApiError {
    return new WeInvoiceApiError(`WBE_REQUEST_${String(r.status).toUpperCase()}`, r.error || r.status);
}

function normalizeFile(f: InvoiceFileWire): ApiFile {
    // `url` is dropped on purpose: it needs the Bearer token — files are fetched through wiDownload.
    return {
        id: String(f.id ?? ""),
        kind: f.kind === "pdf_gdt" ? "pdf" : (f.kind ?? "attachment"),
        name: str(f.name),
        size: num(f.size),
        origin: f.origin ?? "upload",
        addedAt: str(f.addedAt),
        deletable: !!f.deletable,
        // Engine file the DB points at but the server's disk does not have (e.g. fetched by another machine).
        ...(f.size === null || f.size === undefined ? { missing: true } : {}),
    };
}

/** The GDT copy of the PDF is kept apart from `files` so it never counts as "has PDF" (KPIs, filters, fetch button). */
function gdtPdfOf(files: InvoiceFileWire[] | null | undefined): { gdtPdf?: InvoiceFile } {
    const f = (files ?? []).find((x) => x.kind === "pdf_gdt");
    return f ? { gdtPdf: { ...normalizeFile(f), origin: "gdt" } } : {};
}

/**
 * `InvoiceRow` carries no file list: `has_xml` / `has_pdf` become marker files so `hasFile()` and the
 * XML / PDF columns keep working. Their ids are the backend ids of the engine copies (`xml` / `pdf`);
 * the real list (uploads included) arrives with the detail.
 */
const markerFiles = (r: InvoiceRowWire): ApiFile[] => [
    ...(r.hasXml ? [{ id: "xml", kind: "xml" as const, name: "", size: 0, origin: "gdt" as const, addedAt: "", deletable: false }] : []),
    ...(r.hasPdf ? [{ id: "pdf", kind: "pdf" as const, name: "", size: 0, origin: "vendor" as const, addedAt: "", deletable: false }] : []),
];

/**
 * Wire row → cached Invoice. Detail-only fields (items, addresses, lookup code, the real file list)
 * of a record already opened are kept while they still agree with the row (same XML / PDF presence).
 */
function fromRow(r: InvoiceRowWire, prev?: Invoice): ApiInvoice {
    const files = markerFiles(r);
    const sameFiles = !!prev && hasKind(prev, "xml") === r.hasXml && hasKind(prev, "pdf") === r.hasPdf;
    return {
        id: String(r.id),
        direction: r.direction,
        issueDate: r.issueDate,
        templateNo: str(r.templateNo),
        symbol: str(r.symbol),
        number: str(r.number),
        sellerTaxId: str(r.sellerTaxId),
        sellerName: str(r.sellerName),
        sellerAddress: prev?.sellerAddress ?? "",
        buyerTaxId: str(r.buyerTaxId),
        buyerName: str(r.buyerName),
        buyerAddress: prev?.buyerAddress ?? "",
        currency: (r.currency ?? "VND") as Invoice["currency"],
        preTax: num(r.preTax),
        tax: num(r.tax),
        total: num(r.total),
        status: r.status,
        ...(prev?.relatedId ? { relatedId: prev.relatedId } : {}),
        cqtCode: str(r.cqtCode),
        provider: str(r.provider),
        ...(r.providerTaxId ? { providerTaxId: r.providerTaxId } : {}),
        lookupCode: prev?.lookupCode ?? "",
        ...(prev?.lookupCompany ? { lookupCompany: prev.lookupCompany } : {}),
        lookupUrl: prev?.lookupUrl ?? "",
        paymentMethod: prev?.paymentMethod ?? "",
        items: prev?.items ?? [],
        files: sameFiles ? prev!.files : files,
        // The GDT copy only stands in while there is no provider original.
        ...(prev?.gdtPdf && !r.hasPdf ? { gdtPdf: prev.gdtPdf } : {}),
        tags: r.tagIds ?? [],
        source: r.source ?? "gdt",
        syncedAt: str(r.syncedAt),
        providerKnown: !!r.providerKnown,
        needsLookupCode: !!r.needsLookupCode,
        ...((prev as ApiInvoice | undefined)?.lookupDirect !== undefined ? { lookupDirect: (prev as ApiInvoice).lookupDirect } : {}),
        exchangeRate: r.exchangeRate ?? null,
        totalVnd: r.totalVnd ?? null,
    };
}

/** `InvoiceDetail` → cached Invoice (replaces the list row). */
function fromDetail(d: InvoiceDetailWire): ApiInvoice {
    const lookup = d.lookup ?? {};
    return {
        id: String(d.id),
        direction: d.direction,
        issueDate: d.issueDate,
        templateNo: str(d.templateNo),
        symbol: str(d.symbol),
        number: str(d.number),
        sellerTaxId: str(d.seller?.taxId),
        sellerName: str(d.seller?.name),
        sellerAddress: str(d.seller?.address),
        buyerTaxId: str(d.buyer?.taxId),
        buyerName: str(d.buyer?.name),
        buyerAddress: str(d.buyer?.address),
        currency: (d.currency ?? "VND") as Invoice["currency"],
        preTax: num(d.preTax),
        tax: num(d.tax),
        total: num(d.total),
        status: d.status,
        ...(d.relatedId ? { relatedId: String(d.relatedId) } : {}),
        cqtCode: str(d.cqtCode),
        provider: str(d.provider),
        ...(d.providerTaxId ? { providerTaxId: d.providerTaxId } : {}),
        lookupCode: str(lookup.code),
        ...(lookup.companyCode ? { lookupCompany: lookup.companyCode } : {}),
        lookupUrl: str(lookup.url),
        paymentMethod: str(d.paymentMethod),
        // OPEN: `line_kind` (note / discount / promotion lines) has no UI slot — every line is listed as goods.
        items: (d.items ?? []).map((it) => ({ name: str(it.name), unit: str(it.unit), qty: num(it.qty), price: num(it.price), amount: num(it.amount), vatRate: vatRateOf(it.vatRate) })),
        files: (d.files ?? []).filter((f) => f.kind !== "pdf_gdt").map(normalizeFile),
        ...gdtPdfOf(d.files),
        tags: d.tagIds ?? [],
        source: d.source ?? "gdt",
        syncedAt: str(d.syncedAt),
        providerKnown: !!d.providerKnown,
        needsLookupCode: !!lookup.needsCode,
        ...(lookup.url ? { lookupDirect: !!lookup.direct } : {}),
        exchangeRate: d.exchangeRate ?? null,
        totalVnd: d.totalVnd ?? null,
    };
}

const workingTaxIdOf = (i: Invoice) => (i.direction === "purchase" ? i.buyerTaxId : i.sellerTaxId);
const workingMstOf = (ids: string[]) => {
    const inv = ids.map(getInvoice).find(Boolean);
    return inv ? workingTaxIdOf(inv) : "";
};

/** Re-read the list of the years the given (cached) invoices fall in. */
async function reloadInvoicesOf(taxId: string, ids: string[]) {
    const years = new Set(getInvoices(ids).map((i) => Number(i.issueDate.slice(0, 4))).filter((y) => y > 0));
    for (const y of years) await loadInvoices(taxId, y);
}

const followUps = new Set<Promise<unknown>>();
/**
 * Follow an engine request in the background and reload the record when it finishes. Best effort: a
 * failure here only means the record is re-read the next time it is opened.
 */
function followRequest(id: string, requestId: string) {
    const p: Promise<unknown> = waitForRequest(requestId)
        .then(() => loadInvoiceDetail(id))
        .catch(() => undefined)
        .finally(() => followUps.delete(p));
    followUps.add(p);
}
/** Resolves once every background follow-up has settled (tests). */
export async function settleFollowUps(): Promise<void> {
    while (followUps.size) await Promise.all([...followUps]);
}

/**
 * Loader (remote.ts hydration): `GET /invoices` for both directions (`direction` blank) of the working
 * MST, the whole `year`, page by page (0-based `page`, `size` 200) until `total_count`; replaces that
 * MST's invoices in the store and its `incomplete_periods` (`got` → `fetched`). No-op in mock mode.
 */
export async function loadInvoices(taxId: string, year: number): Promise<void> {
    if (DATA_SOURCE !== "api" || !taxId) return;
    const rows: InvoiceRowWire[] = [];
    const periods = new Map<string, IncompletePeriodWire>();
    let sawPeriods = false;
    for (let page = 0; ; page++) {
        const res = await wiGet<InvoiceListWire>("/invoices", { companyMst: taxId, from: `${year}-01-01`, to: `${year}-12-31`, page, size: INVOICE_PAGE_SIZE });
        const batch = res?.rows ?? [];
        rows.push(...batch);
        if (res?.incompletePeriods) {
            sawPeriods = true;
            for (const p of res.incompletePeriods) periods.set(p.month, p);
        }
        if (!batch.length || rows.length >= (res?.totalCount ?? 0)) break;
    }
    setState((s) => {
        const prev = new Map(s.invoices.map((i) => [i.id, i]));
        const fresh = rows.map((r) => fromRow(r, prev.get(String(r.id))));
        const year4 = String(year);
        // Only this MST's invoices of this year are replaced — other years stay cached.
        s.invoices = [...s.invoices.filter((i) => workingTaxIdOf(i) !== taxId || i.issueDate.slice(0, 4) !== year4), ...fresh];
        if (sawPeriods) {
            s.incomplete = [
                ...s.incomplete.filter((x) => x.taxId !== taxId || x.month.slice(0, 4) !== year4),
                ...[...periods.values()].map((p) => ({ taxId, month: p.month, fetched: num(p.got), total: num(p.total) })),
            ];
        }
    });
}

/**
 * Detail (screen 05): `GET /invoices/{id}` (`InvoiceDetail`, files included) replaces the cached row.
 * Returns the stored invoice. Mock mode: returns the cached record.
 */
export async function loadInvoiceDetail(id: string): Promise<Invoice | undefined> {
    if (DATA_SOURCE !== "api") return getInvoice(id);
    const rec = await wiGet<InvoiceDetailWire>(`/invoices/${encodeURIComponent(id)}`);
    const inv = fromDetail({ ...rec, id: rec?.id ?? id });
    setState((s) => {
        const at = s.invoices.findIndex((i) => i.id === inv.id);
        if (at >= 0) s.invoices[at] = inv;
        else s.invoices.unshift(inv);
    });
    return getInvoice(inv.id);
}

/**
 * importParsed in api mode: `POST /uploads` (multipart `company_mst` + `files`) → `UploadResponse`;
 * `GET /uploads/{upload_id}` is polled until the file has an `outcome` (the engine de-dups per §3.2).
 */
async function importViaUpload(raw: string, fileName: string, activeTaxId: string): Promise<{ outcome: ImportOutcome; invoice: Invoice } | { outcome: "foreign" }> {
    const form = new FormData();
    form.append("company_mst", activeTaxId);
    form.append("files", new File([raw], fileName, { type: "application/xml" }));
    let res = await wiUpload<UploadResponseWire>("/uploads", form);
    if (!res?.uploadId) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Response has no `upload_id`.");
    const uploadId = res.uploadId;

    const started = Date.now();
    const pick = (u: UploadResponseWire) => u.files?.find((f) => f.name === fileName) ?? u.files?.[0];
    let file = pick(res);
    while (!file?.outcome) {
        // OPEN: upload-level `status` values are not listed in the spec — `failed` / `error` with no file outcome ends the wait.
        if (res.status === "failed" || res.status === "error") throw new WeInvoiceApiError("WBE_UPLOAD_ERROR", res.error || res.status);
        if (Date.now() - started > UPLOAD_TIMEOUT_MS) throw new WeInvoiceApiError("WBE_TIMEOUT", "The engine did not finish in time.");
        await sleep(UPLOAD_POLL_MS);
        res = await wiGet<UploadResponseWire>(`/uploads/${encodeURIComponent(uploadId)}`);
        file = pick(res);
    }

    const outcome = file.outcome;
    if (outcome === "foreign") return { outcome: "foreign" };
    if (outcome === "error" || outcome === "pdf_pending") throw new WeInvoiceApiError("WBE_UPLOAD_ERROR", file.message || outcome);
    if (!file.invoiceId) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Upload result has no `invoice_id`.");
    const invoice = await loadInvoiceDetail(file.invoiceId);
    if (!invoice) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Imported invoice could not be loaded.");
    return { outcome, invoice };
}
