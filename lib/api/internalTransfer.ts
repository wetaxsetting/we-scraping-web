import type { AxiosError } from "axios";

import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiApprovalActionRequest,
    ApiCreateScheduledTransferRequest,
    ApiCreateScheduledTransferResponse,
    ApiDispatchRequest,
    ApiParseExcelResponse,
    ApiPaymentLineMatchCandidateListResponse,
    ApiPaymentLineMatchRequest,
    ApiPaymentLineMatchResultResponse,
    ApiPaymentLineUnmatchAllResponse,
    ApiRequestApprovalRequest,
    ApiRequestApprovalResponse,
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
 * delivered by Phase A of `wecms-api/.../domain/payment/internaltransfer`:
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
 *  Mirrors the precedent in `lib/api/firmBankingSettings.ts` / `approval-box.ts`.
 *
 *  Throws only when the backend explicitly signals failure (`status.error
 *  === true`). A successful envelope with `data: null` is legal — void
 *  endpoints (delete, dispatch, updateReportingAccount) return exactly
 *  that shape via `ApiResponse.ok(null)` on the api side, where Jackson's
 *  `@JsonInclude(NON_NULL)` drops the `data` field entirely. Treating
 *  null data as an error caused the regression where successful Delete /
 *  Dispatch responses surfaced as "Error: Success (WBI0000)" on the
 *  client + the list never refreshed because the success branch never
 *  ran. Callers expecting a value (`fetchScheduledTransferList`, etc.)
 *  cast through `as T`; TypeScript catches the misuse if a caller
 *  forgets to type the call. */
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return body.data as T;
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
 * Preview the next `VO_YYMMDD_NNN` document number that will be
 * stamped on the batch's approval row when the user submits Request
 * Approval. Used to populate the read-only "Document No." field on
 * the Request Approval popup so Internal Transfer renders the same
 * friendly id format as Card Transactions instead of falling back
 * to the raw 14-digit `SCDUL_PYMN_NO`.
 *
 * The value is preview-only; the authoritative number is allocated
 * server-side at submit. If another Request Approval lands between
 * this call and the user's submit, the assigned value will
 * increment past the preview.
 */
export async function fetchNextInternalTransferDocNo(): Promise<string> {
    const res = await unwrap<{ doc_no: string }>(
        api.get(`${BASE}/next-doc-no`),
    );
    return res.doc_no;
}

/**
 * Withdraw an in-flight approval request on an Internal Transfer
 * batch — the kebab-menu "Delete" action on the Approval Details
 * popup. Deletes the EXPT_RESOL_MSTR + EXPT_RESOL_APPRVR_INFM rows
 * via the shared `ApprovalBoxFanoutService` and clears the batch's
 * back-stamp (`appr_seq_no`, `erp_file_num`, `appr_stts`) so the row
 * returns to draftable state.
 *
 * Refuses when the request is already in a closed state (Approved
 * or Rejected) — those throw `WBE_VALIDATION`.
 */
