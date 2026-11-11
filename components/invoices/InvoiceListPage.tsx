"use client";

import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Ban,
    Download,
    Eye,
    FileArchive,
    FileCode2,
    FileSpreadsheet,
    FileX2,
    Filter,
    Paperclip,
    RefreshCcw,
    RotateCcw,
    Tag as TagIcon,
    X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiErrorText } from "@/components/invoices/apiError";
import DownloadDialog from "@/components/invoices/DownloadDialog";
import InvoiceDetailModal from "@/components/invoices/InvoiceDetailModal";
import { monthOptions, periodRange, type PeriodKey } from "@/components/invoices/period";
import TagMenu from "@/components/invoices/TagMenu";
import SyncDialog from "@/components/sync/SyncDialog";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { Select } from "@/components/shared/Select";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/IconButton";
import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { useDialog } from "@/components/shared/dialog";
import { Popover } from "@/components/shared/Popover";
import { ViewSettingButton, useViewSetting, type ViewColumn } from "@/components/invoices/ColumnSetting";
import { FileBadge } from "@/components/shared/FileBadge";
import { StatusPill } from "@/components/shared/StatusPill";
import type { StatusPillVariant as PillVariant } from "@/components/shared/StatusPill";
import {
    fetchMissingXml,
    filterInvoices,
    getInvoices,
    kpisFor,
    lookupHref,
    needsLookupCode,
    providerKeyOf,
    partnerOf,
    type FileFilter,
    type SortField,
} from "@/lib/api/weinvoice/invoices";
import { exportExcel } from "@/lib/weinvoice/exporter";
import { findProvider, needsCopyAssist, providerTone, supportsDeepLink } from "@/lib/weinvoice/providers";
import { fmtCompact, fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { fullSymbol, hasFile, isCashRegister, isNoCode, type Direction, type Invoice, type InvoiceStatus } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<InvoiceStatus, PillVariant> = {
    original: "success",
    replacement: "progress",
    replaced: "neutral",
    adjustment: "progress",
    adjusted: "warning",
    cancelled: "failed",
};

type ColKey =
    | "date"
    | "direction"
    | "status"
    | "symbol"
    | "number"
    | "partner"
    | "partner_mst"
    | "pretax"
    | "tax"
    | "total"
    | "files"
    | "provider"
    | "cqt_code"
    | "source"
    | "tags";
/** Default View Setting — order + visibility (user can change via "Cột / View Setting"). */
const DEFAULT_VIEW: ViewColumn<ColKey>[] = [
    { key: "date", visible: true },
    { key: "direction", visible: false },
    { key: "status", visible: true },
    { key: "symbol", visible: true },
    { key: "number", visible: true },
    { key: "partner", visible: true },
    { key: "partner_mst", visible: false },
    { key: "pretax", visible: false },
    { key: "tax", visible: true },
    { key: "total", visible: true },
    { key: "files", visible: true },
    { key: "provider", visible: true },
    { key: "cqt_code", visible: false },
    { key: "source", visible: false },
    { key: "tags", visible: false },
];
const COL_WIDTH: Record<ColKey, number> = {
    date: 92, direction: 92, status: 108, symbol: 96, number: 92, partner: 0 /* flexible */, partner_mst: 120,
    pretax: 120, tax: 104, total: 120, files: 84, provider: 132, cqt_code: 150, source: 110, tags: 140,
};
const PARTNER_MIN = 170;
const ACTIONS_W = 136;
const SORTABLE: Partial<Record<ColKey, SortField>> = { date: "issueDate", number: "number", partner: "partner", pretax: "preTax", tax: "tax", total: "total" };

export default function InvoiceListPage({ direction }: { direction: Direction }) {
    const { t, locale } = useTranslation();
    const { toast, confirm } = useDialog();
    const router = useRouter();
    const params = useSearchParams();

    const invoicesAll = useStore((s) => s.invoices); // re-render on any data change
    const activeTaxId = useStore((s) => s.activeTaxId);
    const tags = useStore((s) => s.tags);
    const incompleteAll = useStore((s) => s.incomplete);

    /* ---------------- filters ---------------- */
    const [period, setPeriod] = useState<PeriodKey>("this_year");
    const [keyword, setKeyword] = useState("");
    const [missingXmlOnly, setMissingXmlOnly] = useState(params.get("missing") === "xml");
    const [xml, setXml] = useState<FileFilter>("all");
    const [pdf, setPdf] = useState<FileFilter>("all");
    const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
    const [kind, setKind] = useState<"all" | "normal" | "cash_register" | "no_code">("all");
    const [tagId, setTagId] = useState<string>("all");
    const [provider, setProvider] = useState<string>("all");
    const [exclude, setExclude] = useState<string[]>([]);
    const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({ field: "issueDate", dir: "desc" });
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const view = useViewSetting<ColKey>("invoices", DEFAULT_VIEW);

    const [detailId, setDetailId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<"invoice" | "files">("invoice");
    const [downloadIds, setDownloadIds] = useState<string[] | null>(null);
    const [syncOpen, setSyncOpen] = useState(false);
    const [fetching, setFetching] = useState<{ done: number; total: number } | null>(null);

    useEffect(() => {
    }, []);
    useEffect(() => {
        const open = params.get("open");
        if (open) setDetailId(open);
    }, [params]);

    // reset selection + page when the scope changes
    useEffect(() => {
        setSelected(new Set());
        setPage(1);
    }, [activeTaxId, direction, period, keyword, missingXmlOnly, xml, pdf, status, kind, tagId, provider, exclude]);

    const range = periodRange(period);
    const rows = useMemo(
        () =>
            filterInvoices({
                taxId: activeTaxId,
                direction,
                from: range.from,
                to: range.to,
                keyword,
                missingXmlOnly,
                xml,
                pdf,
                statuses: status === "all" ? [] : [status],
                kind,
                tagIds: tagId === "all" ? [] : [tagId],
                provider,
                excludeTaxIds: exclude,
                sort,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [invoicesAll, activeTaxId, direction, range.from, range.to, keyword, missingXmlOnly, xml, pdf, status, kind, tagId, provider, exclude, sort],
    );
    const kpis = useMemo(() => kpisFor(activeTaxId, range.from, range.to, rows), [activeTaxId, range.from, range.to, rows]);
    const pageRows = rows.slice((page - 1) * size, page * size);
    const partners = useMemo(() => {
        const m = new Map<string, string>();
        filterInvoices({ taxId: activeTaxId, direction, from: range.from, to: range.to }).forEach((i) => {
            const p = partnerOf(i);
            m.set(p.taxId, p.name);
        });
        return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoicesAll, activeTaxId, direction, range.from, range.to]);
    // "Phát hành qua" options: providers present in the current scope (company + direction + period), with counts.
    const providerOptions = useMemo(() => {
        const scope = filterInvoices({ taxId: activeTaxId, direction, from: range.from, to: range.to });
        const m = new Map<string, { label: string; n: number }>();
        let none = 0;
        let need = 0;
        scope.forEach((i) => {
            const k = providerKeyOf(i);
            if (!k) none++;
            else m.set(k, { label: findProvider(k)?.name ?? i.provider ?? k, n: (m.get(k)?.n ?? 0) + 1 });
            if (needsLookupCode(i)) need++;
        });
        const list = Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label));
        return [
            { value: "all", label: t("common.all") },
            ...list.map(([k, v]) => ({ value: k, label: `${v.label} (${v.n})` })),
            ...(need ? [{ value: "__needcode", label: `${t("inv.prov_needcode")} (${need})` }] : []),
            ...(none ? [{ value: "__none", label: `${t("inv.prov_none")} (${none})` }] : []),
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoicesAll, activeTaxId, direction, range.from, range.to, t]);
    const incomplete = incompleteAll.filter((x) => x.taxId === activeTaxId && x.month >= range.from.slice(0, 7) && x.month <= range.to.slice(0, 7));

    const filtersActive = keyword || missingXmlOnly || xml !== "all" || pdf !== "all" || status !== "all" || kind !== "all" || tagId !== "all" || provider !== "all" || exclude.length > 0;
    const resetFilters = () => {
        setKeyword("");
        setMissingXmlOnly(false);
        setXml("all");
        setPdf("all");
        setStatus("all");
        setKind("all");
        setTagId("all");
        setProvider("all");
        setExclude([]);
    };

    /* ---------------- selection ---------------- */
    const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
    const someOnPage = pageRows.some((r) => selected.has(r.id));
    const togglePage = () => {
        const next = new Set(selected);
        if (allOnPage) pageRows.forEach((r) => next.delete(r.id));
        else pageRows.forEach((r) => next.add(r.id));
        setSelected(next);
    };
    const toggleOne = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };
    const targetIds = selected.size ? Array.from(selected) : rows.map((r) => r.id);

    /* ---------------- actions ---------------- */
    const doExcel = useCallback(async () => {
        const list = getInvoices(targetIds);
        const missing = list.filter((i) => !hasFile(i, "xml") && !isNoCode(i)).length;
        if (missing > 0) {
            const go = await confirm({
                title: t("inv.excel_check_title"),
                message: t("inv.excel_check_msg", { n: missing }),
                confirmLabel: t("inv.excel_anyway"),
                kind: "warning",
            });
            if (!go) return;
        }
        // Excel is generated by the backend only (CLAUDE.md §13b): downloaded in api mode, "not available" in mock mode.
        try {
            const res = await exportExcel(list, `WeInvoice_${direction === "purchase" ? "MuaVao" : "BanRa"}_${activeTaxId}_${range.from}_${range.to}.xlsx`, { direction, from: range.from, to: range.to });
            if (res.ok) toast(t("inv.excel_done", { n: list.length }));
            else toast(t("inv.excel_unavailable"), "info");
        } catch (err) {
            toast(apiErrorText(err, t), "error");
        }
    }, [targetIds, confirm, t, direction, activeTaxId, range.from, range.to, toast]);

    const doFetchXml = async (ids: string[]) => {
        const list = getInvoices(ids).filter((i) => !hasFile(i, "xml") && !isNoCode(i));
        if (!list.length) {
            toast(t("inv.fetch_xml_none"), "info");
            return;
        }
        setFetching({ done: 0, total: list.length });
        try {
            const res = await fetchMissingXml(list.map((i) => i.id), (done) => setFetching({ done, total: list.length }));
            toast(t("inv.fetch_xml_done", { n: res.fetched }));
        } catch (err) {
            toast(apiErrorText(err, t), "error");
        } finally {
            setFetching(null);
        }
    };

    const toggleSort = (c: ColKey) => {
        const f = SORTABLE[c];
        if (!f) return;
        setSort((s) => (s.field === f ? { field: f, dir: s.dir === "asc" ? "desc" : "asc" } : { field: f, dir: f === "partner" ? "asc" : "desc" }));
    };

    const statusOptions: { value: "all" | InvoiceStatus; label: string }[] = [
        { value: "all", label: t("common.all") },
        ...(["original", "replacement", "replaced", "adjustment", "adjusted", "cancelled"] as InvoiceStatus[]).map((s) => ({ value: s, label: t(`status.${s}`) })),
    ];
    const fileOpts = (k: string) => [
        { value: "all" as FileFilter, label: t("common.all") },
        { value: "has" as FileFilter, label: t("inv.f.has", { k }) },
        { value: "missing" as FileFilter, label: t("inv.f.missing", { k }) },
    ];
    const periodChips: PeriodKey[] = ["this_year", "last_year", "q1", "q2", "q3", "q4"];
    const visibleCols = view.cols.filter((c) => c.visible).map((c) => c.key);
    const minWidth = 44 + visibleCols.reduce((s, c) => s + COL_WIDTH[c], 0) + PARTNER_MIN + ACTIONS_W;

    const title = t(direction === "purchase" ? "nav.i.purchase" : "nav.i.sales");

    return (
        <PageLayout>
            <PageHeader title={title} subtitle={t("inv.subtitle", { mst: activeTaxId })}>
                <ViewSettingButton
                    cols={view.cols}
                    defaults={DEFAULT_VIEW}
                    locked={["partner"]}
                    label={(k) => t(`inv.col.${k}`)}
                    onSave={view.save}
                    onReset={view.reset}
                />
                <Button size="md" variant="brand" icon={<FileSpreadsheet />} onClick={doExcel} disabled={!targetIds.length}>
                    {t("inv.excel")} ({targetIds.length})
                </Button>
                <Button size="md" variant="brand" icon={<FileArchive />} onClick={() => setDownloadIds(targetIds)} disabled={!targetIds.length}>
                    {t("inv.download")} ({targetIds.length})
                </Button>
                <Button size="md" variant="primary" icon={<RefreshCcw />} onClick={() => setSyncOpen(true)}>
                    {t("inv.sync")}
                </Button>
            </PageHeader>

            {/* Period quick picks */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-wb-12 font-medium text-wb-ntrl-6">{t("inv.quick_period")}</span>
                <div className="flex flex-wrap items-center rounded-md bg-white p-0.5 shadow-wb-outline">
                    {periodChips.map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "h-7 cursor-pointer rounded-[5px] px-3 text-wb-13 font-medium whitespace-nowrap",
                                period === p ? "bg-brand text-white" : "text-wb-ink hover:bg-wb-bg-sidebar",
                            )}
                        >
                            {t(`period.${p}`)}
                            {p.startsWith("q") && <span className={cn("ml-1", period === p ? "text-white/70" : "text-wb-ntrl-5")}>/2026</span>}
                        </button>
                    ))}
                </div>
                <Select
                    value={period.startsWith("m") ? period : ("" as PeriodKey)}
                    width={150}
                    highlight={period.startsWith("m")}
                    options={[{ value: "" as PeriodKey, label: t("period.month") }, ...monthOptions().map((m) => ({ value: `m${m}` as PeriodKey, label: `${t("period.month_short")} ${m.slice(5)}/${m.slice(0, 4)}` }))]}
                    onChange={(v) => v && setPeriod(v)}
                />
                <span className="text-wb-12 text-wb-ntrl-6">
                    {fmtDate(range.from)} – {fmtDate(range.to)}
                </span>
            </div>

            {/* KPI summary cards (WeCMS summary-card look) */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Kpi label={t("inv.kpi.count")} value={fmtMoney(kpis.count)} sub={t("inv.kpi.count_sub", { s: kpis.salesCount, p: kpis.purchaseCount })} />
                <Kpi label={t("inv.kpi.pretax")} value={fmtCompact(kpis.preTax, locale)} sub={`${fmtMoney(kpis.preTax)} ₫`} />
                <Kpi label={t("inv.kpi.tax")} value={fmtCompact(kpis.tax, locale)} sub={`${fmtMoney(kpis.tax)} ₫`} />
                <Kpi
                    label={t("inv.kpi.health")}
                    value={`${kpis.missingXml}`}
                    valueClass={kpis.missingXml ? "text-wb-error" : "text-wb-status-approved-text"}
                    sub={t("inv.kpi.health_sub", { pdf: kpis.missingPdf })}
                    onClick={kpis.missingXml ? () => setMissingXmlOnly(true) : undefined}
                    actionLabel={kpis.missingXml ? t("inv.kpi.health_action") : undefined}
                />
            </div>

            {incomplete.length > 0 && (
                <div className="flex flex-wrap items-start gap-3 rounded-lg border border-wb-warn-border/60 bg-wb-warn-bg px-4 py-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-wb-warning" />
                    <div className="min-w-0 flex-1">
                        <p className="text-wb-14 font-semibold text-wb-ink">{t("inv.incomplete_title")}</p>
                        {incomplete.map((x) => (
                            <p key={x.month} className="mt-0.5 text-wb-13 text-wb-ntrl-8">
                                • <b>T{x.month.slice(5)}/{x.month.slice(0, 4)}</b> — {t("inv.incomplete_line", { got: fmtMoney(x.fetched), total: fmtMoney(x.total), left: fmtMoney(x.total - x.fetched) })}
                            </p>
                        ))}
                        <p className="mt-1 text-wb-12 text-wb-ntrl-6">{t("inv.incomplete_hint")}</p>
                    </div>
                    <Button variant="primary" size="wb-sm" icon={<RefreshCcw />} onClick={() => setSyncOpen(true)}>
                        {t("inv.resync")}
                    </Button>
                </div>
            )}

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={keyword} onChange={setKeyword} placeholder={t("inv.search_ph")} />
                <button
                    type="button"
                    onClick={() => setMissingXmlOnly((v) => !v)}
                    className={cn(
                        "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-wb-13 font-medium shadow-wb-outline",
                        missingXmlOnly ? "bg-brand-soft text-brand shadow-[0_0_0_1px_#0060b9]" : "bg-white text-wb-ink hover:bg-wb-bg-sidebar",
                    )}
                >
                    <FileX2 className="size-4" />
                    {t("inv.missing_xml_only")}
                </button>
                <Select value={xml} prefix="XML" width={140} highlight={xml !== "all"} options={fileOpts("XML")} onChange={setXml} />
                <Select value={pdf} prefix="PDF" width={140} highlight={pdf !== "all"} options={fileOpts("PDF")} onChange={setPdf} />
                <Select value={status} prefix={t("inv.status")} width={190} highlight={status !== "all"} options={statusOptions} onChange={setStatus} />
                <Select
                    value={kind}
                    prefix={t("inv.kind")}
                    width={190}
                    highlight={kind !== "all"}
                    options={[
                        { value: "all", label: t("common.all") },
                        { value: "normal", label: t("inv.kind_normal") },
                        { value: "cash_register", label: t("inv.kind_mtt") },
                        { value: "no_code", label: t("inv.kind_nocode") },
                    ]}
                    onChange={setKind}
                />
                <Select
                    value={tagId}
                    prefix="Tag"
                    width={170}
                    highlight={tagId !== "all"}
                    options={[{ value: "all", label: t("common.all") }, ...tags.map((g) => ({ value: g.id, label: g.name }))]}
                    onChange={setTagId}
                />
                <Popover
                    width={360}
                    trigger={({ toggle }) => (
                        <button
                            type="button"
                            onClick={toggle}
                            className={cn(
                                "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 text-wb-13 font-medium shadow-wb-outline hover:bg-wb-bg-sidebar",
                                exclude.length ? "text-brand shadow-[0_0_0_1px_#0060b9]" : "text-wb-ink",
                            )}
                        >
                            <Ban className="size-4" />
                            {t("inv.exclude_mst")}
                            {exclude.length > 0 && <span className="rounded-sm bg-brand px-1 text-wb-11 text-white">{exclude.length}</span>}
                        </button>
                    )}
                >
                    <div className="max-h-[320px] overflow-auto p-3">
                        <p className="mb-2 text-wb-12 text-wb-ntrl-6">{t("inv.exclude_hint")}</p>
                        <div className="flex flex-col gap-2">
                            {partners.map(([tax, name]) => (
                                <Checkbox
                                    key={tax}
                                    checked={exclude.includes(tax)}
                                    onChange={(on) => setExclude((ex) => (on ? [...ex, tax] : ex.filter((x) => x !== tax)))}
                                    label={
                                        <span className="flex flex-col">
                                            <span className="text-wb-13">{name}</span>
                                            <span className="text-wb-12 font-normal text-wb-ntrl-6">{tax}</span>
                                        </span>
                                    }
                                />
                            ))}
                        </div>
                    </div>
                </Popover>
                <Select
                    value={provider}
                    prefix={t("inv.col.provider")}
                    width={210}
                    highlight={provider !== "all"}
                    options={providerOptions}
                    onChange={setProvider}
                />
                {filtersActive && (
                    <button type="button" onClick={resetFilters} className="flex h-8 cursor-pointer items-center gap-1 px-2 text-wb-13 font-medium text-brand hover:underline">
                        <RotateCcw className="size-3.5" />
                        {t("inv.reset_filters")}
                    </button>
                )}
            </div>

            {/* Selection bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2">
                    <span className="text-wb-13 font-semibold text-brand">{t("inv.selected", { n: selected.size })}</span>
                    {selected.size < rows.length && (
                        <button className="cursor-pointer text-wb-13 font-medium text-brand underline" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
                            {t("inv.select_all_filter", { n: rows.length })}
                        </button>
                    )}
                    <span className="mx-1 h-5 w-px bg-brand/20" />
                    <TagMenu ids={Array.from(selected)} trigger={(toggle) => <Button size="wb-sm" variant="neutral" icon={<TagIcon />} onClick={toggle}>{t("inv.tag_bulk")}</Button>} />
                    <Button size="wb-sm" variant="neutral" icon={<FileCode2 />} onClick={() => doFetchXml(Array.from(selected))}>
                        {t("inv.fetch_xml")}
                    </Button>
                    <Button size="wb-sm" variant="neutral" icon={<Download />} onClick={() => setDownloadIds(Array.from(selected))}>
                        {t("inv.download")}
                    </Button>
                    <button className="ml-auto flex cursor-pointer items-center gap-1 text-wb-13 font-medium text-wb-ntrl-7 hover:text-wb-ink" onClick={() => setSelected(new Set())}>
                        <X className="size-4" /> {t("inv.clear_selection")}
                    </button>
                </div>
            )}
            {fetching && (
                <div className="flex items-center gap-3 rounded-lg bg-wb-bg-card px-3 py-2 shadow-wb-card">
                    <span className="size-4 rounded-full border-2 border-brand border-t-transparent wb-spin" />
                    <span className="text-wb-13 font-medium">{t("inv.fetching_xml", { done: fetching.done, total: fetching.total })}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wb-ntrl-3">
                        <div className="h-full bg-brand transition-all" style={{ width: `${(fetching.done / fetching.total) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-lg shadow-wb-card">
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                    <table className="w-full table-fixed border-collapse" style={{ minWidth }}>
                        <colgroup>
                            <col style={{ width: 44 }} />
                            {visibleCols.map((c) => (
                                <col key={c} style={COL_WIDTH[c] ? { width: COL_WIDTH[c] } : undefined} />
                            ))}
                            <col style={{ width: ACTIONS_W }} />
                        </colgroup>
                        <thead className="sticky top-0 z-10">
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar">
                                <th className="px-3 text-left">
                                    <Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={togglePage} />
                                </th>
                                {visibleCols.map((c) => {
                                    const f = SORTABLE[c];
                                    const on = f && sort.field === f;
                                    const right = c === "pretax" || c === "tax" || c === "total";
                                    return (
                                        <th key={c} className={cn("px-2.5 text-wb-13 font-semibold whitespace-nowrap text-wb-ntrl-8", right ? "text-right" : "text-left")}>
                                            {f ? (
                                                <button className={cn("inline-flex cursor-pointer items-center gap-1 hover:text-brand", on && "text-brand", right && "flex-row-reverse")} onClick={() => toggleSort(c)}>
                                                    {t(`inv.col.${c}`)}
                                                    {on ? sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 text-wb-ntrl-5" />}
                                                </button>
                                            ) : (
                                                t(`inv.col.${c}`)
                                            )}
                                        </th>
                                    );
                                })}
                                <th className="sticky right-0 bg-wb-bg-sidebar px-2.5 text-center text-wb-13 font-semibold text-wb-ntrl-8 shadow-[-1px_0_0_#d3d3d3]">{t("inv.col.actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((inv) => (
                                <Row
                                    key={inv.id}
                                    inv={inv}
                                    cols={visibleCols}
                                    selected={selected.has(inv.id)}
                                    onToggle={() => toggleOne(inv.id)}
                                    onOpen={() => {
                                        setDetailTab("invoice");
                                        setDetailId(inv.id);
                                    }}
                                    onFiles={() => {
                                        setDetailTab("files");
                                        setDetailId(inv.id);
                                    }}
                                    onCopied={(c, k) => toast(t("inv.copied_code", { c, k }), "info")}
                                    onDownload={() => setDownloadIds([inv.id])}
                                    onFetchXml={() => doFetchXml([inv.id])}
                                    tagsById={Object.fromEntries(tags.map((g) => [g.id, g]))}
                                />
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && (
                        <EmptyState
                            icon={<Filter />}
                            title={filtersActive ? t("inv.empty_filtered") : t("inv.empty")}
                            hint={filtersActive ? undefined : t("inv.empty_hint")}
                            action={
                                filtersActive ? (
                                    <Button size="md" variant="neutral" onClick={resetFilters}>{t("inv.reset_filters")}</Button>
                                ) : (
                                    <Button size="md" variant="primary" icon={<RefreshCcw />} onClick={() => setSyncOpen(true)}>{t("inv.sync")}</Button>
                                )
                            }
                        />
                    )}
                </div>
                {rows.length > 0 && (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-wb-table-border bg-wb-bg-footer px-4 py-2.5 text-wb-13">
                        <span className="mr-auto font-semibold text-wb-ntrl-8">{t("inv.footer_total", { n: rows.length })}</span>
                        <span className="text-wb-ntrl-7">
                            {t("inv.col.pretax")}: <b className="text-wb-ink">{fmtMoney(kpis.preTax)}</b>
                        </span>
                        <span className="text-wb-ntrl-7">
                            {t("inv.col.tax")}: <b className="text-wb-ink">{fmtMoney(kpis.tax)}</b>
                        </span>
                        <span className="text-wb-ntrl-7">
                            {t("inv.col.total")}: <b className="text-brand">{fmtMoney(kpis.total)} ₫</b>
                        </span>
                    </div>
                )}
            </div>
            <Pagination page={page} pageSize={size} pageCount={Math.max(1, Math.ceil(rows.length / size))} totalLabel={t("common.showing", { from: rows.length === 0 ? 0 : (page - 1) * size + 1, to: Math.min(rows.length, page * size), total: rows.length })} onPageChange={setPage} onPageSizeChange={(s) => { setSize(s); setPage(1); }} />

            <InvoiceDetailModal
                id={detailId}
                initialTab={detailTab}
                onClose={() => {
                    setDetailId(null);
                    if (params.get("open")) router.replace(window.location.pathname);
                }}
                onOpenOther={(id) => setDetailId(id)}
            />
            <DownloadDialog ids={downloadIds} onClose={() => setDownloadIds(null)} />
            <SyncDialog open={syncOpen} onClose={() => setSyncOpen(false)} defaultFrom={incomplete[0]?.month} />
        </PageLayout>
    );
}

function Kpi({ label, value, sub, valueClass, onClick, actionLabel }: { label: string; value: string; sub?: string; valueClass?: string; onClick?: () => void; actionLabel?: string }) {
    return (
        <div className="flex flex-col justify-between rounded-lg bg-wb-bg-card px-4 py-3 shadow-wb-card">
            <p className="text-wb-12 font-medium uppercase text-wb-ntrl-6">{label}</p>
            <p className={cn("mt-1 text-wb-22 font-bold tracking-wb-tight text-wb-dark", valueClass)}>{value}</p>
            <div className="flex items-center justify-between gap-2">
                {sub && <p className="truncate text-wb-12 text-wb-ntrl-6">{sub}</p>}
                {onClick && actionLabel && (
                    <button className="shrink-0 cursor-pointer text-wb-12 font-semibold text-brand hover:underline" onClick={onClick}>
                        {actionLabel} →
                    </button>
                )}
            </div>
        </div>
    );
}

function Row({
    inv,
    cols,
    selected,
    onToggle,
    onOpen,
    onFiles,
    onCopied,
    onDownload,
    onFetchXml,
    tagsById,
}: {
    inv: Invoice;
    cols: ColKey[];
    selected: boolean;
    onToggle: () => void;
    onOpen: () => void;
    onFiles: () => void;
    onCopied?: (code: string, company: string) => void;
    onDownload: () => void;
    onFetchXml: () => void;
    tagsById: Record<string, { name: string; color: string }>;
}) {
    const { t } = useTranslation();
    const p = partnerOf(inv);
    const xml = hasFile(inv, "xml");
    const pdf = hasFile(inv, "pdf");
    const noCode = isNoCode(inv);
    const cell = "px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink";
    const struck = inv.status === "cancelled" || inv.status === "replaced";
    const prov = findProvider(inv.providerTaxId ?? inv.provider);
    const href = lookupHref(inv);
    // XML present but the provider's lookup code is not in it (BKAV) → ask for the code instead of opening the generic page.
    // api mode: the backend flag decides (`needs_lookup_code`), not the code cached in the browser.
    const needCode = hasFile(inv, "xml") && needsLookupCode(inv) && supportsDeepLink(inv.providerTaxId ?? inv.provider);
    const pdfUrl = inv.files.find((f) => f.kind === "pdf" && f.url)?.url;
    return (
        <tr
            onClick={(e) => {
                if ((e.target as HTMLElement).closest("button,a,input,label,[data-ignore-row-click]")) return;
                onOpen();
            }}
            className={cn("h-[var(--h-wb-table-row)] cursor-pointer border-b border-wb-table-border hover:bg-black/[0.02]", selected && "bg-brand-soft hover:bg-brand-soft")}
        >
            <td className="px-3">
                <Checkbox checked={selected} onChange={onToggle} />
            </td>
            {cols.map((c) => {
                switch (c) {
                    case "date":
                        return <td key={c} className={cell}>{fmtDate(inv.issueDate)}</td>;
                    case "direction":
                        return (
                            <td key={c} className={cell}>
                                <StatusPill size="sm" label={t(`dir.${inv.direction}`)} variant={inv.direction === "purchase" ? "progress" : "pending"} />
                            </td>
                        );
                    case "symbol":
                        return (
                            <td key={c} className={cell}>
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="rounded-sm bg-wb-bg-sidebar px-1.5 font-mono text-wb-12 text-brand-hover">{fullSymbol(inv)}</span>
                                    {(isCashRegister(inv) || noCode) && (
                                        <span className="rounded-sm bg-wb-ntrl-3 px-1 text-wb-10 font-semibold text-wb-ntrl-7" title={noCode ? t("inv.nocode_tip") : undefined}>
                                            {isCashRegister(inv) ? "MTT" : t("inv.nocode_badge")}
                                        </span>
                                    )}
                                </div>
                            </td>
                        );
                    case "number":
                        return (
                            <td key={c} className={cn(cell, "tabular-nums")}>
                                <span className={cn(struck && "line-through decoration-wb-ntrl-5")}>{inv.number}</span>
                            </td>
                        );
                    case "partner_mst":
                        return <td key={c} className={cn(cell, "font-mono text-wb-12")}>{p.taxId}</td>;
                    case "cqt_code":
                        return (
                            <td key={c} className={cn(cell, "truncate font-mono text-wb-11 text-wb-ntrl-7")} title={inv.cqtCode}>
                                {inv.cqtCode || <span className="font-sans text-wb-ntrl-5">—</span>}
                            </td>
                        );
                    case "source":
                        return <td key={c} className={cn(cell, "text-wb-ntrl-7")}>{t(`source.${inv.source}`)}</td>;
                    case "partner":
                        return (
                            <td key={c} className={cell}>
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate" title={p.name}>{p.name}</span>
                                    {!cols.includes("partner_mst") && (
                                        <span className="text-wb-12 font-normal text-wb-ntrl-6">
                                            {t("common.mst")} {p.taxId}
                                        </span>
                                    )}
                                </div>
                            </td>
                        );
                    case "pretax":
                        return <td key={c} className={cn(cell, "text-right tabular-nums")}>{fmtMoney(inv.preTax)}</td>;
                    case "tax":
                        return <td key={c} className={cn(cell, "text-right tabular-nums text-wb-ntrl-7")}>{fmtMoney(inv.tax)}</td>;
                    case "total":
                        return <td key={c} className={cn(cell, "text-right font-semibold tabular-nums")}>{fmtMoney(inv.total)}</td>;
                    case "status":
                        return (
                            <td key={c} className={cell}>
                                <StatusPill size="sm" label={t(`status.${inv.status}`)} variant={STATUS_VARIANT[inv.status]} />
                            </td>
                        );
                    case "files":
                        return (
                            <td key={c} className={cell}>
                                <div className="flex items-center gap-1">
                                    <FileBadge label="XML" on={xml} title={xml ? t("inv.has_xml") : noCode ? t("inv.nocode_tip") : t("inv.missing_xml_tip")} onClick={!xml && !noCode ? onFetchXml : undefined} />
                                    <FileBadge label="PDF" on={pdf} title={pdf ? t("inv.has_pdf") : t("inv.missing_pdf_tip")} onClick={pdfUrl ? () => window.open(pdfUrl, "_blank") : onFiles} />
                                </div>
                            </td>
                        );
                    case "provider":
                        return (
                            <td key={c} className={cell}>
                                {inv.provider && needCode ? (
                                    <button
                                        type="button"
                                        onClick={onFiles}
                                        title={t("inv.need_code_tip", { p: inv.provider })}
                                        style={providerTone(prov?.taxId)}
                                        className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-wb-12 font-medium whitespace-nowrap hover:underline"
                                    >
                                        <span className="shrink-0">{inv.provider}</span>
                                        <span className="shrink-0 rounded-full bg-wb-warn-text px-1 text-wb-10 font-bold text-white">!</span>
                                    </button>
                                ) : inv.provider ? (
                                    <a
                                        onClick={() => {
                                            // WinInvoice & co: no deep link → copy the lookup code, user pastes it on the page.
                                            if (inv.lookupCode && needsCopyAssist(inv.providerTaxId ?? inv.provider)) {
                                                void navigator.clipboard?.writeText(inv.lookupCode).catch(() => {});
                                                onCopied?.(inv.lookupCode, inv.lookupCompany || inv.sellerTaxId);
                                            }
                                        }}
                                        href={href.url || undefined}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={`${prov?.fullName ?? inv.provider}${prov ? ` · ${t("common.mst")} ${prov.taxId}` : ""}\n${href.direct ? t("inv.open_original_tip") : t("inv.open_portal")}: ${href.url || "—"}`}
                                        style={providerTone(prov?.taxId)}
                                        className="inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-wb-12 font-medium whitespace-nowrap hover:underline"
                                    >
                                        <span className="truncate">{inv.provider}</span>
                                        <span className="shrink-0">↗</span>
                                    </a>
                                ) : (
                                    <span className="text-wb-ntrl-5">—</span>
                                )}
                            </td>
                        );
                    case "tags":
                        return (
                            <td key={c} className={cell}>
                                <div className="flex flex-wrap gap-1">
                                    {inv.tags.slice(0, 2).map((id) => tagsById[id] && (
                                        <span key={id} className="max-w-[130px] truncate rounded-sm px-1.5 py-0.5 text-wb-11 font-medium text-white" style={{ background: tagsById[id].color }}>
                                            {tagsById[id].name}
                                        </span>
                                    ))}
                                    {inv.tags.length > 2 && <span className="text-wb-11 text-wb-ntrl-6">+{inv.tags.length - 2}</span>}
                                </div>
                            </td>
                        );
                }
            })}
            <td className={cn("sticky right-0 px-1.5 shadow-[-1px_0_0_#d3d3d3]", selected ? "bg-brand-soft" : "bg-white")}>
                <div className="flex items-center justify-center">
                    <IconButton title={t("inv.act.view")} onClick={onOpen}><Eye /></IconButton>
                    <IconButton title={t("inv.act.download")} onClick={onDownload}><Download /></IconButton>
                    <TagMenu ids={[inv.id]} trigger={(toggle) => <IconButton title={t("inv.act.tag")} onClick={toggle}><TagIcon /></IconButton>} />
                    <IconButton title={t("inv.act.files")} onClick={onFiles}><Paperclip /></IconButton>
                </div>
            </td>
        </tr>
    );
}
