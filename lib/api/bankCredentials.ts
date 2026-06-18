import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type { ApiResponse } from "@/lib/types/api";
import { nxisasDebug, isSupportedCardBank } from "@/lib/nxisas/nxisas-debug";

/**
 * API client for the bank-credentials + NXISAS scraping spike.
 * Mirrors the backend's two new modules:
 *   - `domain/banking/bankcredentials` → CRUD over BANK_CERT_INFO
 *   - `domain/banking/nxisas`          → live scraping (LOGIN → OTP → ACCT_LIST)
 *
 * <p>Wire convention follows the CTO 2026-05-08 directive: lowercase
 * snake_case, success-or-business-fault inside `ApiResponse.status`,
 * transport errors surface as {@link ApiCallError}.
 */

export type ApiBankCredentialRow = {
    seq_no: string;
    bank_cd: string | null;
    username: string | null;
    acct_list_inq_stts: string | null;
    acct_list_inq_msg: string | null;
    lst_acct_list_inq_dt: string | null;
    reg_dtm: string | null;
    mod_dtm: string | null;
};

export type ApiBankCredentialListResponse = {
    items: ApiBankCredentialRow[];
};

export type ApiBankCredentialCreateRequest = {
    bank_cd: string;
    username: string;
    password: string;
};

export type ApiBankCredentialUpdateRequest = {
    username?: string;
    password?: string;
};

export type ApiScrapedAccount = {
    acct_name: string | null;
    acct_num: string | null;
    /** Raw, bank-specific account-type label (e.g. "DEMAND DEPOSIT-VND").
     *  Free text — never shown directly; mapped to `acct_type_cd`. */
    acct_type: string | null;
    /** Legacy ACCT_TYPE_CD (02–08) resolved server-side from `acct_type`
     *  via NXISAS_ACCT_TYPE_MAPPING; null when unmapped (or the reference
     *  table isn't seeded). The popup pre-selects this code. */
    acct_type_cd: string | null;
    currency: string | null;
    balance: string | null;
    available_bal: string | null;
    branch_name: string | null;
    open_date: string | null;
    /** Maturity date for term / fixed-deposit accounts — Coocon
     *  acct-list field `maturityDate` (snake-cased on the wire).
     *  Blank for demand-deposit / current accounts. */
    maturity_date: string | null;
};

export type ApiScrapeSessionStatus =
    | "OTP_REQUIRED"
    | "CAPTCHA_REQUIRED"
    | "QNA_REQUIRED"
    | "COMPLETED"
    | "ERROR";

export type ApiQnaQuestion = {
    /** Bank-supplied opaque id — echoed back unchanged with the
     *  answer so the bank knows which question was answered. */
    hidden_value: string;
    question: string;
};

export type ApiScrapeSessionResponse = {
    session_id: string | null;
    status: ApiScrapeSessionStatus;
    challenge_prompt: string | null;
    /** Populated only when {@code status === "QNA_REQUIRED"} — the
     *  parsed security-question list. The dialog shows these as a
     *  picker; the user chooses one and types its answer. */
    qna_questions: ApiQnaQuestion[] | null;
    /** Populated only when {@code status === "CAPTCHA_REQUIRED"} —
     *  base64 image bytes. Render as
     *  {@code data:image/{captcha_image_format};base64,{captcha_image}}. */
    captcha_image: string | null;
    /** Image MIME suffix — {@code "png"} for most banks, {@code "svg+xml"}
     *  for VIETNAM_GDT. Defaults to {@code "png"} on the frontend when
     *  null. */
    captcha_image_format: string | null;
    accounts: ApiScrapedAccount[] | null;
    /** Populated only when {@code status === "COMPLETED"} AND the
     *  session was started with {@code scrape_kind: "CARD_INFO"} (the
     *  Card Management Add Card flow). Null on every ACCT_LIST session
     *  for back-compat with existing Login Credentials callers. */
    cards: import("@/lib/types/api").ApiScrapedCard[] | null;
    error_code: string | null;
    error_message: string | null;
};

