import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import { unwrap } from "./common/unwrap";
import type { ApiResponse } from "@/lib/types/api";

/**
 * Settings > Purpose API client. Mirrors the Phase 2 backend at
 * `wecms-api/src/main/java/com/kosign/wecms/domain/setting/
 * purposesettings/`.
 *
 * Wire convention: lowercase snake_case for every field (CTO directive
 * 2026-05-08; backend's global Jackson SNAKE_CASE strategy converts the
 * camelCase Java records on the way out). The frontend mirrors the wire
 * shape directly here; the camelCase in-memory shape lives in
 * `components/settings/purpose/types.ts` (`PurposeNode`) and is
 * produced by {@link mapPurposeSettingRow} below — translation happens
 * exactly at this boundary per the workspace API naming rules.
 *
 * Endpoints implemented (all 7 backend operations covered):
 * - GET    `/api/v1/settings/purpose-settings[?keyword=]`        — list (legacy `_r001` + `_r002` merged)
 * - GET    `/api/v1/settings/purpose-settings/{use_usag_cd}`     — detail
 * - POST   `/api/v1/settings/purpose-settings`                   — create
 * - PUT    `/api/v1/settings/purpose-settings/{use_usag_cd}`     — update
 * - DELETE `/api/v1/settings/purpose-settings/{use_usag_cd}`     — soft-delete
 * - PUT    `/api/v1/settings/purpose-settings/order`             — reorder
 * - POST   `/api/v1/settings/purpose-settings/excel/preview`     — Excel parse + validate
 * - POST   `/api/v1/settings/purpose-settings/excel/import`      — Excel commit (pure append)
 */

import type { PurposeNode } from "@/components/settings/purpose/types";

/* ------------------------------------------------------------------ */
/*  Wire types — match the backend DTO records 1:1 (snake_case)        */
/* ------------------------------------------------------------------ */

/** One row of the list / detail wire shape — level-1 rows carry their
 *  `children`; level-2 rows have `null` children. */
export interface ApiPurposeSettingRow {
    use_usag_cd: string;
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont: string | null;
    parent_use_usag_cd: string | null;
    disp_yn: "Y" | "N";
    disp_ord: number | null;
    used_in_transactions: boolean;
    mod_id: string | null;
    mod_dtm: string | null;
    children: ApiPurposeSettingRow[] | null;
}

/** Outer envelope for the list endpoint. */
export interface ApiPurposeSettingListResponse {
    list: ApiPurposeSettingRow[];
}

/** Detail-by-PK shape — flat (no `children`). Also used as the
 *  post-write echo of Create / Update. */
export interface ApiPurposeSettingDetail {
    use_usag_cd: string;
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont: string | null;
    parent_use_usag_cd: string | null;
    disp_yn: "Y" | "N";
    disp_ord: number | null;
    used_in_transactions: boolean;
    mod_id: string | null;
    mod_dtm: string | null;
}

/** Create request body. Mirrors backend `PurposeSettingCreateRequest`
 *  Bean Validation:
 *  - `hand_use_usag_cd` — required, ≤ 20 chars
 *  - `use_usag_nm` — required, ≤ 255 chars
 *  - `use_usag_cont` — optional, ≤ 500 chars
 *  - `parent_use_usag_cd` — optional, ≤ 20 chars
 *  - `disp_yn` — optional ("Y" / "N"; defaults to "Y") */
export interface ApiPurposeSettingCreateRequest {
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont?: string | null;
    parent_use_usag_cd?: string | null;
    disp_yn?: "Y" | "N";
}

/** Update request body. Same shape as Create; the path PK
 *  (`use_usag_cd`) is immutable so it stays out of the body. */
export type ApiPurposeSettingUpdateRequest = ApiPurposeSettingCreateRequest;

/** One `(use_usag_cd, disp_ord)` pair in the Reorder payload. */
export interface ApiPurposeReorderItem {
    use_usag_cd: string;
    disp_ord: number;
}

export interface ApiPurposeReorderRequest {
    items: ApiPurposeReorderItem[];
}

/* ------------------------------------------------------------------ */
/*  Excel preview + import wire types — mirror Spring                  */
/*  `PurposeExcelFieldError` / `PurposeExcelPreviewRow` /              */
/*  `PurposeExcelPreview` / `PurposeExcelImportRequest` /              */
/*  `PurposeExcelImportResult`. Two-step preview / import flow         */
/*  mirrors the VAS Account precedent (legacy comm_0187_004 family).   */
/* ------------------------------------------------------------------ */

/** Per-cell error category codes — match Spring
 *  {@code PurposeExcelService.ERR_*}. The frontend never branches on
 *  the localized message string; the category is the stable contract. */
export type ApiPurposeExcelErrorCode =
    | "required"
    | "length"
    | "dup_file"
    | "dup_db"
    | "parent_not_found"
    | "parent_not_root";

/** One per-cell error — `field` is the wire column id
 *  (`hand_use_usag_cd` / `use_usag_nm` / `use_usag_cont` /
 *  `parent_use_usag_cd`); `message` is pre-localized server-side so
 *  the preview tooltip renders it verbatim. */
