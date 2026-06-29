import { api } from "@/lib/axios";
import { APPROVAL_MULTIPART_CONFIG, buildApprovalForm } from "@/lib/api/approvalMultipart";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiResponse,
    ApiWithdrawalAccountRow,
    ApiPaymentLineMatchCandidateRow,
    ApiPaymentLineMatchCandidateListResponse,
    ApiPaymentLineMatchRequest,
    ApiPaymentLineMatchResultResponse,
    ApiApprovalAttachment,
} from "@/lib/types/api";

export { ApiCallError };

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
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

// ---------------------------------------------------------------------------
// HAENGSUNG (PRDT_TYPE='H') Oracle payment Refresh import
// ---------------------------------------------------------------------------
// One shared endpoint backs all four payment types (Vendor / Expense /
// Payroll / Overseas) + ALL — mirrors the single legacy ErpDataRefreshHelper.
// Backend: POST /api/v1/payments/haengsung/refresh
// (HaengsungPaymentRefreshController). The product-type 'H' guard is enforced
// server-side from the signed JWT — the wire never carries the tenant/product.

/** Wire value for `payment_type` (uppercase; backend parses case-insensitively). */
export type HaengsungPaymentType = "VENDOR" | "EXPENSE" | "PAYROLL" | "OVERSEAS" | "ALL";

export interface ApiHaengsungRefreshRequest {
    /** One of VENDOR | EXPENSE | PAYROLL | OVERSEAS | ALL. */
    payment_type: HaengsungPaymentType;
    /** `YYYYMMDD` (single day) or `YYYYMMDD-YYYYMMDD` (inclusive range). */
    period_date: string;
}

/** Import result counts (`HaengsungRefreshResult`). */
export interface ApiHaengsungRefreshResult {
    masters_found: number;
    imported: number;
    skipped: number;
    failed: number;
    details_imported: number;
}

/**
 * Trigger the HAENGSUNG Oracle Refresh import for one payment type over a
 * period window. Pulls draft batches from the external Oracle ERP into WeCMS.
 *
 * Errors raise {@link ApiCallError} carrying `status.code` — notably
 * `WBE_HS_REFRESH_DISABLED` (Oracle integration off in this environment),
 * `WBE_HS_REFRESH_NOT_HAENGSUNG` (non-`H` tenant), `WBE_HS_REFRESH_NO_TAX_ID`.
 */
export function haengsungPaymentRefresh(
    body: ApiHaengsungRefreshRequest,
): Promise<ApiHaengsungRefreshResult> {
    return unwrap(
        api.post<ApiResponse<ApiHaengsungRefreshResult>>(
            "/api/v1/payments/haengsung/refresh",
            body,
        ),
    );
}

export interface ApiOverseasApprover {
    apprvr_id:      string;
    apprvr_nm:      string;
    apprvr_stts:    string;
    apprvr_line_no: string;
    mod_dtm:        string | null;
    reg_img_url:    string | null;
}

export interface ApiOverseasScheduledRow {
    ovrs_pymn_no: string;
    ccy_cd: string;
    ovrs_pymn_type_cd: string;
    titl: string;
    appr_seq_no: string | null;
    total_tran_amt: number;
    tot_trns_cnt: number;
    reg_dtm: string;
    draft_user_id: string | null;
    draft_user_nm: string | null;
    appr_stts: string | null;
    trnf_yn: string;
    apprvr_appr_tot_cnt: number | null;
    apprvr_tot_cnt: number | null;
    appr_dv: string | null;
    doc_no: string | null;
    file_url: string | null;
    out_bank_cd: string | null;
    out_bank_nm: string | null;
    wdrl_act_no: string | null;
    bnfc_nm: string | null;
    ovrs_pymn_type: string;
    pay_date: string | null;
    file_nm: string | null;
    reg_id: string;
    approvers?: ApiOverseasApprover[];
}

export interface ApiOverseasCurrencyTotal {
    ccy_cd: string;
    // Per-currency total over the FULL filtered set (backend OverseasCurrencyTotal.totlAmt).
    totl_amt: number;
    tot_cnt_ccy_cd?: number;
    tot_trns_cnt?: number;
}

export interface ApiOverseasScheduledListResponse {
    total_count: number;
    page: number;
    size: number;
    rows: ApiOverseasScheduledRow[];
    totals: ApiOverseasCurrencyTotal[];
}

// ---------------------------------------------------------------------------
// Result list
// ---------------------------------------------------------------------------

