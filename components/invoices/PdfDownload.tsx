"use client";

import { Building2, CalendarDays, CheckCircle2, ChevronDown, CircleDashed, Download, FileStack, FileText, Files, FolderDown, Loader2, Mail, RefreshCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { apiErrorText } from "@/components/invoices/apiError";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { Popover } from "@/components/shared/Popover";
import { Button } from "@/components/ui/button";
import {
    FALLBACK_REASONS,
    PDF_MODES,
    cancelPdfJob,
    downloadPdfJobFailedExcel,
    downloadPdfJobFile,
    pdfJobStatus,
    retryPdfJob,
    type PdfItemPhase,
    type PdfJob,
    type PdfMode,
} from "@/lib/api/weinvoice/downloads";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * "Tải PDF hàng loạt" — UI Spec v1.1 screen 05, file 02 §3.12. The job runs on the server (user decision
 * 2026-11-25: "xử lý server rồi tải về 1 pack"); this component only starts it, polls its state, downloads the
 * one ZIP and shows the result. Record: docs/features/weinvoice/weinvoice-invoice-downloads-v1-1-2026-11-25.md.
 */

const ICON: Record<PdfMode, ReactNode> = {
    merge: <FileStack />,
    flat: <FolderDown />,
    rendered: <FileText />,
    pdf_xml: <Files />,
    by_company: <Building2 />,
    by_month: <CalendarDays />,
};

/** Poll interval of the job state. */
export const POLL_MS = 2000;

/** "Tải PDF (n) ▾" + the 6-mode menu. */
export function PdfDownloadMenu({ count, disabled, onPick }: { count: number; disabled?: boolean; onPick: (m: PdfMode) => void }) {
    const { t } = useTranslation();
    return (
        <Popover
            align="right"
            width={330}
            trigger={({ toggle }) => (
                <Button size="wb-sm" variant="neutral" icon={<Download />} onClick={toggle} disabled={disabled}>
                    {t("pdfdl.btn", { n: count })}
                    <ChevronDown className="opacity-60" />
                </Button>
            )}
        >
            {(close) => (
                <div className="py-1" data-testid="pdf-menu">
                    {PDF_MODES.map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => {
                                close();
                                onPick(m);
                            }}
                            className="flex w-full cursor-pointer gap-2.5 px-3 py-2.5 text-left hover:bg-wb-bg-sidebar [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-wb-ntrl-7"
                        >
                            {ICON[m]}
                            <span>
                                <span className="block text-wb-13 font-semibold text-wb-ink">{t(`pdfdl.m.${m}`)}</span>
                                <span className="mt-0.5 block text-wb-12 text-wb-ntrl-6">{t(`pdfdl.m.${m}_hint`)}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </Popover>
    );
}

/** Progress (XML step → PDF) and result of one server job; `job` = the state returned when it was started. */
export function PdfDownloadDialog({ job: started, onClose }: { job: PdfJob | null; onClose: () => void }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const router = useRouter();
    const [job, setJob] = useState<PdfJob | null>(started);
    const downloaded = useRef<string | null>(null);

    const [prevStarted, setPrevStarted] = useState(started);
    if (prevStarted !== started) {
        setPrevStarted(started);
        setJob(started);
    }

    const jobId = job?.jobId;
    const running = job?.state === "running";
    useEffect(() => {
        if (!jobId || !running) return;
        let live = true;
        const h = setInterval(() => {
            pdfJobStatus(jobId)
                .then((s) => live && setJob(s))
                .catch((err) => {
                    if (!live) return;
                    toast(apiErrorText(err, t), "error");
                    onClose();
                });
        }, POLL_MS);
        return () => {
            live = false;
            clearInterval(h);
        };
    }, [jobId, running, toast, t, onClose]);

    // One ZIP per finished run (a retry packs again → a new download).
    const doneKey = job?.state === "done" && job.fileReady ? `${job.jobId}:${job.fileName}:${job.done}:${job.fallback}:${job.failed}` : null;
    useEffect(() => {
        if (!job || !doneKey || downloaded.current === doneKey) return;
        downloaded.current = doneKey;
        downloadPdfJobFile(job).catch((err) => toast(apiErrorText(err, t), "error"));
    }, [doneKey, job, toast, t]);

    useEffect(() => {
        if (job?.state === "cancelled") {
            toast(t("pdfdl.cancelled"), "info");
            onClose();
        } else if (job?.state === "failed") {
            toast(t("pdfdl.job_failed", { e: job.error ?? "" }), "error");
            onClose();
        }
    }, [job?.state, job?.error, toast, t, onClose]);

    if (!job) return null;

    const cancel = () => {
        void cancelPdfJob(job.jobId).catch(() => {});
        onClose();
    };
    const retry = (reason?: string) => {
        downloaded.current = null;
        retryPdfJob(job.jobId, reason)
            .then(setJob)
            .catch((err) => toast(apiErrorText(err, t), "error"));
    };

    /* ---------- result ---------- */
    if (job.state === "done") {
        const ok = job.total - job.failed;
        const fallbackReasons = new Set(job.fallbackGroups.map((g) => g.reason));
        return (
            <Modal
                open
                onClose={onClose}
                width={720}
                title={t("pdfdl.result_title")}
                footer={
                    <>
                        <Button size="md" variant="neutral" icon={<Download />} onClick={() => downloadPdfJobFile(job).catch((err) => toast(apiErrorText(err, t), "error"))}>
                            {t("pdfdl.download_zip")}
                        </Button>
                        <Button size="md" variant="primary" onClick={onClose}>{t("common.close")}</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4" data-testid="pdf-result">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-wb-status-approved-text/40 bg-wb-status-approved-bg px-4 py-3">
                            <p className="text-wb-12 text-wb-ntrl-7">{t("pdfdl.ok")}</p>
                            <p className="text-wb-24 font-bold text-wb-status-approved-text">
                                {ok}/{job.total}
                            </p>
                        </div>
                        <div className={cn("rounded-lg border px-4 py-3", job.failed ? "border-wb-error/40 bg-wb-red-01" : "border-wb-border-sidebar bg-wb-bg-sidebar")}>
                            <p className="text-wb-12 text-wb-ntrl-7">{t("pdfdl.fail")}</p>
                            <p className={cn("text-wb-24 font-bold", job.failed ? "text-wb-error" : "text-wb-ntrl-6")}>{job.failed}</p>
                        </div>
                    </div>
                    {job.failed > 0 ? (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-wb-13 text-wb-ntrl-7">{t("pdfdl.fail_line", { n: job.failed })}</span>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="primary" size="wb-sm" icon={<RefreshCcw />} onClick={() => retry()}>
                                        {t("pdfdl.retry_all", { n: job.failed })}
                                    </Button>
                                    <Button variant="neutral" size="wb-sm" icon={<Download />} onClick={() => downloadPdfJobFailedExcel(job).catch((err) => toast(apiErrorText(err, t), "error"))}>
                                        {t("pdfdl.failed_excel", { n: job.failed })}
                                    </Button>
                                </div>
                            </div>
                            {job.failedGroups.map((g) => (
                                <div key={g.reason} className="rounded-lg border border-wb-border-sidebar p-3" data-testid={`fail-group-${g.reason}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-wb-13 font-semibold text-wb-ink">
                                            {t(`pdfdl.r.${g.reason}`)} <span className="font-normal text-wb-ntrl-6">({t("pdfdl.n_inv", { n: g.count })})</span>
                                        </p>
                                        <Button variant="neutral" size="wb-sm" icon={<RefreshCcw />} onClick={() => retry(g.reason)}>
                                            {t("pdfdl.retry")}
                                        </Button>
                                    </div>
                                    {g.items.slice(0, 50).map((i) => (
                                        <p key={i.id} className="mt-2 text-wb-13 text-wb-ink">
                                            {i.partner} ({i.partnerTaxId})
                                            <span className="block text-wb-12 text-wb-ntrl-6">{t("pdfdl.no", { n: i.number })}</span>
                                        </p>
                                    ))}
                                </div>
                            ))}
                        </>
                    ) : (
                        <p className="flex items-center justify-center gap-2 py-1 text-wb-14 text-wb-ink">
                            <CheckCircle2 className="size-5 text-wb-status-approved-text" /> {t("pdfdl.all_ok")}
                        </p>
                    )}
                    {job.fallback > 0 && (
                        <div className="rounded-lg border border-wb-border-sidebar bg-wb-bg-sidebar p-3" data-testid="pdf-fallback">
                            <p className="text-wb-13 font-semibold text-wb-ink">{t("pdfdl.fb_title", { n: job.fallback })}</p>
                            <p className="mt-0.5 text-wb-12 text-wb-ntrl-6">{t(job.mode === "merge" ? "pdfdl.fb_hint_merge" : "pdfdl.fb_hint")}</p>
                            <ul className="mt-2 flex flex-col gap-1">
                                {job.fallbackGroups
                                    .filter((g) => FALLBACK_REASONS.includes(g.reason))
                                    .map((g) => (
                                        <li key={g.reason} className="text-wb-13 text-wb-ink">
                                            • {t(`pdfdl.r.${g.reason}`)} <span className="text-wb-ntrl-6">({t("pdfdl.n_inv", { n: g.count })})</span>
                                        </li>
                                    ))}
                            </ul>
                            {fallbackReasons.has("no_lookup_code") && (
                                <Button className="mt-2" variant="primary" size="wb-sm" icon={<Mail />} onClick={() => router.push("/sources/mailbox")}>
                                    {t("pdfdl.scan_gmail")}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        );
    }

    /* ---------- progress ---------- */
    const finished = job.done + job.fallback + job.failed;
    const pct = Math.round((finished / Math.max(1, job.total)) * 100);
    const xmlReady = job.xmlDone >= job.xmlTotal && job.step !== "xml";
    const sorted = [...job.items].sort((a, b) => order(a.phase) - order(b.phase));
    return (
        <Modal open onClose={cancel} width={600} closeOnBackdrop={false} title={t(job.mode === "rendered" ? "pdfdl.progress_title_r" : "pdfdl.progress_title")}>
            <div className="flex flex-col gap-2" data-testid="pdf-progress">
                {job.mode !== "rendered" && (
                    <p className="text-wb-13 text-wb-ink">
                        {t("pdfdl.xml_phase")}{" "}
                        <b>
                            {job.xmlDone}/{job.xmlTotal}
                        </b>
                        <span className="ml-2 text-wb-12 italic text-wb-ntrl-6">{xmlReady ? t("pdfdl.xml_ready") : t("pdfdl.xml_wait")}</span>
                    </p>
                )}
                <p className="flex items-center gap-3 text-wb-13 text-wb-ink">
                    <span>{t("pdfdl.done_n", { n: finished, total: job.total })}</span>
                    {job.done + job.fallback > 0 && <span className="font-semibold text-wb-status-approved-text">✓ {job.done + job.fallback}</span>}
                    {job.failed > 0 && <span className="font-semibold text-wb-error">✕ {job.failed}</span>}
                    {job.loading > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-brand">
                            <Loader2 className="size-3.5 wb-spin" /> {t("pdfdl.loading_n", { n: job.loading })}
                        </span>
                    )}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-wb-ntrl-3">
                    <div className="h-full bg-wb-status-approved-text transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-wb-12 font-semibold text-wb-status-approved-text">{pct}%</span>
                    <Button variant="neutral" size="wb-sm" onClick={cancel}>{t("common.cancel")}</Button>
                </div>
                <div className="custom-scrollbar mt-1 max-h-[420px] overflow-auto rounded-lg border border-wb-border-sidebar">
                    {sorted.map((it) => (
                        <div key={it.id} className="flex items-center gap-3 border-b border-wb-border-sidebar px-3 py-2 last:border-b-0">
                            <PhaseIcon phase={it.phase} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-wb-13 font-medium text-wb-ink">{it.partner}</p>
                                <p className="text-wb-12 text-wb-ntrl-6">{t("pdfdl.no", { n: it.number })}</p>
                            </div>
                            <span className={cn("shrink-0 text-wb-12", it.phase === "failed" ? "text-wb-error" : it.phase === "fallback" ? "text-wb-warn-text" : it.phase === "done" ? "text-wb-ink" : "text-brand")}>
                                {it.phase === "done" ? (it.source === "rendered" ? t("pdfdl.ph.fallback") : it.source || "PDF") : t(`pdfdl.ph.${it.phase}`)}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="mt-1 text-center text-wb-12 text-wb-ntrl-6">{t(job.mode === "rendered" ? "pdfdl.foot_r" : "pdfdl.foot")}</p>
            </div>
        </Modal>
    );
}

function order(p: PdfItemPhase) {
    return { loading: 0, xml: 1, failed: 2, done: 3, fallback: 3, queued: 4 }[p];
}

function PhaseIcon({ phase }: { phase: PdfItemPhase }) {
    if (phase === "done") return <CheckCircle2 className="size-4 shrink-0 text-wb-status-approved-text" />;
    if (phase === "fallback") return <CheckCircle2 className="size-4 shrink-0 text-wb-warning" />;
    if (phase === "failed") return <XCircle className="size-4 shrink-0 text-wb-error" />;
    if (phase === "queued") return <CircleDashed className="size-4 shrink-0 text-wb-ntrl-5" />;
    return <Loader2 className="size-4 shrink-0 text-brand wb-spin" />;
}
