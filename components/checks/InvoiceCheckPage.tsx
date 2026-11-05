"use client";

import { AlertTriangle, CheckCircle2, Clock3, Download, FileText, Layers, Loader2, Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PeriodPicker, type PeriodValue } from "@/components/checks/PeriodPicker";
import { SimBanner } from "@/components/checks/SimBanner";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/shared/dialog";
import { StatusPill } from "@/components/shared/StatusPill";
import { checkDates, checkValidity, invoiceRef, periodRange, reviewItems, type DateIssue, type PartnerProblem, type ValidityResult } from "@/lib/api/weinvoice/checks";
import { partnerOf } from "@/lib/api/weinvoice/invoices";
import { fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import type { Direction } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";

const lastMonth = () => {
    const d = new Date();
    d.setDate(0);
    return { kind: "month" as const, n: d.getMonth() + 1, year: d.getFullYear() };
};

/** Kiểm tra hoá đơn trước kê khai 01/GTGT (M09-F01..F04) — Invoy layout, MVP simulation. */
export default function InvoiceCheckPage() {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const taxId = useStore((s) => s.activeTaxId);
    useStore((s) => s.invoices);
    const [per, setPer] = useState<PeriodValue>(lastMonth);
    const [dir, setDir] = useState<Direction>("purchase");
    const range = periodRange(per.kind, per.n, per.year);
    const review = useMemo(() => reviewItems(taxId, dir, range.from, range.to), [taxId, dir, range.from, range.to]);

    // validity (partner verification)
    const [running, setRunning] = useState(false);
    const [prog, setProg] = useState<{ done: number; total: number; cur: { taxId: string; name: string; state: string }[] } | null>(null);
    const [vr, setVr] = useState<ValidityResult | null>(null);
    // date check
    const [dates, setDates] = useState<{ checked: number; issues: DateIssue[] } | null>(null);
    const [datesBusy, setDatesBusy] = useState(false);
    const [open, setOpen] = useState<string | null>(null);
    const key = `${taxId}|${dir}|${range.from}`;
    const [stamp, setStamp] = useState(key);
    if (stamp !== key) { setStamp(key); setVr(null); setDates(null); setProg(null); setOpen(null); }

    const run = async () => {
        setRunning(true); setVr(null);
        const r = await checkValidity(taxId, dir, range.from, range.to, (done, total, cur) => setProg({ done, total, cur }));
        setVr(r); setRunning(false);
    };
    const reviewed = 2 + (dates ? 1 : 0);
    // Repo rule (CLAUDE.md §13b): exported workbooks are produced by the backend only —
    // no client-side XLSX writer. Until that endpoint exists the button explains it.
    const exportXlsx = () => toast(t("common.export_unavailable"), "info");
    const riskTax = vr ? vr.problems.reduce((s, p) => s + p.inv.tax, 0) : 0;

    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 py-6">
                <div>
                    <h1 className="text-wb-22 font-bold tracking-wb-tight text-wb-dark">{t("chk.title")}</h1>
                    <p className="max-w-[720px] text-wb-13 text-wb-ntrl-6">{t("chk.subtitle")}</p>
                </div>
                <SimBanner />
                <div className="rounded-lg bg-white p-4 shadow-wb-card"><PeriodPicker value={per} onChange={setPer} /></div>

                {/* Kiểm tra tính hợp lệ */}
                <div className="rounded-lg bg-white p-4 shadow-wb-card">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 size-5 text-brand" />
                        <div>
                            <p className="text-wb-15 font-semibold">{t("chk.valid_title")}</p>
                            <p className="text-wb-12 text-wb-ntrl-6">{t("chk.valid_hint")}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex rounded-md bg-wb-bg-sidebar p-0.5">
                            {(["purchase", "sales"] as const).map((d) => (
                                <button key={d} type="button" onClick={() => setDir(d)} disabled={running} className={cn("h-8 cursor-pointer rounded px-3 text-wb-13 font-semibold", dir === d ? "bg-white text-brand shadow-wb-btn" : "text-wb-ntrl-7")}>{t(`nav.i.${d}`)}</button>
                            ))}
                        </div>
                        <Button size="md" variant="primary" icon={running ? <Loader2 className="wb-spin" /> : <ShieldCheck />} onClick={run} disabled={running || review.total === 0}>
                            {running ? t("chk.running") : vr ? t("chk.rerun") : t("chk.run")}
                        </Button>
                        <span className="text-wb-12 text-wb-ntrl-6">{t("chk.in_period", { n: review.total, p: range.label })}</span>
                    </div>

                    {running && prog && (
                        <div className="mt-3 rounded-md border border-wb-border-sidebar p-3">
                            <p className="mb-2 flex items-center gap-2 text-wb-12 font-semibold text-wb-ntrl-8"><Loader2 className="size-3.5 wb-spin" />{t("chk.progress", { d: prog.done, t: prog.total, n: review.total })}</p>
                            <div className="flex flex-col gap-1">
                                {prog.cur.map((c, i) => (
                                    <div key={c.taxId + i} className="flex items-center gap-3 text-wb-12">
                                        <span className="w-[110px] font-mono">{c.taxId}</span>
                                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                                        <StatusPill size="sm" label={c.state === "done" ? t("chk.st_done") : t("chk.st_checking")} variant={c.state === "done" ? "success" : "progress"} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {vr && (
                        <div className="mt-3 flex flex-col gap-3">
                            {vr.problems.length > 0 ? (
                                <div className="rounded-md bg-wb-status-rejected-bg px-4 py-3">
                                    <p className="flex items-center gap-2 text-wb-15 font-bold text-wb-status-rejected-text"><AlertTriangle className="size-5" />{t("chk.found", { n: vr.problems.length })}</p>
                                    {dir === "purchase" && <p className="mt-0.5 text-wb-13 text-wb-ntrl-8">{t("chk.found_money", { m: fmtMoney(riskTax) })}</p>}
                                </div>
                            ) : null}
                            <p className="flex items-center gap-2 rounded-md bg-wb-bg-sidebar px-3 py-2 text-wb-13"><CheckCircle2 className="size-4 text-wb-status-approved-text" />{t("chk.ok", { n: vr.okCount })}</p>
                            {vr.problems.length > 0 && (
                                <>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                        {(Object.keys(vr.byReason) as PartnerProblem[]).filter((k) => vr.byReason[k]).map((k) => (
                                            <div key={k} className="rounded-md border border-wb-warn-border/40 bg-wb-warn-bg px-3 py-2">
                                                <p className="text-wb-22 font-bold">{vr.byReason[k]}</p>
                                                <p className="text-wb-12 text-wb-ntrl-8">{t(`chk.reason.${k}`)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-wb-14 font-semibold">{t("chk.need_fix")}</p>
                                        <Button size="wb-sm" variant="neutral" icon={<Download />} onClick={exportXlsx}>{t("chk.export")}</Button>
                                    </div>
                                    <table className="w-full text-wb-13">
                                        <thead>
                                            <tr className="border-b border-wb-table-border bg-wb-bg-sidebar text-left text-wb-ntrl-8">
                                                <th className="px-3 py-2 font-semibold">{t("chk.x.symbol")}</th>
                                                <th className="px-3 py-2 font-semibold">{t("chk.x.partner")}</th>
                                                <th className="px-3 py-2 font-semibold">{t("chk.x.reason")}</th>
                                                <th className="px-3 py-2 text-right font-semibold">{t("chk.x.total")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vr.problems.slice(0, 50).map((p) => (
                                                <tr key={p.inv.id} className="border-b border-wb-table-border">
                                                    <td className="px-3 py-2"><Link className="font-medium hover:text-brand" href={`/invoices/${p.inv.direction}/?open=${p.inv.id}`}>{invoiceRef(p.inv)}</Link><p className="text-wb-11 text-wb-ntrl-6">{fmtDate(p.inv.issueDate)}</p></td>
                                                    <td className="max-w-[320px] px-3 py-2"><p className="truncate">{partnerOf(p.inv).name}</p><p className="font-mono text-wb-11 text-wb-ntrl-6">{partnerOf(p.inv).taxId}</p></td>
                                                    <td className="px-3 py-2"><StatusPill size="sm" label={t(`chk.reason.${p.reason}`)} variant={p.reason === "inactive" ? "failed" : "warning"} /></td>
                                                    <td className="px-3 py-2 text-right font-semibold text-wb-warn-text">{fmtMoney(p.inv.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Rà soát 3 mục */}
                <div className="rounded-lg bg-white p-4 shadow-wb-card">
                    <div className="flex items-center justify-between text-wb-13">
                        <b>{t("chk.period", { p: range.label })}</b>
                        <span className="text-wb-12 text-wb-ntrl-6">{t("chk.reviewed", { n: reviewed })}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-wb-bg-sidebar"><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${(reviewed / 3) * 100}%` }} /></div>
                </div>

                <ItemCard
                    icon={<Layers />} tone="bg-wb-warn-bg text-wb-warn-text" title={t("chk.i1")}
                    status={review.lifecycle.length ? t("chk.i1_n", { n: review.lifecycle.length }) : t("chk.none")}
                    bad={review.lifecycle.length > 0}
                    action={review.lifecycle.length > 0 && <button type="button" className="cursor-pointer text-wb-13 font-semibold text-brand hover:underline" onClick={() => setOpen(open === "i1" ? null : "i1")}>{t("chk.view_n", { n: review.lifecycle.length })} →</button>}
                >
                    {open === "i1" && (
                        <ul className="mt-2 divide-y divide-wb-border-sidebar text-wb-13">
                            {review.lifecycle.map((i) => (
                                <li key={i.id} className="flex items-center gap-3 py-1.5">
                                    <Link href={`/invoices/${i.direction}/?open=${i.id}`} className="w-[170px] font-medium hover:text-brand">{invoiceRef(i)}</Link>
                                    <span className="min-w-0 flex-1 truncate">{partnerOf(i).name}</span>
                                    <StatusPill size="sm" label={t(`status.${i.status}`)} variant={i.status === "cancelled" ? "failed" : "pending"} />
                                </li>
                            ))}
                        </ul>
                    )}
                </ItemCard>
                <ItemCard
                    icon={<FileText />} tone="bg-brand-soft text-brand" title={t("chk.i2")}
                    status={review.noXml.length ? t("chk.i2_n", { n: review.noXml.length }) : t("chk.none")}
                    bad={review.noXml.length > 0}
                    action={review.noXml.length > 0 && <Link href={`/invoices/${dir}/?missing=xml`} className="text-wb-13 font-semibold text-brand hover:underline">{t("chk.view_n", { n: review.noXml.length })} →</Link>}
                />
                <ItemCard
                    icon={<Clock3 />} tone="bg-[#f3e8ff] text-[#7e22ce]" title={t("chk.i3")}
                    status={!dates ? t("chk.not_run") : dates.issues.length ? t("chk.i3_n", { n: dates.issues.length, c: dates.checked }) : t("chk.i3_ok", { c: dates.checked })}
                    bad={!!dates?.issues.length}
                    action={
                        <Button size="wb-sm" variant="primary" icon={datesBusy ? <Loader2 className="wb-spin" /> : <Play />} disabled={datesBusy} onClick={async () => { setDatesBusy(true); setDates(await checkDates(taxId, dir, range.from, range.to)); setDatesBusy(false); }}>
                            {dates ? t("chk.rerun") : t("chk.run_item")}
                        </Button>
                    }
                >
                    {dates && dates.issues.length > 0 && (
                        <ul className="mt-2 divide-y divide-wb-border-sidebar text-wb-13">
                            {dates.issues.map((d) => (
                                <li key={d.inv.id} className="flex flex-wrap items-center gap-3 py-1.5">
                                    <span className="w-[170px] font-medium">{invoiceRef(d.inv)}</span>
                                    <span className="text-wb-12 text-wb-ntrl-7">{t("chk.dates", { l: fmtDate(d.inv.issueDate), s: d.signed ? fmtDate(d.signed) : "—", c: d.coded ? fmtDate(d.coded) : "—" })}</span>
                                    <StatusPill size="sm" label={t(`chk.date.${d.issue}`)} variant="warning" />
                                </li>
                            ))}
                        </ul>
                    )}
                    {dates && <p className="mt-1 text-wb-11 text-wb-ntrl-6">{t("chk.i3_note")}</p>}
                </ItemCard>
            </div>
        </PageLayout>
    );
}

function ItemCard({ icon, tone, title, status, bad, action, children }: { icon: React.ReactNode; tone: string; title: string; status: string; bad?: boolean; action?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="rounded-lg bg-white p-4 shadow-wb-card">
            <div className="flex items-center gap-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5", tone)}>{icon}</span>
                <div className="min-w-0 flex-1">
                    <p className="text-wb-14 font-semibold">{title}</p>
                    <p className={cn("text-wb-12 font-medium", bad ? "text-wb-warn-text" : "text-wb-status-approved-text")}>{status}</p>
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}
