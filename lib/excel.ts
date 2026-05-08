/**
 * Shared Excel export utility — every page that exposes the toolbar
 * Excel icon must funnel through {@link exportExcel}. Per CLAUDE.md
 * §6 (Print / Export Rule) and the View Setting / sort contracts in
 * §13 / §13a, Excel export must respect:
 *
 * - the user's persisted + in-memory View Setting (visible columns +
 *   current order),
 * - the page's current filter state,
 * - the page's current sort state,
 * - the column allow-list registered for the screenId server-side.
 *
 * Mirrors {@link import("./print").printReport} in shape (typed
 * columns + caller-supplied state + escape semantics) but defers
 * actual file generation to the backend — POI on the api side
 * produces the XLSX so 50k-row exports stay bounded in heap and a
 * single style/format contract governs every consumer. The frontend's
 * job is to (a) collect the view-setting + filter + sort context, (b)
 * POST it, (c) save the response blob with the server-supplied
 * filename.
 *
 * Usage (always via the shared {@link import("@/hooks/useExcelExport").useExcelExport}
 * hook — pages do not call {@link exportExcel} directly):
 *
 *     import { useExcelExport } from "@/hooks/useExcelExport";
 *     const exportXlsx = useExcelExport();
 *     await exportXlsx({
 *         endpoint: "/api/v1/banking/accounts/export",
 *         screenId: SCREEN_IDS.ACCOUNT_INQUIRY_VND,
 *         dymAreaId: DEFAULT_AREA_ID,
 *         fileName: t("account_inquiry.title") + " (VND)",
 *         items: vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS,
 *         columnConfig: ACCOUNT_INQUIRY_EXPORT_COLUMNS,
 *         filters: { currency: "VND", bankName: selectedBank, keyword: search },
 *         sort: sortParams,
 *         t,
 *     });
 */

import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type { ApiResponse } from "@/lib/types/api";

/** Wire vocabulary for value coercion — must match
 *  {@code com.kosign.wecms.common.export.ExcelColumnFormat}. */
export type ExcelColumnFormat = "text" | "amount" | "number" | "date" | "datetime";

/** Cell horizontal alignment — must match
 *  {@code com.kosign.wecms.common.export.ExcelAlignment}. */
export type ExcelAlignment = "left" | "right" | "center";

/** One column in the export request. Header is already translated by
 *  the caller via {@code t(...)}; the backend trusts the string. */
export type ExcelExportColumn = {
    fieldId: string;
    header: string;
    format?: ExcelColumnFormat;
    ccyCd?: string;
    align?: ExcelAlignment;
    /** Explicit column width in '0'-character units (POI's
     *  {@code setColumnWidth} unit). When set, the backend writer
     *  applies it verbatim (capped at the safety max). When omitted,
     *  the writer falls back to its auto-measure pass — pages SHOULD
     *  pass widths so the file is immediately readable on download. */
    widthChars?: number;
};

/** Same shape as the list endpoint's common-sort contract. */
export type ExcelExportSort = {
    field?: string;
    direction?: "ASC" | "DESC";
};

export type ExcelExportOptions = {
    /** Per-resource POST endpoint, e.g.
     *  `/api/v1/banking/accounts/export`. CLAUDE.md decision 3 — never
     *  a generic `/api/v1/exports/{screenId}` dispatcher. */
    endpoint: string;
    screenId: string;
    /** Defaults to `"default"` for single-area pages. */
    dymAreaId?: string;
    /** Filename without extension — controller appends `.xlsx`.
     *  Convention: no-space scope marker + DDMMYYYY date suffix
     *  (e.g. `Account Inquiry(VND)_02052026`). NEVER reused as the
     *  in-sheet title — pass `title` for that. */
    fileName: string;
    /** In-sheet title shown in the merged row 0 header cell. Should
     *  match the on-screen page title verbatim (e.g.
     *  `계좌 조회 (VND)` / `Account Inquiry (VND)`) so users see one
     *  consistent label across the page header and the exported file.
     *  When omitted, the backend falls back to `fileName` (legacy
     *  behaviour). */
    title?: string;
    /** Visible + ordered columns from the current View Setting state.
     *  The hook in {@code @/hooks/useExcelExport} produces this from
     *  `vs.items` after filtering specials and unknown FIELD_IDs. */
    columns: ExcelExportColumn[];
    /** Free-form filter map — the per-screen provider on the backend
     *  decides which keys it understands. Account Inquiry consumes
     *  {@code currency} (DB-side) plus {@code bankName} / {@code keyword}
     *  (post-fetch in-memory, mirroring the page's client-side filter). */
    filters?: Record<string, unknown>;
    /** Current sort state (from `useTableSort().sortParams`). `null`
     *  or undefined leaves the backend on its legacy default ORDER BY. */
    sort?: ExcelExportSort | null;
    /** Optional caller-supplied summary fallback. Backend providers
     *  override this with their own count + totals string. */
    subHeader?: string;
};

