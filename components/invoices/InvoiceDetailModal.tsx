"use client";

import {
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    FileCode2,
    FileText,
    GitCompare,
    Loader2,
    Paperclip,
    Printer,
    Trash2,
    Upload,
} from "lucide-react";
import { pdfMatchesInvoice } from "@/lib/weinvoice/pdfText";
import { useEffect, useRef, useState } from "react";

import { apiErrorText } from "@/components/invoices/apiError";
import InvoiceSheet from "@/components/invoices/InvoiceSheet";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { StatusPill } from "@/components/shared/StatusPill";
import {
    lookupHref,
    setLookupCode,
    addFile,
    downloadInvoiceFile,
    fileBaseName,
    getInvoice,
    invoiceFileObjectUrl,
    isDeletableFile,
    loadInvoiceDetail,
    partnerOf,
    pdfCandidates,
    removeFile,
    xmlContent,
    type AddFileConfirm,
} from "@/lib/api/weinvoice/invoices";
import { engineAvailable, fetchOriginalPdf, storeUploadedPdf } from "@/lib/api/weinvoice/original";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { printRenderedInvoice, renderedHtml } from "@/lib/weinvoice/exporter";
import { canAutoFetch, findProvider, lookupCodeFromFileName, needsCopyAssist, originalInvoiceUrl, parseLookupInput, supportsDeepLink } from "@/lib/weinvoice/providers";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { fullSymbol, hasFile, invoiceKey, isNoCode, type Invoice, type InvoiceFile } from "@/lib/weinvoice/types";
import { cn, downloadBlob, sleep } from "@/lib/utils";
import { toApiError } from "@/lib/api/weinvoice/http";
import { parseInvoiceXml } from "@/lib/weinvoice/xml";

type Tab = "invoice" | "files" | "related";

