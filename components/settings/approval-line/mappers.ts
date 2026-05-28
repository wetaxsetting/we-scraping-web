import type {
    ApiApprovalLineApproverInput,
    ApiApprovalLineApproverRow,
    ApiApprovalLineCreateRequest,
    ApiApprovalLineRow,
    ApiApprovalLineUpdateRequest,
} from "@/lib/types/api";

import type { ApproverRow } from "./approver";
import type { ApprovalLineFormValues, ApprovalLineRow } from "./types";

/* =================================================================
 *  Wire → in-memory
 * ================================================================= */

/**
 * Wire approver → in-memory {@link ApproverRow}. Empty-string
 * `apprvr_posi` / `apprvr_dept` (legacy parity write — never null
 * for newly-created rows) flow through verbatim; legacy rows that
 * carry NULL collapse to empty string here so component code can
 * read the fields without null guards.
 */
export function toApproverRow(wire: ApiApprovalLineApproverRow): ApproverRow {
    return {
        id:         wire.apprvr_id,
        name:       wire.apprvr_nm,
        position:   wire.apprvr_posi ?? "",
        department: wire.apprvr_dept ?? "",
        dispOrd:    wire.apprvr_disp_ord,
        userImgUrl: wire.user_img_url ?? undefined,
    };
}

/**
 * Wire approval-line → in-memory {@link ApprovalLineRow}. The wire
 * `approvers[]` is already ordered by `apprvr_disp_ord ASC`
 * (backend pins the order via
 * `findAllByBizKeyAndApprLineNo...OrderByApprvrDispOrdAsc`); the
 * mapper preserves that order.
 */
export function toApprovalLineRow(wire: ApiApprovalLineRow): ApprovalLineRow {
    return {
        apprLineNo: wire.appr_line_no,
        apprLineNm: wire.appr_line_nm,
        regDtm:     wire.reg_dtm,
        approvers:  wire.approvers.map(toApproverRow),
    };
}

/* =================================================================
 *  In-memory → wire
 * ================================================================= */

/**
 * Form values → Create body. {@code apprvr_disp_ord} is NOT sent —
 * the service assigns it 1..N from request-array position (feature
 * § 5.2 / OQ-4). Empty position / department fall back to `""` so
 * the wire never carries `null` (matches the backend's
 * `coalesce(...)` behaviour, which keeps DEV / refactor write
 * shapes identical).
 */
export function toCreateRequest(values: ApprovalLineFormValues): ApiApprovalLineCreateRequest {
    return {
        appr_line_nm: values.apprLineNm.trim(),
        approvers:    values.approvers.map(toApproverInput),
    };
}

/** Same shape as Create — Spring `ApprovalLineUpdateRequest` is a
 *  Java type alias for `ApprovalLineCreateRequest`. */
export function toUpdateRequest(values: ApprovalLineFormValues): ApiApprovalLineUpdateRequest {
    return toCreateRequest(values);
}

function toApproverInput(row: ApproverRow): ApiApprovalLineApproverInput {
    return {
        apprvr_id:   row.id,
        apprvr_nm:   row.name,
        apprvr_posi: row.position.trim() || null,
        apprvr_dept: row.department.trim() || null,
    };
}
