"use client";

import { ArrowLeft, Download, FileSpreadsheet, Lock, Plus, RefreshCcw, Save, Trash2, Unlock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { Modal } from "@/components/shared/Modal";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { Select } from "@/components/shared/Select";
import { StatusPill } from "@/components/shared/StatusPill";
import { useDialog } from "@/components/shared/dialog";
import { INDICATOR_SCHEMA } from "@/components/tax/vatIndicatorSchema";
import { Button } from "@/components/ui/button";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { useStore } from "@/lib/api/weinvoice/store";
import { apiErrorText } from "@/lib/api/weinvoice/sync";
import {
    EDITABLE_CELLS,
    amount,
    createVatDeclaration,
    deleteVatDeclaration,
    downloadVatExport,
    getVatDeclaration,
    listAnnex,
    listVatDeclarations,
    lockVatDeclaration,
    saveVatDeclaration,
    syncVatDeclaration,
    type AnnexPage,
    type AnnexType,
    type VatDeclarationDetail,
    type VatDeclarationRow,
    type VatExportKind,
    type VatIndicatorKey,
    type VatPeriodType,
} from "@/lib/api/weinvoice/vatDeclarations";
import { useTranslation } from "@/lib/i18n";
import { downloadBlob, cn } from "@/lib/utils";
import { fmtDate, fmtMoney } from "@/lib/weinvoice/format";

/**
 * Thuế › Kê khai thuế GTGT (Mẫu 01/GTGT, TT80) of the working MST — the WeCMS VAT declaration module on the
 * engine invoices (record docs/features/weinvoice/weinvoice-vat-declaration-engine-invoices-2026-11-25.md).
 * List → create period → indicators (white cells editable while draft) → lock → export XML / PDF / Excel;
 * annex tabs (BKBR 01-1, BKMV 01-2, 8% reduction) list the period's invoices. API mode only.
 */
export default function VatReturnPage() {
    const { t } = useTranslation();
    const taxId = useStore((s) => s.activeTaxId);
    if (DATA_SOURCE !== "api") {
        return (
            <PageLayout>
                <PageHeader title={t("nav.i.vat_return")} subtitle={t("vat.subtitle")} />
                <EmptyState title={t("vat.api_only")} />
            </PageLayout>
        );
    }
    if (!taxId) {
        return (
            <PageLayout>
                <PageHeader title={t("nav.i.vat_return")} subtitle={t("vat.subtitle")} />
                <EmptyState title={t("vat.no_mst")} />
            </PageLayout>
        );
    }
    // Remount per MST: an open declaration of another MST must not stay on screen.
    return <VatReturnForMst key={taxId} mst={taxId} />;
}

function VatReturnForMst({ mst }: { mst: string }) {
    const [openSid, setOpenSid] = useState<number | null>(null);
    return openSid == null ? <DeclarationList mst={mst} onOpen={setOpenSid} /> : <DeclarationView mst={mst} sid={openSid} onBack={() => setOpenSid(null)} />;
}

const thisYear = () => new Date().getFullYear();

function statusPill(status: string, t: (k: string) => string) {
    return status === "LOCKED" ? <StatusPill size="sm" variant="success" label={t("tax_filing.status.confirmed")} /> : <StatusPill size="sm" variant="warning" label={t("tax_filing.status.draft")} />;
}

function periodText(type: VatPeriodType, value: number, year: number, t: (k: string, v?: Record<string, string | number>) => string) {
    return t(type === "M" ? "tax_filing.period.month" : "tax_filing.period.quarter", { value, year });
}

/* ---------------- List ---------------- */

function DeclarationList({ mst, onOpen }: { mst: string; onOpen: (sid: number) => void }) {
    const { t } = useTranslation();
    const { alert } = useDialog();
    const [year, setYear] = useState(thisYear());
    const [reload, setReload] = useState(0);
    const [creating, setCreating] = useState(false);
    const queryKey = `${mst}|${year}|${reload}`;
    const [state, setState] = useState<{ key: string; rows: VatDeclarationRow[]; error?: string } | null>(null);

    useEffect(() => {
        let off = false;
        listVatDeclarations(mst, { year })
            .then((r) => !off && setState({ key: queryKey, rows: r.rows }))
            .catch((e) => !off && setState({ key: queryKey, rows: [], error: apiErrorText(e) }));
        return () => {
            off = true;
        };
    }, [mst, year, queryKey]);

    const loading = state?.key !== queryKey;
    const years = Array.from({ length: 6 }, (_, i) => thisYear() + 1 - i);

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.vat_return")} subtitle={t("vat.subtitle")}>
                <Select value={String(year)} prefix={t("vat.year")} width={150} options={years.map((y) => ({ value: String(y), label: String(y) }))} onChange={(v) => setYear(Number(v))} />
                <Button size="md" variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
                    {t("tax_filing.action.new_declaration")}
                </Button>
            </PageHeader>
            <div className="overflow-hidden rounded-lg shadow-wb-card">
                <div className="custom-scrollbar-x overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-wb-13">
                        <thead>
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                <th className="px-3">{t("tax_filing.col.filing_period")}</th>
                                <th className="px-3">{t("tax_filing.col.declaration_type")}</th>
                                <th className="px-3">{t("tax_filing.col.status")}</th>
                                <th className="px-3 text-right">{t("tax_filing.col.prev_period_credit")}</th>
                                <th className="px-3 text-right">{t("tax_filing.col.tax_payable")}</th>
                                <th className="px-3 text-right">{t("tax_filing.col.carried_forward")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading &&
                                state?.rows.map((r) => (
                                    <tr key={r.sid} onClick={() => onOpen(r.sid)} className="h-[var(--h-wb-table-row)] cursor-pointer border-b border-wb-table-border font-medium hover:bg-wb-bg-sidebar">
                                        <td className="px-3 text-brand">{periodText(r.periodType, r.periodValue, r.declYear, t)}</td>
                                        <td className="px-3 text-wb-ntrl-7">01/GTGT · TT80/2021</td>
                                        <td className="px-3">{statusPill(r.status, t)}</td>
                                        <td className="px-3 text-right tabular-nums">{fmtMoney(amount(r.prevCredit))}</td>
                                        <td className="px-3 text-right font-semibold tabular-nums">{fmtMoney(amount(r.taxAmount))}</td>
                                        <td className="px-3 text-right tabular-nums">{fmtMoney(amount(r.carriedForward))}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                {loading && <p className="px-4 py-6 text-center text-wb-13 text-wb-ntrl-6">{t("common.loading")}</p>}
                {!loading && state?.error && <p className="px-4 py-6 text-center text-wb-13 text-wb-warn-text">{state.error}</p>}
                {!loading && !state?.error && state?.rows.length === 0 && <EmptyState title={t("vat.empty", { y: year })} hint={t("vat.engine_note")} />}
            </div>
            <NewDeclarationDialog
                open={creating}
                mst={mst}
                onClose={() => setCreating(false)}
                onCreated={(sid) => {
                    setCreating(false);
                    setReload((n) => n + 1);
                    onOpen(sid);
                }}
                onError={(e) => alert({ title: t("dialog.error"), kind: "error", message: apiErrorText(e) })}
            />
        </PageLayout>
    );
}

const INDUSTRIES = ["00", "01", "02", "03"];

function NewDeclarationDialog({ open, mst, onClose, onCreated, onError }: { open: boolean; mst: string; onClose: () => void; onCreated: (sid: number) => void; onError: (e: unknown) => void }) {
    const { t } = useTranslation();
    const now = new Date();
    // Default: the period that has just ended (last month / last quarter) — the one usually being filed.
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [type, setType] = useState<VatPeriodType>("M");
    const [value, setValue] = useState(lastMonth.getMonth() + 1);
    const [year, setYear] = useState(lastMonth.getFullYear());
    const [industry, setIndustry] = useState("00");
    const [busy, setBusy] = useState(false);
    const max = type === "M" ? 12 : 4;

    const submit = async () => {
        setBusy(true);
        try {
            const d = await createVatDeclaration(mst, { periodType: type, periodValue: value, declYear: year, bsnsLineCd: industry, bsnsLineNm: t(`tax_filing.new_dialog.industry.${industry}`) });
            onCreated(d.sid);
        } catch (e) {
            onError(e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            width={520}
            title={t("tax_filing.new_dialog.title")}
            footer={
                <>
                    <Button size="md" variant="neutral" onClick={onClose}>{t("common.cancel")}</Button>
                    <Button size="md" variant="primary" onClick={submit} disabled={busy}>{t("tax_filing.new_dialog.next")}</Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex rounded-md bg-white p-0.5 shadow-wb-outline">
                    {(["M", "Q"] as const).map((k) => (
                        <button
                            key={k}
                            onClick={() => {
                                setType(k);
                                setValue(1);
                            }}
                            className={cn("h-8 flex-1 cursor-pointer rounded-[5px] text-wb-13 font-medium", type === k ? "bg-brand text-white" : "hover:bg-wb-bg-sidebar")}
                        >
                            {t(k === "M" ? "tax_filing.new_dialog.tab_monthly" : "tax_filing.new_dialog.tab_quarterly")}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Select value={String(Math.min(value, max))} prefix={t("tax_filing.new_dialog.period_label")} fullWidth options={Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: type === "M" ? `${t("vat.month")} ${i + 1}` : `${t("vat.quarter")} ${i + 1}` }))} onChange={(v) => setValue(Number(v))} />
                    <Select value={String(year)} prefix={t("vat.year")} fullWidth options={Array.from({ length: 6 }, (_, i) => thisYear() - i).map((y) => ({ value: String(y), label: String(y) }))} onChange={(v) => setYear(Number(v))} />
                </div>
                <Select value={industry} prefix={t("tax_filing.new_dialog.industry_label")} fullWidth options={INDUSTRIES.map((c) => ({ value: c, label: `${c} — ${t(`tax_filing.new_dialog.industry.${c}`)}` }))} onChange={setIndustry} />
                <p className="rounded-md bg-brand-soft px-3 py-2 text-wb-12 leading-5 text-wb-ntrl-7">{t("vat.create_note")}</p>
            </div>
        </Modal>
    );
}

/* ---------------- Detail ---------------- */

type Tab = "decl" | AnnexType;

function DeclarationView({ mst, sid, onBack }: { mst: string; sid: number; onBack: () => void }) {
    const { t } = useTranslation();
    const { alert, confirm, toast } = useDialog();
    const [detail, setDetail] = useState<{ sid: number; d: VatDeclarationDetail } | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [edits, setEdits] = useState<Partial<Record<VatIndicatorKey, string>>>({});
    const [tab, setTab] = useState<Tab>("decl");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let off = false;
        getVatDeclaration(mst, sid)
            .then((d) => !off && setDetail({ sid, d }))
            .catch((e) => !off && setLoadError(apiErrorText(e)));
        return () => {
            off = true;
        };
    }, [mst, sid]);

    const d = detail?.sid === sid ? detail.d : null;
    const draft = d?.status === "DRAFT";
    const dirty = Object.keys(edits).length > 0;

    const run = async (fn: () => Promise<VatDeclarationDetail | void>, okText?: string) => {
        setBusy(true);
        try {
            const next = await fn();
            if (next) {
                setDetail({ sid, d: next });
                setEdits({});
            }
            if (okText) toast(okText);
        } catch (e) {
            alert({ title: t("dialog.error"), kind: "error", message: apiErrorText(e) });
        } finally {
            setBusy(false);
        }
    };

    const exportFile = (kind: VatExportKind) =>
        run(async () => {
            const f = await downloadVatExport(mst, sid, kind);
            downloadBlob(f.blob, f.fileName);
        });

    if (!d) {
        return (
            <PageLayout>
                <PageHeader title={t("tax_filing.form.title")}>
                    <Button size="md" variant="neutral" icon={<ArrowLeft />} onClick={onBack}>{t("vat.back")}</Button>
                </PageHeader>
                <p className={cn("py-10 text-center text-wb-13", loadError ? "text-wb-warn-text" : "text-wb-ntrl-6")}>{loadError ?? t("common.loading")}</p>
            </PageLayout>
        );
    }

    const period = periodText(d.periodType, d.periodValue, d.declYear, t);

    return (
        <PageLayout>
            <PageHeader title={`${t("tax_filing.form.title")} — ${period}`} subtitle={`${d.tpName} · ${t("common.mst")} ${d.tpTaxCode} · ${fmtDate(d.fromDt)} – ${fmtDate(d.toDt)}`}>
                <Button size="md" variant="neutral" icon={<ArrowLeft />} onClick={onBack}>{t("vat.back")}</Button>
                {draft && (
                    <>
                        <Button size="md" variant="neutral" icon={<RefreshCcw />} disabled={busy} onClick={async () => (await confirm({ title: t("tax_filing.form.sync"), message: t("tax_filing.form.sync_confirm") })) && run(() => syncVatDeclaration(mst, sid), t("tax_filing.form.sync_success"))}>
                            {t("tax_filing.form.sync")}
                        </Button>
                        <Button size="md" variant="neutral" icon={<Save />} disabled={busy || !dirty} onClick={() => run(() => saveVatDeclaration(mst, sid, edits), t("tax_filing.form.save_draft_success"))}>
                            {t("tax_filing.form.save_draft")}
                        </Button>
                        <Button size="md" variant="danger" icon={<Trash2 />} disabled={busy} onClick={async () => (await confirm({ title: t("tax_filing.action.delete"), message: t("vat.delete_confirm", { p: period }), danger: true })) && run(async () => { await deleteVatDeclaration(mst, sid); onBack(); }, t("vat.deleted"))}>
                            {t("tax_filing.action.delete")}
                        </Button>
                        <Button size="md" variant="primary" icon={<Lock />} disabled={busy || dirty} onClick={async () => (await confirm({ title: t("tax_filing.form.lock_data"), message: t("vat.lock_confirm", { p: period }) })) && run(() => lockVatDeclaration(mst, sid, true), t("vat.locked"))}>
                            {t("tax_filing.form.lock_data")}
                        </Button>
                    </>
                )}
                {!draft && (
                    <>
                        <Button size="md" variant="neutral" icon={<Unlock />} disabled={busy} onClick={async () => (await confirm({ title: t("tax_filing.action.unlock"), message: t("vat.unlock_confirm", { p: period }) })) && run(() => lockVatDeclaration(mst, sid, false), t("vat.unlocked"))}>
                            {t("tax_filing.action.unlock")}
                        </Button>
                        <Button size="md" variant="neutral" icon={<Download />} disabled={busy} onClick={() => exportFile("xml")}>XML (HTKK)</Button>
                        <Button size="md" variant="neutral" icon={<Download />} disabled={busy} onClick={() => exportFile("pdf")}>PDF</Button>
                        <Button size="md" variant="neutral" icon={<FileSpreadsheet />} disabled={busy} onClick={() => exportFile("report-excel")}>Excel</Button>
                    </>
                )}
            </PageHeader>

            <div className="flex items-center gap-3">
                {statusPill(d.status, t)}
                <span className="text-wb-12 text-wb-ntrl-6">{d.activityCode} — {d.activityName}</span>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-wb-border-sidebar">
                {(["decl", "BKBR", "BKMV", "REDUCE8"] as Tab[]).map((k) => (
                    <button key={k} onClick={() => setTab(k)} className={cn("-mb-px h-10 cursor-pointer border-b-2 px-3 text-wb-13 font-semibold", tab === k ? "border-brand text-brand" : "border-transparent text-wb-ntrl-7 hover:text-wb-ink")}>
                        {t(k === "decl" ? "tax_filing.form.tab_declaration" : k === "BKBR" ? "tax_filing.form.tab_bkbr" : k === "BKMV" ? "tax_filing.form.tab_bkmv" : "vat.tab_reduce8")}
                    </button>
                ))}
            </div>

            {tab === "decl" ? (
                <IndicatorTable d={d} editable={draft && !busy} edits={edits} onEdit={(k, v) => setEdits((e) => ({ ...e, [k]: v }))} />
            ) : (
                <AnnexTable key={`${tab}|${d.status}`} mst={mst} sid={sid} type={tab} />
            )}
        </PageLayout>
    );
}

/* ---------------- Indicators ---------------- */

const EDITABLE = new Set<VatIndicatorKey>(EDITABLE_CELLS);

function IndicatorTable({ d, editable, edits, onEdit }: { d: VatDeclarationDetail; editable: boolean; edits: Partial<Record<VatIndicatorKey, string>>; onEdit: (k: VatIndicatorKey, v: string) => void }) {
    const { t } = useTranslation();
    const cell = (k: VatIndicatorKey | undefined) => {
        if (!k) return <td className="px-3" />;
        const current = edits[k] ?? d.indicators[k] ?? "0";
        if (editable && EDITABLE.has(k) && k !== "ct21") {
            return (
                <td className="px-2 py-1 text-right">
                    <span className="mr-1 text-wb-11 text-wb-ntrl-5">[{k.slice(2)}]</span>
                    <input
                        inputMode="numeric"
                        value={edits[k] ?? String(Math.round(amount(d.indicators[k])))}
                        onChange={(e) => onEdit(k, e.target.value.replace(/[^0-9-]/g, ""))}
                        className={cn("h-8 w-[150px] rounded-md border px-2 text-right text-wb-13 tabular-nums", edits[k] !== undefined ? "border-brand bg-brand-soft" : "border-wb-ntrl-4 bg-white")}
                    />
                </td>
            );
        }
        return (
            <td className="px-3 py-1.5 text-right tabular-nums">
                <span className="mr-1 text-wb-11 text-wb-ntrl-5">[{k.slice(2)}]</span>
                {fmtMoney(amount(current))}
            </td>
        );
    };

    const ct21 = (edits.ct21 ?? d.indicators.ct21 ?? "0") === "1";

    return (
        <div className="overflow-hidden rounded-lg shadow-wb-card">
            <div className="custom-scrollbar-x overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-wb-13">
                    <thead>
                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                            <th className="w-[56px] px-3">STT</th>
                            <th className="px-3">{t("vat.col_indicator")}</th>
                            <th className="w-[230px] px-3 text-right">{t("vat.col_value")}</th>
                            <th className="w-[230px] px-3 text-right">{t("vat.col_tax")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {INDICATOR_SCHEMA.map((r, i) => (
                            <tr key={i} className={cn("border-b border-wb-table-border", r.isSectionHeader && "bg-wb-bg-sidebar", (r.bold || r.isTotal) && "font-semibold")}>
                                <td className="px-3 py-1.5 text-wb-ntrl-7">{r.no}</td>
                                <td className={cn("px-3 py-1.5", r.italic && "italic text-wb-ntrl-7")} style={{ paddingLeft: 12 + (r.indent ?? 0) * 16 }}>
                                    {r.hasCheckbox ? (
                                        <Checkbox checked={ct21} disabled={!editable} onChange={(on) => onEdit("ct21", on ? "1" : "0")} label={t(r.labelKey)} />
                                    ) : (
                                        t(r.labelKey)
                                    )}
                                </td>
                                {r.hasCheckbox ? <td className="px-3" /> : cell(r.ctLeft)}
                                {r.hasCheckbox ? <td className="px-3 text-right text-wb-ntrl-5">[21]</td> : cell(r.ctRight)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ---------------- Annex ---------------- */

function AnnexTable({ mst, sid, type }: { mst: string; sid: number; type: AnnexType }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    const key = `${type}|${query}|${page}|${size}`;
    const [state, setState] = useState<{ key: string; data?: AnnexPage; error?: string } | null>(null);

    useEffect(() => {
        let off = false;
        listAnnex(mst, sid, { annexType: type, search: query, page: page - 1, size })
            .then((data) => !off && setState({ key, data }))
            .catch((e) => !off && setState({ key, error: apiErrorText(e) }));
        return () => {
            off = true;
        };
    }, [mst, sid, type, query, page, size, key]);

    const loading = state?.key !== key;
    const data = state?.data;
    const groups = useMemo(() => data?.taxGroups ?? [], [data]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {/* Enter runs the search (one request per search, not per keystroke). */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        setQuery(search.trim());
                        setPage(1);
                    }}
                >
                    <SearchInput value={search} onChange={setSearch} />
                </form>
                <span className="text-wb-12 text-wb-ntrl-6">{t("vat.engine_note")}</span>
            </div>
            <div className="overflow-hidden rounded-lg shadow-wb-card">
                <div className="custom-scrollbar-x overflow-x-auto">
                    <table className="w-full min-w-[1080px] border-collapse text-wb-13">
                        <thead>
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                                <th className="px-3">{t("tax_filing.bkbr.col_no")}</th>
                                <th className="px-3">{t("tax_filing.annex.col_inv_symbol")}</th>
                                <th className="px-3">{t("tax_filing.annex.col_inv_no")}</th>
                                <th className="px-3">{t("tax_filing.annex.col_inv_dt")}</th>
                                <th className="px-3">{t("tax_filing.annex.col_trco_nm")}</th>
                                <th className="px-3">{t("tax_filing.annex.col_trco_tax_code")}</th>
                                <th className="px-3">{t("tax_filing.annex.col_vat_rate")}</th>
                                <th className="px-3 text-right">{t("tax_filing.annex.col_sply_amt")}</th>
                                <th className="px-3 text-right">{t(type === "REDUCE8" ? "tax_filing.annex.col_reduced_amt" : "tax_filing.annex.col_vat_amt")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading &&
                                data?.rows.map((r, i) => (
                                    <tr key={`${r.srcDocId}|${r.vatRate}|${i}`} className="h-[var(--h-wb-table-row)] border-b border-wb-table-border">
                                        <td className="px-3 text-wb-ntrl-7">{(page - 1) * size + i + 1}</td>
                                        <td className="px-3 font-mono">{r.invSymbol}</td>
                                        <td className="px-3">{r.invNo}</td>
                                        <td className="px-3 whitespace-nowrap">{r.invDt ? `${r.invDt.slice(6, 8)}/${r.invDt.slice(4, 6)}/${r.invDt.slice(0, 4)}` : ""}</td>
                                        <td className="max-w-[320px] truncate px-3" title={r.prodNm ?? undefined}>{r.trcoNm}</td>
                                        <td className="px-3 font-mono">{r.trcoTaxCode}</td>
                                        <td className="px-3">{r.vatRate}</td>
                                        <td className="px-3 text-right tabular-nums">{fmtMoney(amount(r.splyAmt))}</td>
                                        <td className="px-3 text-right tabular-nums">{fmtMoney(amount(type === "REDUCE8" ? r.reducedAmt : r.vatAmt))}</td>
                                    </tr>
                                ))}
                        </tbody>
                        {!loading && data && data.totalCount > 0 && (
                            <tfoot>
                                {groups.map((g) => (
                                    <tr key={g.groupCd} className="border-b border-wb-table-border bg-wb-bg-sidebar text-wb-ntrl-8">
                                        <td colSpan={7} className="px-3 py-1.5">{t("tax_filing.bkbr.total_group", { group: g.groupCd })} · {g.rowCount}</td>
                                        <td className="px-3 text-right tabular-nums">{fmtMoney(amount(g.totalSplyAmt))}</td>
                                        <td className="px-3 text-right tabular-nums">{fmtMoney(amount(type === "REDUCE8" ? g.totalReducedAmt : g.totalVatAmt))}</td>
                                    </tr>
                                ))}
                                <tr className="bg-wb-bg-sidebar font-semibold">
                                    <td colSpan={7} className="px-3 py-2">{t("tax_filing.bkbr.grand_total")}</td>
                                    <td className="px-3 text-right tabular-nums">{fmtMoney(amount(data.grandTotal.totalSplyAmt))}</td>
                                    <td className="px-3 text-right tabular-nums text-brand">{fmtMoney(amount(type === "REDUCE8" ? data.grandTotal.totalReducedAmt : data.grandTotal.totalVatAmt))}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                {loading && <p className="px-4 py-6 text-center text-wb-13 text-wb-ntrl-6">{t("common.loading")}</p>}
                {!loading && state?.error && <p className="px-4 py-6 text-center text-wb-13 text-wb-warn-text">{state.error}</p>}
                {!loading && data && data.totalCount === 0 && <EmptyState title={t("vat.no_rows")} />}
            </div>
            {data && data.totalCount > 0 && (
                <Pagination
                    page={page}
                    pageSize={size}
                    pageCount={Math.max(1, data.totalPages)}
                    totalLabel={t("common.showing", { from: (page - 1) * size + 1, to: Math.min(data.totalCount, page * size), total: data.totalCount })}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => {
                        setSize(s);
                        setPage(1);
                    }}
                />
            )}
        </div>
    );
}
