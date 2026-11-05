/*
 * Uploads (screen 09 · Nguồn → Tải lên) — api mode only (DATA_SOURCE === "api").
 *
 * Published contract (backend interface-specification § "Mail, uploads"; DTO `UploadResponse`):
 *   POST   /uploads                    multipart `company_mst` + `files` (repeated; .xml · .zip · .pdf;
 *                                      ≤ 200) → UploadResponse (status `queued`, outcomes null). The
 *                                      engine reads the files and de-duplicates (§3.2).
 *                                      WBE3022 no file · WBE3025 unsupported type · WBE3017 too many.
 *   GET    /uploads/{upload_id}        UploadResponse — `status` is the engine request's
 *                                      (queued · running · done · partial · failed · cancelled);
 *                                      each file's `outcome` is null until processed.
 *   POST   /uploads/{upload_id}/adopt  { company_mst } → { request_id, subject }: adds the MST as
 *                                      `need_password` and imports its `foreign` files (WBE3026 when
 *                                      no file of the batch names that MST).
 *   DELETE /uploads/{upload_id}        → null
 *
 * The files are sent as the user picked them (ZIPs included, unparsed) — parsing is the engine's.
 * Mock mode keeps the client-side import in UploadPage (invoices.importParsed).
 */
import { WeInvoiceApiError, waitForRequest, wiDelete, wiGet, wiPost, wiUpload } from "@/lib/api/weinvoice/http";
import { sleep } from "@/lib/utils";

export const UPLOAD_OUTCOMES = ["new", "merged", "duplicate", "foreign", "error", "pdf_pending"] as const;
export type UploadOutcome = (typeof UPLOAD_OUTCOMES)[number];

/** `UploadResponse.FileItem` (camelCased). */
export type UploadFileRec = {
    fileNo: number;
    name: string;
    size: number;
    /** `null` until the engine has processed the file. */
    outcome: UploadOutcome | null;
    // OPEN: `message` is free text written by the engine (no reason-code list is published).
    message: string | null;
    invoiceId: string | null;
    sellerTaxId: string | null;
    buyerTaxId: string | null;
    // OPEN: the spec does not say whose name `partner_name` is for a `foreign` file.
    partnerName: string | null;
    total: number | null;
    /** `has` / `missing` for the invoice the file landed on; null without an invoice. */
    pdfStatus: "has" | "missing" | null;
    processedAt: string | null;
};

/** `UploadResponse` (camelCased). */
export type UploadRec = {
    uploadId: string;
    companyMst: string;
    requestId: string | null;
    /** Engine request status of the batch. */
    status: "queued" | "running" | "done" | "partial" | "failed" | "cancelled" | null;
    error: string | null;
    createdAt: string;
    files: UploadFileRec[];
};

/** `POST /uploads/{id}/adopt` → `RequestAccepted`. */
type RequestAccepted = { requestId: string; subject: string };

const FINISHED = new Set(["done", "partial", "failed", "cancelled"]);

/** The engine request of the batch has finished (done · partial · failed · cancelled). */
export function uploadSettled(u: Pick<UploadRec, "status">): boolean {
    return FINISHED.has(String(u.status ?? ""));
}

const normalize = (u: UploadRec, uploadId: string): UploadRec => ({ ...u, uploadId: u.uploadId ?? uploadId, files: u.files ?? [] });

export async function getUpload(uploadId: string): Promise<UploadRec> {
    return normalize(await wiGet<UploadRec>(`/uploads/${encodeURIComponent(uploadId)}`), uploadId);
}

/** A failed / cancelled batch (no per-file result to show) becomes a WeInvoiceApiError. */
function assertUsable(u: UploadRec): UploadRec {
    if ((u.status === "failed" || u.status === "cancelled") && !u.files.some((f) => f.outcome)) {
        throw new WeInvoiceApiError(`WBE_REQUEST_${u.status.toUpperCase()}`, u.error || u.status);
    }
    return u;
}

/** Poll `GET /uploads/{upload_id}` until the batch's engine request has finished. */
export async function waitForUpload(uploadId: string, onProgress?: (u: UploadRec) => void, intervalMs = 1000, timeoutMs = 10 * 60_000): Promise<UploadRec> {
    const started = Date.now();
    for (;;) {
        const u = await getUpload(uploadId);
        onProgress?.(u);
        if (uploadSettled(u)) return assertUsable(u);
        if (Date.now() - started > timeoutMs) throw new WeInvoiceApiError("WBE_TIMEOUT", "The engine did not finish reading the files in time.");
        await sleep(intervalMs);
    }
}

/** `POST /uploads` (multipart: `files` repeated + `company_mst`) then wait for the per-file results. */
export async function uploadFiles(taxId: string, files: File[], onProgress?: (u: UploadRec) => void, intervalMs?: number): Promise<UploadRec> {
    const form = new FormData();
    form.append("company_mst", taxId);
    for (const f of files) form.append("files", f, f.name);
    const created = await wiUpload<UploadRec | null>("/uploads", form);
    if (!created?.uploadId) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Response has no `upload_id`.");
    if (uploadSettled(created)) return assertUsable(normalize(created, created.uploadId));
    onProgress?.(normalize(created, created.uploadId));
    return waitForUpload(created.uploadId, onProgress, intervalMs);
}

/**
 * "Thêm MST … và nhập": `POST /uploads/{id}/adopt` → wait for the engine import request → re-read
 * the batch. `partial` counts as finished (some files may still be `error`; the rows show it).
 */
export async function adoptUpload(uploadId: string, companyMst: string, intervalMs?: number): Promise<UploadRec> {
    const res = await wiPost<RequestAccepted | null>(`/uploads/${encodeURIComponent(uploadId)}/adopt`, { companyMst });
    if (!res?.requestId) throw new WeInvoiceApiError("WBE_CLIENT_PARSE", "Response has no `request_id`.");
    const r = await waitForRequest(res.requestId, undefined, undefined, intervalMs);
    // `error` of an engine request is free text — the code names the final state.
    if (r.status !== "done" && r.status !== "partial") throw new WeInvoiceApiError(`WBE_REQUEST_${r.status.toUpperCase()}`, r.error || r.status);
    return getUpload(uploadId);
}

/** "Xoá kết quả": `DELETE /uploads/{upload_id}`. */
export async function deleteUpload(uploadId: string): Promise<void> {
    await wiDelete(`/uploads/${encodeURIComponent(uploadId)}`);
}
