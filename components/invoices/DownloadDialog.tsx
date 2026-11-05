"use client";

import { FileArchive, FolderTree } from "lucide-react";
import { useState } from "react";

import { apiErrorText } from "@/components/invoices/apiError";
import { Button } from "@/components/ui/button";
import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { getInvoices } from "@/lib/api/weinvoice/invoices";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { buildZip, type ZipMode } from "@/lib/weinvoice/exporter";
import { useTranslation } from "@/lib/i18n";
import { hasFile } from "@/lib/weinvoice/types";
import { cn, downloadBlob } from "@/lib/utils";

const MODES: ZipMode[] = ["flat", "by_month", "by_partner", "by_month_partner", "per_invoice"];
const EXAMPLE: Record<ZipMode, string> = {
    flat: "WeInvoice.zip/\n  0301110001_1C26TSM_00004821.xml\n  0301110002_1C26THG_00002390.xml",
    by_month: "WeInvoice.zip/\n  2026-09/\n    0301110001_1C26TSM_00004821.xml\n  2026-10/ …",
    by_partner: "WeInvoice.zip/\n  0301110001 - CÔNG TY … SAO MAI/\n    …00004821.xml\n  0301110002 - … HOÀNG GIA/ …",
    by_month_partner: "WeInvoice.zip/\n  2026-09/\n    0301110001 - … SAO MAI/\n      …00004821.xml",
    per_invoice: "WeInvoice.zip/\n  0301110001_1C26TSM_00004821/\n    …00004821.xml\n    …00004821.html",
};

/** Bulk download — 5 packaging modes (Invoy) built as a real ZIP. */
export default function DownloadDialog({ ids, onClose }: { ids: string[] | null; onClose: () => void }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const [mode, setMode] = useState<ZipMode>("by_month");
    const [xml, setXml] = useState(true);
    const [rendered, setRendered] = useState(false);
    const [summary, setSummary] = useState(true);
    const [pdf, setPdf] = useState(true);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

    const [progressFor, setProgressFor] = useState(ids);
    if (progressFor !== ids) {
        setProgressFor(ids);
        setProgress(null);
    }
    if (!ids) return null;
    const list = getInvoices(ids);
    const withXml = list.filter((i) => hasFile(i, "xml")).length;
    // api mode: the backend packages stored PDFs; mock mode: only PDFs held as an object URL.
    const withPdf = list.filter((i) => i.files.some((f) => f.kind === "pdf" && (DATA_SOURCE === "api" || f.url))).length;

    const api = DATA_SOURCE === "api";

    const run = async () => {
        setProgress({ done: 0, total: list.length });
        try {
            const { blob, missing, fileName } = await buildZip(list, { mode, xml, rendered: !api && rendered, summary, pdf }, (done, total) => setProgress({ done, total }));
            downloadBlob(blob, fileName ?? `WeInvoice_${list.length}HD_${new Date().toISOString().slice(0, 10)}.zip`);
            toast(missing ? t("dl.done_missing", { n: list.length, m: missing }) : t("dl.done", { n: list.length }));
            onClose();
        } catch (err) {
            setProgress(null);
            toast(apiErrorText(err, t), "error");
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            width={720}
            title={t("dl.title", { n: list.length })}
            footer={
                <>
                    <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                    <Button size="md" variant="primary" icon={<FileArchive />} onClick={run} disabled={!!progress || (api ? !xml && !pdf && !summary : !xml && !rendered && !summary)}>
                        {progress ? t("dl.building") : t("dl.start")}
                    </Button>
                </>
            }
        >
            <div className="grid gap-5 md:grid-cols-[1fr_250px]">
                <div className="flex flex-col gap-2">
                    <p className="text-wb-12 font-medium uppercase text-wb-ntrl-6">{t("dl.mode")}</p>
                    {MODES.map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left",
                                mode === m ? "border-brand bg-brand-soft" : "border-wb-border-sidebar hover:bg-wb-bg-sidebar",
                            )}
                        >
                            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2", mode === m ? "border-brand" : "border-wb-ntrl-5")}>
                                {mode === m && <span className="size-2 rounded-full bg-brand" />}
                            </span>
                            <span>
                                <span className="block text-wb-14 font-semibold text-wb-ink">{t(`dl.m.${m}`)}</span>
                                <span className="block text-wb-12 text-wb-ntrl-6">{t(`dl.m.${m}_hint`)}</span>
                            </span>
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    <p className="text-wb-12 font-medium uppercase text-wb-ntrl-6">{t("dl.content")}</p>
                    <Checkbox checked={xml} onChange={setXml} label={t("dl.xml", { n: withXml, total: list.length })} />
                    <Checkbox checked={pdf} onChange={setPdf} label={t("dl.pdf", { n: withPdf, total: list.length })} />
                    {/* api mode: the server ZIP has no rendered copy (spec: `rendered` skipped) and its listing is an Excel sheet. */}
                    {!api && <Checkbox checked={rendered} onChange={setRendered} label={t("dl.rendered")} />}
                    <Checkbox checked={summary} onChange={setSummary} label={t(api ? "dl.summary" : "dl.summary_html")} />
                    {!api && <p className="rounded-md bg-wb-bg-sidebar p-2 text-wb-12 text-wb-ntrl-6">{t("dl.pdf_note")}</p>}
                    <p className="mt-1 flex items-center gap-1 text-wb-12 font-medium uppercase text-wb-ntrl-6">
                        <FolderTree className="size-3.5" /> {t("dl.preview")}
                    </p>
                    <pre className="overflow-auto rounded-md bg-wb-dark p-2.5 text-wb-11 text-white/85">{EXAMPLE[mode]}</pre>
                </div>
            </div>
            {progress && (
                <div className="mt-4">
                    <div className="mb-1 flex justify-between text-wb-12 text-wb-ntrl-7">
                        <span>{t("dl.building")}</span>
                        <span>
                            {progress.done}/{progress.total}
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-wb-ntrl-3">
                        <div className="h-full bg-brand transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                    </div>
                </div>
            )}
        </Modal>
    );
}
