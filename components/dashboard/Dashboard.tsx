"use client";

import { AlertTriangle, ArrowRight, FileText, FileX2, Link2, RefreshCcw, TrendingDown, TrendingUp, Upload, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import SyncDialog from "@/components/sync/SyncDialog";
import { Card } from "@/components/shared/Card";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { Select } from "@/components/shared/Select";
import { Button } from "@/components/ui/button";
import { DashboardError, getDashboard, type DashboardSummary } from "@/lib/api/weinvoice/dashboard";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { fmtCompact, fmtDateTime, fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { cn } from "@/lib/utils";

const C_PURCHASE = "#0060b9";
const C_SALES = "#e8833a";

export default function Dashboard() {
    const { t, locale } = useTranslation();
    const activeTaxId = useStore((s) => s.activeTaxId);
    // Mock mode recomputes whenever the store changes (sync, upload…); API mode only on scope change / retry.
    const storeTick = useStore((s) => (DATA_SOURCE === "mock" ? s : null));
    const [year, setYear] = useState("2026");
    const [syncOpen, setSyncOpen] = useState(false);
    const [retry, setRetry] = useState(0);
    const [result, setResult] = useState<{ key: string; data?: DashboardSummary; error?: DashboardError } | null>(null);
    const reqKey = `${activeTaxId}|${year}|${retry}`;

    useEffect(() => {
        // API mode: the working MST is set by the shell's hydration — don't ask the backend for "no MST".
        if (DATA_SOURCE === "api" && !activeTaxId) return;
        let alive = true;
        getDashboard(activeTaxId, Number(year))
            .then((data) => alive && setResult({ key: reqKey, data }))
            .catch((e: unknown) => alive && setResult({ key: reqKey, error: e instanceof DashboardError ? e : new DashboardError("WBE_CLIENT_PARSE", String(e)) }));
        return () => {
            alive = false;
        };
    }, [reqKey, activeTaxId, year, storeTick]);

    const loading = result?.key !== reqKey;
    const data = result?.data;
    const error = !loading ? result?.error : undefined;

    if (!data) {
        return (
            <PageLayout>
                <PageHeader title={t("dash.title", { y: year })}>
                    <Select value={year} width={110} options={[{ value: "2026", label: "2026" }, { value: "2025", label: "2025" }]} onChange={setYear} />
                </PageHeader>
                {error ? (
                    <Card>
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <XCircle className="size-8 text-wb-status-rejected-text" />
                            <p className="text-wb-14 font-semibold text-wb-ink">{t("dash.load_error")}</p>
                            <p className="text-wb-12 text-wb-ntrl-6">
                                {error.message} ({error.code})
                            </p>
                            <Button size="md" variant="brand" icon={<RefreshCcw />} onClick={() => setRetry((n) => n + 1)}>
                                {t("common.retry")}
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="flex flex-1 items-center justify-center py-20" role="status" aria-label={t("common.loading")}>
                        <span className="size-6 rounded-full border-2 border-brand border-t-transparent wb-spin" />
                    </div>
                )}
            </PageLayout>
        );
    }

    const vatPayable = data.outVat - data.inVat;
    const myIncomplete = data.incomplete;
    const lastRun = data.lastRun;

    return (
        <PageLayout>
            <PageHeader title={t("dash.title", { y: year })} subtitle={data.lastSyncedAt ? t("dash.last_sync", { at: fmtDateTime(data.lastSyncedAt) }) : t("dash.never_synced")}>
                <Select value={year} width={110} options={[{ value: "2026", label: "2026" }, { value: "2025", label: "2025" }]} onChange={setYear} />
                <Button size="md" variant="primary" icon={<RefreshCcw />} onClick={() => setSyncOpen(true)}>
                    {t("inv.sync")}
                </Button>
            </PageHeader>

            {error && (
                <p className="text-wb-12 text-wb-status-error-text" role="alert">
                    {t("dash.load_error")} — {error.message} ({error.code})
                </p>
            )}
            <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", loading && "opacity-60")}>
                <Stat icon={<FileText />} label={t("dash.kpi.total")} value={fmtMoney(data.count)} sub={t("dash.kpi.total_sub", { s: data.salesCount, p: data.purchaseCount })} />
                <Stat icon={<TrendingUp />} label={t("dash.kpi.revenue")} value={`${fmtCompact(data.salesTotal, locale)} ₫`} sub={t("dash.kpi.n_invoices", { n: data.salesCount })} accent={C_SALES} />
                <Stat icon={<TrendingDown />} label={t("dash.kpi.cost")} value={`${fmtCompact(data.purchaseTotal, locale)} ₫`} sub={t("dash.kpi.n_invoices", { n: data.purchaseCount })} accent={C_PURCHASE} />
                <Stat
                    icon={<Wallet />}
                    label={t("dash.kpi.vat")}
                    value={`${fmtCompact(Math.max(0, vatPayable), locale)} ₫`}
                    sub={t("dash.kpi.vat_sub", { o: fmtCompact(data.outVat, locale), i: fmtCompact(data.inVat, locale) })}
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card title={t("dash.chart_title")} action={<Legend />}>
                    <BarChart months={data.months} />
                </Card>
                <Card title={t("dash.health_title")}>
                    <div className="flex flex-col gap-2.5">
                        <Health
                            icon={<FileX2 />}
                            tone={data.missingXml ? "warn" : "ok"}
                            label={t("dash.health.missing_xml", { n: data.missingXml })}
                            href={data.missingXml ? "/invoices/purchase?missing=xml" : undefined}
                            cta={t("dash.health.fix")}
                        />
                        <Health icon={<FileText />} tone="info" label={t("dash.health.nocode", { n: data.noCodeNoXml })} href="/sources/email" cta={t("dash.health.email")} />
                        <Health icon={<FileText />} tone="info" label={t("dash.health.missing_pdf", { n: data.missingPdf })} />
                        {myIncomplete.map((x) => (
                            <Health key={x.month} icon={<AlertTriangle />} tone="warn" label={t("dash.health.incomplete", { m: `${x.month.slice(5)}/${x.month.slice(0, 4)}`, got: fmtMoney(x.fetched), total: fmtMoney(x.total) })} onClick={() => setSyncOpen(true)} cta={t("inv.resync")} />
                        ))}
                        {lastRun && (
                            <p className="mt-1 text-wb-12 text-wb-ntrl-6">
                                {t("dash.health.last_run", { at: fmtDateTime(lastRun.startedAt), n: lastRun.newCount })}{" "}
                                <Link href="/sync/history" className="font-medium text-brand hover:underline">{t("dash.view_history")}</Link>
                            </p>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card title={t("dash.top_title")} action={<Link href="/invoices/purchase" className="text-wb-13 font-medium text-brand hover:underline">{t("dash.view_all")} →</Link>} bodyClassName="p-0">
                    {data.top.map((p, i) => (
                        <div key={p.taxId} className="flex items-center gap-3 border-b border-wb-border-sidebar px-4 py-2.5 last:border-0">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-wb-12 font-bold text-brand">#{i + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-wb-13 font-semibold text-wb-ink">{p.name}</p>
                                <p className="text-wb-12 text-wb-ntrl-6">
                                    {t("common.mst")} {p.taxId} · {t("dash.kpi.n_invoices", { n: p.count })}
                                </p>
                            </div>
                            <span className="text-wb-14 font-semibold tabular-nums text-wb-ink">{fmtMoney(p.total)} ₫</span>
                        </div>
                    ))}
                    {data.top.length === 0 && <p className="p-4 text-wb-13 text-wb-ntrl-6">{t("dash.no_data")}</p>}
                </Card>
                <Card title={t("dash.quick_title")}>
                    <div className="flex flex-col gap-2">
                        <Quick href="/invoices/purchase" icon={<FileText />} title={t("dash.q.list")} hint={t("dash.q.list_hint")} />
                        <Quick href="/sources/gdt" icon={<Link2 />} title={t("dash.q.gdt")} hint={t("dash.q.gdt_hint")} />
                        <Quick href="/sources/upload" icon={<Upload />} title={t("dash.q.upload")} hint={t("dash.q.upload_hint")} />
                    </div>
                </Card>
            </div>
            <SyncDialog open={syncOpen} onClose={() => setSyncOpen(false)} defaultFrom={myIncomplete[0]?.month} />
        </PageLayout>
    );
}

function Stat({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: string }) {
    return (
        <div className="flex items-start gap-3 rounded-lg bg-wb-bg-card p-4 shadow-wb-card">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand [&_svg]:size-5" style={accent ? { color: accent, background: `${accent}14` } : undefined}>
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-wb-12 font-medium text-wb-ntrl-6">{label}</p>
                <p className="text-wb-22 font-bold tracking-wb-tight text-wb-dark">{value}</p>
                <p className="truncate text-wb-12 text-wb-ntrl-6">{sub}</p>
            </div>
        </div>
    );
}

function Legend() {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-3 text-wb-12 text-wb-ntrl-7">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: C_SALES }} />{t("dash.sales")}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: C_PURCHASE }} />{t("dash.purchase")}</span>
        </div>
    );
}

function BarChart({ months }: { months: { m: number; sales: number; purchase: number }[] }) {
    const { t, locale } = useTranslation();
    const [hover, setHover] = useState<number | null>(null);
    const max = Math.max(1, ...months.flatMap((x) => [x.sales, x.purchase]));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const H = 220;
    const W = 720;
    const left = 52;
    const plotW = W - left - 8;
    const groupW = plotW / 12;
    const barW = Math.min(16, groupW / 3);
    const y = (v: number) => H - (v / top) * H;
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    const h = hover !== null ? months[hover] : null;
    return (
        <div className="relative">
            <svg viewBox={`0 -12 ${W} ${H + 40}`} className="w-full" role="img" aria-label={t("dash.chart_title")} onMouseLeave={() => setHover(null)}>
                {ticks.map((v) => (
                    <g key={v}>
                        <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke="#e5e5e5" strokeWidth={1} />
                        <text x={left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#737373">{fmtCompact(v, locale)}</text>
                    </g>
                ))}
                {months.map((x, i) => {
                    const gx = left + i * groupW;
                    const cx = gx + groupW / 2;
                    return (
                        <g key={x.m} onMouseEnter={() => setHover(i)}>
                            <rect x={gx} y={0} width={groupW} height={H} fill={hover === i ? "rgba(0,96,185,0.05)" : "transparent"} />
                            {[x.sales, x.purchase].map((v, k) => {
                                const bx = cx - barW - 1 + k * (barW + 2);
                                const bh = H - y(v);
                                return bh > 0 ? <path key={k} d={roundedTop(bx, y(v), barW, bh, 3)} fill={k === 0 ? C_SALES : C_PURCHASE} /> : null;
                            })}
                            <text x={cx} y={H + 18} textAnchor="middle" fontSize={11} fill="#737373">T{String(x.m).padStart(2, "0")}</text>
                        </g>
                    );
                })}
                <line x1={left} x2={W} y1={H} y2={H} stroke="#a3a3a3" strokeWidth={1} />
            </svg>
            {h && (
                <div
                    className="pointer-events-none absolute top-2 rounded-md border border-wb-border-sidebar bg-white px-3 py-2 text-wb-12 shadow-wb-popup"
                    style={{ left: `${Math.min(70, ((52 + hover! * ((720 - 60) / 12)) / 720) * 100 + 4)}%` }}
                >
                    <p className="mb-1 font-semibold text-wb-ink">{t("dash.month", { m: h.m })}</p>
                    <p className="flex items-center gap-1.5 text-wb-ntrl-8"><span className="size-2 rounded-sm" style={{ background: C_SALES }} />{t("dash.sales")}: <b>{fmtMoney(h.sales)}</b></p>
                    <p className="flex items-center gap-1.5 text-wb-ntrl-8"><span className="size-2 rounded-sm" style={{ background: C_PURCHASE }} />{t("dash.purchase")}: <b>{fmtMoney(h.purchase)}</b></p>
                </div>
            )}
        </div>
    );
}

function niceStep(raw: number) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, h, w / 2);
    return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function Health({ icon, label, tone, href, cta, onClick }: { icon: React.ReactNode; label: string; tone: "ok" | "warn" | "info"; href?: string; cta?: string; onClick?: () => void }) {
    const cls = tone === "warn" ? "bg-wb-warn-bg text-wb-warn-text" : tone === "ok" ? "bg-wb-status-approved-bg text-wb-status-approved-text" : "bg-wb-bg-sidebar text-wb-ntrl-7";
    return (
        <div className={cn("flex items-center gap-2.5 rounded-md px-3 py-2.5 text-wb-13 [&_svg]:size-4 [&_svg]:shrink-0", cls)}>
            {icon}
            <span className="min-w-0 flex-1 font-medium">{label}</span>
            {href && cta && (
                <Link href={href} className="shrink-0 font-semibold text-brand hover:underline">
                    {cta}
                </Link>
            )}
            {onClick && cta && (
                <button onClick={onClick} className="shrink-0 cursor-pointer font-semibold text-brand hover:underline">
                    {cta}
                </button>
            )}
        </div>
    );
}

function Quick({ href, icon, title, hint }: { href: string; icon: React.ReactNode; title: string; hint: string }) {
    return (
        <Link href={href} className="group flex items-center gap-3 rounded-lg border border-wb-border-sidebar p-3 hover:border-brand hover:bg-brand-soft">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand [&_svg]:size-[18px]">{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-wb-13 font-semibold text-wb-ink">{title}</span>
                <span className="block text-wb-12 text-wb-ntrl-6">{hint}</span>
            </span>
            <ArrowRight className="size-4 text-wb-ntrl-5 group-hover:text-brand" />
        </Link>
    );
}