export interface ApiPurposeExcelFieldError {
    field: string;
    code: ApiPurposeExcelErrorCode;
    message: string;
}

export interface ApiPurposeExcelPreviewRow {
    row_index: number;
    hand_use_usag_cd: string;
    use_usag_nm: string;
    use_usag_cont: string;
    parent_use_usag_cd: string;
    valid: boolean;
    errors: ApiPurposeExcelFieldError[];
}

export interface ApiPurposeExcelPreview {
    rows: ApiPurposeExcelPreviewRow[];
    total_count: number;
    completed_count: number;
    error_count: number;
}

export interface ApiPurposeExcelImportRequest {
    rows: Array<{
        hand_use_usag_cd: string;
        use_usag_nm: string;
        use_usag_cont: string | null;
        parent_use_usag_cd: string | null;
    }>;
}

export interface ApiPurposeExcelImportResult {
    inserted_count: number;
}

/* ------------------------------------------------------------------ */
/*  Endpoint wrappers — `unwrap` shape mirrors firmBankingSettings.ts  */
/* ------------------------------------------------------------------ */

const BASE = "/api/v1/settings/purpose-settings";

// `unwrap` is the shared canonical helper imported from ./common/unwrap (H-2).

/** Fetch the active refactor-scope tree for the current tenant.
 *  Optional `keyword` matches against `use_usag_nm` (case-insensitive
 *  substring; merged from legacy `_r002` into the list endpoint). */
export function fetchPurposeSettings(
    keyword?: string,
): Promise<ApiPurposeSettingListResponse> {
    const params = keyword && keyword.trim() ? { keyword: keyword.trim() } : undefined;
    return unwrap(
        api.get<ApiResponse<ApiPurposeSettingListResponse>>(BASE, { params }),
    );
}

/** Fetch one row by system PK. Backend surfaces `WBE_VALIDATION` when
 *  the row is missing for the current tenant (single envelope — no
 *  cross-tenant existence leak). */
export function fetchPurposeSetting(
    useUsagCd: string,
): Promise<ApiPurposeSettingDetail> {
    return unwrap(
        api.get<ApiResponse<ApiPurposeSettingDetail>>(
            `${BASE}/${encodeURIComponent(useUsagCd)}`,
        ),
    );
}

/** Create a new purpose. Backend errors:
 *  - `WBW1152` — duplicate `hand_use_usag_cd`
 *  - `WBW1138` — duplicate `use_usag_nm`
 *  - `WBE_VALIDATION` — invalid parent / self-parent / Bean Validation */
export function createPurposeSetting(
    body: ApiPurposeSettingCreateRequest,
): Promise<ApiPurposeSettingDetail> {
    return unwrap(
        api.post<ApiResponse<ApiPurposeSettingDetail>>(BASE, body),
    );
}

/** Update editable fields. Path PK is immutable; per legacy parity
 *  (OQ-4) the backend does NOT duplicate-check `hand_use_usag_cd` on
 *  update — only `use_usag_nm` (excluding self). */
export function updatePurposeSetting(
    useUsagCd: string,
    body: ApiPurposeSettingUpdateRequest,
): Promise<ApiPurposeSettingDetail> {
    return unwrap(
        api.put<ApiResponse<ApiPurposeSettingDetail>>(
            `${BASE}/${encodeURIComponent(useUsagCd)}`,
            body,
        ),
    );
}

/** Soft-delete (`use_yn = 'N'`). Returns `WBE1199` when blocked —
 *  either the row has active children OR (per OQ-5) the row / any
 *  active child is referenced by an active banking-transaction-history
 *  / payment / transfer record. Per OQ-8 both cases share one wire
 *  code; the localized message reads "this purpose or one of its
 *  sub-purposes is in use". */
