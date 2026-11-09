/*
 * GDT connections + sync (spec screens 06 "Kết nối Cục Thuế" and 10 "Lịch sử đồng bộ · Đồng bộ hàng loạt").
 *
 * API mode (DATA_SOURCE === "api"): every function below calls `/api/v1/weinvoice/companies*` and
 * `/sync-runs*` — published backend contract (we-scraping-api
 * docs/features/addon-service/weinvoice/interface-specification.md § "GDT connections (screen 06)",
 * § "Sync runs (screen 10)"; DTOs CompanyItem / CompanyListResponse / CompanyCreateRequest /
 * CompanyPasswordRequest / CompanyPatchRequest / RequestAccepted / SyncRunCreateRequest /
 * SyncRunProgress / SyncRunItem). Adding an MST / changing its password answers in one call (the
 * backend verifies the GDT account first); sync runs are polled through `GET /sync-runs/{run_id}`.
 * No captcha is drawn in the browser; the store is a cache refreshed from the responses.
 *
 * MOCK mode (default) — implementation over the in-memory store:
 *
 * Nothing here talks to hoadondientu.gdt.gov.vn: the "captcha" is a locally
 * drawn image used to render the sync-progress UI, connections never store a
 * password (§3.10 "Bí mật … không bao giờ trả về giao diện"), and a sync run
 * only re-stamps the period and appends a history row. The real engine is a
 * backend decision (00_DOC_TRUOC.md).
 */
import type { Direction, GdtConnection, SyncRun } from "@/lib/weinvoice/types";
import { getState, setState } from "@/lib/api/weinvoice/store";
import { MY_COMPANIES } from "@/lib/api/weinvoice/mockData";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { WeInvoiceApiError, wiDelete, wiGet, wiPatch, wiPost, wiPut } from "@/lib/api/weinvoice/http";
import { sleep } from "@/lib/utils";

/** Commercial cap on managed MSTs per account (spec: 5 — still to be confirmed by PO). */
export const MAX_CONNECTIONS = 5;

/** `quota.max` from the last GET /companies (API mode); MAX_CONNECTIONS until then / in mock mode. */
let quotaMax = MAX_CONNECTIONS;
export function getQuotaMax(): number {
    return quotaMax;
}

// ---------------------------------------------------------------------------------------------
// Wire shapes — published contract, camelCased by wiGet/wiPost (wire keys in the comments).
// ---------------------------------------------------------------------------------------------

/** Backend `CompanyItem.status` (lower case). */
export type CompanyApiStatus = "pending" | "connected" | "error" | "expired" | "need_password";

/** `CompanyItem` — `tax_id, company_name, username, label, status, status_message, has_password, default_company, last_sync_at, created_at`. */
type CompanyItemWire = {
    taxId: string;
    companyName: string | null;
    username: string | null;
    label: string | null;
    status: CompanyApiStatus | null;
    statusMessage: string | null;
    hasPassword: boolean;
    defaultCompany: boolean;
    lastSyncAt: string | null;
    createdAt: string | null;
};
/** GET /companies → `{ companies[CompanyItem], quota{used, max} }` (`CompanyListResponse`). */
type CompanyListWire = { companies: CompanyItemWire[] | null; quota: { used: number; max: number } | null };
/** `RequestAccepted` — `{ request_id, subject }` (POST /companies, PUT …/password, POST /sync-runs items). */
type RequestAcceptedWire = { requestId: string; subject: string | null };

/** Backend `SyncRunItem.status`; `queued` / `running` / `cancelled` have no `SyncRun` counterpart. */
type SyncRunApiStatus = "queued" | "running" | "success" | "partial" | "failed" | "cancelled";
/**
 * `SyncRunItem` — `id, request_id, tax_id, company_name, direction, from_month, to_month, started_at,
 * duration_sec, new_count, updated_count, xml_count, status, message, trigger`. Ids are `R<n>`
 * (requested run) or `J<n>` (engine-scheduled run, `request_id` null). Numbers may be null.
 */
