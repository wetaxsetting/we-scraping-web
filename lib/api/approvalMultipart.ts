/**
 * M-1 — shared multipart builder for Request Approval submissions.
 *
 * Every payment type's Request Approval endpoint accepts the same multipart
 * shape: a JSON `request` part plus zero-or-more `attachments` file parts
 * (legacy `EXPT_RESOL_FILE` / REC1). When the user picked no files the
 * `attachments` parts are simply omitted and the backend reads them as
 * `required = false`, so the JSON-only (no-file) submit still works.
 *
 * Mirrors the inline shape Internal Transfer has used since the attachment
 * feature landed (`submitInternalTransferApproval`); extracted here so the
 * Vendor / Expense / Payroll / Overseas / Card clients share one definition.
 */
export function buildApprovalForm(request: unknown, attachments?: File[]): FormData {
    const form = new FormData();
    form.append(
        "request",
        new Blob([JSON.stringify(request)], { type: "application/json" }),
    );
    for (const file of attachments ?? []) {
        form.append("attachments", file, file.name);
    }
    return form;
}

/** Axios config for a multipart Request Approval POST. */
export const APPROVAL_MULTIPART_CONFIG = {
    headers: { "Content-Type": "multipart/form-data" },
} as const;
