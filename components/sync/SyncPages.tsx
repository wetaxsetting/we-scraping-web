"use client";

import { CheckCircle2, Circle, Loader2, Play, XCircle } from "lucide-react";
import { useState } from "react";

import { currentMonth, fitSyncTo, fmtMonth, syncRangeEnd } from "@/components/invoices/period";
import { MonthPicker } from "@/components/shared/MonthPicker";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import Pagination from "@/components/shared/Pagination";
import { Select } from "@/components/shared/Select";
import { Button } from "@/components/ui/button";
import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { useDialog } from "@/components/shared/dialog";
import { StatusPill } from "@/components/shared/StatusPill";
import { refreshAfterSync } from "@/lib/api/weinvoice/remote";
import { apiErrorText, runSync } from "@/lib/api/weinvoice/sync";
import { fmtDateTime } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import type { SyncRun } from "@/lib/weinvoice/types";

/** History reasons with a locale entry; any other reason (API mode: backend text) is shown as sent. */
// `queued` / `running`: API-mode markers for runs not finished yet (lib/api/weinvoice/sync.ts toSyncRun).
const KNOWN_MSG = new Set(["gdt_login_failed", "gdt_batch_limit", "cancelled", "queued", "running"]);

/** Đồng bộ → Lịch sử đồng bộ (per tax ID). */
export function SyncHistoryPage() {
    const { t } = useTranslation();
    const history = useStore((s) => s.history);
    const connections = useStore((s) => s.connections);
    const [mst, setMst] = useState("all");
    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(10);
    const rows = history.filter((h) => (mst === "all" || h.taxId === mst) && (status === "all" || h.status === status));

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.history")} subtitle={t("hist.subtitle")} />
            <div className="flex flex-wrap gap-2">
                <Select value={mst} prefix={t("common.mst")} width={240} options={[{ value: "all", label: t("common.all") }, ...connections.map((c) => ({ value: c.taxId, label: c.taxId }))]} onChange={(v) => { setMst(v); setPage(1); }} />
                <Select value={status} prefix={t("inv.status")} width={210} options={[{ value: "all", label: t("common.all") }, ...["success", "partial", "failed"].map((s) => ({ value: s, label: t(`hist.st.${s}`) }))]} onChange={(v) => { setStatus(v); setPage(1); }} />
            </div>
            <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-lg shadow-wb-card">
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                    <table className="w-full min-w-[1080px] border-collapse text-wb-13">
                        <thead className="sticky top-0">
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                <th className="px-3">{t("hist.col.time")}</th>
                                <th className="px-3">{t("common.mst")}</th>
                                <th className="px-3">{t("hist.col.period")}</th>
                                <th className="px-3">{t("hist.col.trigger")}</th>
                                <th className="px-3 text-right">{t("hist.col.new")}</th>
                                <th className="px-3 text-right">{t("hist.col.updated")}</th>
                                <th className="px-3 text-right">{t("hist.col.xml")}</th>
                                <th className="px-3 text-right">{t("hist.col.duration")}</th>
                                <th className="px-3">{t("inv.status")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice((page - 1) * size, page * size).map((h) => (
                                <tr key={h.id} className="h-[var(--h-wb-table-row)] border-b border-wb-table-border font-medium">
                                    <td className="px-3 whitespace-nowrap">{fmtDateTime(h.startedAt)}</td>
                                    <td className="px-3">
                                        <div className="flex flex-col">
                                            <span className="font-mono">{h.taxId}</span>
                                            <span className="max-w-[260px] truncate text-wb-12 font-normal text-wb-ntrl-6">{h.companyName}</span>
                                        </div>
                                    </td>
                                    <td className="px-3">{h.fromMonth === h.toMonth ? fmtMonth(h.fromMonth) : `${fmtMonth(h.fromMonth)} – ${fmtMonth(h.toMonth)}`} <span className="text-wb-12 text-wb-ntrl-6">· {t(`sync.dir.${h.direction}`)}</span></td>
                                    <td className="px-3 text-wb-ntrl-7">{t(`hist.trigger.${h.trigger}`)}</td>
                                    <td className="px-3 text-right tabular-nums">{h.newCount}</td>
                                    <td className="px-3 text-right tabular-nums">{h.updatedCount}</td>
                                    <td className="px-3 text-right tabular-nums">{h.xmlCount}</td>
                                    <td className="px-3 text-right tabular-nums text-wb-ntrl-7">{h.durationSec}s</td>
                                    <td className="px-3">
                                        <StatusPill size="sm" variant={h.status === "success" ? "success" : h.status === "partial" ? "warning" : "failed"} label={t(`hist.st.${h.status}`)} />
                                        {h.message && <p className="mt-0.5 text-wb-11 text-wb-ntrl-6">{KNOWN_MSG.has(h.message) ? t(`hist.msg.${h.message}`) : h.message}</p>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && <EmptyState title={t("hist.empty")} />}
                </div>
            </div>
            <Pagination page={page} pageSize={size} pageCount={Math.max(1, Math.ceil(rows.length / size))} totalLabel={t("common.showing", { from: rows.length === 0 ? 0 : (page - 1) * size + 1, to: Math.min(rows.length, page * size), total: rows.length })} onPageChange={setPage} onPageSizeChange={(s) => { setSize(s); setPage(1); }} />
        </PageLayout>
    );
}

type RowState = { state: "idle" | "queued" | "running" | "done" | "error"; detail?: string; run?: SyncRun };

/** Đồng bộ → Đồng bộ hàng loạt: run several tax IDs one after another (queue). */
export function BulkSyncPage() {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const connections = useStore((s) => s.connections);
    const [picked, setPicked] = useState<Set<string>>(() => new Set(connections.map((c) => c.taxId)));
    const [from, setFrom] = useState(currentMonth);
    const [to, setTo] = useState(currentMonth);
    const [state, setStateMap] = useState<Record<string, RowState>>({});
    const running = Object.values(state).some((s) => s.state === "running" || s.state === "queued");
    const changeFrom = (m: string) => {
        setFrom(m);
        setTo((cur) => fitSyncTo(m, cur));
    };

    const start = async () => {
        const list = connections.filter((c) => picked.has(c.taxId));
        setStateMap(Object.fromEntries(list.map((c) => [c.taxId, { state: "queued" }])));
        let total = 0;
        for (const c of list) {
            setStateMap((m) => ({ ...m, [c.taxId]: { state: "running", detail: t("sync.step.login") } }));
            try {
                const run = await runSync({ taxId: c.taxId, direction: "both", fromMonth: from <= to ? from : to, toMonth: from <= to ? to : from, trigger: "bulk" }, (p) => {
                    const detail = p.step === "xml" ? `${t("sync.step.xml")} ${p.xmlDone}/${p.xmlTotal}` : p.step === "list" ? t("sync.listed", { n: p.listed, m: p.month ? fmtMonth(p.month) : "", b: p.batch ?? "" }) : t(`sync.step.${p.step}`);
                    setStateMap((m) => ({ ...m, [c.taxId]: { state: "running", detail } }));
                });
                total += run.newCount;
                setStateMap((m) => ({ ...m, [c.taxId]: { state: "done", run } }));
                void refreshAfterSync(c.taxId);
            } catch (e) {
                // API mode: this MST's run could not start / be followed — show the backend message, continue the queue.
                setStateMap((m) => ({ ...m, [c.taxId]: { state: "error", detail: apiErrorText(e) } }));
            }
        }
        toast(t("bulk.done", { n: list.length, inv: total }));
    };

    const all = connections.length > 0 && connections.every((c) => picked.has(c.taxId));
    return (
        <PageLayout>
            <PageHeader title={t("nav.i.bulk")} subtitle={t("bulk.subtitle")}>
                <MonthPicker value={from} prefix={t("sync.from")} width={200} onChange={changeFrom} />
                <MonthPicker value={to} prefix={t("sync.to")} width={200} min={from} max={syncRangeEnd(from)} onChange={setTo} />
                <Button size="md" variant="primary" icon={<Play />} disabled={running || picked.size === 0} onClick={start}>
                    {t("bulk.start", { n: picked.size })}
                </Button>
            </PageHeader>
            <div className="overflow-hidden rounded-lg shadow-wb-card">
                <table className="w-full border-collapse text-wb-13">
                    <thead>
                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                            <th className="w-[44px] px-3">
                                <Checkbox checked={all} indeterminate={!all && picked.size > 0} onChange={() => setPicked(all ? new Set() : new Set(connections.map((c) => c.taxId)))} disabled={running} />
                            </th>
                            <th className="px-3">{t("common.mst")}</th>
                            <th className="px-3">{t("conn.col.company")}</th>
                            <th className="px-3">{t("conn.col.last_sync")}</th>
                            <th className="w-[360px] px-3">{t("bulk.progress")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {connections.map((c) => {
                            const s = state[c.taxId];
                            return (
                                <tr key={c.taxId} className="h-[var(--h-wb-table-row)] border-b border-wb-table-border font-medium">
                                    <td className="px-3">
                                        <Checkbox checked={picked.has(c.taxId)} disabled={running} onChange={(on) => setPicked((p) => { const n = new Set(p); if (on) n.add(c.taxId); else n.delete(c.taxId); return n; })} />
                                    </td>
                                    <td className="px-3 font-mono">{c.taxId}</td>
                                    <td className="max-w-[320px] truncate px-3">{c.companyName}</td>
                                    <td className="px-3 text-wb-ntrl-7">{c.lastSyncAt ? fmtDateTime(c.lastSyncAt) : t("conn.never")}</td>
                                    <td className="px-3">
                                        {!s || s.state === "idle" ? (
                                            <span className="text-wb-ntrl-5">—</span>
                                        ) : s.state === "queued" ? (
                                            <span className="flex items-center gap-1.5 text-wb-ntrl-6"><Circle className="size-4" />{t("bulk.queued")}</span>
                                        ) : s.state === "running" ? (
                                            <span className="flex items-center gap-1.5 text-brand"><Loader2 className="size-4 wb-spin" />{s.detail}</span>
                                        ) : s.state === "done" ? (
                                            <span className="flex items-center gap-1.5 text-wb-status-approved-text"><CheckCircle2 className="size-4" />{t("bulk.result", { n: s.run?.newCount ?? 0, x: s.run?.xmlCount ?? 0 })}</span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-wb-status-error-text"><XCircle className="size-4" />{s.detail}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-wb-12 text-wb-ntrl-6">{t("bulk.note")}</p>
        </PageLayout>
    );
}
