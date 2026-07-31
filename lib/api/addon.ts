import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/file";
import {
    exportExcel,
    type ExcelExportColumn,
    type ExcelExportSort,
} from "@/lib/excel";
import { unwrap, ApiCallError } from "./common/unwrap";
import { mapEInvoiceDetail, toAnnexListResult, toAnnexInvoicePage } from "./mappers";
import type { EInvoiceDetail } from "@/components/addon/einvoices/detailTypes";
import type { AnnexListResult, AnnexInvoicePage } from "@/components/addon/tax-filing/types";
import type {
    ApiEInvoiceDecryptRequest,
    ApiEInvoiceDecryptResponse,
    ApiEInvoiceDetailResponse,
    ApiEInvoiceListResponse,
    ApiEInvoiceScrapeRequest,
    ApiEInvoiceScrapeResult,
    ApiEInvoiceScrapeDetailRequest,
    ApiEInvoiceScrapeDetailResult,
    ApiEInvoiceHistoryResponse,
    ApiEInvoiceDetailHistoryResponse,
    ApiOperationStatusListResponse,
    ApiOperationStatusRow,
    ApiSaveDraftVatDeclarationRequest,
    ApiVatDeclarationDetail,
    ApiVatDeclarationListResponse,
    ApiAnnexListResponse,
    ApiAnnexInvoiceListResponse,
    AnnexType,
    ApiResponse,
} from "@/lib/types/api";

// `unwrap` is the shared canonical helper imported from ./common/unwrap (H-2).

/**
 * Void-endpoint variant of {@link unwrap}: checks only `status.error`.
 *
 * The shared helper also treats a missing `data` as a failure, which is
 * wrong for endpoints that legitimately return no payload (DELETE). Those
 * responses come back as `{ status: { error: false, code: "WBI0000" }, data: null }`
 * and would otherwise surface as an Error dialog reading "Success".
 * The H-2 note sanctions a local variant for void/empty-data-tolerant modules.
 */
async function unwrapVoid(
    promise: Promise<{ data: ApiResponse<unknown> }>,
): Promise<null> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return null;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Add-on Service API — e-Invoices + Operation Status. Sales/Expenses share
 * one backend endpoint (`/api/v1/addon/einvoices`) keyed on `type=SALES|EXPENSE`.
 */

/**
 * Wire shape for the e-Invoice list call. Mirrors the Backend MR A + B
 * controller params verbatim — see
 * `wecms-api/.../controller/EInvoiceController.java`.
 *
 * <p>{@code from} / {@code to} are <b>required</b> per rule IR-3 — the
 * frontend MUST always supply a non-empty range (the wrapper component
 * defaults to last-30-days when the user hasn't picked a range).
 *
 * <p>Sort + pagination defaults match the backend's: omit `sortField` /
 * `sortDirection` to fall back to legacy `ISSU_DT DESC, REG_DTM DESC`;
 * omit `page` for `0`; omit `size` for `10` (clamped to `100`).
 */
export type FetchEInvoicesParams = {
    type: "SALES" | "EXPENSE";
    /** Required — `YYYYMMDD` format. */
    from: string;
    /** Required — `YYYYMMDD` format. */
    to: string;
    /**
     * Case-insensitive partial match across the IR-5 5-column subset
     * (`DOC_ID`, `TRCO_CMNM`, `TRCO_TAX_ID`, `EINV_INVOICESYMBOL`,
     * `DISP_DOC_ID`). Backend escapes `%` / `_` / `!` server-side.
     * Omit (or pass blank) for no keyword filter.
     */
    keyword?: string;
    /**
     * Invoice-status filter — server-side exact match against
     * {@code EINV_INVOICESTATUS} (2026-06-30, full legacy parity with
     * {@code einv_0001_001_r001_act.jsp:88-92}). The value is the
     * canonical stored <b>Vietnamese</b> GDT string per dropdown option
     * (e.g. {@code "Hóa đơn mới"}, {@code "Hóa đơn đã bị hủy"}), produced
     * by {@code toWireStatusValue} — NOT a localized label. The backend
     * applies it to both the paged query and the totals aggregate, so
     * pagination + currency totals stay status-aware. Omit (or pass
     * {@code undefined}) for "All Invoice Status" — no status predicate.
     */
    status?: string;
    /** Zero-based page index. */
    page?: number;
    /** Rows per page (server clamps to `100`). */
    size?: number;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
};