export interface ApiOverseasResultRow {
    ovrs_pymn_no: string;
    ccy_cd: string;
    file_nm: string;
    total_tran_amt: number;
    tot_trns_cnt: number;
    reg_dtm: string;
    draft_user_nm: string | null;
    reg_id: string;
    out_bank_nm: string | null;
    out_bank_cd: string | null;
    wdrl_act_no: string | null;
    trnf_yn: string;
    doc_no: string | null;
    titl: string | null;
    success_count: number;
    failed_count: number;
    /** Per-batch in-progress (pending) transaction count (F2). */
    prs_cnt?: number;
    /** Legacy computed transfer status (F2): "F" all-error, "P" some-pending,
     *  "C" otherwise. Drives the Completed / In-Progress display + filter. */
    trnf_stts?: string | null;
    /** F4b — approval-document key (OVRS_PYMN_SUMR.APPR_SEQ_NO). Keys the
     *  shared Approval Details popup; null for drafts → Approval Ref stays text. */
    appr_seq_no?: string | null;
    /** Scheduled transfer date — OVRS_PYMN_SUMR.PAY_DATE (yyyyMMdd). */
    pay_date?: string | null;
    /** Approval workflow status — EXPT_RESOL_MSTR.APPR_STTS. */
    appr_stts?: string | null;
    /** Approver display name — resolved from approval line (complex join, may be absent). */
    apprvr_nm?: string | null;
}

export interface ApiOverseasResultListResponse {
    total_count: number;
    page: number;
    size: number;
    rows: ApiOverseasResultRow[];
    totals: ApiOverseasCurrencyTotal[];
}

export interface OverseasScheduledListParams {
    from_date: string;
    to_date: string;
    appr_type_cd?: string[];
    keyword?: string;
    page?: number;
    size?: number;
    sort_field?: string;
    sort_direction?: "ASC" | "DESC";
}

export const fetchOverseasScheduledList = async (
    params: OverseasScheduledListParams,
): Promise<ApiOverseasScheduledListResponse> => {
    return unwrap(
        api.get<ApiResponse<ApiOverseasScheduledListResponse>>("/api/v1/payment/overseas-payment/scheduled", { params })
    );
};

/**
 * Firm-banking-capable withdrawal accounts for the Overseas Payment
 * Excel Upload dialog Step 3 — "Withdrawal Bank/Account No." picker.
 *
 * Mirrors legacy {@code comm_1001_001}; same ACCT_MSTR + TB_FIRM_CONF
 * join as internal transfer.
 *
 * Display format: `"${bank_nm} ${acct_no} (${acctTypeLabel} ${ccy_cd})"`.
 *
 * @param ccyCd optional currency filter (e.g. `"USD"`); omit for all.
 */
export const fetchOverseasWithdrawalAccounts = (
    ccyCd?: string,
): Promise<ApiWithdrawalAccountRow[]> => {
    return unwrap(
        api.get<ApiResponse<ApiWithdrawalAccountRow[]>>(
            "/api/v1/payment/overseas-payment/withdrawal-accounts",
            ccyCd ? { params: { ccy_cd: ccyCd } } : undefined,
        ),
    );
};

/**
 * Preview the next `VO_YYMMDD_NNN` document number for the Request Approval
 * popup. Read-only / non-reserving — the authoritative value is stamped at
 * submit. Mirrors `fetchNextInternalTransferDocNo`.
 */
export const fetchNextOverseasDocNo = async (): Promise<string> => {
    const res = await unwrap(
        api.get<ApiResponse<{ doc_no: string }>>("/api/v1/payment/overseas-payment/next-doc-no"),
    );
    return res.doc_no;
};

// ---------------------------------------------------------------------------
// Excel upload preview
// ---------------------------------------------------------------------------

export interface ApiOverseasPaymentExcelFieldError {
    field: string;
    message: string;
}

export interface ApiOverseasPaymentExcelPreviewRow {
    row_index: number;
    currency: string;
    amount: string;
    fee_payer: string;
    beneficiary_code: string;
    memo: string;
    reporting_account: string;
    valid: boolean;
    errors: ApiOverseasPaymentExcelFieldError[];
}

export interface ApiOverseasPaymentExcelPreview {
    rows: ApiOverseasPaymentExcelPreviewRow[];
    total_count: number;
    completed_count: number;
    error_count: number;
}

/** Parse and validate an overseas payment Excel file via the backend.
 *  Returns all rows (valid + invalid) with per-cell error details. */
