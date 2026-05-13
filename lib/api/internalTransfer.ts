import type { AxiosError } from "axios";

import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiCreateScheduledTransferRequest,
    ApiCreateScheduledTransferResponse,
    ApiDispatchRequest,
    ApiParseExcelResponse,
    ApiResponse,
    ApiScheduledTransferDetailResponse,
    ApiScheduledTransferListResponse,
    ApiTransferResultDetailResponse,
    ApiTransferResultListResponse,
    ApiUpdateReportingAccountRequest,
    ApiWithdrawalAccountRow,
} from "@/lib/types/api";

/**
 * Payment > Internal Transfer API client. Wraps the eight endpoints
 * delivered by Phase A of `wecms-api-main/.../domain/payment/internaltransfer`:
 *
 *   GET    /api/v1/payment/internal-transfer
 *   GET    /api/v1/payment/internal-transfer/{id}
 *   POST   /api/v1/payment/internal-transfer/uploads/parse        (stub)
 *   POST   /api/v1/payment/internal-transfer
 *   PATCH  /api/v1/payment/internal-transfer/{id}/lines/{lineId}/reporting-account
 *   DELETE /api/v1/payment/internal-transfer/{id}
 *   POST   /api/v1/payment/internal-transfer/{id}/dispatch        (stub: stamps TRNF_YN only)
 *   GET    /api/v1/payment/internal-transfer/results
 *   GET    /api/v1/payment/internal-transfer/results/{id}
 *
 * Every call goes through the shared {@link api} Axios instance so the
 * JWT interceptor + 401 session-expired re-auth bus apply uniformly.
 *
 * <p>Phase A scope notes (mirrors backend doc §15.6):
 * <ul>
 *   <li>`uploadParseExcel` returns an empty preview — real Apache POI
 *       parsing lands in a follow-up MR.</li>
 *   <li>`createScheduledTransfer` persists the draft and uploads file
 *       metadata, but does NOT save the Excel bytes to disk yet.</li>
 *   <li>`dispatchScheduledTransfer` stamps `TRNF_YN='Y'` + writes the
 *       audit row, but does NOT insert TB_PAY_TARGET / TB_PAY_FILE_MST
 *       rows (those tables aren't in V85 — backend doc §15.6 follow-up).</li>
 *   <li>`updateReportingAccount` does NOT validate CHART_ACCT_INFM
 *       existence — that entity isn't migrated locally yet.</li>
 * </ul>
 *
 * Business errors arrive as `{ status: { error: true, code, message } }`
 * with HTTP 200; the helpers unwrap the envelope into a typed
 * {@link ApiCallError} so callers can branch on `code` and surface the
 * `traceId` in the global error dialog. Network failures and malformed
 * responses produce the same error type so call sites don't need a
 * separate catch path.
 */

const BASE = "/api/v1/payment/internal-transfer";

/** Single envelope unwrap shared by every endpoint in this client.
 *  Mirrors the precedent in `lib/api/firmBankingSettings.ts` / `approval-box.ts`. */
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error || body.data == null) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return body.data;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as AxiosError<ApiResponse<unknown>>;
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/* ----------------------------------------------------------------------------
 *  Scheduled Transfer (pymn_0009_001 + pymn_0009_003)
 * -------------------------------------------------------------------------- */