export function fetchEInvoices(
    params: FetchEInvoicesParams,
): Promise<ApiEInvoiceListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiEInvoiceListResponse>>("/api/v1/addon/einvoices", {
            params,
        }),
    );
}

/**
 * "View e-Invoice Details" — full single-invoice document for the shared
 * Sales / Expenses popup. Refactor port of legacy `einv_0002_001_r001`
 * (`GET /api/v1/addon/einvoices/{docId}?type=…`). Not found / hand-registered
 * → `WBE2019`; wrong type → `WBE2002` (both surface as `ApiCallError`).
 */
export async function fetchEInvoiceDetail(
    docId: string,
    type: "SALES" | "EXPENSE",
): Promise<EInvoiceDetail> {
    const wire = await unwrap(
        api.get<ApiResponse<ApiEInvoiceDetailResponse>>(
            `/api/v1/addon/einvoices/${encodeURIComponent(docId)}`,
            { params: { type } },
        ),
    );
    return mapEInvoiceDetail(wire);
}

// Print + PDF are generated client-side from the modal's own <InvoiceDocument>
// DOM (see components/addon/einvoices/ViewEInvoiceDetailsModal.tsx + lib/print
// printElement + lib/pdf downloadElementAsPdf), so all three surfaces are
// identical. There is intentionally no server print/PDF endpoint.

/**
 * "Update" (scrape) save — refactor port of legacy {@code nxisas_einvoice_c001}.
 *
 * <p>The browser drives the local NXiSAS engine
 * ({@code LOGIN → INVOICE_LIST}), decrypts the result client-side, and
 * POSTs the structured invoice rows here; the backend re-validates and
 * upserts into {@code BUSA_DOC_MSTR} plus one {@code EXT_TRAN_CALL_HIS}
 * audit row. This is the local-engine flow — NOT an external API
 * integration (the engine itself runs on the user's machine).
 */
/**
 * GDT engine-payload decrypt — refactor port of the legacy
 * {@code nxisas_decrypt} action for the e-Invoice scrape flow.
 *
 * <p>The browser drives the engine with {@code nonDecrypt:true} (legacy
 * parity), so every job's {@code Output.Result} arrives as Coocon
 * SEED-CBC ciphertext. This posts the raw callback array to the backend,
 * which decrypts each {@code Output.Result} with the licensed
 * {@code ISASSeedCBC} and returns the array with each result replaced by
 * its parsed plaintext JSON. The refactor never bundled a client-side
 * cipher (OQ-S2 — resolved server-side 2026-07-14), so this round-trip is
 * what makes the two-phase scrape yield data at all.
 *
 * @param raw    the raw {@code _v2nxisas.callNxisas} callback (array).
 * @param uid    {@code CooconiSASNX.OpenUid} (SEED key material).
 * @param action {@code CooconiSASNX.OpenAction} (SEED IV material).
 * @returns the decrypted callback array, ready for the `extract*` parsers.
 */
export async function decryptEInvoiceEngineData(
    raw: unknown,
    uid: string,
    action: string,
): Promise<unknown> {
    const body: ApiEInvoiceDecryptRequest = {
        nxisas_data: JSON.stringify(raw ?? []),
        nxisas_uid: uid || undefined,
        nxisas_action: action || undefined,
    };
    const res = await unwrap(
        api.post<ApiResponse<ApiEInvoiceDecryptResponse>>(
            "/api/v1/addon/einvoices/decrypt",
            body,
        ),
    );
    try {
        return JSON.parse(res.nxisas_data);
    } catch {
        // Backend returned a non-JSON / unchanged payload (e.g. cipher
        // mismatch left it as ciphertext). Fall back to the raw callback so
        // the parser's own defensive handling decides — never throw here.
        return raw;
    }
}

