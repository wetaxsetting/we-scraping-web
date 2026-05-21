import type { AxiosError } from "axios";

import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import type {
    ApiCardListResponse,
    ApiCardManagementListResponse,
    ApiCardTransactionListResponse,
    ApiCardTransactionPatchRequest,
    ApiCardTransactionRow,
    ApiCardTranListPeriodLimitRequest,
    ApiCardTranListPeriodLimitResponse,
    ApiCardRequestApprovalRequest,
    ApiCardRequestApprovalResponse,
    ApiCreateCardsRequest,
    ApiCreateCardsResponse,
    ApiResponse,
    ApiSyncCardTransactionsRequest,
    ApiSyncCardTransactionsResponse,
    ApiUpdateCardActiveRequest,
    ApiUpdateCardInfoRequest,
    ApiUpdateCardReportingAccountRequest,
} from "@/lib/types/api";

/**
 * Payment > Card Transactions API client. Wraps the four endpoints
 * delivered by Phase 2 of
 * `wecms-api-main/.../domain/payment/cardtransactions/`:
 *
 *   GET    /api/v1/payment/card-transactions                   (paged ledger + totals)
 *   GET    /api/v1/payment/card-transactions/cards             (All-Cards filter)
 *   PATCH  /api/v1/payment/card-transactions/{cardSeqNo}       (description / purpose)
 *   PUT    /api/v1/payment/card-transactions/{cardSeqNo}/reporting-account
 *
 * Every call goes through the shared {@link api} Axios instance so the
 * JWT interceptor + 401 session-expired re-auth bus apply uniformly,
 * matching the precedent established by
 * `lib/api/internalTransfer.ts` + `lib/api/erpTransactionHistory.ts`.
 *
 * Business errors arrive as `{ status: { error: true, code, message } }`
 * with HTTP 200; this client unwraps the envelope into a typed
 * {@link ApiCallError} so callers can branch on `code` and surface the
 * trace id in `useDialog()`. Network failures and malformed responses
 * produce the same error type so call sites don't need a separate
 * catch path.
 */

const BASE = "/api/v1/payment/card-transactions";

/** Single envelope unwrap shared by every endpoint in this client.
 *  Mirrors the precedent in `lib/api/internalTransfer.ts`. Treats a
 *  successful envelope with `data === null` as legal — the backend's
 *  void endpoints (PATCH / PUT) return exactly that shape. */
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

/** Wire-shaped query for `GET /api/v1/payment/card-transactions`. The
 *  field names are camelCase here; the fetcher translates them to the
 *  snake_case wire params the controller expects. */
export type FetchCardTransactionsParams = {
    /** Required — yyyyMMdd. */
    fromDt:        string;
    /** Required — yyyyMMdd ≥ fromDt; backend enforces a 365-day cap. */
    toDt:          string;
    /** Optional substring against `MERCH_NM` / `CARD_NM` (ILIKE). */
    srchWd?:       string;
    /** Optional repeated `bank_cd` allow-list. */
    bankCds?:      string[];
    /** Optional repeated `card_no` allow-list. */
    cardNos?:      string[];
    /** "Y" / "N" / blank ("all"). */
    linkYn?:       "Y" | "N" | "";
    /** View Setting FIELD_ID from `CardTrnsHstrSortField`. */
    sortField?:    string;
    sortDirection?: "ASC" | "DESC";
    /** Zero-based page index. */
    page?:         number;
    /** Rows per page (default 15, clamped server-side at 200). */
    size?:         number;
};

/** Fetch the paged ledger + totals envelope. */
export async function fetchCardTransactions(
    query: FetchCardTransactionsParams,
): Promise<ApiCardTransactionListResponse> {
    const params: Record<string, string | number | string[]> = {
        from_dt: query.fromDt,
        to_dt:   query.toDt,
    };
    if (query.srchWd !== undefined && query.srchWd !== "")  params.srch_wd = query.srchWd;
    if (query.bankCds && query.bankCds.length > 0)          params.bank_cd = query.bankCds;
    if (query.cardNos && query.cardNos.length > 0)          params.card_no = query.cardNos;
    if (query.linkYn === "Y" || query.linkYn === "N")       params.link_yn = query.linkYn;
    if (query.sortField)                                    params.sort_field     = query.sortField;
    if (query.sortDirection)                                params.sort_direction = query.sortDirection;
    if (query.page !== undefined)                           params.page = query.page;
    if (query.size !== undefined)                           params.size = query.size;

    return unwrap<ApiCardTransactionListResponse>(
        api.get(BASE, { params }),
    );
}