/**
 * POST the request to the per-resource export endpoint and download
 * the returned XLSX. Errors:
 *
 * - HTTP 200 with a JSON body (BusinessException envelope) — re-thrown
 *   as {@link ApiCallError} carrying {@code COMMON_HEAD.CODE} so the
 *   caller can surface the system dialog using the same path as every
 *   other API call.
 * - HTTP 401 — handled by the global session-expired interceptor in
 *   {@code lib/axios.ts}; the request is retried automatically once
 *   the user re-authenticates.
 * - Network failures — re-thrown as {@link ApiCallError} with
 *   {@code code = "NETWORK"}.
 */
export async function exportExcel(opts: ExcelExportOptions): Promise<void> {
    const body = buildRequestBody(opts);
    let res;
    try {
        res = await api.post<Blob>(opts.endpoint, body, {
            responseType: "blob",
        });
    } catch (err) {
        // Axios throws on HTTP error statuses. The session-expired
        // interceptor handles 401; everything else lands here. The
        // body may still be a Blob with a JSON error — try to decode.
        const e = err as { response?: { data?: unknown; status?: number }; message?: string };
        const decoded = await maybeDecodeJsonError(e.response?.data);
        if (decoded) throw decoded;
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }

    // 200 OK with JSON body — BusinessException came back through the
    // standard envelope (e.g. WBE2010 unknown screen, WBE2011 too
    // many rows). Read the blob as text and re-throw as ApiCallError
    // so the caller renders the same system dialog as every other
    // API failure.
    const contentType = String(res.headers?.["content-type"] ?? "").toLowerCase();
    if (contentType.includes("application/json")) {
        const decoded = await maybeDecodeJsonError(res.data);
        if (decoded) throw decoded;
        throw new ApiCallError("WBE9999", "Excel export returned an unexpected response");
    }

    const fileName =
        parseContentDispositionFilename(
            String(res.headers?.["content-disposition"] ?? ""),
        ) ?? `${opts.fileName}.xlsx`;
    triggerDownload(res.data, fileName);
}

function buildRequestBody(opts: ExcelExportOptions) {
    return {
        screenId: opts.screenId,
        dymAreaId: opts.dymAreaId ?? "default",
        fileName: opts.fileName,
        title: opts.title ?? null,
        filters: opts.filters ?? {},
        sort:
            opts.sort && opts.sort.field && opts.sort.direction
                ? { field: opts.sort.field, direction: opts.sort.direction }
                : null,
        columns: opts.columns.map((c) => ({
            fieldId: c.fieldId,
            header: c.header,
            format: c.format ?? "text",
            ccyCd: c.ccyCd ?? null,
            align: c.align ?? null,
            widthChars: c.widthChars ?? null,
        })),
        subHeader: opts.subHeader ?? null,
    };
}

/** Inspect a Blob (or already-parsed object) for the standard
 *  {@code status} envelope and convert to {@link ApiCallError}.
 *  Returns {@code null} when the payload is not a recognisable error. */
async function maybeDecodeJsonError(raw: unknown): Promise<ApiCallError | null> {
    if (raw == null) return null;
    let parsed: unknown = raw;
    if (raw instanceof Blob) {
        const text = await raw.text();
        try {
            parsed = JSON.parse(text);
        } catch {
            return null;
        }
    }
    const env = parsed as ApiResponse<unknown> | undefined;
    const head = env?.status;
    if (head && head.error) {
        return new ApiCallError(head.code, head.message);
    }
    return null;
}

/** Pull the filename from a `Content-Disposition: attachment;
 *  filename="…"; filename*=UTF-8''…` header. Prefers the RFC 5987
 *  variant so non-ASCII filenames (Korean / Khmer) round-trip. */
function parseContentDispositionFilename(cd: string): string | null {
    const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
    if (star && star[1]) {
        try {
            return decodeURIComponent(star[1].trim());
        } catch {
            // fall through to the legacy form
        }
    }
    const plain = /filename="?([^";]+)"?/i.exec(cd);
    return plain && plain[1] ? plain[1].trim() : null;
}

/**
 * `DDMMYYYY` of the user's local date — the canonical date suffix for
 * export filenames (e.g. {@code "Account Inquiry(VND)_02052026.xlsx"}).
 * Mirrors the legacy JEX `_excelDownload` filename convention exactly —
 * pages append this to their translated `export_title` key. Local
 * date (not UTC) so the suffix matches what the user sees on their
 * wall calendar.
 */
export function todayDmy(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}${m}${y}`;
}

function triggerDownload(blob: Blob, fileName: string): void {
    if (typeof window === "undefined") return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke so Safari has a chance to start the download before
    // the URL is freed.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