export function scrapeEInvoices(
    body: ApiEInvoiceScrapeRequest,
): Promise<ApiEInvoiceScrapeResult> {
    return unwrap(
        api.post<ApiResponse<ApiEInvoiceScrapeResult>>(
            "/api/v1/addon/einvoices/scrape-results",
            body,
        ),
    );
}

/**
 * "Update" phase 2 (INVOICE_DETAIL) save — refactor port of legacy
 * {@code nxisas_einvoice_c002}.
 *
 * <p>After phase 1 ({@link scrapeEInvoices}) persists the invoice list,
 * the browser drives the engine's INVOICE_DETAIL job per listed invoice,
 * decrypts the detail client-side, and POSTs the structured line-item /
 * fee / tax data here. The backend enriches the existing
 * {@code BUSA_DOC_MSTR} row and upserts {@code BUSA_DOC_DETL} /
 * {@code EINV_FEE_DETL} / {@code EINV_TAX_DETL}. Local-engine flow — NOT
 * a server-to-server GDT call.
 */
export function scrapeEInvoiceDetails(
    body: ApiEInvoiceScrapeDetailRequest,
): Promise<ApiEInvoiceScrapeDetailResult> {
    return unwrap(
        api.post<ApiResponse<ApiEInvoiceScrapeDetailResult>>(
            "/api/v1/addon/einvoices/scrape-detail-results",
            body,
        ),
    );
}

/**
 * "Latest Inquiry History" — refactor port of legacy `nxisas_einvhis_r001`.
 * Reads back past GDT scrape calls from `EXT_TRAN_CALL_HIS` for the
 * History popup. `from`/`to` are `YYYYMMDD` (required); `type` scopes to
 * Sales/Expenses (omitted = both); `status` filters success/fail.
 */
export type FetchEInvoiceHistoryParams = {
    type?: "SALES" | "EXPENSE";
    /** `YYYYMMDD`. */
    from: string;
    /** `YYYYMMDD`. */
    to: string;
    status?: "success" | "fail";
};

export function fetchEInvoiceHistory(
    params: FetchEInvoiceHistoryParams,
): Promise<ApiEInvoiceHistoryResponse> {
    const wire: Record<string, string> = { from: params.from, to: params.to };
    if (params.type) wire.type = params.type;
    if (params.status) wire.status = params.status;
    return unwrap(
        api.get<ApiResponse<ApiEInvoiceHistoryResponse>>(
            "/api/v1/addon/einvoices/history",
            { params: wire },
        ),
    );
}

/**
 * "Latest Inquiry — Detail" drill-down — refactor port of legacy
 * `nxisas_einvhis_dt_r001`. Opened from the modal's result-card "View"
 * action (and, later, the History popup); lists the `BUSA_DOC_MSTR`
 * invoices a single GDT inquiry batch produced.
 *
 * - `type` — `SALES` or `EXPENSE` (legacy only rejects the distinct `'E'`
 *   doc type, never Sales `'I'` or Bill `'B'` — the two View links).
 * - `from` / `to` — `YYYYMMDD` issue-date window (the batch's dates).
 * - `modDtm` — the batch timestamp (the phase-1 `/scrape-results`
 *   `mod_dtm`, preserved through phase 2, 14-digit); sent as `mod_dtm`.
 * - `sortField` / `sortDirection` — optional; backend defaults to
 *   `ISSU_DT DESC`.
 */
export type FetchEInvoiceDetailHistoryParams = {
    type: "SALES" | "EXPENSE";
    /** `YYYYMMDD`. */
    from: string;
    /** `YYYYMMDD`. */
    to: string;
    /** `yyyyMMddHHmmss` batch timestamp. */
    modDtm: string;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
};