/** Fetch every card transaction stamped with the given {@code APPR_SEQ_NO}.
 *  Used by the Approval Box's shared `<ApprovalDetailsDialog kind="card">`
 *  popup to populate the Transaction Details grid for an
 *  {@code APPR_DV='33'} row. Backend mirror:
 *  {@code GET /api/v1/payment/card-transactions/by-approval/{apprSeqNo}}. */
export async function fetchCardTransactionsByApproval(
    apprSeqNo: string,
): Promise<ApiCardTransactionRow[]> {
    if (!apprSeqNo.trim()) return [];
    return unwrap<ApiCardTransactionRow[]>(
        api.get(`${BASE}/by-approval/${encodeURIComponent(apprSeqNo.trim())}`),
    );
}

/** Withdraw a pending Card Approval — the kebab-menu "Delete" action
 *  on the Approval Details popup. Deletes the EXPT_RESOL_MSTR +
 *  EXPT_RESOL_APPRVR_INFM rows and clears every CARD_TRNS_HSTR row
 *  pointing at this approval reference. */
export async function withdrawCardApproval(apprSeqNo: string): Promise<void> {
    if (!apprSeqNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "appr_seq_no: required");
    }
    await unwrap<void>(
        api.delete(`${BASE}/by-approval/${encodeURIComponent(apprSeqNo.trim())}`),
    );
}

/** Change the approval line on a pending Card Approval — the
 *  kebab-menu "Edit" action. Replaces every EXPT_RESOL_APPRVR_INFM
 *  row with the new line's approvers; resets the master to Pending. */
export async function changeCardApprovalLine(
    apprSeqNo: string,
    apprLineNo: number,
): Promise<void> {
    if (!apprSeqNo.trim()) {
        throw new ApiCallError("WBE_VALIDATION", "appr_seq_no: required");
    }
    await unwrap<void>(
        api.put(
            `${BASE}/by-approval/${encodeURIComponent(apprSeqNo.trim())}/approval-line`,
            { appr_line_no: apprLineNo },
        ),
    );
}

/** Fetch the cards-dropdown payload — optionally narrowed by `bank_cd`. */
export async function fetchActiveCards(bankCd?: string): Promise<ApiCardListResponse> {
    return unwrap<ApiCardListResponse>(
        api.get(`${BASE}/cards`, {
            params: bankCd ? { bank_cd: bankCd } : undefined,
        }),
    );
}

/** PATCH one row with the discriminated description / purpose body. */
export async function patchCardTransaction(
    cardSeqNo: string,
    body: ApiCardTransactionPatchRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.patch(`${BASE}/${encodeURIComponent(cardSeqNo)}`, body),
    );
}

/** PUT — replace the row's (chart_acct_seq_no, chart_acct_cd) pair. */
export async function putCardTransactionReportingAccount(
    cardSeqNo: string,
    body: ApiUpdateCardReportingAccountRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.put(
            `${BASE}/${encodeURIComponent(cardSeqNo)}/reporting-account`,
            body,
        ),
    );
}

/* ----------------------------------------------------------------------------
 *  Card Management Setting modal (legacy card_0001_003)
 * --------------------------------------------------------------------------*/

/** Query for `GET /api/v1/payment/card-transactions/cards/management`. */
export type FetchManagementCardsParams = {
    srchWd?:       string;
    sortField?:    string;
    sortDirection?: "ASC" | "DESC";
    /** Backend caps at 100. Default 100. */
    size?:         number;
};

/** Fetch the modal list. Mirrors legacy `card_0001_003_r001`. */
export async function fetchManagementCards(
    params: FetchManagementCardsParams = {},
): Promise<ApiCardManagementListResponse> {
    const wire: Record<string, string | number> = {};
    if (params.srchWd !== undefined && params.srchWd !== "") wire.srch_wd = params.srchWd;
    if (params.sortField)     wire.sort_field     = params.sortField;
    if (params.sortDirection) wire.sort_direction = params.sortDirection;
    if (params.size !== undefined) wire.size = params.size;
    return unwrap<ApiCardManagementListResponse>(
        api.get(`${BASE}/cards/management`, { params: wire }),
    );
}

/** Toggle ACTV_YN on one card. Mirrors legacy `card_0001_003_u001`. */
export async function patchCardActive(
    bankCd: string, cardNo: string,
    body: ApiUpdateCardActiveRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.patch(
            `${BASE}/cards/${encodeURIComponent(bankCd)}/${encodeURIComponent(cardNo)}/active`,
            body,
        ),
    );
}

