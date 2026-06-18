import { api } from "@/lib/axios";
import { ApiCallError, type ListSortParams } from "@/lib/api/banking";
import type {
    ApiBankAccountAuditResponse,
    ApiBankAccountListResponse,
    ApiBankAccountPermissionResponse,
    ApiBankAccountPermissionUpdateRequest,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings > Bank Account API client. Mirrors the backend
 * `SettingsBankAccountController`
 * (`wecms-api/.../domain/setting/bankaccount/controller/`).
 *
 * Batch A surface: GET list. Update / Register / Permissions land
 * alongside the wired Edit dialog + Add-chain in follow-up MRs.
 */
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
        const e = err as {
            response?: { data?: ApiResponse<unknown> };
            message?: string;
        };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

export function fetchBankAccounts(
    sort: ListSortParams = {},
): Promise<ApiBankAccountListResponse> {
    return unwrap(
        api.get("/api/v1/settings/bank-account", {
            params: {
                // Spread only when defined so the request omits both
                // keys in the default (no-sort) state — backend then
                // falls back to its legacy default ORDER BY.
                ...(sort.sortField && sort.sortDirection ? sort : {}),
            },
        }),
    );
}

/**
 * Wire body for `PATCH /api/v1/settings/bank-account/{bankCd}/{acctNo}`.
 * Mirrors the backend `BankAccountUpdateRequest` record — every field is
 * optional ("null = leave unchanged"); the service rejects the all-null
 * case with `WBE_VALIDATION`. Field names are camelCase Java; wire shape
 * becomes snake_case via the global Jackson naming strategy.
 */
export type ApiBankAccountUpdateRequest = {
    nickname?: string;
    description?: string;
    /** Legacy 2-char `ACCT_TYPE_CD` — frontend translates from the
     *  semantic "current" / "saving" / "fixed" value before sending. */
    account_type_cd?: string;
    /** ISO `yyyy-MM-dd`; empty string clears the date. */
    maturity_date?: string;
    /** VAS Account FK. `0` clears the mapping; a positive value sets it.
     *  Omit the three VAS fields entirely to leave the mapping unchanged. */
    vas_acct_seq_no?: number;
    vas_acct_cd?: string;
    vas_acct_nm?: string;
};

/**
 * PATCH one ACCT_MSTR row. Mirrors legacy `comm_0183_003_u001`. Returns
 * void on success — callers refetch the list to surface the change.
 */
export async function updateBankAccount(
    bankCd: string,
    acctNo: string,
    body: ApiBankAccountUpdateRequest,
): Promise<void> {
    const path = `/api/v1/settings/bank-account/${encodeURIComponent(bankCd)}/${encodeURIComponent(acctNo)}`;
    try {
        const res = await api.patch<ApiResponse<void>>(path, body);
        const env = res.data;
        if (env.status.error) {
            throw new ApiCallError(env.status.code, env.status.message);
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

/**
 * GET the full View / Withdrawal Permission roster for one bank account.
 * Mirrors legacy `comm_0183_002_r001`. Returns every active tenant user
 * with `is_selected` / `is_locked` flags so the dialog renders the
 * checklist in one paint.
 */
export function fetchBankAccountPermissions(
    bankCd: string,
    acctNo: string,
    kind: "VIEW" | "WITHDRAWAL",
): Promise<ApiBankAccountPermissionResponse> {
    const path = `/api/v1/settings/bank-account/${encodeURIComponent(bankCd)}/${encodeURIComponent(acctNo)}/permissions`;
    return unwrap(
        api.get(path, { params: { type: kind } }),
    );
}

/**
 * Per-account audit history for the Audit Logs popup. Mirrors legacy
 * `comm_0183_004_r001` — reads `AUDIT_LOGS_INFM` for the metadata-edit
 * (`ACCT_MSTR`) + permission (`ACCT_AUTH_INFO`) rows of one bank account,
 * latest-first, in the caller's locale. Empty history returns an empty list.
 */
export function fetchBankAccountAuditLogs(
    bankCd: string,
    acctNo: string,
): Promise<ApiBankAccountAuditResponse> {
    const path = `/api/v1/settings/bank-account/${encodeURIComponent(bankCd)}/${encodeURIComponent(acctNo)}/audit-logs`;
    return unwrap(api.get(path));
}

/**
 * PUT the full desired user-id set for one (bank account, kind).
 * Backend computes the grant / revoke diff in a single transaction and
 * writes per-locale audit-log rows. Returns void; callers refetch the
 * bank-account list so the per-row label aggregates ("X + N more")
 * reflect the new state.
 *
 * <p>Mirrors legacy `comm_0183_002_u001`.
 */
export async function updateBankAccountPermissions(
    bankCd: string,
    acctNo: string,
    body: ApiBankAccountPermissionUpdateRequest,
): Promise<void> {
    const path = `/api/v1/settings/bank-account/${encodeURIComponent(bankCd)}/${encodeURIComponent(acctNo)}/permissions`;
    try {
        const res = await api.put<ApiResponse<void>>(path, body);
        const env = res.data;
        if (env.status.error) {
            throw new ApiCallError(env.status.code, env.status.message);
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