export function fetchEInvoiceDetailHistory(
    params: FetchEInvoiceDetailHistoryParams,
): Promise<ApiEInvoiceDetailHistoryResponse> {
    const wire: Record<string, string> = {
        type: params.type,
        from: params.from,
        to: params.to,
        mod_dtm: params.modDtm,
    };
    if (params.sortField) wire.sortField = params.sortField;
    if (params.sortDirection) wire.sortDirection = params.sortDirection;
    return unwrap(
        api.get<ApiResponse<ApiEInvoiceDetailHistoryResponse>>(
            "/api/v1/addon/einvoices/detail-history",
            { params: wire },
        ),
    );
}

/**
 * Wire shape for the Operation Status list call. Mirrors the backend
 * `OperationStatusController#list` query params:
 *
 * - `q` — case-insensitive partial match on `COMPANYNAME` OR `TAXCODE`
 *   (legacy `SRCH_WD`, fixed 2-column whitelist). Backend escapes
 *   `%` / `_` / `!` server-side.
 * - `companyStatus` — partial match on the raw GDT Vietnamese
 *   `COMPANYSTATUS` string. Caller sends the raw substring (e.g.
 *   `"đang hoạt động"` / `"ngừng"` / `"tạm"`); display labels go
 *   through i18n on the frontend.
 * - `page` / `size` — zero-based page index + page size; backend
 *   clamps `size` to `100`.
 * - `sortField` / `sortDirection` — common-sort contract. `sortField`
 *   is a View Setting `FIELD_ID` (`COMPANY` / `OPERATION_STATUS` /
 *   `LAST_UPDATE`); unknown values fall back silently to default
 *   ORDER BY (`SEARCHDATETIME DESC, TAXCODE ASC`).
 */
export type FetchOperationStatusParams = {
    q?: string;
    companyStatus?: string;
    page?: number;
    size?: number;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
};

/**
 * Wire response of {@code POST /api/v1/addon/operation-status/inquire}
 * — single Tax ID lookup against the GDT business-registration API.
 * Mirrors backend {@code InquireOperationStatusResponse}.
 */
export type InquireOperationStatusResponse = {
    tax_code: string;
    company_nm: string;
    company_status: string;
    status_cd: string;
    office_add: string;
    representative_first_name: string;
    search_datetime: string;
};

/**
 * "Get Business Info" — call the OSMC → GDT bridge for a single Tax ID.
 * Validation matches the backend: 10 digits, optionally with `-NNN`
 * branch suffix. Errors surface as `ApiCallError` carrying the WBE
 * code so the popup can render the orange warning row.
 */
export function inquireOperationStatus(taxCode: string): Promise<InquireOperationStatusResponse> {
    return unwrap(
        api.post<ApiResponse<InquireOperationStatusResponse>>(
            "/api/v1/addon/operation-status/inquire",
            { tax_code: taxCode },
        ),
    );
}

/**
 * Wire request for {@code POST /api/v1/addon/operation-status} — the
 * Inquire-popup "Save" action. Mirrors backend
 * {@code CreateOperationStatusRequest} + legacy {@code aosv_0001_002_c001}
 * required-field set. {@code company_nm} is optional (legacy doesn't
 * require it); the other five are required. The values are exactly the
 * fields the preceding {@code /inquire} call returned.
 */
export type CreateOperationStatusRequest = {
    tax_code: string;
    company_nm: string;
    company_status: string;
    office_add: string;
    search_datetime: string;
    representative_first_name: string;
};

/**
 * "Save" — persist a GDT-looked-up registration into `OPRT_STTS_INFO`.
 * Create-only: a duplicate `(BIZ_KEY, TAXCODE)` surfaces as an
 * `ApiCallError` carrying `WBE_OPERATION_STATUS_DUPLICATE`. Returns the
 * persisted row in the same wire shape as the list rows
 * ({@link ApiOperationStatusRow}).
 */
