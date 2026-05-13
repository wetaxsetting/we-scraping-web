import { z } from "zod";

import { MAX_APPROVERS } from "./approverMockData";

/**
 * Zod schema for the Add / Edit Approval Line dialog. Mirrors the
 * Spring `ApprovalLineCreateRequest` / `ApprovalLineUpdateRequest`
 * validation constraints. Messages hold translation keys; the caller
 * runs `t(key)` when surfacing.
 *
 * <p>Server enforces every rule too — a client-side bypass surfaces as
 * the matching backend code through the global `useDialog()` error
 * surface:
 *
 *   - `WBE_APPROVAL_LINE_NAME_BLANK`
 *   - `WBE_APPROVAL_LINE_EMPTY_APPROVERS`
 *   - `WBE_APPROVAL_LINE_TOO_MANY_APPROVERS`
 *   - `WBE_APPROVAL_LINE_DUP_APPROVER`
 *   - `WBE_APPROVAL_LINE_APPROVER_NOT_IN_TENANT`
 *
 * The schema exists primarily to gate the Submit button and render
 * per-field messages instantly without a round-trip.
 */
const approverSchema = z.object({
    id:         z.string().trim().min(1).max(100),
    name:       z.string().trim().min(1).max(100),
    position:   z.string().trim().max(100),
    department: z.string().trim().max(100),
    dispOrd:    z.number().int().min(1).max(MAX_APPROVERS).optional(),
    userImgUrl: z.string().optional(),
});

export const approvalLineSchema = z
    .object({
        apprLineNm: z
            .string()
            .trim()
            .min(1, "settings.approval_line.validation.name.required")
            .max(100, "settings.approval_line.validation.name.max"),
        approvers: z
            .array(approverSchema)
            .min(1, "settings.approval_line.validation.approvers.required")
            .max(MAX_APPROVERS, "settings.approval_line.validation.approvers.too_many"),
    })
    .superRefine((values, ctx) => {
        // Duplicate-approver guard — mirrors backend
        // WBE_APPROVAL_LINE_DUP_APPROVER. Walks the array to surface
        // the issue against the second occurrence's path.
        const seen = new Set<string>();
        values.approvers.forEach((a, i) => {
            if (seen.has(a.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["approvers", i, "id"],
                    message: "settings.approval_line.validation.approvers.duplicate",
                });
            }
            seen.add(a.id);
        });
    });

export type ApprovalLineSchemaIssue = {
    path: string;
    key:  string;
};

/** Validate the dialog's current form state. Returns null on success;
 *  otherwise a list of `{ path, key }` issues the caller maps onto
 *  per-field messages. */
export function validateApprovalLine(values: unknown): ApprovalLineSchemaIssue[] | null {
    const result = approvalLineSchema.safeParse(values);
    if (result.success) return null;
    return result.error.issues.map((iss) => ({
        path: iss.path.join("."),
        key:  iss.message,
    }));
}