/** Inline-credentials verify request for the
 *  {@code POST /api/v1/banking/scraping/verify} endpoint. Mirrors the
 *  backend {@code VerifyCredentialsRequest} record. The optional
 *  {@code scrape_kind} drives the post-login Coocon job:
 *  {@code "ACCT_LIST"} (Login Credentials flow, default when omitted)
 *  vs {@code "CARD_INFO"} (Card Management Add Card flow).
 */
export type ApiVerifyScrapeRequest = {
    bank_cd:           string;
    login_id:          string;
    password:          string;
    nxisas_gb_seq_no?: number | null;
    extra?:            string | null;
    login_type?:       string | null;
    scrape_kind?:      "ACCT_LIST" | "CARD_INFO" | null;
};

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const { data } = await promise;
        if (data?.status?.error) {
            throw new ApiCallError(data.status.code, data.status.message ?? "");
        }
        return data.data as T;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        throw new ApiCallError(
            "WBE_TRANSPORT",
            err instanceof Error ? err.message : String(err),
        );
    }
}

export function fetchBankCredentials(): Promise<ApiBankCredentialListResponse> {
    return unwrap(api.get("/api/v1/banking/credentials"));
}

export function createBankCredential(
    req: ApiBankCredentialCreateRequest,
): Promise<ApiBankCredentialRow> {
    return unwrap(api.post("/api/v1/banking/credentials", req));
}

export function updateBankCredential(
    seqNo: string,
    req: ApiBankCredentialUpdateRequest,
): Promise<ApiBankCredentialRow> {
    return unwrap(api.put(`/api/v1/banking/credentials/${encodeURIComponent(seqNo)}`, req));
}

export function deleteBankCredential(seqNo: string): Promise<void> {
    return unwrap(api.delete(`/api/v1/banking/credentials/${encodeURIComponent(seqNo)}`));
}

export async function startScrape(seqNo: string): Promise<ApiScrapeSessionResponse> {
    nxisasDebug("execute thread(setup) input", { flowType: "BANK_SETUP", job: "ACCT_LIST", credentialSeqNo: seqNo });
    const res = await unwrap<ApiScrapeSessionResponse>(
        api.post("/api/v1/banking/scraping/account-list", { credential_seq_no: seqNo }),
    );
    nxisasDebug("execute thread(setup) output", {
        traceId: res.session_id, status: res.status, errorCode: res.error_code,
    });
    return res;
}

/**
 * Verify inline credentials and run the post-login Coocon scrape job
 * named by {@code scrape_kind}. Powers the Card Management Add Card
 * flow (where {@code scrape_kind: "CARD_INFO"}) and any other future
 * inline verify-before-save path.
 *
 * <p>Mirrors {@code POST /api/v1/banking/scraping/verify}. Returns
 * the same {@link ApiScrapeSessionResponse} shape as the saved-credential
 * path — {@code COMPLETED} carries the scraped payload (accounts or
 * cards), {@code OTP_REQUIRED} / {@code QNA_REQUIRED} /
 * {@code CAPTCHA_REQUIRED} carry the challenge state, {@code ERROR}
 * carries the gateway / bank-adapter error code.
 */
export async function verifyScrape(
    req: ApiVerifyScrapeRequest,
): Promise<ApiScrapeSessionResponse> {
    // Card Management add-card sends scrape_kind = "CARD_INFO"; everything
    // else is the Bank Login Credentials verify-before-save flow.
    const isCard = req.scrape_kind === "CARD_INFO";
    const flowType = isCard ? "CARD_MANAGEMENT_SETTING" : "BANK_SETUP";
    // req carries the raw password — maskNxisasDebugData redacts it. For the
    // card flow, tag whether the picked bank is an in-scope card bank
    // (Shinhan / Woori) so out-of-scope picks are visible in the console.
    nxisasDebug("execute thread(setup) input", {
        flowType, job: "LOGIN",
        ...(isCard ? { cardBankSupported: isSupportedCardBank(req.bank_cd) } : {}),
        req,
    });
    const res = await unwrap<ApiScrapeSessionResponse>(api.post("/api/v1/banking/scraping/verify", req));
    nxisasDebug("execute thread(setup) output", {
        flowType, traceId: res.session_id, status: res.status, errorCode: res.error_code,
    });
    return res;
}