export type ScheduledTransferListQuery = {
    fromDate: string;        // yyyyMMdd
    toDate: string;          // yyyyMMdd
    srchWd?: string;
    /** Filter by approval-status code (legacy `APPR_TYPE_CD`). Empty / undefined = all. */
    apprType?: string;
    /** View Setting `FIELD_ID` from `InternalTransferSortField`. */
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

/** Fetch the paged Scheduled Transfer list. Mirrors legacy
 *  `pymn_0009_001_r001` (Phase A read path). */
export async function fetchScheduledTransferList(
    query: ScheduledTransferListQuery,
): Promise<ApiScheduledTransferListResponse> {
    return unwrap<ApiScheduledTransferListResponse>(
        api.get(BASE, {
            params: {
                from_date:       query.fromDate,
                to_date:         query.toDate,
                srch_wd:         query.srchWd ?? undefined,
                appr_type:       query.apprType ?? undefined,
                sort_field:      query.sortField ?? undefined,
                sort_direction:  query.sortDirection ?? undefined,
                page:            query.page ?? 0,
                size:            query.size ?? 10,
            },
        }),
    );
}

/** Fetch the detail (master + per-line) for one batch. Mirrors
 *  `pymn_0009_003_r001`. */
export async function fetchScheduledTransferDetail(
    scdulPymnNo: string,
): Promise<ApiScheduledTransferDetailResponse> {
    return unwrap<ApiScheduledTransferDetailResponse>(
        api.get(`${BASE}/${encodeURIComponent(scdulPymnNo)}`),
    );
}

/**
 * Download the original Excel file attached to a batch. Streams the
 * `application/octet-stream` body via Axios `responseType: "blob"`,
 * then triggers a browser save using the server-supplied
 * `Content-Disposition` filename.
 *
 * <p>Mirrors the ERP Transaction History download pattern at
 * [erpTransactionHistory.downloadFile]. Backend endpoint:
 * `GET /api/v1/payment/internal-transfer/{id}/file`. Errors arrive
 * with `WBE2060` (batch missing / wrong tenant) or `WBE2069`
 * (batch has no file behind it / file unreadable on disk) — caller
 * routes them to `useDialog()` per CLAUDE.md §"Dialog variant".
 */
export async function downloadOriginalExcel(scdulPymnNo: string): Promise<void> {
    try {
        const res = await api.get(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/file`,
            { responseType: "blob" },
        );

        // Parse the server's `Content-Disposition: attachment; filename*=UTF-8''…`
        // header. Falls back to a sensible default when the header is
        // missing (shouldn't happen — the backend always sets it).
        const disposition = (res.headers["content-disposition"] as string) ?? "";
        const filename = parseAttachmentFilename(disposition) ?? `${scdulPymnNo}.xlsx`;

        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoke after the click handler has had a chance to fire.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
        // Blob-response errors arrive with the JSON envelope serialised
        // as a Blob (Axios doesn't auto-parse error bodies when the
        // request asked for a blob). Read the bytes back as text +
        // JSON.parse so the caller sees the same `ApiCallError` shape
        // the JSON endpoints throw.
        if (err && typeof err === "object" && "response" in err) {
            const ax = err as { response?: { data?: Blob } };
            const data = ax.response?.data;
            if (data instanceof Blob) {
                const text = await data.text();
                try {
                    const body = JSON.parse(text) as { status?: { code?: string; message?: string } };
                    if (body.status) {
                        throw new ApiCallError(
                            body.status.code ?? "WBE9999",
                            body.status.message ?? "Download failed",
                        );
                    }
                } catch {
                    // fall through to the generic path below
                }
            }
        }
        if (err instanceof ApiCallError) throw err;
        const e = err as { message?: string };
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Parse RFC 5987 / RFC 6266 attachment filenames. Honours
 * `filename*=UTF-8''…` (preferred — preserves non-ASCII) with a
 * fallback to plain `filename="…"`. Returns null when neither
 * variant is present.
 */
function parseAttachmentFilename(disposition: string): string | null {
    if (!disposition) return null;
    // RFC 5987: filename*=UTF-8''<percent-encoded>
    const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
    if (utf8) {
        try {
            return decodeURIComponent(utf8[1].trim());
        } catch {
            // ignore — fall through
        }
    }
    // RFC 2616: filename="…" or filename=…
    const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
    return plain ? plain[1].trim() : null;
}

/* ----------------------------------------------------------------------------
 *  Excel upload (pymn_0009_002_r001 + _c001)
 * -------------------------------------------------------------------------- */

/**
 * Firm-banking-capable withdrawal accounts the current tenant can pick
 * as the source of an Internal Transfer batch. Drives the Step-3
 * "Withdrawal Bank/Account No." picker in the upload dialog. Mirrors
 * legacy `comm_1001_001` — filters to active current/savings accounts
 * enrolled in firm-banking (TB_FIRM_CONF). Optional `ccyCd` narrows to
 * one currency (matches legacy WSVC input; treated as a no-op on the
 * legacy side but honoured here for forward compatibility).
 */
export async function fetchWithdrawalAccounts(
    ccyCd?: string,
): Promise<ApiWithdrawalAccountRow[]> {
    return unwrap<ApiWithdrawalAccountRow[]>(
        api.get(`${BASE}/withdrawal-accounts`, {
            params: ccyCd ? { ccy_cd: ccyCd } : undefined,
        }),
    );
}

/** Parse + per-line validate an Excel upload. Phase A stub — server
 *  returns empty `rows[]` until POI parsing lands in a follow-up MR
 *  (backend doc §15.6). */
export async function parseInternalTransferExcel(
    file: File,
    bankCd: string,
): Promise<ApiParseExcelResponse> {
    const form = new FormData();
    form.append("file_data", file);
    form.append("bank_cd", bankCd);
    return unwrap<ApiParseExcelResponse>(
        api.post(`${BASE}/uploads/parse`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    );
}

/** Save a draft batch. Multipart body — `file_data` is the original
 *  Excel; `request` is the JSON-part with title + withdrawal info +
 *  per-line array. Phase A stores file metadata only (no disk write
 *  yet — backend doc §15.6). */
export async function createScheduledTransfer(
    file: File | null,
    request: ApiCreateScheduledTransferRequest,
): Promise<ApiCreateScheduledTransferResponse> {
    const form = new FormData();
    if (file) form.append("file_data", file);
    form.append(
        "request",
        new Blob([JSON.stringify(request)], { type: "application/json" }),
    );
    return unwrap<ApiCreateScheduledTransferResponse>(
        api.post(BASE, form, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    );
}

/* ----------------------------------------------------------------------------
 *  Mutations on an existing batch
 * -------------------------------------------------------------------------- */

/** Update the Reporting Account (`CHART_ACCT_*`) on one line. Mirrors
 *  `pymn_0009_002_u002`. */
export async function updateReportingAccount(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
    request: ApiUpdateReportingAccountRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.patch(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/reporting-account`,
            request,
        ),
    );
}

/** Delete a draft batch. Rejected with `WBE2062` when the batch has
 *  been submitted for approval (`APPR_SEQ_NO` set). Mirrors
 *  `pymn_0009_001_d001`. */
export async function deleteScheduledTransfer(scdulPymnNo: string): Promise<void> {
    await unwrap<unknown>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}`),
    );
}

/** Execute the "Transfer" action on an approved batch. Phase A stub —
 *  stamps `TRNF_YN='Y'` + writes an audit row, but does NOT insert
 *  TB_PAY_TARGET / TB_PAY_FILE_MST rows (those tables defer to a
 *  follow-up MR per backend doc §15.6). */
export async function dispatchScheduledTransfer(
    scdulPymnNo: string,
    request: ApiDispatchRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/dispatch`,
            request,
        ),
    );
}