export function createOperationStatus(
    body: CreateOperationStatusRequest,
): Promise<ApiOperationStatusRow> {
    return unwrap(
        api.post<ApiResponse<ApiOperationStatusRow>>(
            "/api/v1/addon/operation-status",
            body,
        ),
    );
}

/**
 * Toolbar "Update" — re-poll every cached row in the tenant from the
 * GDT and upsert the refreshed snapshot. Returns the
 * `{total_attempted, updated, failed}` counter for the success toast.
 */
export type UpdateOperationStatusResponse = {
    total_attempted: number;
    updated: number;
    failed: number;
};

/**
 * Toolbar "Update" — re-poll cached rows from the GDT and upsert
 * fresh values. When {@code taxCodes} is omitted / empty the whole
 * tenant cache is re-polled; otherwise only the supplied tax codes
 * are updated (backend silently drops codes that don't belong to the
 * current tenant).
 */
export function updateOperationStatus(
    taxCodes?: string[],
): Promise<UpdateOperationStatusResponse> {
    const body =
        taxCodes && taxCodes.length > 0 ? { tax_codes: taxCodes } : {};
    return unwrap(
        api.post<ApiResponse<UpdateOperationStatusResponse>>(
            "/api/v1/addon/operation-status/update",
            body,
        ),
    );
}

// ── VAT Declarations (Tax Filing) ───────────────────────────────────────────

export type FetchVatDeclarationsParams = {
    year?: number;
    status?: string;
    keyword?: string;
    page?: number;
    size?: number;
};

export function fetchVatDeclarations(
    params?: FetchVatDeclarationsParams,
): Promise<ApiVatDeclarationListResponse> {
    const wire: Record<string, string | number> = {};
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== "") {
                wire[key] = value as string | number;
            }
        }
    }
    return unwrap(
        api.get<ApiResponse<ApiVatDeclarationListResponse>>(
            "/api/v1/addon/vat-declarations",
            { params: Object.keys(wire).length > 0 ? wire : undefined },
        ),
    );
}

export function fetchOperationStatus(
    params?: FetchOperationStatusParams,
): Promise<ApiOperationStatusListResponse> {
    // Strip undefined keys so the URL stays clean (Axios serialises
    // `undefined` as a missing param, but explicit pruning makes the
    // resulting URL deterministic for snapshot tests).
    const wire: Record<string, string | number> = {};
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== "") {
                wire[key] = value as string | number;
            }
        }
    }
    return unwrap(
        api.get<ApiResponse<ApiOperationStatusListResponse>>(
            "/api/v1/addon/operation-status",
            { params: Object.keys(wire).length > 0 ? wire : undefined },
        ),
    );
}

// ── VAT Declaration Create / Detail ──────────────────────────────────────────

export type CreateVatDeclarationRequest = {
    period_type: "M" | "Q";
    period_value: number;
    decl_year: number;
    bsns_line_cd: string;
    annex_bkbr_yn: "Y" | "N";
    annex_bkmv_yn: "Y" | "N";
    annex_reduce8_yn: "Y" | "N";
};

export function createVatDeclaration(
    body: CreateVatDeclarationRequest,
): Promise<ApiVatDeclarationDetail> {
    return unwrap(
        api.post<ApiResponse<ApiVatDeclarationDetail>>(
            "/api/v1/addon/vat-declarations",
            body,
        ),
    );
}

export function fetchVatDeclarationDetail(
    declId: number,
): Promise<ApiVatDeclarationDetail> {
    return unwrap(
        api.get<ApiResponse<ApiVatDeclarationDetail>>(
            `/api/v1/addon/vat-declarations/${declId}`,
        ),
    );
}

/** Delete declaration — DELETE /api/v1/addon/vat-declarations/{sid}. Only valid on Draft status. */
export function deleteVatDeclaration(sid: number): Promise<null> {
    return unwrapVoid(
        api.delete<ApiResponse<null>>(
            `/api/v1/addon/vat-declarations/${sid}`,
        ),
    );
}

