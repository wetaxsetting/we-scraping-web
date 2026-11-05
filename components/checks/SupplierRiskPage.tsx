"use client";

import { AlertTriangle, Building2, CheckCircle2, Copy, ExternalLink, Loader2, Percent, Search, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { PeriodPicker, type PeriodValue } from "@/components/checks/PeriodPicker";
import { SimBanner } from "@/components/checks/SimBanner";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import { Select } from "@/components/shared/Select";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/StatusPill";
import type { StatusPillVariant as PillVariant } from "@/components/shared/StatusPill";
import { chipOf, invoiceRef, periodRange, rateLabel, scanTaxRates, supplierRisk, type RateIssue, type RiskChip, type RiskRow } from "@/lib/api/weinvoice/checks";
import { partnerOf } from "@/lib/api/weinvoice/invoices";
import { fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import type { Direction } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";

const CHIPS: { k: RiskChip; cls: string }[] = [
    { k: "all", cls: "bg-white text-wb-ink ring-wb-ntrl-4" },
    { k: "warned", cls: "bg-[#fdebf1] text-[#c2185b] ring-[#f1a9c3]" },
    { k: "multi_name", cls: "bg-wb-status-rejected-bg text-wb-status-rejected-text ring-wb-red-04" },
    { k: "mismatch", cls: "bg-wb-status-rejected-bg text-wb-status-rejected-text ring-wb-red-04" },
    { k: "high", cls: "bg-wb-status-rejected-bg text-wb-status-rejected-text ring-wb-red-04" },
    { k: "review", cls: "bg-wb-warn-bg text-wb-warn-text ring-wb-warn-border" },
    { k: "not_found", cls: "bg-wb-bg-sidebar text-wb-ntrl-7 ring-wb-ntrl-4" },
];
const lastMonth = () => { const d = new Date(); d.setDate(0); return { kind: "month" as const, n: d.getMonth() + 1, year: d.getFullYear() }; };
const statusVariant = (s: string): PillVariant => (s === "active" ? "success" : s === "not_found" ? "neutral" : "failed");
const levelPill = (l: RiskRow["level"]): { v: PillVariant; k: string } => (l === "match" ? { v: "success", k: "risk.lv.match" } : l === "minor" ? { v: "warning", k: "risk.lv.minor" } : l === "major" ? { v: "failed", k: "risk.lv.major" } : { v: "neutral", k: "risk.lv.na" });

/** Kiểm tra rủi ro NCC (M09-F05..F08) — Invoy layout, MVP simulation. */
export default function SupplierRiskPage() {
    const { t } = useTranslation();
    const taxId = useStore((s) => s.activeTaxId);
    useStore((s) => s.invoices);
    const [per, setPer] = useState<PeriodValue>(lastMonth);
    const [dir, setDir] = useState<Direction>("purchase");
    const range = periodRange(per.kind, per.n, per.year);

    const [rows, setRows] = useState<RiskRow[] | null>(null);
    const [busy, setBusy] = useState<{ d: number; t: number } | null>(null);
    const [chip, setChip] = useState<RiskChip>("all");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [detail, setDetail] = useState<RiskRow | null>(null);
    const [rates, setRates] = useState<{ checked: number; issues: RateIssue[] } | null>(null);
    const [rBusy, setRBusy] = useState<{ d: number; t: number } | null>(null);
    const key = `${taxId}|${dir}|${range.from}|${range.to}`;
    const [stamp, setStamp] = useState(key);
    if (stamp !== key) { setStamp(key); setRows(null); setRates(null); setChip("all"); setPage(1); }

    const shown = useMemo(() => (rows ?? []).filter((r) => chipOf(r, chip)).filter((r) => !q || r.taxId.includes(q) || r.invoiceName.toLowerCase().includes(q.toLowerCase())), [rows, chip, q]);
    const [size, setSize] = useState(10);

    return (
        <PageLayout>
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 py-6">
                <div>
                    <h1 className="flex items-center gap-2 text-wb-22 font-bold tracking-wb-tight text-wb-dark"><ShieldAlert className="size-6 text-wb-warn-text" />{t("risk.title")}</h1>
                    <p className="text-wb-13 text-wb-ntrl-6">{t("risk.subtitle")}</p>
                </div>
                <SimBanner />
                <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-wb-card">
                    <div>
                        <p className="mb-1 text-wb-12 font-semibold text-wb-ntrl-7">{t("risk.period")}</p>
                        <PeriodPicker value={per} onChange={setPer} />
                    </div>
                    <Select value={dir} width={210} options={[{ value: "purchase", label: t("risk.dir_purchase") }, { value: "sales", label: t("risk.dir_sales") }]} onChange={(v) => setDir(v as Direction)} />
                </div>

                {/* Trạng thái NCC */}
                <div className="rounded-lg bg-white p-4 shadow-wb-card">
                    <div className="flex flex-wrap items-start gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><Building2 className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-wb-15 font-semibold">{t("risk.status_title")}</p>
                            <p className="text-wb-12 text-wb-ntrl-6">{t("risk.status_hint")}</p>
                        </div>
                        <Button size="md" variant="primary" icon={busy ? <Loader2 className="wb-spin" /> : <Search />} disabled={!!busy}
                            onClick={async () => { setBusy({ d: 0, t: 1 }); const r = await supplierRisk(taxId, dir, range.from, range.to, (d, tt) => setBusy({ d, t: tt })); setRows(r); setBusy(null); setPage(1); }}>
                            {busy ? t("chk.running") : rows ? t("chk.rerun") : t("risk.check_now")}
                        </Button>
                    </div>
                    {(busy || rows) && (
                        <div className="mt-3 rounded-md bg-wb-bg-sidebar p-3">
                            <div className="flex justify-between text-wb-13"><span>{t("risk.checked", { d: busy ? busy.d : rows!.length, t: busy ? busy.t : rows!.length })}</span><span className="text-wb-12 text-wb-ntrl-6">{busy ? Math.round((busy.d / Math.max(1, busy.t)) * 100) : 100}%</span></div>
                            <div className="mt-1.5 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${busy ? (busy.d / Math.max(1, busy.t)) * 100 : 100}%` }} /></div>
                            {busy && <p className="mt-1 text-wb-11 text-wb-ntrl-6">{t("risk.wait")}</p>}
                        </div>
                    )}
                    {rows && (
                        <>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {CHIPS.map((c) => (
                                    <button key={c.k} type="button" onClick={() => { setChip(c.k); setPage(1); }} className={cn("cursor-pointer rounded-md px-2.5 py-1 text-wb-12 font-semibold ring-1", c.cls, chip === c.k && "ring-2 ring-wb-ink")}>
                                        {t(`risk.chip.${c.k}`)}: {rows.filter((r) => chipOf(r, c.k)).length}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 flex h-9 items-center gap-2 rounded-md px-3 shadow-wb-outline">
                                <Search className="size-4 text-wb-ntrl-6" />
                                <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("risk.search")} className="flex-1 text-wb-13 outline-none" />
                            </div>
                            <div className="custom-scrollbar mt-3 overflow-x-auto">
                                <table className="w-full min-w-[980px] text-wb-13">
                                    <thead>
                                        <tr className="border-b border-wb-table-border bg-wb-bg-sidebar text-left text-wb-ntrl-8">
                                            {["mst", "name", "cqt", "match", "rep", "start", "count", "rating"].map((c) => <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap">{t(`risk.col.${c}`)}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shown.slice((page - 1) * size, page * size).map((r) => {
                                            const lv = levelPill(r.level);
                                            return (
                                                <tr key={r.taxId} onClick={() => setDetail(r)} className="cursor-pointer border-b border-wb-table-border align-top hover:bg-brand-soft/40">
                                                    <td className="px-3 py-2 font-mono text-wb-12 whitespace-nowrap">{r.taxId} <button type="button" title="Copy" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(r.taxId); }} className="ml-1 cursor-pointer text-wb-ntrl-5 hover:text-brand"><Copy className="inline size-3.5" /></button></td>
                                                    <td className="max-w-[300px] px-3 py-2"><p className="font-semibold">{r.invoiceName}</p><p className="text-wb-11 text-wb-ntrl-6">{r.invoiceAddress}</p></td>
                                                    <td className="px-3 py-2"><StatusPill size="sm" label={t(`tp.st.${r.reg.status}`)} variant={statusVariant(r.reg.status)} /></td>
                                                    <td className="px-3 py-2"><StatusPill size="sm" label={t(lv.k)} variant={lv.v} /></td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{r.reg.found ? r.reg.representative : "—"}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{r.reg.found ? fmtDate(r.reg.startDate) : "—"}</td>
                                                    <td className="px-3 py-2 text-center">{r.invoiceCount}</td>
                                                    <td className="px-3 py-2"><StatusPill size="sm" label={t(`risk.rate.${r.rating}`)} variant={r.rating === "safe" ? "success" : r.rating === "review" ? "warning" : "failed"} /></td>
                                                </tr>
                                            );
                                        })}
                                        {shown.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-wb-ntrl-6">{t("risk.empty")}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3">
                                <Pagination page={page} pageSize={size} pageCount={Math.max(1, Math.ceil(shown.length / size))} totalLabel={t("common.showing", { from: shown.length === 0 ? 0 : (page - 1) * size + 1, to: Math.min(shown.length, page * size), total: shown.length })} onPageChange={setPage} onPageSizeChange={(n) => { setSize(n); setPage(1); }} />
                            </div>
                        </>
                    )}
                </div>

                {/* Thuế suất bất thường */}
                <div className="rounded-lg bg-white p-4 shadow-wb-card">
                    <div className="flex flex-wrap items-start gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-wb-warn-bg text-wb-warn-text"><Percent className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-wb-15 font-semibold">{t("risk.rate_title")}</p>
                            <p className="text-wb-12 text-wb-ntrl-6">{t("risk.rate_hint")}</p>
                        </div>
                        <Button size="md" variant="primary" icon={rBusy ? <Loader2 className="wb-spin" /> : <Search />} disabled={!!rBusy}
                            onClick={async () => { setRBusy({ d: 0, t: 1 }); setRates(await scanTaxRates(taxId, dir, range.from, range.to, (d, tt) => setRBusy({ d, t: tt }))); setRBusy(null); }}>
                            {t("risk.rate_scan")}
                        </Button>
                    </div>
                    {(rBusy || rates) && (
                        <div className="mt-3 rounded-md bg-wb-bg-sidebar p-3">
                            <div className="flex justify-between text-wb-13"><span>{t("risk.rate_checked", { d: rBusy ? rBusy.d : rates!.checked, t: rBusy ? rBusy.t : rates!.checked })}</span><span className="text-wb-12 text-wb-ntrl-6">{t("risk.coverage")} {rBusy ? Math.round((rBusy.d / Math.max(1, rBusy.t)) * 100) : 100}%</span></div>
                            <div className="mt-1.5 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-brand" style={{ width: `${rBusy ? (rBusy.d / Math.max(1, rBusy.t)) * 100 : 100}%` }} /></div>
                        </div>
                    )}
                    {rates && (
                        <>
                            <p className="mt-3"><span className={cn("rounded-md px-2.5 py-1 text-wb-12 font-semibold", rates.issues.length ? "bg-wb-status-rejected-bg text-wb-status-rejected-text" : "bg-wb-status-approved-bg text-wb-status-approved-text")}>{t("risk.abnormal", { n: rates.issues.length })}</span></p>
                            {rates.issues.length > 0 && (
                                <table className="mt-3 w-full text-wb-13">
                                    <thead>
                                        <tr className="border-b border-wb-table-border bg-wb-bg-sidebar text-left text-wb-ntrl-8">
                                            {["no", "date", "partner", "reason", "amount"].map((c) => <th key={c} className={cn("px-3 py-2 font-semibold", c === "amount" && "text-right")}>{t(`risk.rcol.${c}`)}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rates.issues.map((r) => (
                                            <tr key={r.inv.id} className="border-b border-wb-table-border">
                                                <td className="px-3 py-2 font-mono text-wb-12"><Link href={`/invoices/${r.inv.direction}/?open=${r.inv.id}`} className="hover:text-brand">{invoiceRef(r.inv)}</Link></td>
                                                <td className="px-3 py-2">{fmtDate(r.inv.issueDate)}</td>
                                                <td className="max-w-[360px] px-3 py-2"><p className="truncate">{partnerOf(r.inv).name}</p><p className="font-mono text-wb-11 text-wb-ntrl-6">{partnerOf(r.inv).taxId}</p></td>
                                                <td className="px-3 py-2"><StatusPill size="sm" variant="warning" label={t(r.kind === "multi" ? "risk.multi_rate" : "risk.invalid_rate", { r: r.rates.map(rateLabel).join(" + ") })} /></td>
                                                <td className="px-3 py-2 text-right font-semibold">{fmtMoney(r.inv.total)} đ</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <p className="mt-2 text-wb-11 text-wb-ntrl-6">{t("risk.rate_note")}</p>
                        </>
                    )}
                </div>
            </div>
            {detail && <Drawer row={detail} onClose={() => setDetail(null)} />}
        </PageLayout>
    );
}

function Drawer({ row, onClose }: { row: RiskRow; onClose: () => void }) {
    const { t } = useTranslation();
    const r = row.reg;
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const verdict = (x: number) => (x >= 0.95 ? { c: "text-wb-status-approved-text", k: "risk.v.match" } : x >= 0.75 ? { c: "text-wb-warn-text", k: "risk.v.partial" } : { c: "text-wb-status-rejected-text", k: "risk.v.diff" });
    const nV = verdict(row.nameScore), aV = verdict(row.addrScore);
    const worst = Math.min(row.nameScore, row.addrScore);
    const info: [string, string][] = [
        ["full_name", r.name], ["mst", r.taxId], ["cqt", t(`tp.st.${r.status}`)], ["rep", r.representative], ["start", fmtDate(r.startDate)],
        ["type", r.companyType], ["office", r.taxOffice], ["industry", r.industry], ["phone", r.phone], ["address", r.address],
    ];
    return createPortal(
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/25" onMouseDown={onClose}>
            <aside className="custom-scrollbar h-full w-full max-w-[520px] overflow-y-auto bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
                <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-wb-border-sidebar bg-white px-5 py-4">
                    <div>
                        <StatusPill size="sm" label={t(`risk.rate.${row.rating}`)} variant={row.rating === "safe" ? "success" : row.rating === "review" ? "warning" : "failed"} />
                        <p className="mt-1 text-wb-16 font-bold">{row.invoiceName}</p>
                        <p className="font-mono text-wb-12 text-wb-ntrl-6">{row.taxId}</p>
                    </div>
                    <button type="button" onClick={onClose} className="cursor-pointer p-1 text-wb-ntrl-6 hover:text-wb-ink"><X className="size-5" /></button>
                </div>
                <div className="flex flex-col gap-5 px-5 py-4 text-wb-13">
                    {!r.found ? (
                        <p className="rounded-md bg-wb-bg-sidebar px-3 py-2">{t("risk.not_found_detail")}</p>
                    ) : (
                        <section>
                            <p className="mb-2 text-wb-11 font-bold tracking-wide text-wb-ntrl-6 uppercase">{t("risk.d.reg")}</p>
                            <dl className="divide-y divide-wb-border-sidebar">
                                {info.map(([k, v]) => (
                                    <div key={k} className="grid grid-cols-[150px_1fr] gap-2 py-1.5">
                                        <dt className="text-wb-ntrl-6">{t(`risk.d.${k}`)}</dt>
                                        <dd className={cn(!v && "text-wb-ntrl-5 italic")}>{v || t("risk.d.none")}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    )}
                    {r.found && (
                        <section>
                            <p className="mb-2 text-wb-11 font-bold tracking-wide text-wb-ntrl-6 uppercase">{t("risk.d.compare")}</p>
                            {[["name", row.invoiceName, r.name, row.nameScore, nV], ["addr", row.invoiceAddress, r.address, row.addrScore, aV]].map(([k, a, b, sc, v]) => (
                                <div key={k as string} className="mb-3">
                                    <div className="flex justify-between"><b>{t(`risk.d.${k}`)}</b><span className={cn("text-wb-12 font-semibold", (v as { c: string }).c)}>● {t((v as { k: string }).k)} ({pct(sc as number)})</span></div>
                                    <p className="mt-1 grid grid-cols-[80px_1fr] gap-2"><span className="text-wb-ntrl-6">{t("risk.d.on_inv")}</span><span>{a as string}</span></p>
                                    <p className="grid grid-cols-[80px_1fr] gap-2"><span className="text-wb-ntrl-6">{t("risk.d.on_cqt")}</span><span>{b as string}</span></p>
                                </div>
                            ))}
                            {row.namesOnInvoices.length > 1 && <p className="mb-2 rounded-md bg-wb-status-rejected-bg px-3 py-2 text-wb-12 text-wb-status-rejected-text">{t("risk.d.multi", { n: row.namesOnInvoices.length })}</p>}
                            <p className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-wb-12", worst >= 0.95 ? "bg-wb-status-approved-bg text-wb-status-approved-text" : worst >= 0.75 ? "bg-wb-warn-bg text-wb-warn-text" : "bg-wb-status-rejected-bg text-wb-status-rejected-text")}>
                                {worst >= 0.95 ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
                                {t(worst >= 0.95 ? "risk.d.ok" : worst >= 0.75 ? "risk.d.minor" : "risk.d.major")}
                            </p>
                        </section>
                    )}
                    <section>
                        <p className="mb-2 text-wb-11 font-bold tracking-wide text-wb-ntrl-6 uppercase">{t("risk.d.tx")}</p>
                        <p className="grid grid-cols-[150px_1fr]"><span className="text-wb-ntrl-6">{t("risk.col.count")}</span><b>{row.invoiceCount}</b></p>
                    </section>
                    <section>
                        <p className="mb-2 text-wb-11 font-bold tracking-wide text-wb-ntrl-6 uppercase">{t("risk.d.manual")}</p>
                        {[["https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp", t("risk.d.gdt")], [`https://masothue.com/Search/?q=${row.taxId}`, t("risk.d.masothue")]].map(([h, l]) => (
                            <a key={h} href={h} target="_blank" rel="noreferrer" onClick={() => void navigator.clipboard?.writeText(row.taxId).catch(() => {})} className="mb-2 flex items-center justify-between rounded-md px-3 py-2 shadow-wb-outline hover:text-brand">{l}<ExternalLink className="size-4" /></a>
                        ))}
                        <p className="text-wb-11 text-wb-ntrl-5">{t("risk.d.copy_note")}</p>
                        <p className="text-wb-11 text-wb-ntrl-5">{r.source === "gdt" ? t("tp.src_gdt", { d: fmtDate(r.checkedAt ?? "") }) : t("sim.source")}</p>
                    </section>
                </div>
            </aside>
        </div>,
        document.body,
    );
}
