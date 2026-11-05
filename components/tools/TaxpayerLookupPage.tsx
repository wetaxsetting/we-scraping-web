"use client";

import { BadgeCheck, ClipboardPen, Download, ExternalLink, Loader2, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SimBanner } from "@/components/checks/SimBanner";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { StatusPill } from "@/components/shared/StatusPill";
import type { StatusPillVariant as PillVariant } from "@/components/shared/StatusPill";
import { lookupOne, parseTaxIdList } from "@/lib/api/weinvoice/checks";
import { fmtDate } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { GDT_LOOKUP_URL, lookupTaxpayer, saveGdtVerified, type TaxpayerRecord, type TaxpayerStatus } from "@/lib/api/weinvoice/registry";
import { cn } from "@/lib/utils";

const PILL: Record<TaxpayerStatus, PillVariant> = { active: "success", suspended: "warning", closed: "failed", absconded: "failed", not_found: "neutral" };

type Row = { taxId: string; state: "wait" | "run" | "done"; rec?: TaxpayerRecord };

/** Tra cứu tình trạng NNT hàng loạt (M10-F01/F02) — Invoy layout, SIMULATED registry. */
export default function TaxpayerLookupPage() {
    const { t } = useTranslation();
    const params = useSearchParams();
    const [text, setText] = useState(() => params.get("mst") ?? "");
    const [rows, setRows] = useState<Row[]>([]);
    const [running, setRunning] = useState(false);
    const cancel = useRef(false);
    const parsed = useMemo(() => parseTaxIdList(text), [text]);
    const autoRan = useRef(false);
    const { toast } = useDialog();
    const [rec, setRec] = useState<TaxpayerRecord | null>(null);

    /** Copy-assist: GDT page has a captcha → copy the MST, open the page, user pastes + types the captcha. */
    const openGdt = (taxId: string) => {
        void navigator.clipboard?.writeText(taxId).catch(() => {});
        window.open(GDT_LOOKUP_URL, "_blank", "noopener");
        toast(t("tp.copied", { mst: taxId }), "info");
    };
    const refreshRow = (taxId: string) => setRows((r) => r.map((x) => (x.taxId === taxId ? { ...x, rec: lookupTaxpayer(taxId) } : x)));

    const run = async (list = parsed.valid) => {
        if (!list.length) return;
        cancel.current = false;
        setRunning(true);
        const init: Row[] = list.map((taxId) => ({ taxId, state: "wait" }));
        setRows(init);
        for (let i = 0; i < list.length; i++) {
            if (cancel.current) break;
            setRows((r) => r.map((x, j) => (j === i ? { ...x, state: "run" } : x)));
            const rec = await lookupOne(list[i]);
            setRows((r) => r.map((x, j) => (j === i ? { ...x, state: "done", rec } : x)));
        }
        setRunning(false);
    };

    useEffect(() => {
        if (autoRan.current) return;
        autoRan.current = true;
        const m = params.get("mst");
        if (m) {
            const v = parseTaxIdList(m).valid;
            if (v.length) void run(v);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const done = rows.filter((r) => r.state === "done");
    const safe = done.filter((r) => r.rec?.status === "active" && !r.rec.warned).length;
    const review = done.filter((r) => r.rec && r.rec.found && (r.rec.status !== "active" || r.rec.warned)).length;
    const failed = done.filter((r) => r.rec && !r.rec.found).length;

    // Repo rule (CLAUDE.md §13b): exported workbooks are produced by the backend only —
    // no client-side XLSX writer. Until that endpoint exists the button explains it.
    const exportXlsx = () => toast(t("common.export_unavailable"), "info");

    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 py-6">
                <div>
                    <h1 className="text-wb-22 font-bold tracking-wb-tight text-wb-dark">{t("tp.title")}</h1>
                    <p className="text-wb-13 text-wb-ntrl-6">{t("tp.subtitle")}</p>
                </div>
                <SimBanner />
                <div className="rounded-lg bg-brand-softer px-4 py-3 text-wb-13 text-wb-ntrl-8">
                    <p className="mb-1 font-semibold text-brand">{t("tp.real_title")}</p>
                    <ol className="list-decimal space-y-0.5 pl-5 text-wb-12">
                        <li>{t("tp.real_1")}</li>
                        <li>{t("tp.real_2")}</li>
                        <li>{t("tp.real_3")}</li>
                    </ol>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-wb-card">
                    <p className="mb-1.5 text-wb-13 font-semibold text-wb-ntrl-8">{t("tp.input")}</p>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={6}
                        placeholder={"0101243150\n0312345678-001\n0109876543, 0106543210"}
                        className="w-full resize-y rounded-md p-3 font-mono text-wb-13 shadow-wb-outline outline-none focus:shadow-wb-focus"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-wb-12 text-wb-ntrl-7">{t("tp.valid", { n: parsed.valid.length })}</span>
                        {parsed.invalid.length > 0 && (
                            <span className="text-wb-12 text-wb-status-rejected-text" title={parsed.invalid.join(", ")}>
                                {t("tp.invalid", { n: parsed.invalid.length })}
                            </span>
                        )}
                        {parsed.overflow > 0 ? (
                            <span className="text-wb-12 text-wb-warn-text">{t("tp.over_limit", { n: parsed.overflow })}</span>
                        ) : (
                            <span className="text-wb-12 text-wb-ntrl-5">{t("tp.limit")}</span>
                        )}
                        <div className="ml-auto flex gap-2">
                            <Button size="md" variant="neutral" icon={<Trash2 />} onClick={() => { cancel.current = true; setText(""); setRows([]); }} disabled={!text && !rows.length}>
                                {t("tp.clear")}
                            </Button>
                            <Button size="md" variant="primary" icon={running ? <Loader2 className="animate-spin" /> : <Search />} disabled={running || !parsed.valid.length} onClick={() => run()}>
                                {running ? t("tp.running", { d: done.length, n: rows.length }) : t("tp.run", { n: parsed.valid.length })}
                            </Button>
                        </div>
                    </div>
                </div>

                {rows.length > 0 && (
                    <div className="rounded-lg bg-white p-4 shadow-wb-card">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-wb-status-approved-bg px-2.5 py-1 text-wb-12 font-semibold text-wb-status-approved-text">{t("tp.sum_safe", { n: safe })}</span>
                            <span className="rounded-md bg-wb-warn-bg px-2.5 py-1 text-wb-12 font-semibold text-wb-warn-text">{t("tp.sum_review", { n: review })}</span>
                            <span className="rounded-md bg-wb-bg-sidebar px-2.5 py-1 text-wb-12 font-semibold text-wb-ntrl-7">{t("tp.sum_fail", { n: failed })}</span>
                            <Button size="md" className="ml-auto" variant="neutral" icon={<Download />} disabled={!done.length || running} onClick={exportXlsx}>
                                {t("tp.export")}
                            </Button>
                        </div>
                        <div className="overflow-x-auto rounded-md ring-1 ring-wb-table-border">
                            <table className="w-full min-w-[1060px] border-collapse text-wb-13">
                                <thead>
                                    <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                        <th className="w-10 px-3">#</th>
                                        <th className="px-3">{t("tp.col.mst")}</th>
                                        <th className="px-3">{t("tp.col.name")}</th>
                                        <th className="px-3">{t("tp.col.status")}</th>
                                        <th className="px-3">{t("tp.col.address")}</th>
                                        <th className="px-3">{t("tp.col.rep")}</th>
                                        <th className="w-[200px] px-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={r.taxId + i} className="border-b border-wb-table-border align-top">
                                            <td className="px-3 py-2.5 text-wb-ntrl-5">{i + 1}</td>
                                            <td className="px-3 py-2.5 font-mono text-wb-12">
                                                {r.taxId}
                                                {r.rec?.newId && <p className="mt-0.5 font-sans text-wb-11 text-wb-ntrl-6">{t("tp.new_id", { id: r.rec.newId })}</p>}
                                            </td>
                                            {r.state !== "done" || !r.rec ? (
                                                <td colSpan={5} className="px-3 py-2.5 text-wb-ntrl-6">
                                                    {r.state === "run" ? (
                                                        <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />{t("tp.st_run")}</span>
                                                    ) : (
                                                        t("tp.st_wait")
                                                    )}
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="px-3 py-2.5 font-semibold">
                                                        {r.rec.found ? r.rec.name : <span className="font-normal text-wb-ntrl-6">{t("tp.not_found_hint")}</span>}
                                                        {r.rec.found && r.rec.source === "sim" && <p className="text-wb-11 font-normal text-wb-ntrl-6">{r.rec.companyType} · {t("tp.since", { d: fmtDate(r.rec.startDate) })}</p>}
                                                        <p className="mt-1">
                                                            {r.rec.source === "gdt" ? (
                                                                <span className="inline-flex items-center gap-1 rounded-sm bg-wb-status-approved-bg px-1.5 py-0.5 text-wb-11 font-semibold text-wb-status-approved-text"><BadgeCheck className="size-3" />{t("tp.src_gdt", { d: fmtDate(r.rec.checkedAt ?? "") })}</span>
                                                            ) : (
                                                                <span className="rounded-sm bg-wb-bg-sidebar px-1.5 py-0.5 text-wb-11 font-semibold text-wb-ntrl-6">{t("tp.src_sim")}</span>
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <StatusPill size="sm" label={t(`tp.st.${r.rec.status}`)} variant={PILL[r.rec.status]} />
                                                            {r.rec.warned && <span className="rounded-sm bg-wb-status-rejected-bg px-1.5 py-0.5 text-wb-11 font-semibold text-wb-status-rejected-text">{t("tp.warned")}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="max-w-[300px] px-3 py-2.5 text-wb-12">{r.rec.address || "—"}</td>
                                                    <td className="px-3 py-2.5 text-wb-12">{r.rec.representative || "—"}</td>
                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                        <button type="button" onClick={() => openGdt(r.taxId)} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-wb-12 font-semibold text-brand hover:bg-brand-soft" title={t("tp.open_gdt_hint")}>
                                                            <ExternalLink className="size-3.5" />{t("tp.open_gdt")}
                                                        </button>
                                                        <button type="button" onClick={() => setRec(r.rec!)} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-wb-12 font-semibold text-wb-ntrl-8 hover:bg-black/5">
                                                            <ClipboardPen className="size-3.5" />{t("tp.record")}
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                <p className="flex flex-wrap items-center gap-1 text-wb-12 text-wb-ntrl-6">
                    {t("tp.note")}
                    <a href="https://tracuunnt.gdt.gov.vn/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline">
                        tracuunnt.gdt.gov.vn <ExternalLink className="size-3" />
                    </a>
                </p>
                <p className="text-wb-12 text-wb-ntrl-6">{t("tp.tt86")}</p>
            </div>
            {rec && (
                <RecordDialog
                    rec={rec}
                    onOpenGdt={() => openGdt(rec.taxId)}
                    onClose={() => setRec(null)}
                    onSaved={(clear) => { refreshRow(rec.taxId); setRec(null); toast(clear ? t("tp.rec_cleared") : t("tp.rec_saved", { mst: rec.taxId }), "success"); }}
                />
            )}
        </PageLayout>
    );
}

const STATUSES: TaxpayerStatus[] = ["active", "suspended", "closed", "absconded", "not_found"];

/** Ghi kết quả đã tra trên tracuunnt.gdt.gov.vn — dùng thay dữ liệu mô phỏng ở mọi màn hình (Kiểm tra HĐ, Rủi ro NCC). */
function RecordDialog({ rec, onClose, onSaved, onOpenGdt }: { rec: TaxpayerRecord; onClose: () => void; onSaved: (cleared: boolean) => void; onOpenGdt: () => void }) {
    const { t } = useTranslation();
    const isGdt = rec.source === "gdt";
    const [name, setName] = useState(isGdt ? rec.name : "");
    const [address, setAddress] = useState(isGdt ? rec.address : "");
    const [rep, setRep] = useState(isGdt ? rec.representative : "");
    const [office, setOffice] = useState(isGdt ? rec.taxOffice : "");
    const [status, setStatus] = useState<TaxpayerStatus>(isGdt ? rec.status : "active");
    const [err, setErr] = useState("");
    const input = "h-10 w-full rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus";
    const save = () => {
        if (status !== "not_found" && !name.trim()) return setErr(t("tp.rec_err"));
        saveGdtVerified(rec.taxId, { name: name.trim(), address: address.trim(), status, representative: rep.trim(), taxOffice: office.trim() });
        onSaved(false);
    };
    return (
        <Modal
            open
            onClose={onClose}
            width={600}
            title={t("tp.rec_title", { mst: rec.taxId })}
            footer={
                <>
                    {isGdt && (
                        <Button size="md" variant="neutral" className="mr-auto" onClick={() => { saveGdtVerified(rec.taxId, null); onSaved(true); }}>{t("tp.rec_clear")}</Button>
                    )}
                    <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                    <Button size="md" variant="primary" onClick={save}>{t("common.save")}</Button>
                </>
            }
        >
            <div className="grid gap-3">
                <p className="flex flex-wrap items-center gap-2 rounded-md bg-wb-bg-sidebar px-3 py-2 text-wb-12 text-wb-ntrl-7">
                    {t("tp.rec_hint")}
                    <button type="button" onClick={onOpenGdt} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-brand hover:underline">
                        <ExternalLink className="size-3.5" />{t("tp.open_gdt")}
                    </button>
                </p>
                <label className="flex flex-col gap-1.5">
                    <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("tp.f_status")}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((st) => (
                            <button key={st} type="button" onClick={() => setStatus(st)} className={cn("cursor-pointer rounded-md px-2.5 py-1 text-wb-12 font-medium ring-1", status === st ? "bg-brand text-white ring-brand" : "text-wb-ntrl-8 ring-wb-ntrl-4 hover:bg-black/5")}>
                                {t(`tp.st.${st}`)}
                            </button>
                        ))}
                    </div>
                </label>
                {status !== "not_found" && (
                    <>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("tp.f_name")}</span>
                            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="CÔNG TY TNHH …" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("tp.f_address")}</span>
                            <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("tp.f_rep")}</span>
                                <input className={input} value={rep} onChange={(e) => setRep(e.target.value)} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-wb-13 font-semibold text-wb-ntrl-8">{t("tp.f_office")}</span>
                                <input className={input} value={office} onChange={(e) => setOffice(e.target.value)} />
                            </label>
                        </div>
                    </>
                )}
                {err && <p className="rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-12 text-wb-status-rejected-text">{err}</p>}
                <p className="text-wb-11 text-wb-ntrl-6">{t("tp.rec_note")}</p>
            </div>
        </Modal>
    );
}