/** Save draft — PUT /api/v1/addon/vat-declarations/{sid}. Only valid on Draft status. */
/** Unlock declaration — DELETE /api/v1/addon/vat-declarations/{sid}/lock. Confirmed → Draft. */
export function unlockVatDeclaration(sid: number): Promise<ApiVatDeclarationDetail> {
    return unwrap(
        api.delete<ApiResponse<ApiVatDeclarationDetail>>(
            `/api/v1/addon/vat-declarations/${sid}/lock`,
        ),
    );
}

/** Lock declaration — PUT /api/v1/addon/vat-declarations/{sid}/lock. Draft → Confirmed. */
export function lockVatDeclaration(sid: number): Promise<ApiVatDeclarationDetail> {
    return unwrap(
        api.put<ApiResponse<ApiVatDeclarationDetail>>(
            `/api/v1/addon/vat-declarations/${sid}/lock`,
        ),
    );
}

export function saveDraftVatDeclaration(
    sid: number,
    body: ApiSaveDraftVatDeclarationRequest,
): Promise<ApiVatDeclarationDetail> {
    return unwrap(
        api.put<ApiResponse<ApiVatDeclarationDetail>>(
            `/api/v1/addon/vat-declarations/${sid}`,
            body,
        ),
    );
}

// ─── VAT Declaration Annex Lines ─────────────────────────────────────────────

export type FetchAnnexLinesParams = {
    sid?: number;
    annex_type?: AnnexType;
    io_dv?: "I" | "O";
};

/** GET /api/v1/addon/vat-declarations/{sid}/annex/invoices */
export async function fetchAnnexLines(
    sid: number,
    params?: FetchAnnexLinesParams,
): Promise<AnnexListResult> {
    const wire = await unwrap(
        api.get<ApiResponse<ApiAnnexListResponse>>(
            `/api/v1/addon/vat-declarations/${sid}/annex/invoices`,
            { params: { sid, ...params } },
        ),
    );
    return toAnnexListResult(wire);
}

/**
 * GET /api/v1/addon/vat-declarations/{sid}/export/pdf — A4 PDF of form
 * 01/GTGT (API #12).
 *
 * Binary endpoint: it streams `application/pdf` with a `Content-Disposition`
 * header and never uses the `ApiResponse` envelope, so it goes through
 * {@link downloadFile} rather than `unwrap()`. On a business error the server
 * *does* answer with the JSON envelope — `downloadFile` sniffs that and throws
 * {@link ApiCallError}, so callers can route `WBE_VAT_DECL_NOT_LOCKED` (Draft
 * declarations cannot be printed) to a dialog.
 *
 * @param fallbackFileName used only when the response omits Content-Disposition;
 *                         the server's own name (`[MST]-01_GTGT_TT80-[period].pdf`)
 *                         wins whenever present.
 */
export function exportVatDeclarationPdf(
    sid: number,
    fallbackFileName: string,
): Promise<void> {
    return downloadFile(
        `/api/v1/addon/vat-declarations/${sid}/export/pdf`,
        fallbackFileName,
    );
}

/**
 * GET /api/v1/addon/vat-declarations/{sid}/export/xml — HTKK 01/GTGT (TT80)
 * XML (API #10).
 *
 * Same binary contract as {@link exportVatDeclarationPdf}: `application/xml` +
 * `Content-Disposition`, no envelope, LOCKED-only (Draft →
 * `WBE_VAT_DECL_NOT_LOCKED`).
 */
export function exportVatDeclarationXml(
    sid: number,
    fallbackFileName: string,
): Promise<void> {
    return downloadFile(
        `/api/v1/addon/vat-declarations/${sid}/export/xml`,
        fallbackFileName,
    );
}

/** Provider id for the annex export screen (API #11). Export-only — it is
 *  deliberately NOT seeded in `SYS_SCR_OPTION_WECMS`. */
export const ANNEX_EXPORT_SCREEN_ID = "addon-vat-declaration-annex";