type SyncRunItemWire = {
    id: string;
    requestId: string | null;
    taxId: string;
    companyName: string | null;
    direction: SyncRun["direction"] | null;
    fromMonth: string | null;
    toMonth: string | null;
    startedAt: string | null;
    durationSec: number | null;
    newCount: number | null;
    updatedCount: number | null;
    xmlCount: number | null;
    status: SyncRunApiStatus | null;
    message: string | null;
    trigger: SyncRun["trigger"] | null;
};
/** Page response `{ rows, total_count, page, size }` (`WeInvoicePage`). */
type PageWire<T> = { rows: T[] | null; totalCount: number; page: number; size: number };
/**
 * GET /sync-runs/{run_id} (`SyncRunProgress`) — `run_id, tax_id, status, step, month, listed, xml_done,
 * xml_total, error, run`. `status` is the ENGINE REQUEST status (queued · running · done · partial ·
 * failed · cancelled), not the history status; `run` is the same row as the history (`SyncRunItem`).
 */
type SyncRunProgressWire = {
    runId: string;
    taxId: string;
    status: "queued" | "running" | "done" | "partial" | "failed" | "cancelled" | null;
    step: string | null;
    month: string | null;
    listed: number | null;
    xmlDone: number | null;
    xmlTotal: number | null;
    error: string | null;
    run: SyncRunItemWire | null;
};

/** Per-MST fields of `CompanyItem` that `GdtConnection` (lib/weinvoice/types.ts) has no place for. */
export type CompanyMeta = { apiStatus: CompanyApiStatus; statusMessage: string; hasPassword: boolean; defaultCompany: boolean };
const companyMeta = new Map<string, CompanyMeta>();

/** API mode: backend status / message / default flag of an MST (undefined in mock mode). */
export function getCompanyMeta(taxId: string): CompanyMeta | undefined {
    return companyMeta.get(taxId);
}

/** API mode: the MST flagged `default_company` in the last GET /companies (empty when none / mock). */
export function getDefaultCompanyMst(): string {
    for (const [taxId, m] of companyMeta) if (m.defaultCompany) return taxId;
    return "";
}

/**
 * `CompanyItem.status` → `GdtConnection.status` (connected · error · expired):
 *  - `need_password` (added from an upload, no password yet) → `expired` ("Cần nhập lại mật khẩu"),
 *    the same state the mock gives `addPendingConnection`;
 *  - `pending` (login test queued / running) → `error`: not usable for a sync yet. The connections
 *    screen shows the real state from `getCompanyMeta` (pending → "Đang đăng nhập Cục Thuế…").
 */
function toUiStatus(s: CompanyApiStatus | null): GdtConnection["status"] {
    if (s === "connected" || s === "expired" || s === "error") return s;
    if (s === "need_password") return "expired";
    return "error";
}

function toConnection(w: CompanyItemWire): GdtConnection {
    companyMeta.set(w.taxId, { apiStatus: w.status ?? "error", statusMessage: w.statusMessage ?? "", hasPassword: !!w.hasPassword, defaultCompany: !!w.defaultCompany });
    return {
        taxId: w.taxId,
        companyName: w.companyName ?? "",
        username: w.username ?? w.taxId,
        label: w.label ?? "",
        status: toUiStatus(w.status),
        lastSyncAt: w.lastSyncAt ?? "",
        createdAt: w.createdAt ?? "",
    };
}

/**
 * `SyncRunItem` → `SyncRun`. Status mapping (SyncRun has only success · partial · failed):
 *  - success / partial / failed → unchanged;
 *  - cancelled → `partial` + message `cancelled` ("Người dùng dừng") — what was collected before the stop is kept;
 *  - queued / running → `partial` + message `queued` / `running` (history shows the run is not finished;
 *    i18n keys `hist.msg.queued` / `hist.msg.running`).
 * The backend `message` (engine error text) wins over these markers when present.
 */
function toSyncRun(w: SyncRunItemWire): SyncRun {
    const st = w.status;
    const status: SyncRun["status"] = st === "success" || st === "partial" || st === "failed" ? st : "partial";
    const marker = st === "cancelled" || st === "queued" || st === "running" ? st : undefined;
    return {
        id: w.id,
        taxId: w.taxId,
        companyName: w.companyName ?? getState().connections.find((c) => c.taxId === w.taxId)?.companyName ?? "",
        direction: w.direction ?? "both",
        fromMonth: w.fromMonth ?? "",
        toMonth: w.toMonth ?? "",
        startedAt: w.startedAt ?? "",
        durationSec: w.durationSec ?? 0,
        newCount: w.newCount ?? 0,
        updatedCount: w.updatedCount ?? 0,
        xmlCount: w.xmlCount ?? 0,
        status,
        message: w.message || marker,
        trigger: w.trigger ?? "manual",
    };
}