export function previewOverseasPaymentExcel(
    file: File,
): Promise<ApiOverseasPaymentExcelPreview> {
    const form = new FormData();
    form.append("file", file);
    return unwrap(
        api.post<ApiResponse<ApiOverseasPaymentExcelPreview>>(
            "/api/v1/payment/overseas-payment/excel-preview",
            form,
            { headers: { "Content-Type": "multipart/form-data" } },
        ),
    );
}

// ---------------------------------------------------------------------------
// Excel upload submit
// ---------------------------------------------------------------------------

export interface ApiOverseasPaymentExcelDetailRow {
    trn_seq:      number;
    bnfc_code:    string;
    ccy_cd:       string;
    trnf_amt:     number;
    fee_payer_cd: string;
    memo:         string;
    rprt_acct_cd: string | null;
    bnfc_nm:      string;
    bnfc_bank_nm: string;
    bic_cd:       string;
    bnfc_acct_no: string;
    bnfc_addr:    string;
    /** {@code "Y"} = transferred (success), {@code "N"} = pending. Present on read; absent on upload request. */
    trnf_yn?:     string;
    /** Phase 2 — dispatch-result fields populated server-side via
     *  {@code DispatchResultResolver.resolveOverseas} from
     *  {@code TB_PAY_FILE_MST} / {@code TB_PAY_FILE_DATA}. All null
     *  until the bank-side daemon updates the dispatch rows; the
     *  Result detail page falls back to neutral chrome. */
    proc_stat?:     string | null;
    proc_stat_key?: string | null;
    proc_dttm?:     string | null;
    rslt_dttm?:     string | null;
    rs_cd?:         string | null;
    rs_msg?:        string | null;
    /** OVR-G1 per-line banking-match read fields (Phase B state + Phase D
     *  identity), sourced from {@code OVRS_PYMN_DTLS}. {@code ovrs_pymn_detl_no}
     *  is the line key the match endpoints consume; {@code link_match_yn} drives
     *  the Match-vs-Unmatch CTA. Absent on the upload request shape. */
    ovrs_pymn_detl_no?:  string | null;
    link_match_yn?:      string | null;
    acct_seq_no?:        string | null;
    bank_trns_short_id?: string | null;
    bank_trns_full_id?:  string | null;
}

export interface ApiOverseasPaymentExcelUploadRequest {
    file_nm:         string;
    ccy_cd:          string;
    total_tran_amt:  number;
    tot_trns_cnt:    number;
    wdrl_bank_cd:    string;
    wdrl_bank_nm:    string;
    wdrl_acct_no:    string;
    rows:            ApiOverseasPaymentExcelDetailRow[];
}

export interface ApiOverseasPaymentExcelUploadResult {
    ovrs_pymn_no: string;
}

/**
 * Persist the overseas-payment Excel batch summary and save the physical
 * Excel file to the server storage root.
 *
 * Sends as multipart/form-data with two parts:
 *   - `file`: the original Excel file
 *   - `data`: the JSON metadata
 */
export function submitOverseasPaymentExcel(
    body: ApiOverseasPaymentExcelUploadRequest,
    file: File,
): Promise<ApiOverseasPaymentExcelUploadResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("data", new Blob([JSON.stringify(body)], { type: "application/json" }));
    return unwrap(
        api.post<ApiResponse<ApiOverseasPaymentExcelUploadResult>>(
            "/api/v1/payment/overseas-payment/excel-upload",
            form,
            { headers: { "Content-Type": "multipart/form-data" } },
        ),
    );
}

/**
 * Stream-download the original Excel file attached to an overseas payment batch.
 * Triggers a browser file save using the `Content-Disposition` filename from
 * the server.
 */