export type ExportAnnexExcelParams = {
    /** Without extension — the controller appends `.xlsx`. */
    fileName: string;
    /** In-sheet title for the merged row-0 header. */
    title: string;
    /** Must stay inside the provider allow-list: IO_DV / SRC_DOC_ID / INV_NO /
     *  INV_SYMBOL / INV_DT / TRCO_TAX_CODE / TRCO_NM / PROD_NM / SPLY_AMT /
     *  VAT_RATE / VAT_AMT / REDUCED_AMT. */
    columns: ExcelExportColumn[];
    filters?: {
        annex_type?: AnnexType;
        io_dv?: "I" | "O";
        search?: string | null;
    };
    sort?: ExcelExportSort | null;
};

/**
 * POST /api/v1/addon/vat-declarations/{sid}/annex/export — XLSX of the annex
 * invoice list (API #11), same data path as `/annex/invoices`.
 *
 * Goes through the shared {@link exportExcel} helper but NOT through
 * `hooks/useExcelExport`: that hook derives its column list from the screen's
 * View Setting items, and this screen is export-only with no
 * `SYS_SCR_OPTION_WECMS` seed — the provider's allow-list is the contract, so
 * callers pass an explicit column list instead (CLAUDE.md §13b deviation).
 *
 * `sid` travels in the path; the server injects `filters.decl_id` itself and
 * ignores any client-sent value.
 */
export function exportVatDeclarationAnnexExcel(
    sid: number,
    params: ExportAnnexExcelParams,
): Promise<void> {
    return exportExcel({
        endpoint: `/api/v1/addon/vat-declarations/${sid}/annex/export`,
        screenId: ANNEX_EXPORT_SCREEN_ID,
        dymAreaId: "default",
        fileName: params.fileName,
        title: params.title,
        columns: params.columns,
        filters: params.filters ?? {},
        sort: params.sort ?? null,
    });
}

/** Hard ceiling so a bad `total_pages` can never spin forever. */
const ANNEX_FETCH_MAX_PAGES = 200;

/**
 * Every annex invoice for one declaration, not just a page.
 *
 * The tabs page through `/annex/invoices`, but an export has to carry the whole
 * set, so this walks the pages and concatenates them. Aggregates (`tax_groups`,
 * `grand_total`) already cover the full filtered set, so the first response's
 * copies are kept as-is.
 *
 * @param size rows per request — larger means fewer round-trips (API cap: 100).
 */
export async function fetchAllAnnexInvoices(
    sid: number,
    params: Omit<FetchAnnexInvoicesParams, "page" | "size"> = {},
    size = 100,
): Promise<AnnexInvoicePage> {
    const first = await fetchAnnexInvoices(sid, { ...params, page: 0, size });
    const rows = [...first.rows];

    const pages = Math.min(first.totalPages, ANNEX_FETCH_MAX_PAGES);
    for (let page = 1; page < pages; page++) {
        const next = await fetchAnnexInvoices(sid, { ...params, page, size });
        if (next.rows.length === 0) break; // defensive: stop on an empty page
        rows.push(...next.rows);
    }
    return { ...first, rows, pageNumber: 0, pageSize: rows.length };
}

export type FetchAnnexInvoicesParams = {
    annex_type?: AnnexType;
    io_dv?: "I" | "O";
    page?: number;   // 0-based (default 0)
    size?: number;   // default 20, max 100
};

/**
 * GET /api/v1/addon/vat-declarations/{sid}/annex/invoices — flat, server-paginated
 * shape (BKMV). Rows are grouped in the UI by `vat_rate_order`.
 */
export async function fetchAnnexInvoices(
    sid: number,
    params?: FetchAnnexInvoicesParams,
): Promise<AnnexInvoicePage> {
    const wire = await unwrap(
        api.get<ApiResponse<ApiAnnexInvoiceListResponse>>(
            `/api/v1/addon/vat-declarations/${sid}/annex/invoices`,
            { params: { sid, ...params } },
        ),
    );
    return toAnnexInvoicePage(wire);
}