export async function withdrawInternalTransferApproval(
    scdulPymnNo: string,
): Promise<void> {
    if (!scdulPymnNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "scdul_pymn_no: required");
    }
    await unwrap<void>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo.trim())}/approval`),
    );
}

/**
 * Replace the approver chain on an in-flight approval request with
 * the chain attached to `apprLineNo` — the kebab-menu "Edit" action.
 * Resets the master back to Pending so the new first approver
 * becomes active. Refuses closed states with `WBE_VALIDATION`.
 */
export async function changeInternalTransferApprovalLine(
    scdulPymnNo: string,
    apprLineNo: number,
): Promise<void> {
    if (!scdulPymnNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "scdul_pymn_no: required");
    }
    await unwrap<void>(
        api.put(
            `${BASE}/${encodeURIComponent(scdulPymnNo.trim())}/approval-line`,
            { appr_line_no: apprLineNo },
        ),
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
 * Shared blob-download helper for the generated 21-column Internal
 * Transfer report. GETs `url?lang=<locale>` as a blob, then triggers a
 * browser save using the server-supplied `Content-Disposition` filename
 * (`WeCMS_Internal_Transfer_download_{LANG}.xlsx`). Blob-encoded error
 * envelopes are re-thrown as {@link ApiCallError} so callers branch on
 * `code` exactly like the JSON endpoints. Mirrors the streaming shape of
 * {@link downloadOriginalExcel}.
 */
export async function streamReportDownload(
    url: string,
    lang: string,
    fallbackName: string,
): Promise<void> {
    await streamBlobDownload(url, { lang }, fallbackName);
}

/**
 * Generalised blob-download core shared by the per-row report download
 * ({@link streamReportDownload}, lang-only params) and the toolbar bulk
 * report download (filter + lang params). Same Content-Disposition
 * parsing and {@link ApiCallError} envelope decoding.
 */
export async function streamBlobDownload(
    url: string,
    params: Record<string, string | undefined>,
    fallbackName: string,
): Promise<void> {
    try {
        const res = await api.get(url, {
            params,
            responseType: "blob",
        });
        const disposition = (res.headers["content-disposition"] as string) ?? "";
        const filename = parseAttachmentFilename(disposition) ?? fallbackName;
        const blob = res.data as Blob;
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
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
 * Excel Download — the generated 21-column report for a Scheduled
 * Transfer batch (legacy `pymn_0009_003_r002`). Backend endpoint:
 * `GET /api/v1/payment/internal-transfer/{id}/report?lang=<locale>`.
 * Loads the locale template (EN/KO/VI; KM/other → EN) and populates one
 * row per transfer detail. This is NOT the original uploaded file — that
 * remains the import source only ({@link downloadOriginalExcel}).
 */
export async function downloadScheduledTransferReport(
    scdulPymnNo: string,
    lang: string,
): Promise<void> {
    await streamReportDownload(
        `${BASE}/${encodeURIComponent(scdulPymnNo)}/report`,
        lang,
        `WeCMS_Internal_Transfer_download_${lang}.xlsx`,
    );
}

/**
 * Excel Download — the generated 21-column report for a Transfer Result
 * batch (legacy `pymn_0010_002_r002`). Same artifact as
 * {@link downloadScheduledTransferReport} but routed through the
 * result-scoped endpoint so `payment-internal-transfer-result` menu
 * authorization applies. Backend endpoint:
 * `GET /api/v1/payment/internal-transfer/results/{id}/report?lang=<locale>`.
 */
export async function downloadTransferResultReport(
    scdulPymnNo: string,
    lang: string,
): Promise<void> {
    await streamReportDownload(
        `${BASE}/results/${encodeURIComponent(scdulPymnNo)}/report`,
        lang,
        `WeCMS_Internal_Transfer_download_${lang}.xlsx`,
    );
}

/**
 * Toolbar Excel — the generated 21-column report for ALL batches in the
 * current Transfer Result filter (legacy `pymn_0002_002_r003` bulk-report
 * parity). Same locale template + column layout as the per-row report;
 * the backend appends every filtered batch's transfer lines into one
 * workbook. Backend endpoint:
 * `GET /api/v1/payment/internal-transfer/results/report?from_date&to_date&srch_wd?&trnf_stts?&lang`.
 * Replaces the old from-scratch 7-column `ExcelExportService` summary.
 */
export async function downloadTransferResultBulkReport(
    filters: { fromDate: string; toDate: string; srchWd?: string; trnfStts?: string },
    lang: string,
): Promise<void> {
    await streamBlobDownload(
        `${BASE}/results/report`,
        {
            from_date: filters.fromDate,
            to_date:   filters.toDate,
            srch_wd:   filters.srchWd?.trim() || undefined,
            trnf_stts: filters.trnfStts || undefined,
            lang,
        },
        `WeCMS_Internal_Transfer_download_${lang}.xlsx`,
    );
}

/**
 * Download one approval-request attachment registered against a
 * batch's APPR_SEQ_NO (the per-row PK in `EXPT_RESOL_FILE`, V208).
 * Mirrors {@link downloadOriginalExcel}'s pattern verbatim — same
 * blob streaming, same Content-Disposition parsing, same
 * `ApiCallError` envelope on failure (`WBE2069` for missing file /
 * wrong tenant).
 *
 * <p>Backend endpoint:
 * `GET /api/v1/payment/internal-transfer/{id}/approval/{apprSeqNo}/attachments/{fileId}`.
 */
export async function downloadApprovalAttachment(
    scdulPymnNo: string,
    apprSeqNo: string,
    fileId: string,
    fileType?: string,
): Promise<void> {
    try {
        const res = await api.get(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}`
                + `/approval/${encodeURIComponent(apprSeqNo)}`
                + `/attachments/${encodeURIComponent(fileId)}`,
            {
                responseType: "blob",
                // Route to EXPT_RESOL_FILE vs EXPT_RESOL_PAY_EVID_FILE
                // (GAP-ATT-1). Omitted → backend defaults to EXPT_RESOL_FILE.
                params: fileType ? { fileType } : undefined,
            },
        );
        const disposition = (res.headers["content-disposition"] as string) ?? "";
        const filename = parseAttachmentFilename(disposition)
            ?? `${scdulPymnNo}-attachment-${fileId}`;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
        // Blob-response error envelope handling — same shape as
        // downloadOriginalExcel; pulled inline to keep the two
        // downloaders independently editable.
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
                    // fall through
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
export function parseAttachmentFilename(disposition: string): string | null {
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


/* ---------------------------------------------------------------------------
 * Banking Match (G21b) — per-line, legacy comm_0197_* domestic path.
 * ------------------------------------------------------------------------- */

/** Candidate bank transactions for an Internal Transfer payment line
 *  (`GET .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match/candidates`). */
export async function fetchInternalTransferMatchCandidates(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
    srchWd?: string,
): Promise<ApiPaymentLineMatchCandidateListResponse> {
    return unwrap<ApiPaymentLineMatchCandidateListResponse>(
        api.get(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/match/candidates`,
            { params: srchWd && srchWd.trim() ? { srch_wd: srchWd.trim() } : undefined },
        ),
    );
}

/** Match an Internal Transfer payment line to a bank transaction
 *  (`POST .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match`). */
export async function matchInternalTransferLine(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
    request: ApiPaymentLineMatchRequest,
): Promise<ApiPaymentLineMatchResultResponse> {
    return unwrap<ApiPaymentLineMatchResultResponse>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/match`,
            request,
        ),
    );
}

/** Unmatch a single Internal Transfer payment line
 *  (`DELETE .../{scdulPymnNo}/lines/{scdulPymnDetlNo}/match`). */
export async function unmatchInternalTransferLine(
    scdulPymnNo: string,
    scdulPymnDetlNo: string,
): Promise<ApiPaymentLineMatchResultResponse> {
    return unwrap<ApiPaymentLineMatchResultResponse>(
        api.delete(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/lines/${encodeURIComponent(scdulPymnDetlNo)}/match`,
        ),
    );
}

/** Unmatch every matched line under an Internal Transfer batch
 *  (`DELETE .../{scdulPymnNo}/matches`). */
export async function unmatchAllInternalTransferLines(
    scdulPymnNo: string,
): Promise<ApiPaymentLineUnmatchAllResponse> {
    return unwrap<ApiPaymentLineUnmatchAllResponse>(
        api.delete(`${BASE}/${encodeURIComponent(scdulPymnNo)}/matches`),
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

/**
 * Submit one Scheduled Transfer batch for approval. Mirrors the
 * legacy `comm_0192_001_c005` entry point at the network boundary —
 * the shape the shared `<RequestApprovalDialog>` posts. Phase A
 * backend stub stamps a synthesised `APPR_SEQ_NO` on the master and
 * writes an audit row; the full BLTB_POST_INFM / EXPT_RESOL_MSTR
 * fan-out lands when those tables are ported.
 *
 * <p>Always multipart so user-supplied attachments (zero-or-more
 * files) reach the backend in one round-trip — the JSON body lives in
 * the {@code request} part, each picked file occupies one
 * {@code attachments} part. When the dialog has no files the
 * {@code attachments} parts are simply omitted; the backend reads
 * {@code request.files = required = false} so the JSON-only call
 * shape from before this MR is still accepted.
 */
export function submitInternalTransferApproval(
    scdulPymnNo: string,
    request: ApiRequestApprovalRequest,
    attachments?: File[],
): Promise<ApiRequestApprovalResponse> {
    const form = new FormData();
    form.append(
        "request",
        new Blob([JSON.stringify(request)], { type: "application/json" }),
    );
    for (const file of attachments ?? []) {
        form.append("attachments", file, file.name);
    }
    return unwrap<ApiRequestApprovalResponse>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/request-approval`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } },
        ),
    );
}

/**
 * Approve / reject the active approval request on one Scheduled
 * Transfer batch. Drives the Approve + Reject footer buttons on
 * `<ApprovalDetailsDialog>` (legacy `comm_0195_001` lines 916-919 →
 * `bltb_0001_003_u001`).
 *
 * <p>Phase A backend stamps {@code APPR_STTS = "C"} (Approve) or
 * {@code "X"} (Reject) on the master + writes an audit row. Surfaces
 * {@code WBE2080} if the batch hasn't been submitted for approval yet
 * (no `APPR_SEQ_NO`), and {@code WBE2081} if the batch has already
 * been approved or rejected (idempotency guard).
 */
export async function actOnInternalTransferApproval(
    scdulPymnNo: string,
    request: ApiApprovalActionRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.post(
            `${BASE}/${encodeURIComponent(scdulPymnNo)}/approval-action`,
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
