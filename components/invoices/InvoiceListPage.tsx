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
import { PdfDownloadDialog, PdfDownloadMenu } from "@/components/invoices/PdfDownload";
import { Modal } from "@/components/shared/Modal";
import { CURRENT_YEAR, periodRange, type PeriodKey } from "@/components/invoices/period";
import TagMenu from "@/components/invoices/TagMenu";
import SyncDialog from "@/components/sync/SyncDialog";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import { MonthPicker } from "@/components/shared/MonthPicker";
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
    getInvoice,
    getInvoices,
    invoiceFacets,
    listInvoiceIds,
    listInvoices,
    lookupHref,
    needsLookupCode,
    partnerOf,
    useInvoiceListVersion,
    type FileFilter,
    type InvoiceKpis,
    type InvoiceListResult,
    type ListFacets,
    type MissingXmlFilter,
    type SortField,
} from "@/lib/api/weinvoice/invoices";
import { downloadCqtList, downloadExcel, startPdfJob, type ListScope, type PdfJob, type PdfMode } from "@/lib/api/weinvoice/downloads";
import { findProvider, needsCopyAssist, providerTone, supportsDeepLink } from "@/lib/weinvoice/providers";
import { fmtCompact, fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { useTranslation } from "@/lib/i18n";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { useStore } from "@/lib/api/weinvoice/store";
import { fullSymbol, hasFile, isCashRegister, isNoCode, type Direction, type Invoice, type InvoiceStatus } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";

/** mock: the store IS the data (re-filter on every change); api: the server is (re-ask on listVersion). */
const IS_MOCK = DATA_SOURCE !== "api";
const EMPTY_KPIS: InvoiceKpis = { count: 0, preTax: 0, tax: 0, total: 0, missingXml: 0, missingPdf: 0, salesCount: 0, purchaseCount: 0, salesTotal: 0, purchaseTotal: 0 };

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
    const { toast } = useDialog();
    const router = useRouter();
    const params = useSearchParams();

    const invoicesAll = useStore((s) => s.invoices); // re-render on any data change
    const activeTaxId = useStore((s) => s.activeTaxId);
    const tags = useStore((s) => s.tags);

    /* ---------------- filters ---------------- */
    const [period, setPeriod] = useState<PeriodKey>("this_year");
    const [keyword, setKeyword] = useState("");
    // ?missing=xml → every invoice without XML (card, chip); ?missing=xml_coded → coded ones only (dashboard rows)
    // (docs/issues/weinvoice-list-missing-xml-card-all-invoices-2026-11-17.md)
    const [missingXml, setMissingXml] = useState<MissingXmlFilter>(
        params.get("missing") === "xml" ? "all" : params.get("missing") === "xml_coded" ? "coded" : "off",
    );
    const [xml, setXml] = useState<FileFilter>("all");
    // Dashboard "chưa có PDF gốc" rows open the list with ?missing=pdf (docs/issues/weinvoice-dashboard-data-status-by-direction-2026-11-17.md)
    const [pdf, setPdf] = useState<FileFilter>(params.get("missing") === "pdf" ? "missing" : "all");
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
    }, [activeTaxId, direction, period, keyword, missingXml, xml, pdf, status, kind, tagId, provider, exclude]);

    const range = periodRange(period);
    // The keyword waits for typing to pause before the list asks again.
    const [keywordQ, setKeywordQ] = useState(keyword);
    useEffect(() => {
        const h = setTimeout(() => setKeywordQ(keyword), 350);
        return () => clearTimeout(h);
    }, [keyword]);

    /*
     * One page at a time (docs/issues/weinvoice-invoice-list-server-paging-2026-11-18.md): api mode asks the server
     * for the page, KPIs and incomplete periods on every filter / sort / page change, and again when the data may
     * have changed (sync, upload, fetched XML → listVersion); mock mode does the same over the store.
     */
    const listVersion = useInvoiceListVersion();
    const filter = useMemo(
        () => ({
            taxId: activeTaxId,
            direction,
            from: range.from,
            to: range.to,
            keyword: keywordQ,
            missingXml,
            xml,
            pdf,
            statuses: status === "all" ? [] : [status],
            kind,
            tagIds: tagId === "all" ? [] : [tagId],
            provider,
            excludeTaxIds: exclude,
            sort,
        }),
        [activeTaxId, direction, range.from, range.to, keywordQ, missingXml, xml, pdf, status, kind, tagId, provider, exclude, sort],
    );
    const queryKey = JSON.stringify([filter, page, size, listVersion]);
    const [result, setResult] = useState<{ key: string; data: InvoiceListResult } | null>(null);
    const [failedKey, setFailedKey] = useState<string | null>(null);
    useEffect(() => {
        if (!activeTaxId) return;
        let live = true;
        listInvoices({ ...filter, page, size })
            .then((data) => {
                if (live) setResult({ key: queryKey, data });
            })
            .catch((err) => {
                if (!live) return;
                setFailedKey(queryKey);
                toast(apiErrorText(err, t), "error");
            });
        return () => {
            live = false;
        };
        // mock mode re-filters when the store changes; api mode only when listVersion moves (part of queryKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryKey, IS_MOCK ? invoicesAll : null]);
    const loading = !!activeTaxId && result?.key !== queryKey && failedKey !== queryKey;
    const data = result?.data;
    const kpis: InvoiceKpis = data?.kpis ?? EMPTY_KPIS;
    const totalCount = data?.totalCount ?? 0;
    // rows are read back from the store so tag / file changes show at once
    const pageRows = (data?.rows ?? []).map((r) => getInvoice(r.id) ?? r);

    // "Phát hành qua" and "Loại trừ MST" options of the MST + direction + period
    const facetKey = JSON.stringify([activeTaxId, direction, range.from, range.to, listVersion]);
    const [facets, setFacets] = useState<{ key: string; data: ListFacets } | null>(null);
    useEffect(() => {
        if (!activeTaxId) return;
        let live = true;
        invoiceFacets(activeTaxId, direction, range.from, range.to)
            .then((f) => {
                if (live) setFacets({ key: facetKey, data: f });
            })
            .catch(() => {}); // options only: the list itself reports errors
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facetKey, IS_MOCK ? invoicesAll : null]);
    const partners = facets?.data.partners ?? [];
    const providerOptions = useMemo(() => {
        const f = facets?.data;
        return [
            { value: "all", label: t("common.all") },
            ...(f?.providers ?? []).map((p) => ({ value: p.key, label: `${p.label} (${p.n})` })),
            ...(f?.needsCode ? [{ value: "__needcode", label: `${t("inv.prov_needcode")} (${f.needsCode})` }] : []),
            ...(f?.none ? [{ value: "__none", label: `${t("inv.prov_none")} (${f.none})` }] : []),
        ];
    }, [facets, t]);
    const incomplete = data?.incomplete ?? [];

    const filtersActive = keyword || missingXml !== "off" || xml !== "all" || pdf !== "all" || status !== "all" || kind !== "all" || tagId !== "all" || provider !== "all" || exclude.length > 0;
    const resetFilters = () => {
        setKeyword("");
        setMissingXml("off");
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
    /** The selection, or every invoice of the filtered list (server ids, at most 20,000). */
    const resolveTargets = useCallback(async (): Promise<string[] | null> => {
        if (selected.size) return Array.from(selected);
        try {
            return await listInvoiceIds(filter);
        } catch (err) {
            toast(apiErrorText(err, t), "error");
            return null;
        }
    }, [selected, filter, toast, t]);
    const targetCount = selected.size || totalCount;
    const selectAllFiltered = async () => {
        try {
            setSelected(new Set(await listInvoiceIds(filter)));
        } catch (err) {
            toast(apiErrorText(err, t), "error");
        }
    };

    /* ---------------- actions ---------------- */
    /** Scope of a download (UI Spec v1.1 §3.6): the ticked rows, or the whole filtered list (no ids sent). */
    const scope = useCallback((): ListScope => ({ filter, ids: selected.size ? Array.from(selected) : undefined }), [filter, selected]);

    /** Excel (§3.11) — built by the backend only: downloaded in api mode, "not available" in mock mode. */
    const writeExcel = useCallback(
        async (ids: string[] | null) => {
            try {
                const s: ListScope = { filter, ids: ids ?? undefined };
                const ok = await downloadExcel(s, `WeInvoice_${direction === "purchase" ? "MuaVao" : "BanRa"}_${activeTaxId}_${range.from}_${range.to}.xlsx`);
                if (ok) toast(t("inv.excel_done", { n: ids?.length ?? totalCount }));
                else toast(t("inv.excel_unavailable"), "info");
            } catch (err) {
                toast(apiErrorText(err, t), "error");
            }
        },
        [filter, direction, activeTaxId, range.from, range.to, totalCount, toast, t],
    );

    const [excelAsk, setExcelAsk] = useState<{ ids: string[] | null; missing: number; withXml: number } | null>(null);
    const doExcel = useCallback(async () => {
        // coded invoices without XML: counted on the selection, or by the server for the whole list
        const ids = selected.size ? Array.from(selected) : null;
        const known = ids ? getInvoices(ids) : [];
        const missing = ids ? known.filter((i) => !hasFile(i, "xml") && !isNoCode(i)).length : (data?.missingXmlCoded ?? 0);
        if (missing > 0) {
            const withXml = ids ? known.filter((i) => hasFile(i, "xml")).length : Math.max(0, totalCount - kpis.missingXml);
            setExcelAsk({ ids, missing, withXml });
            return;
        }
        await writeExcel(ids);
    }, [selected, data, totalCount, kpis.missingXml, writeExcel]);

    /** "Đồng bộ + xuất đầy đủ": fetch the missing XML from GDT, then export. */
    const syncThenExcel = async () => {
        const ask = excelAsk;
        setExcelAsk(null);
        if (!ask) return;
        const ids = ask.ids ?? (await resolveTargets());
        if (!ids?.length) return;
        await doFetchXml(ids);
        await writeExcel(ask.ids);
    };

    /** "Bảng kê gốc (CQT)" (§3.12) — ZIP from the server. */
    const doCqtList = async () => {
        try {
            const ok = await downloadCqtList(scope());
            if (ok) toast(t("inv.cqt_list_done", { n: targetCount }));
            else toast(t("common.export_unavailable"), "info");
        } catch (err) {
            toast(apiErrorText(err, t), "error");
        }
    };

    /** "Tải PDF (n) ▾" (§3.12) — a server job; one ZIP at the end. */
    const [pdfJob, setPdfJob] = useState<PdfJob | null>(null);
    const closePdfJob = useCallback(() => setPdfJob(null), []);
    const doPdf = async (mode: PdfMode) => {
        try {
            const job = await startPdfJob(scope(), mode);
            if (job) setPdfJob(job);
            else toast(t("pdfdl.unavailable"), "info");
        } catch (err) {
            toast(apiErrorText(err, t), "error");
        }
    };

    const doFetchXml = async (ids: string[]) => {
        const known = getInvoices(ids);
        const list = known.filter((i) => !hasFile(i, "xml") && !isNoCode(i)).map((i) => i.id);
        // ids selected across pages are not all in the store: the server picks the fetchable ones
        const send = known.length < ids.length ? ids : list;
        if (!send.length) {
            toast(t("inv.fetch_xml_none"), "info");
            return;
        }
        setFetching({ done: 0, total: send.length });
        try {
            const res = await fetchMissingXml(send, (done) => setFetching({ done, total: send.length }));
            toast(t("inv.fetch_xml_done", { n: res.fetched }));
        } catch (err) {
            toast(apiErrorText(err, t), "error");
        } finally {
            setFetching(null);
        }
    };

    const doDownload = async () => {
        const ids = await resolveTargets();
        if (ids?.length) setDownloadIds(ids);
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
            {/* v1.1: the page header keeps only "Đồng bộ"; downloads moved to the bar above the table. */}
            <PageHeader title={title} subtitle={t("inv.subtitle", { mst: activeTaxId })}>
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
                            {p.startsWith("q") && <span className={cn("ml-1", period === p ? "text-white/70" : "text-wb-ntrl-5")}>/{CURRENT_YEAR}</span>}
                        </button>
                    ))}
                </div>
                <MonthPicker
                    value={period.startsWith("m") ? period.slice(1) : ""}
                    width={150}
                    highlight={period.startsWith("m")}
                    placeholder={t("period.month")}
                    onChange={(m) => setPeriod(`m${m}`)}
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
                    onClick={kpis.missingXml ? () => setMissingXml("all") : undefined}
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
                    onClick={() => setMissingXml((v) => (v === "off" ? "all" : "off"))}
                    className={cn(
                        "flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-wb-13 font-medium shadow-wb-outline",
                        missingXml !== "off" ? "bg-brand-soft text-brand shadow-[0_0_0_1px_#0060b9]" : "bg-white text-wb-ink hover:bg-wb-bg-sidebar",
                    )}
                >
                    <FileX2 className="size-4" />
                    {t(missingXml === "coded" ? "inv.missing_xml_coded" : "inv.missing_xml_only")}
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
                            {partners.map(({ taxId: tax, name }) => (
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
                    {selected.size < totalCount && (
                        <button className="cursor-pointer text-wb-13 font-medium text-brand underline" onClick={() => void selectAllFiltered()}>
                            {t("inv.select_all_filter", { n: totalCount })}
                        </button>
                    )}
                    <span className="mx-1 h-5 w-px bg-brand/20" />
                    {/* v1.1: "Gắn tag" / downloads moved to the download bar */}
                    <Button size="wb-sm" variant="neutral" icon={<FileCode2 />} onClick={() => doFetchXml(Array.from(selected))}>
                        {t("inv.fetch_xml")}
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

            {/* Download bar (UI Spec v1.1): hint · Cột · Gắn tag (n) · Tải PDF (n) ▾ · Excel (n) · Bảng kê gốc (CQT) · Tải XML.
                Nothing ticked → the buttons act on the whole filtered list; ticked → on the selection (§3.6). */}
            <div className="flex flex-wrap items-center gap-2" data-testid="dl-toolbar">
                <p className="min-w-[200px] flex-1 truncate text-wb-13 text-wb-ntrl-6" title={selected.size ? t("inv.tb_selected", { n: selected.size }) : t("inv.tb_hint")}>
                    {selected.size ? t("inv.tb_selected", { n: selected.size }) : t("inv.tb_hint")}
                </p>
                <ViewSettingButton
                    cols={view.cols}
                    defaults={DEFAULT_VIEW}
                    locked={["partner"]}
                    label={(k) => t(`inv.col.${k}`)}
                    onSave={view.save}
                    onReset={view.reset}
                />
                {selected.size > 0 && (
                    <TagMenu
                        ids={Array.from(selected)}
                        trigger={(toggle) => (
                            <Button size="wb-sm" variant="danger" icon={<TagIcon />} onClick={toggle}>
                                {t("inv.tag_n", { n: selected.size })}
                            </Button>
                        )}
                    />
                )}
                <PdfDownloadMenu count={targetCount} disabled={!targetCount} onPick={(mode) => void doPdf(mode)} />
                <Button size="wb-sm" variant="neutral" icon={<FileSpreadsheet />} onClick={doExcel} disabled={!targetCount} title={t("inv.excel_tip")}>
                    {t("inv.excel")} ({targetCount})
                </Button>
                <Button size="wb-sm" variant="neutral" icon={<Download />} onClick={() => void doCqtList()} disabled={!targetCount} title={t("inv.cqt_list_tip")}>
                    {t("inv.cqt_list")}
                </Button>
                <Button size="wb-sm" variant="neutral" icon={<FileArchive />} onClick={doDownload} disabled={!targetCount}>
                    {selected.size ? t("inv.xml_selected", { n: targetCount }) : t("inv.xml_all", { n: targetCount })}
                </Button>
            </div>

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
                    {loading && !pageRows.length && (
                        <div role="status" className="flex items-center justify-center gap-2 py-16 text-wb-13 text-wb-ntrl-6">
                            <span className="size-4 rounded-full border-2 border-brand border-t-transparent wb-spin" />
                            {t("common.loading")}
                        </div>
                    )}
                    {!loading && totalCount === 0 && (
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
                {totalCount > 0 && (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-wb-table-border bg-wb-bg-footer px-4 py-2.5 text-wb-13">
                        <span className="mr-auto font-semibold text-wb-ntrl-8">{t("inv.footer_total", { n: totalCount })}</span>
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
            <Pagination page={page} pageSize={size} pageCount={Math.max(1, Math.ceil(totalCount / size))} totalLabel={t("common.showing", { from: totalCount === 0 ? 0 : (page - 1) * size + 1, to: Math.min(totalCount, page * size), total: totalCount })} onPageChange={setPage} onPageSizeChange={(s) => { setSize(s); setPage(1); }} />

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
            <PdfDownloadDialog job={pdfJob} onClose={closePdfJob} />
            <Modal
                open={!!excelAsk}
                onClose={() => setExcelAsk(null)}
                width={500}
                title={
                    <span className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-wb-warning" />
                        {t("inv.excel_check_title")}
                    </span>
                }
                footer={
                    <>
                        <Button
                            size="md"
                            variant="neutral"
                            onClick={() => {
                                const ask = excelAsk;
                                setExcelAsk(null);
                                if (ask) void writeExcel(ask.ids);
                            }}
                        >
                            {t("inv.excel_now", { n: excelAsk?.missing ?? 0 })}
                        </Button>
                        <Button size="md" variant="primary" icon={<RefreshCcw />} onClick={() => void syncThenExcel()}>
                            {t("inv.excel_sync_full")}
                        </Button>
                    </>
                }
            >
                {excelAsk && (
                    <div className="flex flex-col gap-3 text-wb-13 text-wb-ink" data-testid="excel-ask">
                        <p>{t("inv.excel_ask_msg", { n: excelAsk.missing })}</p>
                        <div className="rounded-lg border border-wb-border-sidebar bg-wb-bg-sidebar px-3 py-2">
                            <p className="text-wb-12 text-wb-ntrl-6">{t("inv.excel_ask_state")}</p>
                            <p>
                                <b className="text-wb-status-approved-text">{excelAsk.withXml}</b> {t("inv.excel_ask_ok")} · <b className="text-wb-warn-text">{excelAsk.missing}</b> {t("inv.excel_ask_missing")}
                            </p>
                        </div>
                        <p className="text-wb-12 text-wb-ntrl-6">{t("inv.excel_ask_eta", { m: Math.max(1, Math.ceil((excelAsk.missing * 1.5) / 60)) })}</p>
                    </div>
                )}
            </Modal>
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
                                        // Provider only — no "Mở hoá đơn gốc: <url>" line (docs/issues/weinvoice-provider-pill-tooltip-hide-url-2026-11-18.md)
                                        title={`${prov?.fullName ?? inv.provider}${prov ? ` · ${t("common.mst")} ${prov.taxId}` : ""}`}
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
