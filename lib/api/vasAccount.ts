import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiResponse,
    ApiVasAccountCreateRequest,
    ApiVasAccountListResponse,
    ApiVasAccountLookupResponse,
    ApiVasAccountRow,
    ApiVasAccountUpdateRequest,
} from "@/lib/types/api";

/**
 * Settings &gt; VAS Account API client. Mirrors the Spring controller
 * {@code VasAccountController} (5 endpoints; Excel preview / import +
 * Excel export are deferred to a follow-up MR — see
 * {@code docs/refactor-wecms/features/vas-account.md §1 "In scope"}).
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * {@code status.code} so the caller can branch on {@code WBE0003}
 * (duplicate code), {@code WBE2040} (not found / wrong tenant),
 * {@code WBE_VALIDATION}, etc.
 *
 * <p>Wire convention: lowercase snake_case everywhere (CTO directive
 * 2026-05-08). The path segment {@code {vasAcctSeqNo}} is URL-encoded;
 * server validates it as {@code Long} and rejects non-numeric with
 * {@code WBE_VALIDATION}.
 */
const BASE = "/api/v1/settings/vas-account";

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error || !body.data) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return body.data;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/** Query parameters for the list endpoint — every field is optional. */
export type FetchVasAccountsParams = {
    searchWd?: string;
    /** Repeatable on the wire. Pass `["A"]` or `["I"]` for a single-status
     *  filter; pass `[]` / omit for both. Multi-value list is sent as
     *  repeated `?stts=A&stts=I` per Spring's `List<String>` binding. */
    statuses?: string[];
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    /** Zero-based. Defaults to 0 server-side. Ignored when `all` is true. */
    page?: number;
    /** Defaults to 20 server-side, clamped to 100. Ignored when `all` is true. */
    size?: number;
    /** Load the entire filtered set (no pagination). The VAS Account
     *  management panel sets this so its prefix-code hierarchy is built
     *  over the full dataset — legacy parity with `comm_0217_001_r001`
     *  (no paging) and avoids the 100-row server clamp truncating a
     *  tenant. Backend honours `all=true` via `VasAccountService.listAll`. */
    all?: boolean;
};

/**
 * Filtered + paginated list. Mirrors
 * {@code VasAccountController#list}. Per the backend contract, the
 * default sort is {@code vasAcctCd ASC} with a {@code vasAcctSeqNo}
 * tiebreaker; unknown {@code sortField} values fall back to the
 * default rather than 4xx-ing.
 */
export function fetchVasAccounts(
    params: FetchVasAccountsParams = {},
): Promise<ApiVasAccountListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiVasAccountListResponse>>(BASE, {
            params: {
                search_wd: params.searchWd || undefined,
                stts: params.statuses && params.statuses.length > 0 ? params.statuses : undefined,
                sort_field: params.sortField,
                sort_direction: params.sortDirection,
                page: params.all ? undefined : params.page,
                size: params.all ? undefined : params.size,
                all: params.all ? true : undefined,
            },
        }),
    );
}

/** Detail by seq_no. {@code WBE2040} when missing or in another tenant. */
export function fetchVasAccount(vasAcctSeqNo: string): Promise<ApiVasAccountRow> {
    const path = `${BASE}/${encodeURIComponent(vasAcctSeqNo)}`;
    return unwrap(api.get<ApiResponse<ApiVasAccountRow>>(path));
}

/**
 * Active+live picker for the Edit Bank Account dialog. Mirrors legacy
 * `comm_1002_001`. Returns up to 500 rows, all `STTS='A'` /
 * `DEL_YN='N'`. The typeahead caller filters further client-side.
 */
export function fetchVasAccountLookup(
    searchWd?: string,
): Promise<ApiVasAccountLookupResponse> {
    return unwrap(
        api.get<ApiResponse<ApiVasAccountLookupResponse>>(`${BASE}/lookup`, {
            params: { search_wd: searchWd || undefined },
        }),
    );
}

/**
 * Create. {@code WBE0003} on duplicate {@code vas_acct_cd};
 * {@code WBE_VALIDATION} on bean-validation failure. Backend appends
 * 4 locale audit rows under one {@code audit_logs_seq_no}.
 */
export function createVasAccount(
    body: ApiVasAccountCreateRequest,
): Promise<ApiVasAccountRow> {
    return unwrap(api.post<ApiResponse<ApiVasAccountRow>>(BASE, body));
}

/**
 * Update. Same wire shape as create; identity travels via the path.
 * Backend duplicate-check fires only when {@code vas_acct_cd} actually
 * changed (mirrors legacy {@code comm_0217_004_u001_act.jsp}).
 */
export function updateVasAccount(
    vasAcctSeqNo: string,
    body: ApiVasAccountUpdateRequest,
): Promise<ApiVasAccountRow> {
    const path = `${BASE}/${encodeURIComponent(vasAcctSeqNo)}`;
    return unwrap(api.put<ApiResponse<ApiVasAccountRow>>(path, body));
}

/* =================================================================
 *  Excel — template / preview / import (legacy comm_0217_002 family)
 * ================================================================= */

/** Per-cell error category codes — match Spring
 *  {@code VasAccountExcelService.ERR_CODE_*}. The frontend filters
 *  by {@link code} (not {@link message}) when switching the upload
 *  option so the re-derivation stays locale-agnostic. */