export async function submitScrapeOtp(
    sessionId: string,
    value: string,
): Promise<ApiScrapeSessionResponse> {
    nxisasDebug("continuation input", { flowType: "BANK_SETUP", challengeType: "OTP", traceId: sessionId, value });
    const res = await unwrap<ApiScrapeSessionResponse>(
        api.post(`/api/v1/banking/scraping/${encodeURIComponent(sessionId)}/otp`, {
            value,
        }),
    );
    nxisasDebug("continuation output", { traceId: res.session_id, status: res.status, errorCode: res.error_code });
    return res;
}

/**
 * Resume a scrape session after a QNA challenge. The user picks ONE
 * of the LOGIN response's security questions and types its answer;
 * the gateway may complete the login or chain into another challenge.
 */
export async function submitScrapeQna(
    sessionId: string,
    payload: { hidden_value: string; question: string; answer: string },
): Promise<ApiScrapeSessionResponse> {
    nxisasDebug("continuation input", { flowType: "BANK_SETUP", challengeType: "QNA", traceId: sessionId, payload });
    const res = await unwrap<ApiScrapeSessionResponse>(
        api.post(`/api/v1/banking/scraping/${encodeURIComponent(sessionId)}/qna`, payload),
    );
    nxisasDebug("continuation output", { traceId: res.session_id, status: res.status, errorCode: res.error_code });
    return res;
}

/**
 * Resume a scrape session after a CAPTCHA challenge. Wire shape is
 * identical to OTP — {@code { value: "<typed text>" }} — only the
 * path segment differs.
 */
export async function submitScrapeCaptcha(
    sessionId: string,
    value: string,
): Promise<ApiScrapeSessionResponse> {
    nxisasDebug("continuation input", { flowType: "BANK_SETUP", challengeType: "CAPTCHA", traceId: sessionId, value });
    const res = await unwrap<ApiScrapeSessionResponse>(
        api.post(`/api/v1/banking/scraping/${encodeURIComponent(sessionId)}/captcha`, {
            value,
        }),
    );
    nxisasDebug("continuation output", { traceId: res.session_id, status: res.status, errorCode: res.error_code });
    return res;
}

/**
 * Wire shape sent to {@code POST /api/v1/banking/accounts/register}.
 * Maps the Select Bank Accounts dialog's checked rows + the
 * triggering credential's SEQ_NO. Mirrors the legacy
 * {@code fnsh_0101_001_c001} input from
 * comm_0218_nxisas.ts:1188.
 */
export type ApiRegisterAccountEntry = {
    account_no:        string;
    currency:          string;
    acct_type_cd?:     string | null;
    account_nickname?: string | null;
    account_details?:  string | null;
    acct_nm?:          string | null;
    bal?:              string | number | null;
    /** Maturity date (legacy EXPI_DT) — backend normalizes to yyyyMMdd. */
    maturity_date?:    string | null;
    /** VAS Code (legacy VAS_ACCT_CD) — omitted for product type H. */
    vas_acct_cd?:      string | null;
    /** VAS Account Name (legacy VAS_ACCT_NM) — omitted for product type H. */
    vas_acct_nm?:      string | null;
};

export type ApiRegisterAccountsRequest = {
    credential_seq_no: string | number;
    accounts:          ApiRegisterAccountEntry[];
};

export type ApiRegisterAccountsResponse = {
    inserted: number;
    updated:  number;
};

/**
 * Persist the picked accounts under the tenant's {@code ACCT_MSTR}.
 * The BANK_CD is resolved server-side off the credential row —
 * callers only ship the seq_no + the picked rows.
 */
export function registerAccounts(
    req: ApiRegisterAccountsRequest,
): Promise<ApiRegisterAccountsResponse> {
    return unwrap(api.post("/api/v1/banking/accounts/register", req));
}
