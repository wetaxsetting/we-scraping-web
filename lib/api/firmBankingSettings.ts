import { api } from "@/lib/axios";
import { unwrap } from "./common/unwrap";
import { ApiCallError } from "@/lib/api/banking";
import type {
    ApiFirmBankingAuditListResponse,
    ApiFirmBankingSettingDetail,
    ApiFirmBankingSettingListResponse,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Wire body for `POST /api/v1/settings/firm-banking-settings`.
 * Mirrors the backend `FirmBankingSettingCreateRequest` record
 * verbatim. Lowercase snake_case via the global Jackson naming
 * strategy.
 *
 * Five required fields. **`file_type` is NOT on the wire** — under
 * OQ-8a Option (c) it is server-derived from `out_bank_cd` per the
 * §5.4 mapping table (Shinhan→`SHB`, Vietcombank→`VCB`, Woori→`WRB`).
 * Anything outside the supported 3-bank set returns `WBE0001`. Never
 * add `file_type` to this type — see the feature spec §13 OQ-8a.
 */
export type ApiFirmBankingSettingCreateRequest = {
    out_bank_cd: string;
    wdrl_act_no: string;
    bank_prtn_id: string;
    van_org_cd: string;
    /** `OrgStat` — "0"/"1"/"2"/"3" per Phase 1 V6. The frontend
     *  always supplies "1" (AVAILABLE) until UX adds a status
     *  selector — V17 default. */
    org_stat: string;
};

/**
 * Wire body for {@code PUT /api/v1/settings/firm-banking-settings/{out_bank_cd}/{wdrl_act_no}}.
 * Mirrors the backend {@code FirmBankingSettingUpdateRequest} record
 * verbatim. Lowercase snake_case via the global Jackson naming
 * strategy (no per-field {@code @JsonProperty} required on the
 * Java side; the frontend mirrors the wire shape directly here).
 *
 * <p>Editable fields only — the composite PK
 * ({@code out_bank_cd}, {@code wdrl_act_no}) is immutable and
 * carried in the path. {@code file_type} is server-derived only on
 * Create (V14) and never sent on Update.
 */
export type ApiFirmBankingSettingUpdateRequest = {
    bank_prtn_id: string;
    van_org_cd: string;
    /** {@code OrgStat} — "0"/"1"/"2"/"3" per Phase 1 V6. */
    org_stat: string;
};

/**
 * Settings &gt; Firm Banking Settings API client. Mirrors the Phase 2
 * controller `FirmBankingSettingsController`
 * (`wecms-api/.../domain/setting/firmbankingsettings/controller/`).
 *
 * <p>Endpoints implemented today: three GETs + POST + PUT + DELETE.
 * <ul>
 *   <li>POST (Create) added 2026-05-09 under OQ-8a Option (c)
 *       (provisional). Bounded-bank set; server derives
 *       `file_type`. Depends on the shared
 *       {@code AuditLogService} (Phase 1 P-1).</li>
 *   <li>PUT (Update) added 2026-05-09 — depends on the shared
 *       {@code AuditLogService} (Phase 1 P-1).</li>
 *   <li>DELETE added 2026-05-09 (no audit per OQ-2; no shared service
 *       dependency).</li>
 * </ul>
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * {@code status.code} so the caller can decide whether to surface a
 * dialog (auth-token expiry pattern) or fall back to a degraded view
 * (read-only graceful fallback).
 *
 * <p>Wire convention: lowercase snake_case for every wire field (CTO
 * directive 2026-05-08). Path components are URL-encoded so
 * account-number characters that survive the backend regex
 * ({@code [A-Za-z0-9-]}) round-trip safely.
 */
// `unwrap` is the shared canonical helper imported from ./common/unwrap (H-2).

/** Base URI shared by every endpoint in this client. */
const BASE = "/api/v1/settings/firm-banking-settings";

/**
 * Fetch the list of firm-banking-setting bindings for the current
 * tenant. Mirrors {@code FirmBankingSettingsController#list}.
 *
 * <p>No filters, no pagination — JEX list returns every binding for
 * the tenant in PK order. The static UI typically renders ≤ 10 rows;
 * adding pagination here without a JEX twin would be a behaviour
 * change.
 *
 * <p>{@code wdrl_act_no} is masked server-side
 * ({@code "1009****0384"}). The detail call returns cleartext when
 * the user opens the edit dialog.
 */
export function fetchFirmBankingSettings(): Promise<ApiFirmBankingSettingListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiFirmBankingSettingListResponse>>(BASE),
    );
}

/**
 * Fetch one firm-banking-setting binding by its composite PK. Mirrors
 * {@code FirmBankingSettingsController#detail}. Returns cleartext
 * {@code wdrl_act_no} for the edit-dialog round-trip (see feature §9).
 *
 * <p>Backend {@code WBE2020} when the row is missing — surfaces here
 * as {@link ApiCallError} with {@code code = "WBE2020"} so the caller
 * can render a feature-specific empty state.
 *
 * @param outBankCd 1–15 digits ({@code [0-9]}). NAPAS bank code.
 * @param wdrlActNo 1–100 chars ({@code [A-Za-z0-9-]}). Account number.
 */
export function fetchFirmBankingSetting(
    outBankCd: string,
    wdrlActNo: string,
): Promise<ApiFirmBankingSettingDetail> {
    const path = `${BASE}/${encodeURIComponent(outBankCd)}/${encodeURIComponent(wdrlActNo)}`;
    return unwrap(
        api.get<ApiResponse<ApiFirmBankingSettingDetail>>(path),
    );
}