export async function deletePurposeSetting(useUsagCd: string): Promise<void> {
    const path = `${BASE}/${encodeURIComponent(useUsagCd)}`;
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

/** Bulk reorder. Returns the refreshed list (server-authoritative
 *  order after the write commits). */
export function reorderPurposeSettings(
    body: ApiPurposeReorderRequest,
): Promise<ApiPurposeSettingListResponse> {
    return unwrap(
        api.put<ApiResponse<ApiPurposeSettingListResponse>>(
            `${BASE}/order`,
            body,
        ),
    );
}

/* ------------------------------------------------------------------ */
/*  Excel — template / preview / import (legacy comm_0187_004 family)  */
/* ------------------------------------------------------------------ */

/** Locales for which a pre-made Purpose upload template ships under
 *  {@code wecms-web/public/templates/purpose/}. EN/KO/VI each have their
 *  own localized file (headers in the matching language); any other
 *  locale (e.g. KM) falls back to EN so the download never 404s. Mirrors
 *  the VAS Account convention — single {@code .xlsx} extension per
 *  locale. To add a new localized template, commit
 *  {@code WeCMS_Purpose_Bulk_Upload_{LOCALE}.xlsx} and add the locale
 *  here — no other code change is needed. */
const TEMPLATE_LOCALES = ["EN", "KO", "VI"] as const;
type TemplateLocale = (typeof TEMPLATE_LOCALES)[number];

/**
 * Trigger a browser download of the pre-made Purpose Excel template.
 * Locale-aware: the user's active locale picks the matching static
 * asset under {@code /templates/purpose/} (EN/KO/VI have localized
 * headers). Any locale without an on-disk template (e.g. KM) falls back
 * to the EN template so the download never 404s.
 *
 * No backend round-trip — the file is a static asset served by
 * Next.js from {@code public/}.
 */
export function downloadPurposeTemplate(locale: string): void {
    const upper = locale.toUpperCase();
    const safe: TemplateLocale =
        (TEMPLATE_LOCALES as readonly string[]).includes(upper)
            ? (upper as TemplateLocale)
            : "EN";

    const dateTime = formatYyyyMmDd(new Date());
    const url = `/templates/purpose/WeCMS_Purpose_Bulk_Upload_${safe}.xlsx?${dateTime}`;
    const filename = `WeCMS_Purpose_Bulk_Upload_${safe}_${dateTime}.xlsx`;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

/** Multipart upload: parse + validate. Backend ships every row
 *  (valid + invalid) with pre-localized per-cell error messages.
 *  Errors surface as {@link ApiCallError} when the workbook can't be
 *  parsed at all (WBE2042 header / WBE2043 corrupt / WBE2041 row cap). */
export function previewPurposeExcel(
    file: File,
): Promise<ApiPurposeExcelPreview> {
    const form = new FormData();
    form.append("file", file);
    return unwrap(
        api.post<ApiResponse<ApiPurposeExcelPreview>>(
            `${BASE}/excel/preview`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } },
        ),
    );
}

/** Persist the preview rows. Purpose is append-only — there is no
 *  reset/replace mode (no equivalent of VAS Account's wipe path).
 *  Atomic server-side; any row's validation / parent-resolve / PK
 *  collision rolls back the entire batch. */
export function importPurposeExcel(
    body: ApiPurposeExcelImportRequest,
): Promise<ApiPurposeExcelImportResult> {
    return unwrap(
        api.post<ApiResponse<ApiPurposeExcelImportResult>>(
            `${BASE}/excel/import`,
            body,
        ),
    );
}

function formatYyyyMmDd(d: Date): string {
    const y = d.getFullYear().toString().padStart(4, "0");
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}${m}${day}`;
}

/* ------------------------------------------------------------------ */
/*  Wire ↔ in-memory mapper                                            */
/* ------------------------------------------------------------------ */

/**
 * Translate one wire row into the in-memory `PurposeNode` the static-UI
 * components already consume. Recursively maps `children` so the tree
 * shape produced by the backend's `assembleTree` lands intact.
 *
 * - `description` defaults to `"-"` when empty so the table cell never
 *   renders a literal blank (mirrors the existing mock convention).
 * - `enabled` derives from `disp_yn === "Y"`.
 * - `parentCode` carries the parent's *user-visible* code where one
 *   exists — translated via the parent index built at call-site (the
 *   wire field is the system `use_usag_cd`, the frontend form picker
 *   shows hand codes).
 */
export function mapPurposeSettingRow(
    api: ApiPurposeSettingRow,
    parentHandCdByCode?: Map<string, string>,
): PurposeNode {
    const parentHandCd =
        api.parent_use_usag_cd && parentHandCdByCode
            ? parentHandCdByCode.get(api.parent_use_usag_cd) ?? null
            : null;
    return {
        id: api.use_usag_cd,
        useUsagCd: api.use_usag_cd,
        code: api.hand_use_usag_cd,
        name: api.use_usag_nm,
        // Empty description renders as a blank cell — legacy
        // `comm_0187_001.ts:731` uses null2void ("" ), never a "-" dash.
        description: api.use_usag_cont && api.use_usag_cont.trim()
            ? api.use_usag_cont
            : "",
        enabled: api.disp_yn === "Y",
        usedInTransactions: api.used_in_transactions,
        parentSystemCd: api.parent_use_usag_cd ?? null,
        parentHandCd,
        modId: api.mod_id ?? undefined,
        modDtm: api.mod_dtm ?? undefined,
        dispOrd: api.disp_ord ?? undefined,
        children: api.children?.map((c) =>
            mapPurposeSettingRow(c, parentHandCdByCode),
        ),
    };
}

/** Build the level-1 `use_usag_cd → hand_use_usag_cd` map the
 *  `mapPurposeSettingRow` mapper uses to resolve the parent picker's
 *  display value. Walks the top-level list only — the hierarchy is
 *  capped at depth 2 so children never carry their own children, and
 *  only level-1 rows are eligible parents. */
export function buildParentHandCdIndex(
    rows: ApiPurposeSettingRow[],
): Map<string, string> {
    const idx = new Map<string, string>();
    for (const r of rows) {
        if (r.parent_use_usag_cd === null) {
            idx.set(r.use_usag_cd, r.hand_use_usag_cd);
        }
    }
    return idx;
}
