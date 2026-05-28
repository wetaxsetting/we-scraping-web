import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";
import type { ApiResponse } from "@/lib/types/api";

/**
 * Client for `GET /api/v1/payment/blocked-chars`. The endpoint returns
 * the active {@code BLOCKED_CHARS_RULE} rows for one
 * (bank_cd, pymn_type) pair so column-header tooltips on Excel-upload
 * preview + Scheduled / Result detail tables can render the
 * bank-specific block list verbatim.
 *
 * <p>Replaces the legacy hardcoded JS lookup
 * (`add_osmc.js#addHeaderInfoIcon`). One source of truth (the DB) for
 * both server-side validation and the user-facing tooltip — no JS
 * map to keep in sync when a bank's rules change.
 */

/** Wire shape — lowercase snake_case via global Jackson naming. */
export interface ApiBlockedCharsRuleRow {
    field_cd:      string;
    blocked_chars: string;
}

export interface ApiBlockedCharsRulesResponse {
    rules: ApiBlockedCharsRuleRow[];
}

/**
 * Payment-type code keying {@code BLOCKED_CHARS_RULE.PYMN_TPYE}.
 * Mirrors the backend `com.kosign.wecms.domain.payment.validation.PymnType`
 * enum — kept in sync as a literal union here so callers get
 * autocomplete + a compile-time check at the call site.
 */
export type PymnType =
    | "INTR"   // Internal Transfer
    | "VEND"   // Vendor Payment
    | "EXPN"   // Expense Payment
    | "PAYR"   // Payroll Payment
    | "OVER";  // Overseas Payment

/**
 * Field code keying {@code BLOCKED_CHARS_RULE.FIELD_CD}. Mirrors the
 * backend `com.kosign.wecms.domain.payment.validation.FieldCd` enum.
 * The tooltip component matches the column to a field via these codes
 * so the wire stays decoupled from frontend UI labels.
 */
export type FieldCd =
    | "RMKS"  // TRAN_USAG / WDRL_ACCT_RMRK
    | "RCPT"  // RCPT_NM / FINC_MDA_OWNER_NM
    | "MEMO"  // Overseas MEMO field
    | "BENA"  // Overseas BNFC_NM
    | "BEAD"; // Overseas BNFC_ADDR

/**
 * Frontend in-memory map keyed by {@link FieldCd}. Empty object
 * (no rules registered) renders no tooltips — the upload preview /
 * detail page degrades gracefully.
 */
export type BlockedCharsMap = Partial<Record<FieldCd, string>>;

/**
 * Fetch active rules for one (bankCd, pymnType) pair. The hook
 * `useBlockedChars` wraps this with the standard `useApiData`
 * mount-once lifecycle.
 *
 * <p>Returns an empty {@link BlockedCharsMap} on `bankCd` blank —
 * tooltips simply don't render in that case (matches legacy behaviour
 * when no withdrawal bank is selected).
 */
export async function fetchBlockedChars(
    bankCd: string | null | undefined,
    pymnType: PymnType,
): Promise<BlockedCharsMap> {
    if (!bankCd || !bankCd.trim()) return {};
    try {
        const res = await api.get<ApiResponse<ApiBlockedCharsRulesResponse>>(
            "/api/v1/payment/blocked-chars",
            { params: { bank_cd: bankCd.trim(), pymn_type: pymnType } },
        );
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        const out: BlockedCharsMap = {};
        for (const r of body.data?.rules ?? []) {
            out[r.field_cd as FieldCd] = r.blocked_chars;
        }
        return out;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}