export type ApiVasAccountExcelErrorCode =
    | "required"
    | "length"
    | "format"
    | "dup_file"
    | "dup_db";

/** Excel preview cell-error — matches Spring
 *  `VasAccountExcelFieldError`. `field` is the column id
 *  (`vas_acct_cd` / `vas_acct_nm`). `message` is pre-localized
 *  server-side, so the preview tooltip renders it verbatim.
 *  `code` is the category the frontend filters on. */
export interface ApiVasAccountExcelFieldError {
    field: string;
    code: ApiVasAccountExcelErrorCode;
    message: string;
}

export interface ApiVasAccountExcelPreviewRow {
    row_index: number;
    vas_acct_cd: string;
    vas_acct_nm: string;
    valid: boolean;
    errors: ApiVasAccountExcelFieldError[];
}

export interface ApiVasAccountExcelPreview {
    rows: ApiVasAccountExcelPreviewRow[];
    total_count: number;
    completed_count: number;
    error_count: number;
}

export interface ApiVasAccountExcelImportRequest {
    upld_optn: "A" | "R";
    rows: Array<{ vas_acct_cd: string; vas_acct_nm: string }>;
}

export interface ApiVasAccountExcelImportResult {
    inserted_count: number;
    replaced_count: number;
}

/**
 * Locales for which a pre-made VAS Account upload template ships
 * under {@code wecms-web/public/templates/vas-account/}. Copied
 * from the legacy project at
 * {@code WECMS DEV/WECMS_STATIC/web/file/excel/VN/WeCMS_VAS_Accounts_Bulk_Upload_{EN,KO,VI}.xlsx}.
 * The refactor's URL is slug-scoped ({@code /templates/vas-account/…})
 * — the legacy's country-prefixed {@code /file/excel/VN/…} layout is
 * intentionally dropped because "VN" was a per-deployment artifact of
 * the JEX setup, not meaningful for the refactor. KM has no template
 * in the legacy set; the picker falls back to EN.
 */
const TEMPLATE_LOCALES = ["EN", "KO", "VI"] as const;
type TemplateLocale = (typeof TEMPLATE_LOCALES)[number];

/**
 * Trigger a browser download of the pre-made VAS Account Excel
 * template. Locale-aware: the user's active locale picks the matching
 * static asset under {@code /templates/vas-account/}. KM falls back to
 * EN because the legacy project never shipped a Khmer template.
 *
 * Mirrors legacy {@code comm_0217_002.ts fnDownloadExcelForm}: builds
 * a plain anchor + locale-aware URL, appends a {@code yyyyMMdd}
 * timestamp to defeat the browser cache, and forces a custom download
 * filename of the same shape.
 *
 * No backend round-trip — the file is a static asset served by
 * Next.js from {@code public/}.
 */
export function downloadVasAccountTemplate(locale: string): void {
    const upper = locale.toUpperCase();
    const safe: TemplateLocale =
        (TEMPLATE_LOCALES as readonly string[]).includes(upper)
            ? (upper as TemplateLocale)
            : "EN";

    const dateTime = formatYyyyMmDd(new Date());
    const url = `/templates/vas-account/WeCMS_VAS_Accounts_Bulk_Upload_${safe}.xlsx?${dateTime}`;
    const filename = `WeCMS_VAS_Accounts_Bulk_Upload_${safe}_${dateTime}.xlsx`;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

/** `yyyyMMdd` — matches the legacy {@code moment().format("YYYYMMDD")}
 *  the cache-buster query relies on. Local time (legacy used the
 *  browser's `new Date()` too — keeps behaviour identical). */
function formatYyyyMmDd(d: Date): string {
    const y = d.getFullYear().toString().padStart(4, "0");
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}${m}${day}`;
}

/** Multipart upload: parse + validate. Backend ships every row
 *  (valid + invalid) with pre-localized per-cell error messages. */
export function previewVasAccountExcel(
    file: File,
): Promise<ApiVasAccountExcelPreview> {
    const form = new FormData();
    form.append("file", file);
    return unwrap(
        api.post<ApiResponse<ApiVasAccountExcelPreview>>(
            `${BASE}/excel/preview`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } },
        ),
    );
}

/** Persist the preview rows. `A` = Append (reject DB dups);
 *  `R` = Reset/Replace (soft-delete all live, then insert). Atomic
 *  server-side. */
export function importVasAccountExcel(
    body: ApiVasAccountExcelImportRequest,
): Promise<ApiVasAccountExcelImportResult> {
    return unwrap(
        api.post<ApiResponse<ApiVasAccountExcelImportResult>>(
            `${BASE}/excel/import`,
            body,
        ),
    );
}

/**
 * Soft delete (sets {@code DEL_YN='Y'} server-side). The success
 * envelope carries no payload; resolves to {@code void}. Callers
 * refetch the list after success.
 *
 * <p>Cannot use {@link unwrap} — that helper treats a missing
 * {@code data} field as an error; void responses legitimately omit
 * {@code data} (matches the firm-banking-settings DELETE precedent).
 */
export async function deleteVasAccount(vasAcctSeqNo: string): Promise<void> {
    const path = `${BASE}/${encodeURIComponent(vasAcctSeqNo)}`;
    try {
        const res = await api.delete<ApiResponse<void>>(path);
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}