/** Inline-rename — updates `card_hldr_nm` + `card_nick_nm` together.
 *  Mirrors legacy `card_0001_003_u002`. */
export async function patchCardInfo(
    bankCd: string, cardNo: string,
    body: ApiUpdateCardInfoRequest,
): Promise<void> {
    await unwrap<unknown>(
        api.patch(
            `${BASE}/cards/${encodeURIComponent(bankCd)}/${encodeURIComponent(cardNo)}`,
            body,
        ),
    );
}

/** Hard-delete one card. Mirrors legacy `card_0001_003_d001`. Throws
 *  `ApiCallError` with code `WBE1153` when the card still has
 *  transactions (legacy in-use guard). */
export async function deleteManagementCard(
    bankCd: string, cardNo: string,
): Promise<void> {
    await unwrap<unknown>(
        api.delete(
            `${BASE}/cards/${encodeURIComponent(bankCd)}/${encodeURIComponent(cardNo)}`,
        ),
    );
}

/**
 * Bulk-create scraped cards for the Card Management Add Card flow.
 * Posted by the popup chain after the user ticks which scraped cards
 * to register. Backend dedupes on the composite PK
 * {@code (BIZ_KEY, BANK_CD, CARD_NO)}; the response carries both
 * counts so the dialog can surface "Added X, Y already registered".
 */
export async function createScrapedCards(
    req: ApiCreateCardsRequest,
): Promise<ApiCreateCardsResponse> {
    return unwrap<ApiCreateCardsResponse>(
        api.post(`${BASE}/cards`, req),
    );
}

/**
 * Synchronous Update / sync — kicks off the Coocon scrape for every
 * active card in the tenant that has a registered credential, inserts
 * resulting transactions into {@code CARD_TRNS_HSTR}, returns per-card
 * success / failure counts. Backend orchestrator is
 * {@code CardTransactionSyncService}.
 *
 * <p>Expect this call to take several seconds — Axios's default
 * timeout is enough for ~10 cards; tune {@code timeout} on the
 * caller side if a tenant has many cards.
 */
export async function syncCardTransactions(
    req: ApiSyncCardTransactionsRequest,
): Promise<ApiSyncCardTransactionsResponse> {
    return unwrap<ApiSyncCardTransactionsResponse>(
        api.post(`${BASE}/sync`, req, { timeout: 5 * 60_000 }),
    );
}

/**
 * Per-bank period-limit lookup feeding the Update Cards popup's
 * date-range validation. Mirrors legacy {@code nxisas_cardTranList_r001}
 * — caller posts {@code REC_IN} with (bank_cd, bank_cert_seq) pairs,
 * backend returns {@code REC_OUT} with {@code cont1} (count) +
 * {@code cont2} (unit) per row.
 */
export async function fetchCardTranListPeriodLimits(
    req: ApiCardTranListPeriodLimitRequest,
): Promise<ApiCardTranListPeriodLimitResponse> {
    return unwrap<ApiCardTranListPeriodLimitResponse>(
        api.post(`${BASE}/period-limits`, req),
    );
}

/**
 * Batch Request Approval for selected card-transaction rows. Mirrors
 * legacy `card_0001_001.ts:661-676` — the click handler that opens
 * `comm_0194_001.act` with `APPR_DV='33'`. The refactor collapses
 * the popup + persist into a single backend call.
 */
export async function requestCardApproval(
    req: ApiCardRequestApprovalRequest,
): Promise<ApiCardRequestApprovalResponse> {
    return unwrap<ApiCardRequestApprovalResponse>(
        api.post(`${BASE}/request-approval`, req),
    );
}

/**
 * Preview the next {@code VO_YYMMDD_NNN} document number for the
 * current tenant. The Request Approval popup calls this on open so
 * the read-only "Document No." field can show a meaningful value —
 * Card has no parent batch row to source it from (every other
 * Payment module uses the parent's {@code SCDUL_PYMN_NO}).
 *
 * The value is preview-only; the authoritative number is allocated
 * at submit by {@code ApprovalBoxFanoutService.fanout}. If another
 * Request Approval lands between this call and the user's submit,
 * the assigned value will increment past the preview.
 */
export async function fetchNextCardDocNo(): Promise<string> {
    const res = await unwrap<{ doc_no: string }>(
        api.get(`${BASE}/next-doc-no`),
    );
    return res.doc_no;
}