export default function InvoiceDetailModal({ id, onClose, onOpenOther, initialTab = "invoice" }: { id: string | null; onClose: () => void; onOpenOther: (id: string) => void; initialTab?: Tab }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    useStore((s) => s.invoices);
    const inv = id ? getInvoice(id) : undefined;
    // api mode: the list rows are a summary — load the full record + file record when the modal opens.
    useEffect(() => {
        if (DATA_SOURCE !== "api" || !id) return;
        loadInvoiceDetail(id).catch((err) => toast(apiErrorText(err, t), "error"));
    }, [id, t, toast]);
    const [tab, setTab] = useState<Tab>(initialTab);
    // Reset the tab when another invoice / initial tab is requested (state-during-render, no effect).
    const tabKey = `${id}|${initialTab}`;
    const [tabFor, setTabFor] = useState(tabKey);
    if (tabFor !== tabKey) {
        setTabFor(tabKey);
        setTab(initialTab);
    }

    if (!inv) return null;
    const related = inv.relatedId ? getInvoice(inv.relatedId) : undefined;
    const p = partnerOf(inv);
    const prov = findProvider(inv.providerTaxId ?? inv.provider);
    const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { key: "invoice", label: t("detail.tab.invoice"), icon: <FileText /> },
        { key: "files", label: t("detail.tab.files"), icon: <Paperclip />, badge: inv.files.length },
        ...(related ? [{ key: "related" as Tab, label: t("detail.tab.related"), icon: <GitCompare /> }] : []),
    ];

    return (
        <Modal
            open={!!inv}
            onClose={onClose}
            width={1080}
            bodyClassName="p-0"
            title={
                <span className="flex flex-wrap items-center gap-2">
                    {fullSymbol(inv)} · {inv.number}
                    <StatusPill size="sm" label={t(`status.${inv.status}`)} variant={inv.status === "original" ? "success" : inv.status === "cancelled" ? "failed" : "progress"} />
                </span>
            }
        >
            <div className="flex min-h-[560px] flex-col lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex shrink-0 items-center gap-1 border-b border-wb-border-sidebar px-4">
                        {tabs.map((x) => (
                            <button
                                key={x.key}
                                onClick={() => setTab(x.key)}
                                className={cn(
                                    "-mb-px flex h-11 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-wb-13 font-semibold [&_svg]:size-4",
                                    tab === x.key ? "border-brand text-brand" : "border-transparent text-wb-ntrl-7 hover:text-wb-ink",
                                )}
                            >
                                {x.icon}
                                {x.label}
                                {x.badge !== undefined && <span className="rounded-full bg-wb-ntrl-3 px-1.5 text-wb-11 text-wb-ntrl-7">{x.badge}</span>}
                            </button>
                        ))}
                    </div>
                    <div className="custom-scrollbar min-h-0 flex-1 overflow-auto bg-wb-bg-sidebar p-4">
                        {tab === "invoice" && <InvoiceView inv={inv} />}
                        {tab === "files" && <FileRecord inv={inv} />}
                        {tab === "related" && related && <Compare inv={inv} other={related} onOpenOther={onOpenOther} />}
                    </div>
                </div>

                {/* Side summary */}
                <aside className="w-full shrink-0 border-t border-wb-border-sidebar p-4 lg:w-[300px] lg:border-t-0 lg:border-l">
                    <Info label={t("detail.partner")} value={<><b>{p.name}</b><br /><span className="text-wb-ntrl-6">{t("common.mst")} {p.taxId}</span></>} />
                    <Info label={t("detail.issue_date")} value={fmtDate(inv.issueDate)} />
                    <Info label={t("detail.amounts")} value={<>{fmtMoney(inv.preTax)} + {fmtMoney(inv.tax)} = <b className="text-brand">{fmtMoney(inv.total)} ₫</b></>} />
                    <Info label={t("detail.cqt_code")} value={isNoCode(inv) ? <span className="text-wb-ntrl-6">{t("inv.nocode_tip")}</span> : <span className="font-mono text-wb-12 break-all">{inv.cqtCode}</span>} />
                    <Info
                        label={t("detail.provider")}
                        value={
                            inv.provider ? (
                                <span className="flex flex-col gap-1">
                                    <span>
                                        <b>{inv.provider}</b>
                                        {prov && (
                                            <span className="block text-wb-12 text-wb-ntrl-6">
                                                {prov.fullName} · {t("common.mst")} {prov.taxId}
                                            </span>
                                        )}
                                    </span>
                                    {inv.lookupCode && (
                                        <span className="flex items-center gap-1 text-wb-12">
                                            {t("detail.lookup_code")}: <b className="font-mono">{inv.lookupCode}</b>
                                            <CopyBtn text={inv.lookupCode} />
                                        </span>
                                    )}
                                    {inv.lookupCode && needsCopyAssist(inv.providerTaxId ?? inv.provider) && (
                                        <span className="flex items-center gap-1 text-wb-12">
                                            {t("detail.lookup_company")}: <b className="font-mono">{inv.lookupCompany || inv.sellerTaxId}</b>
                                            <CopyBtn text={inv.lookupCompany || inv.sellerTaxId} />
                                        </span>
                                    )}
                                    {lookupHref(inv).url && (
                                        <a className="inline-flex items-center gap-1 text-wb-12 font-medium text-brand hover:underline" href={lookupHref(inv).url} target="_blank" rel="noreferrer">
                                            {t("inv.open_portal")} <ExternalLink className="size-3" />
                                        </a>
                                    )}
                                </span>
                            ) : (
                                "—"
                            )
                        }
                    />
                    <Info label={t("detail.source")} value={t(`source.${inv.source}`)} />
                    <Info label={t("detail.synced_at")} value={fmtDateTime(inv.syncedAt)} />
                    <div className="mt-4 flex flex-col gap-2">
                        <Button size="md"
                            variant="brand"
                            icon={<FileCode2 />}
                            disabled={!hasFile(inv, "xml")}
                            onClick={() => {
                                const xmlFile = inv.files.find((f) => f.kind === "xml");
                                if (DATA_SOURCE === "api") {
                                    if (xmlFile) downloadInvoiceFile(inv, xmlFile).catch((err) => toast(apiErrorText(err, t), "error"));
                                    return;
                                }
                                const x = xmlContent(inv);
                                if (x) downloadBlob(new Blob([x], { type: "application/xml" }), `${fileBaseName(inv)}.xml`);
                            }}
                        >
                            {t("detail.download_xml")}
                        </Button>
                        <Button size="md" variant="brand" icon={<Download />} onClick={() => downloadBlob(new Blob([renderedHtml(inv)], { type: "text/html" }), `${fileBaseName(inv)}.html`)}>
                            {t("detail.download_rendered")}
                        </Button>
                        <Button size="md"
                            variant="neutral"
                            icon={<Printer />}
                            onClick={() => {
                                // Print the rendered copy in its own popup — never the live modal DOM (CLAUDE.md §6d).
                                if (!printRenderedInvoice(inv)) toast(t("detail.print_blocked"), "warning");
                            }}
                        >
                            {t("detail.print")}
                        </Button>
                    </div>
                </aside>
            </div>
        </Modal>
    );
}

