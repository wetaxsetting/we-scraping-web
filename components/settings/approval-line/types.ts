import type { ApproverRow } from "./approverMockData";

/**
 * Approval Line panel row — in-memory shape consumed by
 * {@link ../ApprovalLineTable} + {@link ../ApprovalLinePanel} +
 * {@link ../ApprovalLineDialog}.
 *
 * <p>Renamed from the original static-UI shape ({@code id}, {@code name},
 * {@code approverName}, {@code approverCount}, {@code createDate}) to
 * match the Spring `ApprovalLineRow` DTO field-by-field. The wire
 * shape arrives via {@link import('@/lib/types/api').ApiApprovalLineRow},
 * gets translated once at the boundary inside
 * {@link ./mappers#toApprovalLineRow}, and never carries snake_case
 * keys into component code.
 *
 * <p>{@code approvers} is the full chain (1..5 rows, ordered by
 * `apprvrDispOrd ASC`); the table derives the primary approver name +
 * count chip from `approvers[0]` + `approvers.length`. Edit dialog
 * seeds the approver chain table from the same array.
 */
export type ApprovalLineRow = {
    apprLineNo: number;
    apprLineNm: string;
    /** Legacy {@code yyyyMMddHHmmss} string; the table renders the
     *  `yyyy-MM-dd` slice (mirrors the static-UI display). */
    regDtm:     string;
    approvers:  ApproverRow[];
};

/**
 * Form-state shape for the Add / Edit dialog. Kept separate from
 * {@link ApprovalLineRow} because Create has no
 * `apprLineNo` and Edit threads it via the path segment, not the
 * body.
 */
export type ApprovalLineFormValues = {
    apprLineNm: string;
    approvers:  ApproverRow[];
};
