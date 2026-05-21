import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiEInvoiceListResponse,
    ApiOperationStatusListResponse,
    ApiResponse,
} from "@/lib/types/api";

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
     * Invoice-status filter — exact match against
     * {@code EINV_INVOICESTATUS}. Frontend MR B sends the canonical
     * English form ({@code Original} / {@code Replacement} /
     * {@code Adjustment} / {@code Cancelled}); the backend wire-level
     * filter is planned per IR-4 but not yet implemented (Phase 2 will
     * either land an {@code invoiceStatus} param server-side or
     * run regex matching). Until then, this param flows through and
     * is silently ignored — the frontend additionally applies a
     * client-side post-filter on the rendered page slice so the
     * dropdown is visibly functional. See {@code <EInvoicesClient>}
     * for the stop-gap details.
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