/** Original PDF (when fetched) with a switch to the rendered copy built from XML. */
function InvoiceView({ inv }: { inv: Invoice }) {
    const { t } = useTranslation();
    // api mode: PDFs to try, in order — uploaded (the user chose to replace) → provider original → GDT copy.
    // Files the server does not have are skipped; a download that fails moves on to the next one.
    const candidates = DATA_SOURCE === "api" ? pdfCandidates(inv) : [];
    const invoiceId = inv.id;
    const listKey = `${invoiceId}|${candidates.map((c) => `${c.id}@${c.addedAt}`).join(",")}`;
    const [attempt, setAttempt] = useState({ key: listKey, at: 0, firstErr: "" });
    if (attempt.key !== listKey) setAttempt({ key: listKey, at: 0, firstErr: "" });
    const at = attempt.key === listKey ? attempt.at : 0;
    const apiPdf = candidates[at];
    const isGdtCopy = !!apiPdf && apiPdf.id === inv.gdtPdf?.id;
    const apiPdfId = apiPdf?.id ?? "";
    const apiPdfName = apiPdf?.name ?? "";
    const apiPdfKey = apiPdf ? `${listKey}|${apiPdfId}` : "";
    const [apiPdfUrl, setApiPdfUrl] = useState<{ key: string; url: string } | null>(null);
    useEffect(() => {
        if (!apiPdfKey) return;
        let alive = true;
        let made = "";
        invoiceFileObjectUrl(invoiceId, { id: apiPdfId, name: apiPdfName, kind: "pdf" })
            .then((url) => {
                made = url;
                if (alive) setApiPdfUrl({ key: apiPdfKey, url });
                else URL.revokeObjectURL(url);
            })
            // Unreadable PDF (e.g. WBE3010: not on this server's disk) → try the next one; keep the first reason.
            .catch((err) => {
                if (alive) setAttempt((a) => (a.key === listKey ? { key: listKey, at: a.at + 1, firstErr: a.firstErr || apiErrorText(err, t) } : a));
            });
        return () => {
            alive = false;
            if (made) URL.revokeObjectURL(made);
        };
    }, [apiPdfKey, listKey, invoiceId, apiPdfId, apiPdfName, t]);
    // Nothing loaded: say why — the first download error, or that the PDF is not on the server yet.
    const missingPdf = DATA_SOURCE === "api" && inv.files.some((f) => f.kind === "pdf" && f.missing);
    const pdfErr = apiPdf ? "" : attempt.key === listKey && attempt.firstErr ? attempt.firstErr : missingPdf ? t("files.missing") : "";
    const local = inv.files.find((f) => f.kind === "pdf" && f.url);
    const pdfUrl = DATA_SOURCE === "api" ? (apiPdfUrl && apiPdfUrl.key === apiPdfKey ? apiPdfUrl.url : "") : (local?.url ?? "");
    const [mode, setMode] = useState<"original" | "rendered">(pdfUrl ? "original" : "rendered");
    const modeKey = `${inv.id}|${pdfUrl}`;
    const [modeFor, setModeFor] = useState(modeKey);
    if (modeFor !== modeKey) {
        setModeFor(modeKey);
        setMode(pdfUrl ? "original" : "rendered");
    }
    if (!pdfUrl)
        return pdfErr ? (
            <div className="flex h-full flex-col gap-2">
                <p className="rounded-md bg-wb-warn-bg px-3 py-2 text-wb-12 text-wb-warn-text">{t("detail.view.pdf_unavailable", { reason: pdfErr })}</p>
                <InvoiceSheet inv={inv} />
            </div>
        ) : (
            <InvoiceSheet inv={inv} />
        );
    return (
        <div className="flex h-full flex-col gap-2">
            <div className="flex items-center gap-1 self-start rounded-md bg-white p-0.5 shadow-wb-outline">
                {(["original", "rendered"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={cn("h-7 cursor-pointer rounded-[5px] px-3 text-wb-13 font-medium", mode === m ? "bg-brand text-white" : "hover:bg-wb-bg-sidebar")}>
                        {t(m === "original" && isGdtCopy ? "detail.view.gdt_copy" : `detail.view.${m}`)}
                    </button>
                ))}
            </div>
            {isGdtCopy && mode === "original" && <p className="text-wb-12 text-wb-ntrl-6">{t("detail.view.gdt_copy_hint")}</p>}
            {mode === "original" ? <iframe title="original" src={pdfUrl} className="h-[640px] w-full rounded-md bg-white shadow-wb-card" /> : <InvoiceSheet inv={inv} />}
        </div>
    );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="border-b border-wb-border-sidebar py-2.5 first:pt-0">
            <p className="text-wb-11 font-medium uppercase text-wb-ntrl-6">{label}</p>
            <div className="mt-0.5 text-wb-13 text-wb-ink">{value}</div>
        </div>
    );
}

