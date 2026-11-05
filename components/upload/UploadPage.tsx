"use client";

import { FileUp, Info, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import JSZip from "jszip";
import { useRef, useState } from "react";

import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { TestDataPanel } from "@/components/upload/TestDataPanel";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { StatusPill } from "@/components/shared/StatusPill";
import type { StatusPillVariant as PillVariant } from "@/components/shared/StatusPill";
import { CURRENT_YEAR } from "@/components/invoices/period";
import { getInvoice, importParsed, loadInvoices } from "@/lib/api/weinvoice/invoices";
import { fetchOriginalPdf } from "@/lib/api/weinvoice/original";
import { canAutoFetch } from "@/lib/weinvoice/providers";
import { addPendingConnection, loadCompanies, setActiveTaxId } from "@/lib/api/weinvoice/sync";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { adoptUpload, deleteUpload, uploadFiles, type UploadFileRec, type UploadRec } from "@/lib/api/weinvoice/uploads";
import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { getState, useStore } from "@/lib/api/weinvoice/store";
import { hasFile } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";
import { parseInvoiceXml } from "@/lib/weinvoice/xml";

type Outcome = "new" | "merged" | "duplicate" | "foreign" | "error" | "pdf_pending";
type ResultRow = { uploadId?: string; errorText?: string; file: string; outcome: Outcome; ref?: string; partner?: string; total?: number; invoiceId?: string; direction?: string; error?: string; raw?: string; buyer?: { taxId: string; name: string }; pdf?: "fetching" | "ok" | "failed" | "na" | "no_engine"; pdfUrl?: string; pdfError?: string };

/** Parser / import error → `up.err.*` reason key (§3.2 "Lỗi + lý do"). */
const ERROR_REASON: Record<string, string> = { invalid_xml: "invalid_xml", not_invoice: "not_invoice_xml", not_invoice_xml: "not_invoice_xml" };

const KNOWN_ERRORS = new Set(["invalid_xml", "not_invoice_xml", "invalid_zip", "unsupported"]);
const OUTCOMES = new Set<string>(["new", "merged", "duplicate", "foreign", "error", "pdf_pending"]);

/**
 * api mode: one file of `GET /uploads/{id}` → the page's result row. The invoice reference /
 * direction are not in the upload result — they are read from the store (`invoice_id`) at render.
 * For a `foreign` file the MST to adopt is the side (buyer first, then seller) that is not one of
 * the tenant's connections.
 */
function rowFromApi(uploadId: string, f: UploadFileRec, managed: Set<string>): ResultRow {
    const outcome = (f.outcome && OUTCOMES.has(f.outcome) ? f.outcome : "error") as Outcome;
    const code = f.message ? (ERROR_REASON[f.message] ?? f.message) : undefined;
    const known = code && KNOWN_ERRORS.has(code) ? code : undefined;
    const foreignMst = outcome === "foreign" ? [f.buyerTaxId, f.sellerTaxId].find((m): m is string => !!m && !managed.has(m)) : undefined;
    return {
        uploadId,
        file: f.name,
        outcome,
        partner: f.partnerName ?? undefined,
        total: f.total ?? undefined,
        invoiceId: f.invoiceId ?? undefined,
        // Known reason → translated `up.err.*`; otherwise the engine's message as is.
        error: known,
        errorText: known ? undefined : (f.message ?? undefined),
        buyer: foreignMst ? { taxId: foreignMst, name: f.partnerName ?? "" } : undefined,
        // `pdf_status`: has → the original PDF is on the invoice; missing → nothing to show.
        pdf: f.pdfStatus === "has" ? "ok" : undefined,
    };
}
const managedMsts = () => new Set(getState().connections.map((c) => c.taxId));
const rowsFromApi = (u: UploadRec) => {
    const managed = managedMsts();
    return u.files.map((f) => rowFromApi(u.uploadId, f, managed));
};

const VARIANT: Record<Outcome, PillVariant> = { new: "success", merged: "progress", duplicate: "neutral", foreign: "warning", error: "failed", pdf_pending: "pending" };

/** Nguồn → Tải lên: XML / ZIP / PDF, de-duplicated against GDT & email data. */
export default function UploadPage() {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const input = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);
    const [busy, setBusy] = useState(false);
    const [rows, setRows] = useState<ResultRow[]>([]);
    useStore((s) => s.invoices); // api mode: invoice refs of the result rows are read from the store
    /** Backend failure → toast text: a matching UI message where there is one, else message + code. */
    const errText = (e: unknown) => {
        if (!(e instanceof WeInvoiceApiError)) return (e as Error).message;
        if (e.code === "WBE3025") return `${t("up.err.unsupported")} — ${e.message}`;
        return `${e.message} (${e.code})`;
    };

    const handleXml = async (name: string, text: string): Promise<ResultRow> => {
        try {
            const parsed = parseInvoiceXml(text);
            const res = await importParsed(parsed, text, name, getState().activeTaxId, "upload");
            const ref = `${parsed.templateNo}${parsed.symbol} · ${parsed.number}`;
            if (res.outcome === "foreign") return { file: name, outcome: "foreign", ref, partner: parsed.sellerName, total: parsed.total, raw: text, buyer: { taxId: parsed.buyerTaxId, name: parsed.buyerName } };
            const partner = res.invoice.direction === "purchase" ? res.invoice.sellerName : res.invoice.buyerName;
            return { file: name, outcome: res.outcome, ref, partner, total: parsed.total, invoiceId: res.invoice.id, direction: res.invoice.direction };
        } catch (e) {
            return { file: name, outcome: "error", error: ERROR_REASON[(e as Error).message] ?? "invalid_xml" };
        }
    };

    /** api mode: the original files (ZIPs included, unparsed) go to the engine in ONE POST /uploads. */
    const processApi = async (files: File[]) => {
        const taxId = getState().activeTaxId;
        setBusy(true);
        let out: ResultRow[];
        try {
            out = rowsFromApi(await uploadFiles(taxId, files));
        } catch (e) {
            toast(errText(e), "error");
            return;
        } finally {
            setBusy(false);
        }
        setRows((r) => [...out, ...r]);
        const n = out.filter((x) => x.outcome === "new" || x.outcome === "merged").length;
        toast(t("up.toast", { n, total: out.length }), n ? "success" : "info");
        if (n) await reloadInvoices(taxId);
    };

    const reloadInvoices = async (taxId: string) => {
        try {
            await loadInvoices(taxId, CURRENT_YEAR);
        } catch (e) {
            toast(errText(e), "error");
        }
    };

    const process = async (files: File[]) => {
        if (DATA_SOURCE === "api") return processApi(files);
        setBusy(true);
        const out: ResultRow[] = [];
        for (const f of files) {
            const ext = f.name.toLowerCase().split(".").pop();
            if (ext === "xml") out.push(await handleXml(f.name, await f.text()));
            else if (ext === "zip") {
                try {
                    const zip = await JSZip.loadAsync(await f.arrayBuffer());
                    const entries = Object.values(zip.files).filter((z) => !z.dir);
                    for (const z of entries) {
                        const zx = z.name.toLowerCase();
                        if (zx.endsWith(".xml")) out.push(await handleXml(`${f.name} › ${z.name}`, await z.async("string")));
                        else if (zx.endsWith(".pdf")) out.push({ file: `${f.name} › ${z.name}`, outcome: "pdf_pending" });
                    }
                } catch {
                    out.push({ file: f.name, outcome: "error", error: "invalid_zip" });
                }
            } else if (ext === "pdf") out.push({ file: f.name, outcome: "pdf_pending" });
            else out.push({ file: f.name, outcome: "error", error: "unsupported" });
        }
        setRows((r) => [...out, ...r]);
        setBusy(false);
        void autoFetch(out);
        const n = out.filter((x) => x.outcome === "new" || x.outcome === "merged").length;
        toast(t("up.toast", { n, total: out.length }), n ? "success" : "info");
    };

    /** After import: download the ORIGINAL PDF automatically for supported providers (MISA…). */
    const autoFetch = async (list: ResultRow[]) => {
        const patch = (row: ResultRow, p: Partial<ResultRow>) => setRows((rs) => rs.map((x) => (x === row || (x.invoiceId && x.invoiceId === row.invoiceId) ? { ...x, ...p } : x)));
        const targets = list.filter((r) => r.invoiceId && (r.outcome === "new" || r.outcome === "merged" || r.outcome === "duplicate"));
        for (const r of targets) {
            const inv = getInvoice(r.invoiceId!);
            if (!inv || hasFile(inv, "pdf")) continue;
            if (!canAutoFetch(inv.providerTaxId ?? inv.provider, inv.lookupCode)) {
                patch(r, { pdf: "na" });
                continue;
            }
            patch(r, { pdf: "fetching" });
            let res: Awaited<ReturnType<typeof fetchOriginalPdf>>;
            try {
                res = await fetchOriginalPdf(inv);
            } catch {
                // No PDF engine in this build — report it instead of failing the import.
                res = { ok: false, error: "no_engine" };
            }
            if (res.ok) patch(r, { pdf: "ok", pdfUrl: res.url });
            else patch(r, { pdf: res.error === "no_engine" ? "no_engine" : "failed", pdfError: res.detail ?? res.error });
        }
    };

    /** Add the buyer MST of "foreign" files as a working MST, then re-import every foreign file for it. */
    const adoptBuyer = async (taxId: string, name: string, uploadId?: string) => {
        if (DATA_SOURCE === "api") return adoptBuyerApi(taxId, uploadId);
        addPendingConnection(taxId, name);
        setActiveTaxId(taxId);
        const redo = rows.filter((r) => r.outcome === "foreign" && r.raw && r.buyer?.taxId === taxId);
        const others = rows.filter((r) => !redo.includes(r));
        const again: ResultRow[] = [];
        for (const r of redo) again.push(await handleXml(r.file, r.raw!));
        setRows([...again, ...others]);
        void autoFetch(again);
        toast(t("up.adopted", { mst: taxId, n: again.filter((x) => x.outcome === "new" || x.outcome === "merged").length }));
    };

    /** api mode: POST /uploads/{id}/adopt for every upload holding foreign files of this buyer. */
    const adoptBuyerApi = async (taxId: string, firstUploadId?: string) => {
        const ids = Array.from(new Set([firstUploadId, ...rows.filter((r) => r.outcome === "foreign" && r.buyer?.taxId === taxId).map((r) => r.uploadId)].filter((x): x is string => !!x)));
        if (!ids.length) return;
        setBusy(true);
        const fresh = new Map<string, ResultRow[]>();
        try {
            for (const id of ids) fresh.set(id, rowsFromApi(await adoptUpload(id, taxId)));
        } catch (e) {
            toast(errText(e), "error");
        } finally {
            setBusy(false);
        }
        if (!fresh.size) return;
        // Replace each re-read upload's rows in place; others are untouched.
        setRows((rs) => {
            const done = new Set<string>();
            return rs.flatMap((r) => {
                if (!r.uploadId || !fresh.has(r.uploadId)) return [r];
                if (done.has(r.uploadId)) return [];
                done.add(r.uploadId);
                return fresh.get(r.uploadId)!;
            });
        });
        const imported = (list: ResultRow[]) => list.filter((x) => x.outcome === "new" || x.outcome === "merged").length;
        const before = imported(rows.filter((r) => r.uploadId && fresh.has(r.uploadId)));
        toast(t("up.adopted", { mst: taxId, n: Math.max(0, imported(Array.from(fresh.values()).flat()) - before) }));
        try {
            await loadCompanies();
        } catch (e) {
            toast(errText(e), "error");
        }
        setActiveTaxId(taxId);
        await reloadInvoices(taxId);
    };

    /** "Xoá kết quả": api mode also deletes the stored upload results (DELETE /uploads/{id}). */
    const clearRows = async () => {
        if (DATA_SOURCE === "api") {
            const ids = Array.from(new Set(rows.map((r) => r.uploadId).filter((x): x is string => !!x)));
            try {
                for (const id of ids) await deleteUpload(id);
            } catch (e) {
                toast(errText(e), "error");
                return;
            }
        }
        setRows([]);
    };

    const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.outcome] = (m[r.outcome] ?? 0) + 1), m), {});

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.upload")} subtitle={t("up.subtitle")} />

            <TestDataPanel />

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length) process(files);
                }}
                onClick={() => !busy && input.current?.click()}
                className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                    drag ? "border-brand bg-brand-soft" : "border-wb-ntrl-4 bg-wb-bg-card hover:border-brand hover:bg-brand-soft/60",
                )}
            >
                {busy ? <Loader2 className="size-10 wb-spin text-brand" /> : <UploadCloud className="size-10 text-brand" />}
                <p className="text-wb-16 font-semibold text-wb-ink">{busy ? t("up.processing") : t("up.drop")}</p>
                <p className="text-wb-13 text-wb-ntrl-6">{t("up.formats")}</p>
                <Button size="md" variant="primary" icon={<FileUp />} className="mt-2" disabled={busy}>
                    {t("up.choose")}
                </Button>
                <input
                    ref={input}
                    type="file"
                    multiple
                    accept=".xml,.zip,.pdf"
                    className="hidden"
                    onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length) process(files);
                        e.target.value = "";
                    }}
                />
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-wb-bg-sidebar px-4 py-3 text-wb-13 text-wb-ntrl-7">
                <Info className="mt-0.5 size-4 shrink-0 text-brand" />
                <p>{t("up.rule")}</p>
            </div>

            {rows.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="mr-2 text-wb-14 font-semibold">{t("up.results")}</h3>
                        {(Object.keys(VARIANT) as Outcome[]).filter((k) => counts[k]).map((k) => (
                            <StatusPill size="sm" key={k} variant={VARIANT[k]} label={`${t(`up.o.${k}`)}: ${counts[k]}`} />
                        ))}
                        <button className="ml-auto cursor-pointer text-wb-13 font-medium text-wb-ntrl-6 hover:text-wb-ink" onClick={() => void clearRows()}>
                            {t("up.clear")}
                        </button>
                    </div>
                    <div className="overflow-hidden rounded-lg shadow-wb-card">
                        <div className="custom-scrollbar overflow-x-auto">
                            <table className="w-full min-w-[860px] border-collapse text-wb-13">
                                <thead>
                                    <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                        <th className="px-3">{t("up.col.file")}</th>
                                        <th className="px-3">{t("up.col.invoice")}</th>
                                        <th className="px-3">{t("inv.col.partner")}</th>
                                        <th className="px-3 text-right">{t("inv.col.total")}</th>
                                        <th className="px-3">{t("up.col.result")}</th>
                                        <th className="px-3">{t("up.col.pdf")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={i} className="h-12 border-b border-wb-table-border font-medium">
                                            <td className="max-w-[280px] truncate px-3" title={r.file}>{r.file}</td>
                                            <td className="px-3">
                                                <InvoiceCell row={r} />
                                            </td>
                                            <td className="max-w-[260px] truncate px-3">{r.partner ?? "—"}</td>
                                            <td className="px-3 text-right tabular-nums">{r.total !== undefined ? fmtMoney(r.total) : "—"}</td>
                                            <td className="px-3">
                                                <StatusPill size="sm" variant={VARIANT[r.outcome]} label={t(`up.o.${r.outcome}`)} />
                                                {r.error && <span className="ml-2 text-wb-12 text-wb-ntrl-6">{t(`up.err.${r.error}`)}</span>}
                                                {r.errorText && <span className="ml-2 text-wb-12 text-wb-ntrl-6">{r.errorText}</span>}
                                                {r.outcome === "foreign" && r.buyer?.taxId && (
                                                    <button
                                                        className="ml-2 cursor-pointer text-wb-12 font-semibold text-brand hover:underline"
                                                        disabled={busy}
                                                        onClick={() => adoptBuyer(r.buyer!.taxId, r.buyer!.name, r.uploadId)}
                                                    >
                                                        {t("up.adopt", { mst: r.buyer.taxId })}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-3">
                                                {r.pdf === "fetching" ? (
                                                    <span className="flex items-center gap-1.5 text-brand"><Loader2 className="size-4 wb-spin" />{t("up.pdf.fetching")}</span>
                                                ) : r.pdf === "ok" && r.pdfUrl ? (
                                                    <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="font-semibold text-wb-status-approved-text hover:underline">{t("up.pdf.ok")} ↗</a>
                                                ) : r.pdf === "ok" ? (
                                                    <span className="font-semibold text-wb-status-approved-text">{t("up.pdf.ok")}</span>
                                                ) : r.pdf === "failed" ? (
                                                    <span className="text-wb-status-error-text" title={r.pdfError}>{t("up.pdf.failed")}</span>
                                                ) : r.pdf === "no_engine" ? (
                                                    <span className="text-wb-ntrl-6" title={t("up.pdf.no_engine_tip")}>{t("up.pdf.no_engine")}</span>
                                                ) : r.pdf === "na" ? (
                                                    <span className="text-wb-ntrl-5">{t("up.pdf.na")}</span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </PageLayout>
    );
}

/**
 * Result row → invoice cell. Mock rows carry their reference; api rows only carry `invoice_id`, so
 * the reference and direction come from the store (shown as soon as the invoices are reloaded).
 */
function InvoiceCell({ row }: { row: ResultRow }) {
    const inv = row.invoiceId ? getInvoice(row.invoiceId) : undefined;
    const ref = row.ref ?? (inv ? `${inv.templateNo}${inv.symbol} · ${inv.number}` : undefined);
    const direction = row.direction ?? inv?.direction;
    if (row.invoiceId && direction) {
        return (
            <Link className="text-brand hover:underline" href={`/invoices/${direction}/?open=${row.invoiceId}`}>
                {ref ?? row.invoiceId}
            </Link>
        );
    }
    return <>{ref ?? "—"}</>;
}
