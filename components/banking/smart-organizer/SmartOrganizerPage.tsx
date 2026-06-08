"use client";

import { Settings2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import InteractiveDateRangePicker from "@/components/shared/InteractiveDateRangePicker";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import { useDialog } from "@/components/shared/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { formatAmount } from "@/lib/currency";
import { ApiCallError } from "@/lib/api/banking";
import {
    confirmEligibleTransactions,
    fetchEligibleTransactions,
    type ApiEligibleTransactionRow,
} from "@/lib/api/smartOrganizer";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";

import OrganizerSettingsDialog from "./OrganizerSettingsDialog";

/**
 * Banking > Transaction History > Smart Organizer — detail view (NOT
 * a top-level menu). Refactor port of legacy `fnsh_0200_001`. Lists
 * rule-matched, unconfirmed bank transactions across every account
 * in the tenant; the user reviews the auto-populated suggestions and
 * confirms them via Save. The Organizer Settings dialog lives behind
 * the toolbar Settings button.
 *
 * Layout follows the live JEX screenshot:
 *
 *   Header row:  [breadcrumb title]                  [Back button]
 *   Filter row:  [from-date] → [to-date] [cal-icon]  [Search]  [Organizer Settings]
 *   Table:       checkbox + 9 data columns split into
 *                "Bank Transaction Data" / "Confirmation" sections,
 *                with sort arrows on every column header
 *   Empty:       centred wand glyph + "Go to Organizer Settings" CTA
 *   Footer:      pagination (page-size + 0 of 0 + arrows)
 */
export default function SmartOrganizerPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const dialog = useDialog();

    // R11 — Smart Organizer is scoped to the account selected in Transaction
    // History, carried as `?account=<bankCd>_<acctNo>`. Without it the page
    // cannot run an account-scoped query and must NOT fall back to a
    // tenant-wide listing. Read via window.location (not useSearchParams) so
    // the page stays prerenderable without a Suspense boundary — same
    // convention as ApprovalBoxPage's deep-link gate.
    const [accountParam, setAccountParam] = useState<string | null>(null);
    useEffect(() => {
        if (typeof window === "undefined") return;
        setAccountParam(new URLSearchParams(window.location.search).get("account"));
    }, []);
    const account = useMemo(() => {
        if (!accountParam) return null;
        const sep = accountParam.indexOf("_");
        if (sep <= 0 || sep === accountParam.length - 1) return null;
        return { bankCd: accountParam.slice(0, sep), acctNo: accountParam.slice(sep + 1) };
    }, [accountParam]);

    const initialRange = useMemo(defaultDateRange, []);
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);
    const [search, setSearch] = useState("");
    const [rows, setRows] = useState<ApiEligibleTransactionRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const reqCounterRef = useRef(0);

    const sort = useTableSort();

    /* Sticky mirror of the in-flight gate. The Smart Organizer fetch
     * fires on first paint and on every date / search / sort / refresh
     * change; sticky-wrapping holds the centered "Loading…" body row
     * (and suppresses the empty-state guide) for the minimum-visibility
     * window so a fast cached response doesn't flash loading → empty
     * → table in under a perceptual frame. */
    const stickyLoading = useStickyLoading(loading);

    // ---- fetch eligible rows ------------------------------------------
    useEffect(() => {
        // R11 — no account in the URL ⇒ no account-scoped query is possible.
        // Show the empty state rather than ever listing tenant-wide.
        if (!account) {
            setRows([]);
            setTotalCount(0);
            setLoading(false);
            return;
        }
        const reqId = ++reqCounterRef.current;
        let cancelled = false;
        setLoading(true);
        fetchEligibleTransactions({
            bankCd: account.bankCd,
            acctNo: account.acctNo,
            fromDt: toWireDate(startDate),
            toDt: toWireDate(endDate),
            keyword: search.trim() || undefined,
            sortField: sort.sortField ?? undefined,
            sortDirection: sort.sortDirection ?? undefined,
            page: 1,
            size: 100,
        })
            .then((res) => {
                if (cancelled || reqId !== reqCounterRef.current) return;
                setRows(res.rows ?? []);
                setTotalCount(res.total_count ?? 0);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled || reqId !== reqCounterRef.current) return;
                setLoading(false);
                if (err instanceof ApiCallError) {
                    setRows([]);
                    setTotalCount(0);
                }
            });
        return () => { cancelled = true; };
    }, [account, startDate, endDate, search, sort.sortField, sort.sortDirection, refreshKey]);

    // ---- pagination ---------------------------------------------------
    const pg = usePagination<ApiEligibleTransactionRow>({ items: rows });

    // ---- selection ----------------------------------------------------
    const toggleRow = (acctSeqNo: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(acctSeqNo)) next.delete(acctSeqNo);
            else next.add(acctSeqNo);
            return next;
        });
    };

    const allSelected = rows.length > 0 && selected.size === rows.length;
    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(rows.map((r) => r.acct_seq_no)));
    };

    // ---- save (confirm) -----------------------------------------------
    const [saving, setSaving] = useState(false);
    /* Sticky mirror of `saving` — keeps the Save / Cancel pair
     * visibly disabled across the minimum-visibility window so a fast
     * confirm-batch resolution doesn't flicker the buttons. The
     * functional guard (`saving`) inside `handleSave` still blocks
     * the duplicate request. */
    const stickySaving = useStickyLoading(saving);
    const handleSave = async () => {
        if (selected.size === 0 || !account) return;
        setSaving(true);
        try {
            const payloadRows = rows
                .filter((r) => selected.has(r.acct_seq_no))
                .map((r) => ({
                    acct_seq_no: r.acct_seq_no,
                    use_usag_cd: r.use_usag_cd ?? undefined,
                    vas_acct_seq_no: r.vas_acct_seq_no ?? undefined,
                    trco_key: r.trco_key ?? undefined,
                    chart_acct_cd: r.chart_acct_cd ?? undefined,
                    chart_acct_seq_no: r.chart_acct_seq_no ?? undefined,
                }));
            const res = await confirmEligibleTransactions({
                bank_cd: account.bankCd,
                acct_no: account.acctNo,
                rows: payloadRows,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("smart_organizer_page.confirm_success", {
                    count: String(res.confirmed_count),
                }),
            });
            setSelected(new Set());
            setRefreshKey((k) => k + 1);
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "UNKNOWN";
            const message = err instanceof ApiCallError ? err.message : String(err);
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const hasRows = rows.length > 0;

    return (
        <>
            <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 md:px-6">
                {/* Breadcrumb title + Back button */}
                <div className="flex shrink-0 items-center justify-between gap-4 pt-4 md:pt-6">
                    <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("smart_organizer_page.breadcrumb")}
                    </h1>
                    <button
                        type="button"
                        onClick={handleBack}
                        className="flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        <span className="text-wb-13">‹</span>
                        <span>{t("common.back")}</span>
                    </button>
                </div>

                {/* Filter row */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                    <InteractiveDateRangePicker
                        startIso={startDate}
                        endIso={endDate}
                        onChange={(range) => {
                            setStartDate(range.start);
                            setEndDate(range.end);
                        }}
                    />
                    <div className="flex items-center gap-2">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder={t("common.search")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            className="flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-wb-bg-card"
                        >
                            <Settings2 className="size-4 shrink-0" strokeWidth={1.8} />
                            <span className="whitespace-nowrap">
                                {t("smart_organizer_page.organizer_settings")}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Table area */}
                <div className="flex min-h-0 flex-1 flex-col gap-3 pb-3">
                    <div className="custom-scrollbar min-h-0 flex-1 overflow-auto rounded-md border border-wb-table-border bg-white">
                        {/* Inner flex column — lets the empty-state sibling
                           expand via `flex-1` so the guide block centers in
                           the body area below the header, mirroring ERP
                           Transaction History (Settings). */}
                        <div className="flex h-full flex-col">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                {/* Section header row */}
                                <tr className="border-b border-wb-table-border">
                                    <th className="w-10 px-2.5 py-2 text-left" rowSpan={2}>
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={toggleAll}
                                            disabled={!hasRows}
                                            className="size-[var(--size-wb-icon-sm)]"
                                        />
                                    </th>
                                    <th
                                        colSpan={5}
                                        className="border-r border-wb-table-border px-2.5 py-2 text-center text-wb-13 font-semibold text-wb-dark"
                                    >
                                        {t("smart_organizer_page.section.bank_transaction_data")}
                                    </th>
                                    <th
                                        colSpan={4}
                                        className="px-2.5 py-2 text-center text-wb-13 font-semibold text-wb-dark"
                                    >
                                        {t("smart_organizer_page.section.confirmation")}
                                    </th>
                                </tr>
                                {/* Column headers with sort */}
                                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                                    <TableHeaderCell
                                        sortFieldId="TRSC_DT"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.date")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="ACCT_NO"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.account_no")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="IN_AMT"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        align="right"
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.deposit")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="OUT_AMT"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        align="right"
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.withdrawal")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="RMRK"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.remarks")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="CHART_ACCT_CD"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.reporting_account")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="USE_USAG_CD"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.purpose")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="VAS_ACCT_SEQ_NO"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.vas_account")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        sortFieldId="TRCO_KEY"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                        sortable
                                        textSizeClass="text-wb-13"
                                    >
                                        {t("smart_organizer_page.col.contact")}
                                    </TableHeaderCell>
                                </tr>
                            </thead>
                            <tbody>
                                {stickyLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-2.5 py-8 text-center text-wb-13 text-wb-muted">
                                            {t("common.loading")}
                                        </td>
                                    </tr>
                                ) : !hasRows ? null : (
                                    pg.paged.map((r) => {
                                        const sel = selected.has(r.acct_seq_no);
                                        return (
                                            <tr
                                                key={r.acct_seq_no}
                                                className={
                                                    "h-[var(--h-wb-table-row)] border-b border-wb-table-border hover:bg-black/[0.02] " +
                                                    (sel ? "bg-[#EBF5FF]" : "")
                                                }
                                            >
                                                <td className="px-2.5 py-2.5 align-middle">
                                                    <Checkbox
                                                        checked={sel}
                                                        onCheckedChange={() => toggleRow(r.acct_seq_no)}
                                                        className="size-[var(--size-wb-icon-sm)]"
                                                    />
                                                </td>
                                                <Td>{formatDtIso(r.trsc_dt)}</Td>
                                                <Td>{r.acct_no ?? "—"}</Td>
                                                {/* R06 — format by the account's real currency (VND + FCY), never raw. */}
                                                <Td align="right">
                                                    {r.in_amt != null
                                                        ? formatAmount(r.in_amt, r.ccy_cd ?? "VND", true)
                                                        : ""}
                                                </Td>
                                                <Td align="right">
                                                    {r.out_amt != null
                                                        ? formatAmount(r.out_amt, r.ccy_cd ?? "VND", true)
                                                        : ""}
                                                </Td>
                                                <Td>{r.rmrk ?? ""}</Td>
                                                {/* R07 — display names, falling back to the code while a lookup is unresolved. */}
                                                <Td>{r.chart_acct_nm ?? r.chart_acct_cd ?? "—"}</Td>
                                                <Td>{r.disp_usag_nm ?? r.use_usag_cd ?? "—"}</Td>
                                                <Td>{r.disp_vas_acct_nm ?? r.vas_acct_seq_no?.toString() ?? "—"}</Td>
                                                <Td>{r.disp_trco_nm ?? r.trco_key ?? "—"}</Td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        {!stickyLoading && !hasRows && (
                            <div className="flex flex-1 items-center justify-center">
                                <EmptyState onSettings={() => setShowSettings(true)} />
                            </div>
                        )}
                        </div>
                    </div>

                    {/* Save / Cancel bar — only when selection exists */}
                    {selected.size > 0 && (
                        <div className="flex shrink-0 items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                disabled={stickySaving}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("dialog.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={stickySaving}
                                aria-busy={stickySaving || undefined}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-13 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("smart_organizer_page.save", { count: String(selected.size) })}
                            </button>
                        </div>
                    )}

                    {/* Pagination footer — always rendered (shows "0 of 0" when empty) */}
                    <Pagination
                        page={pg.page}
                        pageCount={Math.max(1, pg.pageCount)}
                        pageSize={pg.pageSize}
                        onPageChange={pg.setPage}
                        onPageSizeChange={pg.setPageSize}
                        totalLabel={t("common.showing_of", {
                            shown: String(pg.counts.shown),
                            total: String(totalCount || pg.counts.total),
                        })}
                        className="shrink-0"
                    />
                </div>
            </div>

            {showSettings && (
                <OrganizerSettingsDialog
                    onClose={() => setShowSettings(false)}
                    onChanged={() => setRefreshKey((k) => k + 1)}
                />
            )}
        </>
    );
}

function Td({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}) {
    return (
        <td
            className={
                "px-2.5 py-2.5 align-middle text-wb-13 font-medium text-wb-ink " +
                (align === "right" ? "text-right" : "text-left")
            }
        >
            {children}
        </td>
    );
}

function EmptyState({ onSettings }: { onSettings: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Wand2 className="size-12 text-brand" strokeWidth={1.5} />
            <p className="max-w-md text-center text-wb-13 text-wb-muted">
                {t("smart_organizer_page.empty_description")}
            </p>
            <button
                type="button"
                onClick={onSettings}
                className="flex h-9 cursor-pointer items-center justify-center rounded-md bg-brand px-4 text-wb-13 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
            >
                {t("smart_organizer_page.go_to_organizer_settings")}
            </button>
        </div>
    );
}

function defaultDateRange(): { start: string; end: string } {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { start: toIso(start), end: toIso(end) };
}

function toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function toWireDate(iso: string): string {
    return iso.replaceAll("-", "");
}

/** Format a `yyyymmdd` wire date as `YYYY-MM-DD` for table cells. */
function formatDtIso(yyyymmdd: string): string {
    if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? "";
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}
