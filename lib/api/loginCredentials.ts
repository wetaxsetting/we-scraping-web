import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiLoginCredentialAuditResponse,
    ApiLoginCredentialBankCreateRequest,
    ApiLoginCredentialBankFormInfoResponse,
    ApiLoginCredentialBankPickerResponse,
    ApiLoginCredentialBankUpdateRequest,
    ApiLoginCredentialCreateResponse,
    ApiLoginCredentialGdtCreateRequest,
    ApiLoginCredentialGdtUpdateRequest,
    ApiLoginCredentialListResponse,
    ApiLoginCredentialRevealRequest,
    ApiLoginCredentialRevealResponse,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; Login Credentials API client. Mirrors the Spring
 * controller `LoginCredentialsController` — four endpoints over
 * `BANK_CERT_INFO` ∪ `GDT_CERT_INFO` (slug `login-credentials`,
 * legacy parity for the `comm_0218_*` family).
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * `status.code` so the caller can branch on
 * `WBE2060` (credential not found),
 * `WBE2061` (re-auth failed on reveal),
 * `WBE2062` (unknown {@code type} path segment).
 *
 * <p>Wire convention: lowercase snake_case (CTO directive 2026-05-08).
 * The {@code type} path segment is the literal {@code "bank"} or
 * {@code "gdt"} — the controller normalises case-insensitively.
 */
const BASE = "/api/v1/login-credentials";

export type LoginCredentialKind = "bank" | "gdt";

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error || body.data === undefined) {
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

/**
 * List grouped credentials for the current tenant — one entry per
 * BANK_CD (with N accounts) plus a single GDT entry when configured.
 * Backend orchestrates the union; no pagination (the typical tenant
 * has at most ~10 banks + 1 GDT).
 */
export function fetchLoginCredentials(): Promise<ApiLoginCredentialListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiLoginCredentialListResponse>>(BASE),
    );
}

/**
 * Delete one credential row by composite key. Writes audit-log rows
 * server-side (slug `login-credentials`). `seqNo` is the per-tenant
 * surrogate from `BANK_CERT_INFO` or `GDT_CERT_INFO` — JS callers
 * pass a number; we serialise to a path-segment string.
 */
export function deleteLoginCredential(
    type: LoginCredentialKind,
    seqNo: number,
): Promise<void> {
    return unwrap(
        api.delete<ApiResponse<void>>(
            `${BASE}/${type}/${encodeURIComponent(seqNo.toString())}`,
        ),
    );
}

/**
 * Decrypt one credential after the user re-enters their own WeCMS
 * login password. The plaintext password is only ever returned by
 * this path — the list endpoint masks it.
 *
 * <p>Re-auth failure surfaces as {@link ApiCallError} with code
 * `WBE2061` so the dialog can show a localised "wrong password"
 * message without retrying.
 */
export function revealLoginCredential(
    type: LoginCredentialKind,
    seqNo: number,
    body: ApiLoginCredentialRevealRequest,
): Promise<ApiLoginCredentialRevealResponse> {
    return unwrap(
        api.post<ApiResponse<ApiLoginCredentialRevealResponse>>(
            `${BASE}/${type}/${encodeURIComponent(seqNo.toString())}/reveal`,
            body,
        ),
    );
}

/**
 * Audit history for one credential row — already localised to the
 * caller's locale server-side. Rows are latest-first.
 */
export function fetchLoginCredentialAuditLogs(
    type: LoginCredentialKind,
    seqNo: number,
): Promise<ApiLoginCredentialAuditResponse> {
    return unwrap(
        api.get<ApiResponse<ApiLoginCredentialAuditResponse>>(
            `${BASE}/${type}/${encodeURIComponent(seqNo.toString())}/audit-logs`,
        ),
    );
}

/**
 * Create one BANK_CERT_INFO row under the current tenant. Writes
 * one audit-log row per supported locale (slug `login-credentials`,
 * detail key `audit.login_credentials.create.detail`). Returns the
 * freshly allocated SEQ_NO so the caller can refresh and key its new
 * row.
 */
export function createBankLoginCredential(
    body: ApiLoginCredentialBankCreateRequest,
): Promise<ApiLoginCredentialCreateResponse> {
    return unwrap(
        api.post<ApiResponse<ApiLoginCredentialCreateResponse>>(
            `${BASE}/bank`,
            body,
        ),
    );
}

/**
 * Update one existing bank credential by SEQ_NO. `login_id` /
 * `password` / `extra` are individually optional — null means
 * "leave unchanged". An all-null body raises `WBE_VALIDATION`.
 */
export function updateBankLoginCredential(
    seqNo: number,
    body: ApiLoginCredentialBankUpdateRequest,
): Promise<void> {
    return unwrap(
        api.put<ApiResponse<void>>(
            `${BASE}/bank/${encodeURIComponent(seqNo.toString())}`,
            body,
        ),
    );
}

/** Create the tenant's GDT credential row. */
export function createGdtLoginCredential(
    body: ApiLoginCredentialGdtCreateRequest,
): Promise<ApiLoginCredentialCreateResponse> {
    return unwrap(
        api.post<ApiResponse<ApiLoginCredentialCreateResponse>>(
            `${BASE}/gdt`,
            body,
        ),
    );
}

/** Update the tenant's GDT credential row. */
export function updateGdtLoginCredential(
    seqNo: number,
    body: ApiLoginCredentialGdtUpdateRequest,
): Promise<void> {
    return unwrap(
        api.put<ApiResponse<void>>(
            `${BASE}/gdt/${encodeURIComponent(seqNo.toString())}`,
            body,
        ),
    );
}

/**
 * Banks available in the Add-Bank picker. Sourced from
 * {@code BANK_INFM_DETL} (scraping-capable rows only), real
 * {@code BANK_CD} values. {@code search} (optional) does a
 * case-insensitive substring match on the bank's display name.
 */
export function fetchLoginCredentialBanks(
    search?: string,
): Promise<ApiLoginCredentialBankPickerResponse> {
    return unwrap(
        api.get<ApiResponse<ApiLoginCredentialBankPickerResponse>>(
            `${BASE}/banks`,
            { params: { search: search && search.trim() ? search.trim() : undefined } },
        ),
    );
}

/**
 * Per-bank form info — drives the Login ID/PW dialog's radio buttons
 * (when the bank has multiple sub-types) and the per-sub-type
 * localised field labels. Mirrors the legacy
 * {@code nxisas_getCertFormInfo} response.
 *
 * <p>Returns an empty {@code sub_types} list for unknown banks; the
 * dialog falls back to a default single-sub-type form with generic
 * English labels.
 */
export function fetchLoginCredentialBankFormInfo(
    bankCd: string,
): Promise<ApiLoginCredentialBankFormInfoResponse> {
    return unwrap(
        api.get<ApiResponse<ApiLoginCredentialBankFormInfoResponse>>(
            `${BASE}/banks/${encodeURIComponent(bankCd)}/form-info`,
        ),
    );
}