/** GET /companies → store.connections (+ quota.max, per-MST meta). No-op in mock mode. */
export async function loadCompanies(): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    const data = await wiGet<CompanyListWire>("/companies");
    companyMeta.clear();
    const rows = (data?.companies ?? []).map(toConnection);
    if (typeof data?.quota?.max === "number") quotaMax = data.quota.max;
    setState((s) => {
        s.connections = rows;
    });
}

/** Page size for GET /sync-runs (backend max 200). */
const HISTORY_PAGE_SIZE = 200;
/** OPEN: how much history the screen should hold is not specified — capped at 5 pages (1000 runs). */
const HISTORY_MAX_PAGES = 5;

/**
 * GET /sync-runs?company_mst=&page=&size= → store.history (newest first, as the backend returns it).
 * Without `companyMst` the tenant's whole history replaces the store; with it, only that MST's rows
 * are replaced. No-op in mock mode.
 */
export async function loadSyncHistory(companyMst?: string): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    const runs: SyncRun[] = [];
    for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const data = await wiGet<PageWire<SyncRunItemWire>>("/sync-runs", { ...(companyMst ? { companyMst } : {}), page, size: HISTORY_PAGE_SIZE });
        const rows = data?.rows ?? [];
        runs.push(...rows.map(toSyncRun));
        if (rows.length < HISTORY_PAGE_SIZE || runs.length >= (data?.totalCount ?? 0)) break;
    }
    setState((s) => {
        if (!companyMst) s.history = runs;
        else s.history = [...runs, ...s.history.filter((h) => h.taxId !== companyMst)].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
}

/**
 * Backend error code → the add-dialog's error kinds (spec § Error codes):
 * WBE3001 malformed MST → invalid_tax_id · WBE3003 already connected → exists · WBE3004 quota → quota.
 * Anything else (e.g. WBE1003 admin-only, WBE_VALIDATION, network) → `api`: the dialog shows the
 * backend message + code. A failed engine login test is reported separately as `wrong_password`.
 */
export function toConnectError(code: string): ConnectError {
    if (code === "WBE3001") return "invalid_tax_id";
    if (code === "WBE3003") return "exists";
    if (code === "WBE3004") return "quota";
    if (code === "WBE3027") return "wrong_password"; // the GDT portal rejected the account (message = portal text)
    return "api";
}

/** User-facing text of an API failure: backend message + code (screens use it in their error alerts). */
export function apiErrorText(e: unknown): string {
    if (e instanceof WeInvoiceApiError) return e.code && !e.message.includes(e.code) ? `${e.message} (${e.code})` : e.message;
    return e instanceof Error ? e.message : String(e);
}

/**
 * After POST /companies or PUT …/password answered with the saved `CompanyItem`: reload GET /companies
 * (quota, default flag, other rows) and return the MST's row; when the reload fails, the answer itself
 * is used so a saved connection is never reported as a failure.
 */
async function afterSave(taxId: string, saved: CompanyItemWire | null): Promise<GdtConnection> {
    try {
        await loadCompanies();
        const conn = getState().connections.find((c) => c.taxId === taxId);
        if (conn) return conn;
    } catch {
        /* fall through to the answer */
    }
    if (!saved) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Empty answer from the server after saving the connection.");
    const conn = toConnection(saved);
    setState((s) => {
        s.connections = [...s.connections.filter((c) => c.taxId !== taxId), conn];
    });
    return conn;
}

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Locally drawn captcha-looking image (SVG data URI) — UI stand-in only. */
export function makeCaptcha(len = 4): { code: string; src: string } {
    let code = "";
    for (let i = 0; i < len; i++) code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    const glyphs = code
        .split("")
        .map((c, i) => `<text x="${12 + i * 22}" y="${26 + (i % 2 ? -3 : 3)}" transform="rotate(${(i % 2 ? -1 : 1) * 8} ${12 + i * 22} 22)" font-family="monospace" font-size="22" font-weight="700" fill="#0b3c6f">${c}</text>`)
        .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${len * 22 + 16}" height="36"><rect width="100%" height="100%" fill="#eef3fa"/><path d="M0 22 C30 8 60 32 120 14" stroke="#9fb7d6" fill="none"/>${glyphs}</svg>`;
    return { code, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}

export function listConnections(): GdtConnection[] {
    return getState().connections;
}

function companyNameFor(taxId: string): string {
    return MY_COMPANIES.find((c) => c.taxId === taxId)?.name ?? `CÔNG TY TNHH MST ${taxId}`;
}

/** `api` = any other backend refusal (e.g. WBE1003 admin-only): the dialog shows `message` (backend text + code). */
export type ConnectError = "invalid_tax_id" | "wrong_password" | "exists" | "quota" | "api";

/** Body of POST /companies and PUT /companies/{mst}/password: optional keys are omitted, never sent empty. */
function credentialBody(password: string, username?: string, extra: Record<string, string> = {}): Record<string, string> {
    const body: Record<string, string> = { ...extra, password };
    const u = username?.trim();
    if (u) body.gdtUsername = u; // blank → the backend uses the MST as the GDT login
    return body;
}

/**
 * Add an MST. API mode: POST /companies `{company_mst, gdt_username?, password, label?}` → the saved
 * `CompanyItem` (status `connected`). The backend logs in to the GDT portal first (through the scraping
 * engine, captcha solved server-side) and stores the account only when the portal accepts it — one call,
 * no polling (we-scraping-api docs/issues/weinvoice-gdt-login-test-synchronous-2026-11-06.md).
 * `onStep("login")` is emitted while the call runs (a few seconds).
 * The GDT-username field is not on the form yet → `gdt_username` is omitted unless `username` is given.
 * Errors: WBE3001 / WBE3003 / WBE3004 → invalid_tax_id / exists / quota; WBE3027 (portal rejected the
 * account) → wrong_password + the backend message; anything else (WBE3028 could not check now, network,
 * …) → `api` + backend message and code.
 */
export async function addConnection(
    input: { taxId: string; password: string; label: string; username?: string },
    onStep?: (step: string) => void,
): Promise<{ ok: true; conn: GdtConnection } | { ok: false; error: ConnectError; message?: string }> {
    const taxId = input.taxId.trim();
    if (DATA_SOURCE === "api") {
        if (!/^\d{10}(-\d{3})?$/.test(taxId)) return { ok: false, error: "invalid_tax_id" };
        let saved: CompanyItemWire | null;
        try {
            const label = input.label.trim();
            onStep?.("login");
            saved = await wiPost<CompanyItemWire | null>("/companies", credentialBody(input.password, input.username, { companyMst: taxId, ...(label ? { label } : {}) }));
        } catch (err) {
            const e = err instanceof WeInvoiceApiError ? err : new WeInvoiceApiError("WBE_CLIENT_PARSE", String(err));
            const kind = toConnectError(e.code);
            return { ok: false, error: kind, message: kind === "wrong_password" ? e.message : apiErrorText(e) };
        }
        return { ok: true, conn: await afterSave(taxId, saved) };
    }
    await sleep(600);
    if (!/^\d{10}(-\d{3})?$/.test(taxId)) return { ok: false, error: "invalid_tax_id" };
    const existing = getState().connections.find((c) => c.taxId === taxId);
    if (existing && existing.status === "connected") return { ok: false, error: "exists" };
    if (!existing && getState().connections.length >= MAX_CONNECTIONS) return { ok: false, error: "quota" };
    // Demo rule from UI Spec v1.0 screen "Kết nối Cục Thuế": a password containing "sai" simulates a login failure.
    if (/sai/i.test(input.password)) return { ok: false, error: "wrong_password" };
    const now = new Date().toISOString();
    const conn: GdtConnection = { taxId, companyName: existing?.companyName ?? companyNameFor(taxId), username: taxId, label: input.label || existing?.label || "", status: "connected", lastSyncAt: existing?.lastSyncAt ?? "", createdAt: existing?.createdAt ?? now };
    setState((s) => {
        s.connections = existing ? s.connections.map((c) => (c.taxId === taxId ? conn : c)) : [...s.connections, conn];
    });
    return { ok: true, conn };
}

/** MST discovered from an imported XML — added in "needs password" state (§3.2 "Không thuộc MST"). */
export function addPendingConnection(taxId: string, companyName: string): GdtConnection {
    const conn: GdtConnection = { taxId, companyName, username: taxId, label: "", status: "expired", lastSyncAt: "", createdAt: new Date().toISOString() };
    setState((s) => {
        if (!s.connections.some((c) => c.taxId === taxId)) s.connections.push(conn);
    });
    return conn;
}

/**
 * API mode: PATCH /companies/{mst} `{label}` → `CompanyItem`, which replaces the store row
 * (status is the backend's, never patched). Mock: patches the store.
 */
export async function updateConnection(taxId: string, patch: Partial<Pick<GdtConnection, "label" | "status">>): Promise<void> {
    if (DATA_SOURCE === "api") {
        if (patch.label === undefined) return;
        await patchCompany(taxId, { label: patch.label });
        return;
    }
    await sleep(200);
    setState((s) => {
        const c = s.connections.find((x) => x.taxId === taxId);
        if (c) Object.assign(c, patch);
    });
}

/** PATCH /companies/{mst} → `CompanyItem` → store row (+ meta). A null answer falls back to a reload. */
async function patchCompany(taxId: string, body: { label?: string; defaultCompany?: boolean }): Promise<void> {
    const item = await wiPatch<CompanyItemWire | null>(`/companies/${encodeURIComponent(taxId)}`, body);
    if (!item?.taxId) {
        await loadCompanies();
        return;
    }
    if (body.defaultCompany) for (const m of companyMeta.values()) m.defaultCompany = false;
    const conn = toConnection(item);
    setState((s) => {
        s.connections = s.connections.map((c) => (c.taxId === conn.taxId ? conn : c));
    });
}

/**
 * API mode: PATCH /companies/{mst} `{default_company: true}` — the tenant's default MST (the backend
 * clears the flag on the others). Does not change the working MST of this session. Mock: no-op.
 */
export async function setDefaultCompany(taxId: string): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    await patchCompany(taxId, { defaultCompany: true });
}

/**
 * Change the GDT password. API mode: PUT /companies/{mst}/password `{password, gdt_username?}` → the
 * saved `CompanyItem`; the backend logs in to the GDT portal first and keeps the old password when the
 * portal rejects the new one. Throws WeInvoiceApiError (`WBE3027` rejected · `WBE3028` could not check
 * now). The password is sent in the body only (§3.10). Mock: marks the connection connected.
 */
export async function changePassword(taxId: string, password: string, onStep?: (step: string) => void, username?: string): Promise<void> {
    if (DATA_SOURCE === "api") {
        onStep?.("login");
        const saved = await wiPut<CompanyItemWire | null>(`/companies/${encodeURIComponent(taxId)}/password`, credentialBody(password, username));
        await afterSave(taxId, saved);
        return;
    }
    await updateConnection(taxId, { status: "connected" });
}

/** Removes the connection; its invoices stay (they are the customer's records). API: DELETE /companies/{mst}. */
export async function removeConnection(taxId: string): Promise<void> {
    if (DATA_SOURCE === "api") {
        await wiDelete(`/companies/${encodeURIComponent(taxId)}`); // → null
        companyMeta.delete(taxId);
    } else await sleep(200);
    setState((s) => {
        s.connections = s.connections.filter((c) => c.taxId !== taxId);
        if (s.activeTaxId === taxId) s.activeTaxId = s.connections[0]?.taxId ?? "";
    });
}

export function setActiveTaxId(taxId: string): void {
    setState((s) => {
        s.activeTaxId = taxId;
    });
}

export type SyncStep = "login" | "captcha" | "list" | "xml" | "done";
export type SyncProgress = {
    step: SyncStep;
    captcha?: { code: string; src: string };
    month?: string;
    batch?: number;
    listed: number;
    xmlDone: number;
    xmlTotal: number;
};

function monthsBetween(from: string, to: string): string[] {
    const out: string[] = [];
    let [y, m] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    while (y < ty || (y === ty && m <= tm)) {
        out.push(`${y}-${String(m).padStart(2, "0")}`);
        m++;
        if (m > 12) {
            m = 1;
            y++;
        }
    }
    return out;
}

/**
 * Simulated sync: walks the UI through login → captcha → list → XML for each
 * month, using the invoices already in the store as the "listed" set. Clears
 * the "incomplete period" banner for the synced months and records a history row.
 */
export async function runSync(
    opts: { taxId: string; direction: "both" | Direction; fromMonth: string; toMonth: string; trigger?: SyncRun["trigger"] },
    onProgress: (p: SyncProgress) => void,
    signal?: { cancelled: boolean },
): Promise<SyncRun> {
    if (DATA_SOURCE === "api") return runSyncApi(opts, onProgress, signal);
    const started = Date.now();
    const conn = getState().connections.find((c) => c.taxId === opts.taxId);
    const base: Omit<SyncRun, "status" | "newCount" | "updatedCount" | "xmlCount" | "durationSec"> = {
        id: `run-${started}`,
        taxId: opts.taxId,
        companyName: conn?.companyName ?? companyNameFor(opts.taxId),
        direction: opts.direction,
        fromMonth: opts.fromMonth,
        toMonth: opts.toMonth,
        startedAt: new Date(started).toISOString(),
        trigger: opts.trigger ?? "manual",
    };
    const finish = (run: SyncRun) => {
        setState((s) => {
            s.history.unshift(run);
            if (run.status !== "failed") {
                const months = new Set(monthsBetween(opts.fromMonth, opts.toMonth));
                s.incomplete = s.incomplete.filter((x) => !(x.taxId === opts.taxId && months.has(x.month)));
                const c = s.connections.find((x) => x.taxId === opts.taxId);
                if (c) c.lastSyncAt = new Date().toISOString();
            }
        });
        return run;
    };

    onProgress({ step: "login", listed: 0, xmlDone: 0, xmlTotal: 0 });
    await sleep(500);
    if (!conn || conn.status !== "connected") {
        return finish({ ...base, status: "failed", newCount: 0, updatedCount: 0, xmlCount: 0, durationSec: 1, message: "gdt_login_failed" });
    }
    const captcha = makeCaptcha();
    onProgress({ step: "captcha", captcha, listed: 0, xmlDone: 0, xmlTotal: 0 });
    await sleep(700);

    let listed = 0;
    let xmlTotal = 0;
    for (const month of monthsBetween(opts.fromMonth, opts.toMonth)) {
        if (signal?.cancelled) break;
        const n = getState().invoices.filter(
            (i) => i.issueDate.startsWith(month) && (opts.direction === "both" || i.direction === opts.direction) && (i.direction === "purchase" ? i.buyerTaxId : i.sellerTaxId) === opts.taxId,
        ).length;
        listed += n;
        xmlTotal += n;
        onProgress({ step: "list", month, batch: 1, listed, xmlDone: 0, xmlTotal });
        await sleep(300);
    }
    for (let done = 0; done <= xmlTotal && !signal?.cancelled; done += Math.max(1, Math.ceil(xmlTotal / 8))) {
        onProgress({ step: "xml", listed, xmlDone: Math.min(done, xmlTotal), xmlTotal });
        await sleep(180);
    }
    const durationSec = Math.max(1, Math.round((Date.now() - started) / 1000));
    if (signal?.cancelled) {
        onProgress({ step: "done", listed, xmlDone: 0, xmlTotal });
        return finish({ ...base, status: "partial", newCount: 0, updatedCount: 0, xmlCount: 0, durationSec, message: "cancelled" });
    }
    onProgress({ step: "done", listed, xmlDone: xmlTotal, xmlTotal });
    return finish({ ...base, status: "success", newCount: 0, updatedCount: listed, xmlCount: xmlTotal, durationSec });
}

/** Engine request statuses that end a run (GET /sync-runs/{run_id} `status`). */
const SYNC_TERMINAL = new Set(["done", "partial", "failed", "cancelled"]);
const SYNC_STEPS = new Set<string>(["login", "captcha", "list", "xml", "done"]);

/** Final engine request status → `SyncRunItem.status`, used only when the response carries no `run`. */
const RUN_STATUS: Record<string, SyncRunApiStatus> = { done: "success", partial: "partial", failed: "failed", cancelled: "cancelled" };

/**
 * API sync: POST /sync-runs `{company_msts: [mst], direction, from_month, to_month, trigger}` →
 * `[{request_id: "R<n>", subject: mst}]` → poll GET /sync-runs/{run_id} (~1 s; run_id = that
 * request_id) until the engine request leaves queued / running. `signal.cancelled` →
 * POST /sync-runs/{run_id}/cancel once (WBE3012 "already finished" is ignored), then keep polling for
 * the final state. The returned SyncRun is the response's `run` (the history row). At the end the
 * history and the connections (last sync) are reloaded.
 * Refusals of the POST (WBE3016 invalid / future period, WBE3023 > 36 months, WBE3024 MST without
 * password, WBE3002 / WBE1003 …) are thrown as WeInvoiceApiError with the backend message.
 * `trigger: schedule` is engine-only — sent as `manual`.
 */
async function runSyncApi(
    opts: { taxId: string; direction: "both" | Direction; fromMonth: string; toMonth: string; trigger?: SyncRun["trigger"] },
    onProgress: (p: SyncProgress) => void,
    signal?: { cancelled: boolean },
    intervalMs = 1000,
    timeoutMs = 30 * 60_000,
): Promise<SyncRun> {
    const created = await wiPost<RequestAcceptedWire[]>("/sync-runs", { companyMsts: [opts.taxId], direction: opts.direction, fromMonth: opts.fromMonth, toMonth: opts.toMonth, trigger: opts.trigger === "bulk" ? "bulk" : "manual" });
    const list = Array.isArray(created) ? created : [];
    const runId = (list.find((x) => x.subject === opts.taxId) ?? list[0])?.requestId;
    if (!runId) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "POST /sync-runs returned no request_id.");
    const path = `/sync-runs/${encodeURIComponent(runId)}`;
    const startedAt = Date.now();
    let cancelSent = false;
    let last: SyncRunProgressWire;
    for (;;) {
        last = await wiGet<SyncRunProgressWire>(path);
        const step = last.step && SYNC_STEPS.has(last.step) ? (last.step as SyncStep) : "login"; // queued: no step yet
        onProgress({ step, month: last.month ?? undefined, listed: last.listed ?? 0, xmlDone: last.xmlDone ?? 0, xmlTotal: last.xmlTotal ?? 0 });
        if (last.status && SYNC_TERMINAL.has(last.status)) break;
        if (signal?.cancelled && !cancelSent) {
            cancelSent = true;
            try {
                await wiPost(`${path}/cancel`); // → EngineRequestResponse (queued → cancelled; running → cancel_requested)
            } catch (err) {
                if (!(err instanceof WeInvoiceApiError && err.code === "WBE3012")) throw err; // already finished → poll the result
            }
        }
        if (Date.now() - startedAt > timeoutMs) throw new WeInvoiceApiError("WBE_TIMEOUT", "The sync run did not finish in time.");
        await sleep(intervalMs);
    }
    const base: SyncRunItemWire = last.run ?? {
        id: last.runId ?? runId,
        requestId: null,
        taxId: last.taxId ?? opts.taxId,
        companyName: null,
        direction: null,
        fromMonth: null,
        toMonth: null,
        startedAt: null,
        durationSec: null,
        newCount: null,
        updatedCount: null,
        xmlCount: null,
        status: last.status ? RUN_STATUS[last.status] : null,
        message: last.error,
        trigger: null,
    };
    const run = toSyncRun({
        ...base,
        id: base.id || runId,
        taxId: base.taxId || opts.taxId,
        direction: base.direction ?? opts.direction,
        fromMonth: base.fromMonth ?? opts.fromMonth,
        toMonth: base.toMonth ?? opts.toMonth,
        message: base.message || last.error,
        trigger: base.trigger ?? opts.trigger ?? "manual",
    });
    await Promise.all([loadSyncHistory(), loadCompanies()]);
    return run;
}