/**
 * Fetch the audit-log history for one binding in the caller's locale,
 * latest-first. Mirrors {@code FirmBankingSettingsController#audit}.
 *
 * <p>Backend filters by {@code REF_NO='TB_FIRM_CONF'},
 * {@code WSVC_ID='comm_0220_001'} (legacy verbatim per OQ-6),
 * {@code LANG_CD = TenantContext.currentLangCd()}. The endpoint does
 * NOT pre-check existence of the row — an audit lookup against an
 * unknown row simply returns an empty list.
 *
 * <p>Lazy-call from the audit tab's {@code useEffect}; do not bundle
 * with the detail fetch (the dialog stays cheap on initial open and
 * the audit query plan stays independent).
 */
export function fetchFirmBankingSettingAudit(
    outBankCd: string,
    wdrlActNo: string,
): Promise<ApiFirmBankingAuditListResponse> {
    const path = `${BASE}/${encodeURIComponent(outBankCd)}/${encodeURIComponent(wdrlActNo)}/audit`;
    return unwrap(
        api.get<ApiResponse<ApiFirmBankingAuditListResponse>>(path),
    );
}

/**
 * Create a new firm-banking-setting binding for the current tenant.
 * Mirrors `FirmBankingSettingsController#create`.
 *
 * Five wire fields under OQ-8a Option (c); backend derives
 * `file_type` from `out_bank_cd` and rejects unsupported banks
 * with `WBE0001`. Backend appends 4 locale audit rows under one
 * `audit_logs_seq_no` via the shared `AuditLogService`.
 *
 * Returns the created row in the standard
 * {@link ApiFirmBankingSettingDetail} shape.
 *
 * Errors propagate as {@link ApiCallError}:
 *   - `WBE0001` — `out_bank_cd` outside the supported 3-bank set
 *   - `WBE0002` — bank not in `TB_FIRM_BANK_CODE`
 *   - `WBE2021` — PK already exists for the current tenant
 *   - `WBE_VALIDATION` — request body fails bean-validation
 */
export function createFirmBankingSetting(
    body: ApiFirmBankingSettingCreateRequest,
): Promise<ApiFirmBankingSettingDetail> {
    return unwrap(
        api.post<ApiResponse<ApiFirmBankingSettingDetail>>(BASE, body),
    );
}

/**
 * Update the editable fields of one firm-banking-setting binding.
 * Mirrors {@code FirmBankingSettingsController#update}.
 *
 * <p>Editable fields only — {@code out_bank_cd} / {@code wdrl_act_no}
 * are path PK components and immutable; {@code file_type} is
 * server-derived only on Create (V14). The body carries
 * {@code bank_prtn_id} / {@code van_org_cd} / {@code org_stat}
 * matching the backend {@code FirmBankingSettingUpdateRequest}
 * record. Backend appends 4 locale audit rows under one
 * {@code audit_logs_seq_no} via the shared {@code AuditLogService}
 * (Phase 1 P-1), inside a {@code REQUIRES_NEW} transaction so the
 * audit insert is isolated from the business write.
 *
 * <p>Returns the updated row in the standard
 * {@link ApiFirmBankingSettingDetail} shape (cleartext
 * {@code wdrl_act_no} per OQ-4 detail-endpoint contract).
 *
 * <p>Errors propagate as {@link ApiCallError}: {@code WBE2020} when
 * the row does not exist for the current tenant; {@code WBE_VALIDATION}
 * when the request body fails bean-validation.
 */
export function updateFirmBankingSetting(
    outBankCd: string,
    wdrlActNo: string,
    body: ApiFirmBankingSettingUpdateRequest,
): Promise<ApiFirmBankingSettingDetail> {
    const path = `${BASE}/${encodeURIComponent(outBankCd)}/${encodeURIComponent(wdrlActNo)}`;
    return unwrap(
        api.put<ApiResponse<ApiFirmBankingSettingDetail>>(path, body),
    );
}

/**
 * Hard-delete one firm-banking-setting binding by its composite PK.
 * Mirrors {@code FirmBankingSettingsController#delete}.
 *
 * <p>Per OQ-2 the backend writes no audit row on this path. Tenant
 * scoping is enforced server-side via {@code TenantContext.currentBizKey()};
 * a delete against another tenant's row surfaces here as
 * {@link ApiCallError} with {@code code = "WBE2020"} (indistinguishable
 * from "row truly missing" — intentional).
 *
 * <p>The success envelope carries no payload ({@code data: null}; the
 * global {@code @JsonInclude(NON_NULL)} omits the {@code data} key
 * entirely on the wire). Resolves to {@code void}; callers refetch the
 * list after a successful delete.
 *
 * <p>This call cannot use the shared {@link unwrap} helper because that
 * helper treats a missing {@code data} field as an error (read paths
 * always carry a payload). The void contract is unique to write paths
 * that return only the envelope.
 */
export async function deleteFirmBankingSetting(
    outBankCd: string,
    wdrlActNo: string,
): Promise<void> {
    const path = `${BASE}/${encodeURIComponent(outBankCd)}/${encodeURIComponent(wdrlActNo)}`;
    try {
        const res = await api.delete<ApiResponse<void>>(path);
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        // Success path — body.data is intentionally absent on void responses.
        return;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}