function CopyBtn({ text }: { text: string }) {
    const [ok, setOk] = useState(false);
    return (
        <button
            className="cursor-pointer text-wb-ntrl-5 hover:text-brand"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                } catch {
                    /* ignore */
                }
                setOk(true);
                setTimeout(() => setOk(false), 1200);
            }}
        >
            {ok ? <CheckCircle2 className="size-3.5 text-wb-status-approved-text" /> : <Copy className="size-3.5" />}
        </button>
    );
}

/* ---------------- Invoice file record ("Hồ sơ hoá đơn") ---------------- */
function FileRecord({ inv }: { inv: Invoice }) {
    const { t } = useTranslation();
    const { toast, confirm, alert } = useDialog();
    const input = useRef<HTMLInputElement>(null);
    const [fetchStep, setFetchStep] = useState<number>(-1);

    const [dragOver, setDragOver] = useState(false);

    /** Confirm question for a backend `needs_confirm` reason (`pdf_exists`, `pdf_not_matched`, `xml_key_mismatch`). */
    const reasonDialog = (reason: string, kind: InvoiceFile["kind"], fileName: string): { title: string; message: string; confirmLabel: string; value: AddFileConfirm } => {
        if (reason === "pdf_exists") return { title: t("files.replace_title"), message: t("files.replace_msg", { k: kind.toUpperCase() }), confirmLabel: t("files.replace"), value: "replace" };
        if (reason === "pdf_not_matched") return { title: t("files.pdf_check_title"), message: t("files.pdf_check_msg", { file: fileName, no: inv.number }), confirmLabel: t("files.attach_anyway"), value: "attach_anyway" };
        return { title: t("files.mismatch_title"), message: t("files.mismatch_msg", { file: fileName, inv: `${fullSymbol(inv)} · ${inv.number}` }), confirmLabel: t("files.attach_anyway"), value: "attach_anyway" };
    };

    /** api mode: POST /invoices/{id}/files — the backend decides what needs confirming (`needs_confirm`). */
    const uploadViaApi = async (file: File, kind: InvoiceFile["kind"]) => {
        if (kind === "xml") {
            try {
                parseInvoiceXml(await file.text());
            } catch {
                await alert({ title: t("files.invalid_xml"), kind: "error", message: t("files.invalid_xml_msg") });
                return;
            }
        }
        const codeInName = kind === "pdf" && !inv.lookupCode ? lookupCodeFromFileName(file.name, inv.symbol, inv.number) : "";
        const meta: InvoiceFile = { id: "", kind, name: file.name, size: file.size, origin: "upload", addedAt: new Date().toISOString() };
        // `confirm` is repeatable: every answer given so far is resent with the next attempt.
        const confirms = new Set<AddFileConfirm>();
        try {
            for (let attempt = 0; attempt < 4; attempt++) {
                const answers = [...confirms];
                const r = kind === "pdf" ? await storeUploadedPdf(file, fileBaseName(inv), { invoiceId: inv.id, confirm: answers }) : await addFile(inv.id, meta, { blob: file, confirm: answers });
                if ("error" in r) {
                    await alert({ title: t("files.not_pdf"), kind: "error", message: t("files.not_pdf_msg") });
                    return;
                }
                if ("duplicate" in r) {
                    toast(t("up.o.duplicate"), "warning");
                    return;
                }
                if ("needsConfirm" in r) {
                    for (const reason of r.needsConfirm) {
                        const d = reasonDialog(reason, kind, file.name);
                        if (!(await confirm({ title: d.title, message: d.message, confirmLabel: d.confirmLabel }))) return;
                        confirms.add(d.value);
                    }
                    continue;
                }
                toast(t(kind === "pdf" ? "files.pdf_added" : "files.added", { name: file.name }));
                if (codeInName) {
                    await setLookupCode(inv.id, codeInName, inv.lookupCompany);
                    toast(t("files.code_from_name", { c: codeInName }));
                }
                return;
            }
        } catch (err) {
            // WBE3008 not a PDF · WBE3009 not a readable e-invoice XML — the screen has its own messages for both.
            const code = toApiError(err).code;
            if (code === "WBE3008") await alert({ title: t("files.not_pdf"), kind: "error", message: t("files.not_pdf_msg") });
            else if (code === "WBE3009") await alert({ title: t("files.invalid_xml"), kind: "error", message: t("files.invalid_xml_msg") });
            else toast(apiErrorText(err, t), "error");
        }
    };

    const onPick = async (file: File) => {
        const ext = file.name.toLowerCase().split(".").pop();
        const kind: InvoiceFile["kind"] = ext === "xml" ? "xml" : ext === "pdf" ? "pdf" : "attachment";
        if (DATA_SOURCE === "api") return uploadViaApi(file, kind);
        let content: string | undefined;
        if (kind === "xml") {
            content = await file.text();
            try {
                const parsed = parseInvoiceXml(content);
                if (invoiceKey(parsed) !== invoiceKey(inv)) {
                    const go = await confirm({
                        title: t("files.mismatch_title"),
                        message: t("files.mismatch_msg", { file: `${parsed.templateNo}${parsed.symbol} · ${parsed.number}`, inv: `${fullSymbol(inv)} · ${inv.number}` }),
                        confirmLabel: t("files.attach_anyway"),
                    });
                    if (!go) return;
                }
            } catch {
                await alert({ title: t("files.invalid_xml"), kind: "error", message: t("files.invalid_xml_msg") });
                return;
            }
        }
        let url: string | undefined;
        const codeInName = kind === "pdf" && !inv.lookupCode ? lookupCodeFromFileName(file.name, inv.symbol, inv.number) : "";
        if (kind === "pdf") {
            // Light check that the PDF belongs to this invoice: its file name should carry the invoice number or lookup code.
            const digits = file.name.replace(/\D/g, "");
            const okName = !!codeInName || digits.includes(String(Number(inv.number))) || (!!inv.lookupCode && file.name.includes(inv.lookupCode));
            // Name does not say → look inside the PDF (invoice no. + seller MST, lookup code or GDT code). VNISC/abcsys names every file "ViewPDF.pdf".
            const byContent = okName ? "" : await pdfMatchesInvoice(file, { number: inv.number, lookupCode: inv.lookupCode, cqtCode: inv.cqtCode, sellerTaxId: inv.sellerTaxId });
            if (byContent) toast(t("files.pdf_check_ok", { no: inv.number }));
            if (!okName && !byContent) {
                const go = await confirm({
                    title: t("files.pdf_check_title"),
                    message: t("files.pdf_check_msg", { file: file.name, no: inv.number }),
                    confirmLabel: t("files.attach_anyway"),
                });
                if (!go) return;
            }
        }
        if (kind !== "attachment" && hasFile(inv, kind)) {
            const go = await confirm({ title: t("files.replace_title"), message: t("files.replace_msg", { k: kind.toUpperCase() }), confirmLabel: t("files.replace") });
            if (!go) return;
        }
        if (kind === "pdf") {
            const r = await storeUploadedPdf(file, fileBaseName(inv));
            if (!("url" in r)) {
                await alert({ title: t("files.not_pdf"), kind: "error", message: t("files.not_pdf_msg") });
                return;
            }
            url = r.url;
            if (!r.persisted) toast(t("files.pdf_session_only"), "warning");
        }
        await addFile(inv.id, { id: `f-${Date.now()}`, kind, name: file.name, size: file.size, origin: "upload", addedAt: new Date().toISOString(), content, url });
        toast(t(kind === "pdf" ? "files.pdf_added" : "files.added", { name: file.name }));
        if (codeInName) {
            await setLookupCode(inv.id, codeInName);
            toast(t("files.code_from_name", { c: codeInName }));
        }
    };

    const [engine, setEngine] = useState(false);
    useEffect(() => {
        engineAvailable().then(setEngine);
    }, []);
    const [fetchErr, setFetchErr] = useState("");

    /** REAL download through the engine (api mode: POST /invoices/{id}/original-pdf; engine steps drive the progress). */
    const fetchReal = async () => {
        setFetchErr("");
        setFetchStep(0);
        if (DATA_SOURCE !== "api") {
            await sleep(300);
            setFetchStep(1);
        }
        const res = await fetchOriginalPdf(inv, setFetchStep);
        if (res.ok) {
            setFetchStep(2);
            toast(t("files.pdf_fetched", { p: inv.provider }));
            setTimeout(() => setFetchStep(-1), 1200);
        } else {
            setFetchStep(-1);
            setFetchErr(res.detail ?? res.error);
        }
    };

    const fetchPdf = async () => {
        // api mode: never simulate — ask the backend engine for the original.
        if (DATA_SOURCE === "api") return fetchReal();
        for (let s = 0; s < 2; s++) {
            setFetchStep(s);
            await sleep(900);
        }
        await addFile(inv.id, { id: `${inv.id}-p`, kind: "pdf", name: `${fileBaseName(inv)}.pdf`, size: 152000, origin: "vendor", addedAt: new Date().toISOString() });
        setFetchStep(2);
        toast(t("files.pdf_fetched", { p: inv.provider }));
        setTimeout(() => setFetchStep(-1), 1500);
    };

    // No "solve captcha" step: §3.4 forbids bypassing third-party captchas — the user does that on the portal.
    const steps = [t("files.step_portal"), t("files.step_download")];
    // Real deep link only when the stored URL already carries this invoice's own lookup code (real XML).
    const link = originalInvoiceUrl(inv.providerTaxId ?? inv.provider, inv.lookupCode, { company: inv.lookupCompany, sellerTaxId: inv.sellerTaxId, buyerTaxId: inv.buyerTaxId, number: inv.number });
    const real = link?.direct && hasFile(inv, "xml") && inv.lookupCode ? link : null;
    const autoOk = canAutoFetch(inv.providerTaxId ?? inv.provider, inv.lookupCode);
    const needCode = hasFile(inv, "xml") && !inv.lookupCode && supportsDeepLink(inv.providerTaxId ?? inv.provider);
    const [codeInput, setCodeInput] = useState("");
    const saveCode = async () => {
        const c = parseLookupInput(codeInput);
        if (!/^[A-Za-z0-9_-]{4,40}$/.test(c)) {
            toast(t("files.code_invalid"), "warning");
            return;
        }
        try {
            await setLookupCode(inv.id, c, inv.lookupCompany);
        } catch (err) {
            // WBE3020 = invalid lookup code or link.
            if (toApiError(err).code === "WBE3020") toast(t("files.code_invalid"), "warning");
            else toast(apiErrorText(err, t), "error");
            return;
        }
        setCodeInput("");
        toast(t("files.code_saved", { c }));
    };

    return (
        <div
            className={cn("mx-auto flex max-w-[760px] flex-col gap-4 rounded-lg", dragOver && "ring-2 ring-brand ring-offset-4")}
            onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onPick(f);
            }}
        >
            <div className="rounded-lg bg-white p-4 shadow-wb-card">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-wb-14 font-semibold">{t("files.title")}</h4>
                    <div className="flex gap-2">
                        {real && engine && autoOk && !hasFile(inv, "pdf") && (
                            <Button size="wb-sm" variant="brand" icon={<Download />} onClick={fetchReal} disabled={fetchStep >= 0}>
                                {t("files.fetch_pdf", { p: inv.provider })}
                            </Button>
                        )}
                        {real ? (
                            <a
                                href={real.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center gap-2 rounded-md bg-white px-3 text-wb-13 font-medium text-brand shadow-wb-btn hover:bg-brand-soft"
                            >
                                <ExternalLink className="size-4" />
                                {t("files.open_original", { p: inv.provider })}
                            </a>
                        ) : (
                            !hasFile(inv, "pdf") &&
                            inv.provider && (
                                <Button size="wb-sm" variant="brand" icon={<Download />} onClick={fetchPdf} disabled={fetchStep >= 0}>
                                    {t("files.fetch_pdf", { p: inv.provider })}
                                </Button>
                            )
                        )}
                        <Button size="wb-sm" variant="primary" icon={<Upload />} onClick={() => input.current?.click()}>
                            {t("files.upload_pdf")}
                        </Button>
                        <input
                            ref={input}
                            type="file"
                            accept=".xml,.pdf,.png,.jpg,.jpeg,.zip"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onPick(f);
                                e.target.value = "";
                            }}
                        />
                    </div>
                </div>
                {needCode && (
                    <div className="mb-3 rounded-md bg-wb-warn-bg p-3">
                        <p className="mb-2 text-wb-12 text-wb-warn-text">{t("files.code_missing", { p: inv.provider })}</p>
                        <div className="flex gap-2">
                            <input
                                value={codeInput}
                                onChange={(e) => setCodeInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveCode()}
                                placeholder={t("files.code_placeholder")}
                                className="h-8 flex-1 rounded-md border border-wb-ntrl-3 bg-white px-2.5 text-wb-13 outline-none focus:border-brand"
                            />
                            <Button size="wb-sm" variant="primary" onClick={saveCode} disabled={!codeInput.trim()}>
                                {t("common.save")}
                            </Button>
                        </div>
                    </div>
                )}
                {fetchStep >= 0 && (
                    <div className="mb-3 rounded-md bg-brand-soft p-3">
                        {steps.map((s, i) => (
                            <div key={s} className="flex items-center gap-2 py-0.5 text-wb-13">
                                {fetchStep > i ? <CheckCircle2 className="size-4 text-wb-status-approved-text" /> : fetchStep === i ? <Loader2 className="size-4 wb-spin text-brand" /> : <span className="size-4 rounded-full border border-wb-ntrl-4" />}
                                <span className={cn(fetchStep >= i ? "text-wb-ink" : "text-wb-ntrl-5")}>{s}</span>
                            </div>
                        ))}
                    </div>
                )}
                <table className="w-full text-wb-13">
                    <thead>
                        <tr className="border-b border-wb-table-border bg-wb-bg-sidebar text-left text-wb-ntrl-8">
                            <th className="px-2.5 py-2 font-semibold">{t("files.col.type")}</th>
                            <th className="px-2.5 py-2 font-semibold">{t("files.col.name")}</th>
                            <th className="px-2.5 py-2 font-semibold">{t("files.col.origin")}</th>
                            <th className="px-2.5 py-2 font-semibold">{t("files.col.added")}</th>
                            <th className="w-[80px]" />
                        </tr>
                    </thead>
                    <tbody>
                        {inv.files.map((f) => (
                            <tr key={f.id} className="border-b border-wb-table-border">
                                <td className="px-2.5 py-2"><span className="rounded-[4px] bg-brand-softer px-1.5 py-0.5 text-wb-11 font-semibold text-brand uppercase">{f.kind === "attachment" ? t("files.attachment") : f.kind}</span></td>
                                <td className="max-w-[260px] truncate px-2.5 py-2" title={f.name}>{f.name} <span className="text-wb-12 text-wb-ntrl-5">({f.missing ? t("files.missing") : `${Math.max(1, Math.round(f.size / 1024))} KB`})</span></td>
                                <td className="px-2.5 py-2">{t(`origin.${f.origin}`)}</td>
                                <td className="px-2.5 py-2 text-wb-ntrl-7">{fmtDateTime(f.addedAt)}</td>
                                <td className="px-2.5 py-2 text-right">
                                    {f.kind === "pdf" && f.url && (
                                        <a className="inline-flex cursor-pointer p-1 text-wb-ntrl-6 hover:text-brand" title={t("files.open_pdf")} href={f.url} target="_blank" rel="noreferrer">
                                            <ExternalLink className="size-4" />
                                        </a>
                                    )}
                                    {!f.missing && (f.kind === "xml" || (DATA_SOURCE === "api" && !f.url)) && (
                                        <button
                                            className="cursor-pointer p-1 text-wb-ntrl-6 hover:text-brand"
                                            title={t("common.download")}
                                            onClick={() => {
                                                downloadInvoiceFile(inv, f).catch((err) => toast(apiErrorText(err, t), "error"));
                                            }}
                                        >
                                            <Download className="size-4" />
                                        </button>
                                    )}
                                    {isDeletableFile(f) && (
                                        <button
                                            className="cursor-pointer p-1 text-wb-ntrl-6 hover:text-wb-red-07"
                                            title={t("common.delete")}
                                            onClick={async () => {
                                                if (await confirm({ title: t("files.delete_title"), message: f.name, danger: true, confirmLabel: t("common.delete") })) await removeFile(inv.id, f.id).catch((err) => toast(apiErrorText(err, t), "error"));
                                            }}
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {inv.files.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-2.5 py-6 text-center text-wb-ntrl-6">{t("files.none")}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {fetchErr && <p className="mt-3 rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-12 text-wb-status-rejected-text">{t("files.fetch_failed", { e: fetchErr })}</p>}
                {real && !(engine && autoOk) && !hasFile(inv, "pdf") && <p className="mt-3 rounded-md bg-brand-soft px-3 py-2 text-wb-12 text-wb-ntrl-8">{t("files.original_hint", { p: inv.provider })}</p>}
                {isNoCode(inv) && !hasFile(inv, "xml") && <p className="mt-3 rounded-md bg-wb-warn-bg px-3 py-2 text-wb-12 text-wb-warn-text">{t("files.nocode_hint")}</p>}
            </div>
            <p className="text-wb-12 text-wb-ntrl-6">{t("files.drop_hint")}</p>
            <p className="text-wb-12 text-wb-ntrl-6">{t("files.rule")}</p>
        </div>
    );
}

/* ---------------- Replacement compare ---------------- */
function Compare({ inv, other, onOpenOther }: { inv: Invoice; other: Invoice; onOpenOther: (id: string) => void }) {
    const { t } = useTranslation();
    const [orig, repl] = inv.status === "replaced" ? [inv, other] : [other, inv];
    const rows: [string, string, string][] = [
        [t("compare.number"), orig.number, repl.number],
        [t("compare.date"), fmtDate(orig.issueDate), fmtDate(repl.issueDate)],
        [t("inv.col.pretax"), fmtMoney(orig.preTax), fmtMoney(repl.preTax)],
        [t("inv.col.tax"), fmtMoney(orig.tax), fmtMoney(repl.tax)],
        [t("inv.col.total"), fmtMoney(orig.total), fmtMoney(repl.total)],
    ];
    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-white p-4 shadow-wb-card">
                <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-wb-14 font-semibold">{t("compare.title")}</h4>
                    <Button size="wb-sm" variant="brand" onClick={() => onOpenOther(other.id)}>
                        {t("compare.open_other")}
                    </Button>
                </div>
                <table className="w-full text-wb-13">
                    <thead>
                        <tr className="border-b border-wb-table-border bg-wb-bg-sidebar text-left">
                            <th className="px-2.5 py-2 font-semibold" />
                            <th className="px-2.5 py-2 font-semibold">{t("compare.original")}</th>
                            <th className="px-2.5 py-2 font-semibold">{t("compare.replacement")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(([k, a, b]) => (
                            <tr key={k} className="border-b border-wb-table-border">
                                <td className="px-2.5 py-2 text-wb-ntrl-7">{k}</td>
                                <td className="px-2.5 py-2">{a}</td>
                                <td className={cn("px-2.5 py-2", a !== b && "bg-yellow-100 font-semibold")}>{b}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
                <div>
                    <p className="mb-1 text-wb-12 font-semibold uppercase text-wb-ntrl-6">{t("compare.original")}</p>
                    <InvoiceSheet inv={orig} className="p-3 text-wb-11" />
                </div>
                <div>
                    <p className="mb-1 text-wb-12 font-semibold uppercase text-wb-ntrl-6">{t("compare.replacement")}</p>
                    <InvoiceSheet inv={repl} diffWith={orig} className="p-3 text-wb-11" />
                </div>
            </div>
        </div>
    );
}
