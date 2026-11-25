/*
 * Downloads of the invoice list — WeInvoice UI Spec v1.1 (20/11/2026), file 02 §3.6, §3.11, §3.12.
 *
 * Every file is built by the backend (project rule: no workbook in the browser) — backend record
 * `wecms-api/docs/features/addon-service/weinvoice/weinvoice-invoice-downloads-v1-1-2026-11-25.md`:
 *   POST /invoices/export/excel        body = InvoiceFilter (+ ids)  → XLSX, 3 sheets (§3.11)
 *   POST /invoices/export/cqt-list     body = InvoiceFilter (+ ids)  → ZIP "bang-ke-goc-CQT_…" (§3.12)
 *   POST /invoices/export/pdf-jobs     {company_mst, ids, filter, mode} → job (processed on the server, §3.12)
 *   GET  /invoices/export/pdf-jobs/{id} · POST …/cancel · POST …/retry {reason?} · GET …/file · GET …/failed-excel
 * Scope (§3.6 v1.1): nothing ticked → the whole filtered list (`ids` omitted); ticked → `ids`.
 * Mock mode cannot build these files: callers get `{ ok: false }` / `null` and show "not available".
 */
import { listFilterBody, type InvoiceQuery } from "@/lib/api/weinvoice/invoices";
import { wiDownload, wiGet, wiPost } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { downloadBlob } from "@/lib/utils";

export type ListScope = { filter: Omit<InvoiceQuery, "page" | "size">; ids?: string[] };

export type PdfMode = "merge" | "flat" | "rendered" | "pdf_xml" | "by_company" | "by_month";
export const PDF_MODES: PdfMode[] = ["merge", "flat", "rendered", "pdf_xml", "by_company", "by_month"];

export type PdfItemPhase = "xml" | "queued" | "loading" | "done" | "fallback" | "failed";
export type PdfJobItem = {
    id: string;
    partner: string;
    partnerTaxId: string;
    symbol: string;
    number: string;
    issueDate: string;
    phase: PdfItemPhase;
    source?: string | null;
    reason?: string | null;
};
export type PdfJobGroup = { reason: string; count: number; items: PdfJobItem[] };
export type PdfJob = {
    jobId: string;
    mode: PdfMode;
    state: "running" | "done" | "cancelled" | "failed";
    step: "xml" | "pdf" | "pack" | "done";
    xmlDone: number;
    xmlTotal: number;
    total: number;
    done: number;
    fallback: number;
    failed: number;
    loading: number;
    items: PdfJobItem[];
    failedGroups: PdfJobGroup[];
    fallbackGroups: PdfJobGroup[];
    fileName?: string | null;
    fileReady: boolean;
    error?: string | null;
};

const scopeBody = (s: ListScope) => listFilterBody(s.filter, s.ids);

/** Excel (§3.11). `false` = mock build (server only). */
export async function downloadExcel(scope: ListScope, fallbackName: string): Promise<boolean> {
    if (DATA_SOURCE !== "api") return false;
    const { blob, fileName } = await wiDownload("post", "/invoices/export/excel", { body: scopeBody(scope), fallbackName });
    downloadBlob(blob, fileName);
    return true;
}

/** "Bảng kê gốc (CQT)" ZIP (§3.12). `false` = mock build. */
export async function downloadCqtList(scope: ListScope): Promise<boolean> {
    if (DATA_SOURCE !== "api") return false;
    const { blob, fileName } = await wiDownload("post", "/invoices/export/cqt-list", {
        body: scopeBody(scope),
        fallbackName: `bang-ke-goc-CQT_${scope.filter.from}_${scope.filter.to}.zip`,
    });
    downloadBlob(blob, fileName);
    return true;
}

/** Starts a bulk PDF job; `null` in mock mode. */
export async function startPdfJob(scope: ListScope, mode: PdfMode): Promise<PdfJob | null> {
    if (DATA_SOURCE !== "api") return null;
    const filter = scopeBody({ filter: scope.filter });
    return wiPost<PdfJob>("/invoices/export/pdf-jobs", { companyMst: scope.filter.taxId, ids: scope.ids, filter, mode });
}

export const pdfJobStatus = (jobId: string) => wiGet<PdfJob>(`/invoices/export/pdf-jobs/${encodeURIComponent(jobId)}`);
export const cancelPdfJob = (jobId: string) => wiPost<PdfJob>(`/invoices/export/pdf-jobs/${encodeURIComponent(jobId)}/cancel`);
export const retryPdfJob = (jobId: string, reason?: string) =>
    wiPost<PdfJob>(`/invoices/export/pdf-jobs/${encodeURIComponent(jobId)}/retry`, reason ? { reason } : {});

export async function downloadPdfJobFile(job: Pick<PdfJob, "jobId" | "fileName">): Promise<void> {
    const { blob, fileName } = await wiDownload("get", `/invoices/export/pdf-jobs/${encodeURIComponent(job.jobId)}/file`, {
        fallbackName: job.fileName || "WeInvoice_PDF.zip",
    });
    downloadBlob(blob, fileName);
}

export async function downloadPdfJobFailedExcel(job: Pick<PdfJob, "jobId" | "fileName">): Promise<void> {
    const base = (job.fileName || "WeInvoice_PDF.zip").replace(/\.zip$/i, "");
    const { blob, fileName } = await wiDownload("get", `/invoices/export/pdf-jobs/${encodeURIComponent(job.jobId)}/failed-excel`, {
        fallbackName: `${base}_HD-THAT-BAI.xlsx`,
    });
    downloadBlob(blob, fileName);
}

/** Fallback reasons the pack fills with a rendered copy; others are failures (retry). */
export const FALLBACK_REASONS = ["no_code_invoice", "no_lookup_code", "not_connected", "no_provider"];