export async function downloadOverseasPaymentFile(id: string): Promise<void> {
    const res = await api.get(
        `/api/v1/payment/overseas-payment/scheduled/${encodeURIComponent(id)}/file`,
        { responseType: "blob" },
    );
    const blob = res.data as Blob;
    const cd = res.headers["content-disposition"] as string | undefined;
    let fileName = `OverseasPayment_${id}.xlsx`;
    if (cd) {
        const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
        const plainMatch = cd.match(/filename="?([^";]+)"?/i);
        const raw = utf8Match?.[1] ?? plainMatch?.[1];
        if (raw) fileName = decodeURIComponent(raw);
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Single scheduled row
// ---------------------------------------------------------------------------

export const fetchOverseasScheduledById = (
    id: string,
): Promise<ApiOverseasScheduledRow> =>
    unwrap(
        api.get<ApiResponse<ApiOverseasScheduledRow>>(
            `/api/v1/payment/overseas-payment/scheduled/${encodeURIComponent(id)}`,
        ),
    );

// ---------------------------------------------------------------------------
// Result list + single result row
// ---------------------------------------------------------------------------

export interface OverseasResultListParams {
    from_date: string;
    to_date: string;
    keyword?: string;
    /**
     * F2 — legacy PROC_STAT CSV mirroring the Completed / In-Progress
     * checkboxes: Completed = "0,3", In Progress = "6", omit = all. The
     * backend maps these to the computed TRNF_STTS (legacy
     * pymn_0008_001_r001 getDynamicStatusFilter).
     */
    proc_stat?: string;
    page?: number;
    size?: number;
    sort_field?: string;
    sort_direction?: "ASC" | "DESC";
}

export const fetchOverseasResultList = (
    params: OverseasResultListParams,
): Promise<ApiOverseasResultListResponse> =>
    unwrap(
        api.get<ApiResponse<ApiOverseasResultListResponse>>(
            "/api/v1/payment/overseas-payment/result",
            { params },
        ),
    );

export const fetchOverseasResultById = (
    id: string,
): Promise<ApiOverseasResultRow> =>
    unwrap(
        api.get<ApiResponse<ApiOverseasResultRow>>(
            `/api/v1/payment/overseas-payment/result/${encodeURIComponent(id)}`,
        ),
    );

/**
 * Download the Overseas Payment Result XLSX for all batches matching the
 * current filter. Triggers a browser file-save with the server-supplied filename.
 */
export async function exportOverseasResultList(
    params: OverseasResultListParams,
): Promise<void> {
    const res = await api.get(
        "/api/v1/payment/overseas-payment/result/export",
        { params, responseType: "blob" },
    );
    const blob = res.data as Blob;
    const cd = res.headers["content-disposition"] as string | undefined;
    let fileName = "OverseasPaymentResult.xlsx";
    if (cd) {
        const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
        const plainMatch = cd.match(/filename="?([^";]+)"?/i);
        const raw = utf8Match?.[1] ?? plainMatch?.[1];
        if (raw) fileName = decodeURIComponent(raw);
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Approval Details / Request
// ---------------------------------------------------------------------------

export interface ApiOverseasPaymentDetailResponse {
    ovrs_pymn_no: string;
    titl: string;
    appr_stts: string | null;
    total_tran_amt: number;
    ccy_cd: string;
    tot_trns_cnt: number;
    reg_id: string;
    reg_dtm: string;
    mod_dtm: string | null;
    out_bank_cd: string;
    wdrl_act_no: string;
    wdrl_ccy_cd: string | null;
    doc_no: string | null;
    appr_seq_no: string | null;
    file_nm: string | null;
    file_size: string | null;
    org_file_nm: string | null;
    rows: ApiOverseasPaymentExcelDetailRow[];
    /** GAP-OVS-ATT: approval attachments (UNION of EXPT_RESOL_FILE +
     *  EXPT_RESOL_PAY_EVID_FILE) keyed by APPR_SEQ_NO. Previously never
     *  returned for overseas. Optional for back-compat. */
    attachments?: ApiApprovalAttachment[];
    /** GAP-OVS-MODE: true when this is a legacy M-mode approval
     *  (OVRS_PYMN_MSTR-only) whose per-line detail is not fully supported
     *  yet — `rows` is empty and the popup must not crash. */
    legacy_mmode?: boolean;
    /** Human-readable notice when `legacy_mmode` is true. */
    legacy_mmode_notice?: string | null;
    /** Approval Content note for the popup's "Approval Content" section.
     *  Legacy source = `BLTB_POST_INFM.POST_CONT` joined by `APPR_SEQ_NO`
     *  (NOT `EXPT_RESOL_MSTR.CONT`). null when the batch has no approval
     *  request yet or the note is blank. */
    cont?: string | null;
}

/** Fetch the full batch metadata + per-line beneficiary rows for the
 *  Request Approval or Approval Details dialogs. */
export function fetchOverseasPaymentDetail(
    id: string,
): Promise<ApiOverseasPaymentDetailResponse> {
    return unwrap(
        api.get<ApiResponse<ApiOverseasPaymentDetailResponse>>(
            `/api/v1/payment/overseas-payment/scheduled/${encodeURIComponent(id)}/details`,
        ),
    );
}

// ---------------------------------------------------------------------------
// Overseas banking match (OVR-G1 Phase D) — per-line, keyed on OVRS_PYMN_DETL_NO.
// Reuses the shared VendorExpenseMatchDialog: the candidate-list / match client
// fns map the overseas wire response onto the domestic ApiPaymentLineMatch*
// shapes so the dialog (which only reads `.candidates`) is consumed unchanged.
// ---------------------------------------------------------------------------

/** Raw overseas candidate-list wire shape (echo fields differ from domestic). */
interface ApiOverseasMatchCandidateListResponse {
    ovrs_pymn_no:      string;
    ovrs_pymn_detl_no: string;
    wdrl_act_no:       string | null;
    trnf_amt:          string | null;
    pay_tran_dt:       string | null;
    ccy_cd:            string | null;
    tot_cnt:           number;
    candidates:        ApiPaymentLineMatchCandidateRow[];
}

/** Raw overseas match/unmatch result wire shape. */
interface ApiOverseasMatchResultResponse {
    ovrs_pymn_no:       string;
    ovrs_pymn_detl_no:  string;
    link_match_yn:      string;
    acct_seq_no:        string | null;
    bank_trns_short_id: string | null;
    bank_trns_full_id:  string | null;
    match_log_seq:      string | null;
}

/** Raw overseas unmatch-all result wire shape. */
export interface ApiOverseasUnmatchAllResponse {
    ovrs_pymn_no:    string;
    unmatched_count: number;
}

/**
 * Candidate bank transactions for one overseas line
 * (`GET .../{ovrsPymnNo}/lines/{ovrsPymnDetlNo}/match/candidates`).
 * Returns the domestic candidate-list shape so {@link VendorExpenseMatchDialog}
 * consumes it unchanged (the dialog reads only `.candidates`).
 */
export async function fetchOverseasMatchCandidates(
    ovrsPymnNo: string,
    ovrsPymnDetlNo: string,
    srchWd?: string,
): Promise<ApiPaymentLineMatchCandidateListResponse> {
    const res = await unwrap(
        api.get<ApiResponse<ApiOverseasMatchCandidateListResponse>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(ovrsPymnNo)}`
            + `/lines/${encodeURIComponent(ovrsPymnDetlNo)}/match/candidates`,
            { params: srchWd ? { srch_wd: srchWd } : {} },
        ),
    );
    return {
        scdul_pymn_no:      res.ovrs_pymn_no,
        scdul_pymn_detl_no: res.ovrs_pymn_detl_no,
        wdrl_act_no:        res.wdrl_act_no,
        tran_amt:           res.trnf_amt,
        pay_tran_dt:        res.pay_tran_dt,
        trnf_ccy_cd:        res.ccy_cd,
        tot_cnt:            res.tot_cnt,
        candidates:         res.candidates ?? [],
    };
}

/** Match one overseas line to the selected bank transaction
 *  (`POST .../{ovrsPymnNo}/lines/{ovrsPymnDetlNo}/match`). */
export async function matchOverseasPaymentLine(
    ovrsPymnNo: string,
    ovrsPymnDetlNo: string,
    request: ApiPaymentLineMatchRequest,
): Promise<ApiPaymentLineMatchResultResponse> {
    const res = await unwrap(
        api.post<ApiResponse<ApiOverseasMatchResultResponse>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(ovrsPymnNo)}`
            + `/lines/${encodeURIComponent(ovrsPymnDetlNo)}/match`,
            request,
        ),
    );
    return {
        scdul_pymn_no:      res.ovrs_pymn_no,
        scdul_pymn_detl_no: res.ovrs_pymn_detl_no,
        link_match_yn:      res.link_match_yn,
        acct_seq_no:        res.acct_seq_no,
        bank_trns_short_id: res.bank_trns_short_id,
        bank_trns_full_id:  res.bank_trns_full_id,
        match_log_seq:      res.match_log_seq,
    };
}