/* ----------------------------------------------------------------------------
 *  Transfer Result (pymn_0010_001 + pymn_0010_002) — read-only
 * -------------------------------------------------------------------------- */

export type TransferResultListQuery = {
    fromDate: string;
    toDate: string;
    srchWd?: string;
    /** Optional `Y`/`N` to filter only dispatched / draft. */
    trnfStts?: "Y" | "N";
    /** View Setting `FIELD_ID` from `InternalTransferResultSortField`. */
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    page?: number;
    size?: number;
};

export async function fetchTransferResultList(
    query: TransferResultListQuery,
): Promise<ApiTransferResultListResponse> {
    return unwrap<ApiTransferResultListResponse>(
        api.get(`${BASE}/results`, {
            params: {
                from_date:       query.fromDate,
                to_date:         query.toDate,
                srch_wd:         query.srchWd ?? undefined,
                trnf_stts:       query.trnfStts ?? undefined,
                sort_field:      query.sortField ?? undefined,
                sort_direction:  query.sortDirection ?? undefined,
                page:            query.page ?? 0,
                size:            query.size ?? 10,
            },
        }),
    );
}

export async function fetchTransferResultDetail(
    scdulPymnNo: string,
): Promise<ApiTransferResultDetailResponse> {
    return unwrap<ApiTransferResultDetailResponse>(
        api.get(`${BASE}/results/${encodeURIComponent(scdulPymnNo)}`),
    );
}
