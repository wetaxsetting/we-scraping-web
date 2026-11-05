/*
 * Original invoice PDF — WeInvoice UI Spec v1.0 (P1), screen 05 "Chi tiết hoá đơn".
 *
 * api (DATA_SOURCE === "api"): the backend engine fetches vendor originals (interface specification
 * § "Invoices (screens 04, 05)") —
 *  - engineAvailable() resolves true;
 *  - fetchOriginalPdf() → `POST /invoices/{id}/original-pdf` → `{request_id, subject}` → `waitForRequest`
 *    (engine: open portal → submit code → download), then reloads the record (`GET /invoices/{id}`);
 *  - storeUploadedPdf() checks the `%PDF-` bytes and uploads through `addFile` (POST /invoices/{id}/files);
 *    the backend checks again (`WBE3008`) and may answer `needs_confirm` (`pdf_not_matched`, `pdf_exists`).
 *
 * mock (default): the prototype talked to a local PDF engine (server.ps1) that downloaded vendor
 * originals and saved uploads under /files/pdf/. This build has no such engine (and must not bypass
 * third-party captchas, §3.4), so:
 *  - engineAvailable() resolves false → the UI shows the manual "Open original" path;
 *  - fetchOriginalPdf() always fails with "engine_unavailable";
 *  - storeUploadedPdf() keeps a verified PDF as a session-only object URL (persisted: false).
 */

import { type Invoice } from "@/lib/weinvoice/types";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { toApiError, waitForRequest, wiPost } from "@/lib/api/weinvoice/http";
import { addFile, loadInvoiceDetail, requestFailure, type AddFileConfirm } from "@/lib/api/weinvoice/invoices";

export function engineAvailable(): Promise<boolean> {
    return Promise.resolve(DATA_SOURCE === "api");
}

export type FetchResult = { ok: true; url: string; bytes: number } | { ok: false; error: string; detail?: string };

/**
 * UI progress index for an engine step: 0 = open portal / send code, 1 = download PDF.
 * OPEN: the spec does not list the fetch_pdf `step` values (controller: "open portal → submit code →
 * download") — any step mentioning download / pdf counts as the download step.
 */
export function pdfStepIndex(step: string | null | undefined): number {
    return step && /download|pdf/i.test(step) ? 1 : 0;
}

export async function fetchOriginalPdf(inv: Invoice, onStep?: (index: number) => void): Promise<FetchResult> {
    if (DATA_SOURCE !== "api") return { ok: false, error: "engine_unavailable" };
    try {
        const { requestId } = await wiPost<{ requestId: string; subject?: string }>(`/invoices/${encodeURIComponent(inv.id)}/original-pdf`);
        const r = await waitForRequest(requestId, (p) => onStep?.(pdfStepIndex(p.step)));
        if (r.status !== "done" && r.status !== "partial") {
            const e = requestFailure(r);
            return { ok: false, error: e.code, detail: e.message };
        }
        const fresh = await loadInvoiceDetail(inv.id);
        const pdf = fresh?.files.find((f) => f.kind === "pdf");
        // Finished without a PDF on the record (e.g. the portal had none) is not a success.
        if (!pdf) return { ok: false, error: "WBE_NO_PDF", detail: r.error || undefined };
        // `url` stays empty in api mode: the file is read through the authenticated download.
        return { ok: true, url: pdf.url ?? "", bytes: pdf.size };
    } catch (err) {
        const e = toApiError(err);
        return { ok: false, error: e.code, detail: e.message };
    }
}

/** `%PDF-` magic bytes — §3.5 "phải là PDF thật". */
async function isRealPdf(file: Blob): Promise<boolean> {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return head.length === 5 && String.fromCharCode(...head) === "%PDF-";
}

export type StorePdfResult = { url: string; persisted: boolean } | { error: string } | { needsConfirm: string[] } | { duplicate: true };

/**
 * Keep an uploaded original PDF. api mode needs `opts.invoiceId` and uploads through `addFile`
 * (`needsConfirm` = the backend `reasons[]`; re-call with every answer so far in `opts.confirm`).
 */
export async function storeUploadedPdf(file: File, baseName: string, opts: { invoiceId?: string; confirm?: AddFileConfirm[] } = {}): Promise<StorePdfResult> {
    try {
        if (!(await isRealPdf(file))) return { error: "not_pdf" };
    } catch {
        return { error: "unreadable" };
    }
    if (DATA_SOURCE === "api") {
        if (!opts.invoiceId) return { error: "no_invoice" };
        const res = await addFile(
            opts.invoiceId,
            { id: "", kind: "pdf", name: file.name || `${baseName}.pdf`, size: file.size, origin: "upload", addedAt: new Date().toISOString() },
            { blob: file, confirm: opts.confirm },
        );
        if (res.ok) return { url: "", persisted: true };
        return "needsConfirm" in res ? { needsConfirm: res.needsConfirm } : { duplicate: true };
    }
    const blob = file.type === "application/pdf" ? file : new Blob([file], { type: "application/pdf" });
    return { url: URL.createObjectURL(blob), persisted: false };
}