/** Unmatch one overseas line (`DELETE .../{ovrsPymnNo}/lines/{ovrsPymnDetlNo}/match`). */
export function unmatchOverseasPaymentLine(
    ovrsPymnNo: string,
    ovrsPymnDetlNo: string,
): Promise<ApiOverseasMatchResultResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiOverseasMatchResultResponse>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(ovrsPymnNo)}`
            + `/lines/${encodeURIComponent(ovrsPymnDetlNo)}/match`,
        ),
    );
}

/** Unmatch every matched line on the batch (`DELETE .../{ovrsPymnNo}/matches`). */
export function unmatchAllOverseasPaymentLines(
    ovrsPymnNo: string,
): Promise<ApiOverseasUnmatchAllResponse> {
    return unwrap(
        api.delete<ApiResponse<ApiOverseasUnmatchAllResponse>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(ovrsPymnNo)}/matches`,
        ),
    );
}

/** Submit an unapproved overseas payment batch to the approval engine.
 *  Returns the allocated APPR_SEQ_NO and the generated DOC_NO (e.g. VO_260521_001). */
export function requestOverseasApproval(
    id: string,
    body: import("@/lib/types/api").ApiRequestApprovalRequest,
    attachments?: File[],
): Promise<{ appr_seq_no: string; doc_no: string | null }> {
    // M-1: multipart so attachments persist into EXPT_RESOL_FILE (legacy parity).
    return unwrap(
        api.post<ApiResponse<{ appr_seq_no: string; doc_no: string | null }>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(id)}/request-approval`,
            buildApprovalForm(body, attachments),
            APPROVAL_MULTIPART_CONFIG,
        ),
    );
}

/** Replace the approver chain on a pending overseas payment batch. */
export function changeOverseasApprovalLine(
    id: string,
    body: { appr_line_no: number; approvers: { apprvr_id: string; apprvr_nm: string }[] },
): Promise<void> {
    return unwrap(
        api.patch<ApiResponse<void>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(id)}/approval-line`,
            body,
        ),
    );
}

