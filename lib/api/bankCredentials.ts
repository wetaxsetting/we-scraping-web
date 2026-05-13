import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type { ApiResponse } from "@/lib/types/api";

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
    acct_type: string | null;
    currency: string | null;
    balance: string | null;
    available_bal: string | null;
    branch_name: string | null;
    open_date: string | null;
};

export type ApiScrapeSessionStatus =
    | "OTP_REQUIRED"
    | "CAPTCHA_REQUIRED"
    | "QNA_REQUIRED"
    | "COMPLETED"
    | "ERROR";

export type ApiScrapeSessionResponse = {
    session_id: string | null;
    status: ApiScrapeSessionStatus;
    challenge_prompt: string | null;
    accounts: ApiScrapedAccount[] | null;
    error_code: string | null;
    error_message: string | null;
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

export function startScrape(seqNo: string): Promise<ApiScrapeSessionResponse> {
    return unwrap(
        api.post("/api/v1/banking/scraping/account-list", { credential_seq_no: seqNo }),
    );
}

export function submitScrapeOtp(
    sessionId: string,
    value: string,
): Promise<ApiScrapeSessionResponse> {
    return unwrap(
        api.post(`/api/v1/banking/scraping/${encodeURIComponent(sessionId)}/otp`, {
            value,
        }),
    );
}