/**
 * Retract the pending approval request on an overseas payment batch.
 * Resets the batch to draft state (clears APPR_SEQ_NO / APPR_STTS and
 * deletes EXPT_RESOL_MSTR + EXPT_RESOL_APPRVR_INFM rows).
 * Only allowed while the batch is in pending state (APPR_STTS = 'P').
 */
export function removeOverseasApprovalLine(id: string): Promise<void> {
    return unwrap(
        api.delete<ApiResponse<void>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(id)}/approval-line`,
        ),
    );
}

/**
 * Delete a draft overseas payment batch (summary + detail rows).
 * Only allowed when the batch has never been submitted for approval (no appr_seq_no).
 * Submitted batches must be retracted first via removeOverseasApprovalLine.
 */
export function deleteOverseasDraftBatch(id: string): Promise<void> {
    return unwrap(
        api.delete<ApiResponse<void>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(id)}`,
        ),
    );
}

/** Approve or Reject a submitted overseas payment batch. */
export function actOnOverseasApproval(
    id: string,
    body: { action: "APPROVE" | "REJECT" },
): Promise<void> {
    return unwrap(
        api.post<ApiResponse<void>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(id)}/approval-action`,
            body,
        ),
    );
}

/**
 * Execute the "Transfer" dispatch flow for an approved Overseas batch.
 * Mirrors the SCDUL_PYMN family's `dispatch{Vendor|Expense|Payroll}Payment`
 * wrappers — no request body (Overseas is always SWIFT / File path
 * and the batch's own {@code CCY_CD} is the transfer currency).
 *
 * <p>Wire: {@code POST /api/v1/payment/overseas-payment/{id}/dispatch}.
 * Server writes {@code TB_PAY_FILE_MST} + {@code TB_PAY_FILE_DATA}
 * rows and stamps {@code TRNF_YN='Y'} + {@code TRNF_DT} on the master.
 */
export function dispatchOverseasPayment(id: string): Promise<void> {
    return unwrap(
        api.post<ApiResponse<void>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(id)}/dispatch`,
        ),
    );
}

/**
 * Assign or clear the reporting account for a single detail line.
 * Pass `rprtAcctCd = null` (and `rprtAcctSeqNo = null`) to clear.
 *
 * Both the code and the seq_no are sent together — `CHART_ACCT_SEQ_NO` is the
 * `CHART_ACCT_INFM` PK identity (the code alone is non-unique), so the pair
 * must stay consistent (legacy `pymn_0007_001_u001` parity).
 */
export async function saveOverseasReportingAccount(
    id: string,
    trnSeq: number,
    rprtAcctCd: string | null,
    rprtAcctSeqNo: string | null,
): Promise<void> {
    try {
        const res = await api.patch<ApiResponse<void>>(
            `/api/v1/payment/overseas-payment/${encodeURIComponent(id)}/details/${trnSeq}/reporting-account`,
            { rprt_acct_cd: rprtAcctCd, rprt_acct_seq_no: rprtAcctSeqNo },
        );
        const env = res.data;
        if (env.status.error) throw new ApiCallError(env.status.code, env.status.message);
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", (e as { message?: string }).message ?? "Network error");
    }
}
