"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    fetchLinkableEInvoices,
    fetchLinkableReceipts,
    linkCardExpenses,
} from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import PaymentPeriodDropdown, {
    type ManualDateRange,
    type PeriodKey,
    yyyymmddToday,
} from "@/components/payment/shared/PaymentPeriodDropdown";
import { useDialog } from "@/components/shared/dialog";
import { formatAmount } from "@/lib/currency";
import { formatDateLang } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type {
    ApiLinkableEInvoiceRow,
    ApiLinkableReceiptRow,
} from "@/lib/types/api";
import { cn } from "@/lib/utils";

import NewReceiptDialog from "./NewReceiptDialog";
import type { CardTransaction } from "./cardTransactionMappers";

/* ============================================================================
 *  "Link Card Payments with the Expenses" popup — mirrors legacy
 *  {@code card_0001_002}. Opens from the Link Reference cell on the Card
 *  Transactions table (legacy {@code card_0001_001.ts:533-542}).
 *
 *  Two tabs:
 *   1. **Expenses e-Invoice** — list of GDT e-invoices (legacy `r001`)
 *   2. **Receipt** — list of manually-registered receipts (legacy `r002`)
 *      plus a "New Receipt" button that opens {@link NewReceiptDialog}
 *      (legacy `prch_0011_001`).
 *
 *  Static UI scope this MR — both tables show "No Data Found" until the
 *  backend `card-transactions/links/e-invoices` and `.../receipts`
 *  endpoints land. Link / Unlink wire-paths + amount-matching
 *  validation (legacy `comm_0192_004_d001` `c001` `WBE0001`) follow in a
 *  later MR.
 * ========================================================================== */

type LinkCardPaymentsDialogProps = {
    /** The card transaction whose Link Reference cell was clicked. */
    row:         CardTransaction;
    onClose:     () => void;
    /** Fires after a successful link write — the parent refreshes the
     *  Card Transactions list so the Link Reference cell reflects the
     *  new linked state. */
    onLinked?:   () => void;
};

type LinkTab = "expenses" | "receipt";

export default function LinkCardPaymentsDialog({
    row,
    onClose,
    onLinked,
}: LinkCardPaymentsDialogProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();

    const [activeTab, setActiveTab]   = useState<LinkTab>("expenses");
    const [search, setSearch]         = useState("");
    /** Period filter — three presets ("30d" / "90d" / "180d") plus
     *  "manual" which opens an inline popover with two
     *  {@code <DateField>} chips. Backed by the shared
     *  {@code <PaymentPeriodDropdown>} so the chrome stays identical
     *  to every other Payment list filter row. Mirrors legacy
     *  {@code card_0001_002_view.jsp:240-274}. */
    const [period, setPeriod] = useState<PeriodKey>("30d");
    const [manualRange, setManualRange] = useState<ManualDateRange | undefined>(undefined);
    const [newReceiptOpen, setNewReceiptOpen] = useState(false);
    /** Bumped after every successful New Receipt save so the
     *  receipts-tab `useApiData` re-runs and the new row appears. */
    const [refreshKey, setRefreshKey] = useState(0);
    /** Selected e-invoice `doc_id`s on the Expenses tab. Cleared on tab
     *  switch + date / search change so the Save button never carries a
     *  stale pick. */
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(() => new Set());

    // Compute the [from, to] yyyyMMdd window. Presets walk back N days
    // from today; "manual" uses the user-picked range from the shared
    // dropdown's inline popover.
    const { fromDt, toDt } = useMemo(() => {
        if (period === "manual" && manualRange) {
            return { fromDt: manualRange.fromDate, toDt: manualRange.toDate };
        }
        const days = period === "30d" ? 30 : period === "90d" ? 90 : 180;
        const now  = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - days);
        return { fromDt: toYmd(from), toDt: yyyymmddToday() };
    }, [period, manualRange]);

    // Fetch e-invoices / receipts based on the active tab. `useApiData`
    // keeps the previous payload visible during refetches
    // (stale-while-revalidate), so changing the period or typing in the
    // search box doesn't blank the table.
    const expensesState = useApiData(
        () => activeTab === "expenses"
            ? fetchLinkableEInvoices({ fromDt, toDt, search })
            : Promise.resolve(null),
        [activeTab, fromDt, toDt, search, refreshKey],
    );
    const expenses = expensesState.data?.rows ?? [];

    const receiptsState = useApiData(
        () => activeTab === "receipt"
            ? fetchLinkableReceipts({ fromDt, toDt, search })
            : Promise.resolve(null),
        [activeTab, fromDt, toDt, search, refreshKey],
    );
    const receipts = receiptsState.data?.rows ?? [];

    // Wipe selection whenever the visible result set changes (tab
    // switch, filter, search) so we never carry a stale doc_id.
    const activeRows = activeTab === "expenses" ? expenses : receipts;
    const activeKey = (activeTab === "expenses" ? expensesState.data : receiptsState.data)
        ? activeRows.map((r) => r.doc_id).join(",")
        : `${activeTab}::empty`;
    const lastActiveKey = useMemo(() => ({ current: "" }), []);
    if (lastActiveKey.current !== activeKey) {
        lastActiveKey.current = activeKey;
        if (selectedDocIds.size > 0) setSelectedDocIds(new Set());
    }

    const selectedCount = selectedDocIds.size;
    const [submitting, setSubmitting] = useState(false);
    const canLink = selectedCount > 0 && !submitting;

    // Sum the picked rows' amounts. The backend re-checks this against
    // the card's TRSC_AMT and rejects with WBE_LINK_AMOUNT_MISMATCH on
    // any drift; we precompute here so we can validate locally too.
    const pickedAmtSum = activeRows
        .filter((r) => selectedDocIds.has(r.doc_id))
        .reduce((acc, r) => acc + Number(r.totl_amt || 0), 0);

    const handleLink = async () => {
        const picks = activeRows.filter((r) => selectedDocIds.has(r.doc_id));
        if (picks.length === 0) return;

        const trscAmt = Number(row.trscAmtRaw ?? 0);
        if (Math.abs(pickedAmtSum - trscAmt) > 0.0001) {
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: t("payment.card.link.error.amount_mismatch", {
                    sum:    pickedAmtSum.toLocaleString("vi-VN"),
                    target: trscAmt.toLocaleString("vi-VN"),
                }),
                errorCode:   "WBE_LINK_AMOUNT_MISMATCH",
            });
            return;
        }

        setSubmitting(true);
        try {
            await linkCardExpenses({
                card_seq_no: row.cardSeqNo,
                items: picks.map((p) => ({
                    doc_id:   p.doc_id,
                    dedu_amt: String(p.totl_amt),
                })),
            });
            // Refresh the underlying card list (Link Reference cell
            // repaints with the new linked badge) and the picker's
            // own list (linked docs disappear). The success dialog
            // stays open until the user clicks OK — clicking OK
            // closes this Link popup too (legacy
            // `card_0001_002.ts:417` parity, but deferred so the
            // user reads the message first).
            onLinked?.();
            setRefreshKey((k) => k + 1);
            setSelectedDocIds(new Set());
            sysDialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description: t("payment.card.link.success"),
                onConfirm:   onClose,
            });
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("payment.card.link.error.generic");
            sysDialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: message,
                errorCode:   code,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const toggleExpense = (docId: string) => {
        setSelectedDocIds((prev) => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId);
            else                 next.add(docId);
            return next;
        });
    };

    return (
        <>
            <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
                <DialogContent
                    className="flex h-[770px] w-[min(1080px,calc(100vw-32px))] max-w-none flex-col p-0"
                    aria-describedby={undefined}
                    /* Disable outside-click dismiss — the `useDialog()`
                       system success / error popup portals outside this
                       dialog's Radix tree, so a click on its OK button
                       registers as an "outside click" and unmounts this
                       popup. Users close this popup explicitly via the
                       X button or ESC. */
                    closeOnOutsideClick={false}
                >
                    <DialogTitle className="border-b border-wb-table-border px-6 py-4 text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                        {t("payment.card.link.title")}
                    </DialogTitle>

                    {/* Tab strip — legacy `card_0001_002_view.jsp:188-197` */}
                    <div className="border-b border-wb-table-border px-6">
                        <div className="flex items-center gap-6">
                            <TabButton
                                active={activeTab === "expenses"}
                                onClick={() => setActiveTab("expenses")}
                            >
                                {t("payment.card.link.tab.expenses")}
                            </TabButton>
                            <TabButton
                                active={activeTab === "receipt"}
                                onClick={() => setActiveTab("receipt")}
                            >
                                {t("payment.card.link.tab.receipt")}
                            </TabButton>
                        </div>
                    </div>

                    {/* Filter row — period dropdown + search + per-tab CTAs */}
                    <div className="flex items-center justify-between gap-3 border-b border-wb-table-border px-6 py-3">
                        <div className="flex items-center gap-2">
                            {/* Period dropdown — shared `<PaymentPeriodDropdown>`
                                so the chrome reads identical to every other
                                Payment filter row. Four options; "Enter
                                Manually" opens an inline popover with the
                                From / To DateField pair + Cancel / Save.
                                Mirrors legacy `card_0001_002_view.jsp:240-274`. */}
                            <PaymentPeriodDropdown
                                period={period}
                                onPeriodChange={setPeriod}
                                manualRange={manualRange}
                                onManualRangeChange={setManualRange}
                            />
                            <div className="relative">
                                <Search
                                    aria-hidden
                                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t("payment.card.link.search_placeholder")}
                                    className="h-8 w-[260px] rounded-md border-0 bg-white pl-9 pr-3 text-wb-13 font-normal text-wb-ink shadow-wb-btn focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {activeTab === "receipt" && (
                                <button
                                    type="button"
                                    onClick={() => setNewReceiptOpen(true)}
                                    className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/3"
                                >
                                    {t("payment.card.link.new_receipt")}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleLink}
                                disabled={!canLink}
                                className={cn(
                                    "flex h-8 items-center justify-center rounded-md px-3 text-wb-13 font-medium",
                                    canLink
                                        ? "cursor-pointer bg-brand text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                        : "cursor-not-allowed bg-wb-ntrl-4 text-white",
                                )}
                            >
                                {submitting
                                    ? t("common.loading")
                                    : activeTab === "expenses"
                                        ? t("payment.card.link.link_einvoice")
                                        : t("payment.card.link.link_receipt")}
                            </button>
                        </div>
                    </div>

                    {/* Table body — switches per tab. */}
                    <div className="custom-scrollbar flex-1 overflow-auto">
                        {activeTab === "expenses" ? (
                            <ExpensesTable
                                rows={expenses}
                                loading={expensesState.loading && expenses.length === 0}
                                selected={selectedDocIds}
                                onToggle={toggleExpense}
                            />
                        ) : (
                            <ReceiptTable
                                rows={receipts}
                                loading={receiptsState.loading && receipts.length === 0}
                                selected={selectedDocIds}
                                onToggle={toggleExpense}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {newReceiptOpen && (
                <NewReceiptDialog
                    onClose={() => setNewReceiptOpen(false)}
                    onCreated={() => {
                        setNewReceiptOpen(false);
                        // Bump the refresh key so the Receipt-tab
                        // `useApiData` re-fetches and the new row
                        // appears in the picker.
                        setRefreshKey((k) => k + 1);
                    }}
                />
            )}
        </>
    );
}

/* ── Tab pill ───────────────────────────────────────────────────── */

function TabButton({
    active,
    onClick,
    children,
}: {
    active:    boolean;
    onClick:   () => void;
    children:  React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "relative cursor-pointer border-0 bg-transparent px-1 py-3 text-wb-14 font-medium",
                active ? "text-brand" : "text-wb-ntrl-8 hover:text-wb-ink",
            )}
        >
            {children}
            {active && (
                <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-brand"
                />
            )}
        </button>
    );
}

/* ── Expenses e-Invoice table — legacy `card_0001_002.ts:534-541` ── */

function ExpensesTable({
    rows,
    loading,
    selected,
    onToggle,
}: {
    rows:     ApiLinkableEInvoiceRow[];
    loading:  boolean;
    selected: ReadonlySet<string>;
    onToggle: (docId: string) => void;
}) {
    const { t, locale } = useTranslation();
    return (
        <table className="w-full text-wb-13">
            <thead className="sticky top-0 z-10 border-b border-wb-table-border bg-wb-bg-sidebar text-wb-dark">
                <tr>
                    <th className="w-10 px-3 py-2.5 text-left font-semibold" />
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.date")}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.einvoice_no")}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.merchant")}</th>
                    <th className="px-3 py-2.5 text-right font-semibold">{t("payment.card.link.col.amount")}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.currency")}</th>
                </tr>
            </thead>
            <tbody>
                {loading && (
                    <tr>
                        <td colSpan={6} className="px-3 py-20 text-center text-wb-13 text-wb-ntrl-6">
                            {t("common.loading")}
                        </td>
                    </tr>
                )}
                {!loading && rows.length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-3 py-20 text-center text-wb-13 text-wb-ntrl-6">
                            {t("payment.card.link.empty")}
                        </td>
                    </tr>
                )}
                {!loading && rows.map((r) => {
                    const isSel = selected.has(r.doc_id);
                    return (
                        <tr
                            key={r.doc_id}
                            onClick={() => onToggle(r.doc_id)}
                            className={cn(
                                "cursor-pointer border-b border-wb-table-border last:border-b-0",
                                isSel ? "bg-brand-soft" : "hover:bg-black/[0.02]",
                            )}
                        >
                            <td className="px-3 py-3">
                                <Checkbox
                                    checked={isSel}
                                    onCheckedChange={() => onToggle(r.doc_id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                {formatIssuDt(r.issu_dt, locale)}
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                <div className="flex flex-col gap-0.5">
                                    <span>{r.disp_doc_id || r.doc_id}</span>
                                    {r.einv_invoicestatus && (
                                        <span className="text-wb-12 font-medium text-wb-status-approved-text">
                                            {localizeEInvStatus(r.einv_invoicestatus, t)}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                <div className="flex flex-col gap-0.5">
                                    <span>{r.merch_nm ?? ""}</span>
                                    {r.merch_tax_id && (
                                        <span className="text-wb-12 font-normal text-wb-ntrl-6">
                                            MST: {r.merch_tax_id}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-3 py-3 text-right text-wb-13 font-medium text-wb-ink">
                                {formatAmount(r.totl_amt, r.ccy_cd ?? "VND", false)}
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                {r.ccy_cd ?? ""}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/** yyyyMMdd → locale-aware display label (matches the rest of the
 *  Card Transactions page — see `formatDateLang` in `lib/datetime`). */
function formatIssuDt(yyyymmdd: string | null, locale: Locale): string {
    if (!yyyymmdd || yyyymmdd.length !== 8) return "";
    return formatDateLang(yyyymmdd, locale);
}

/** Today / N-days-back helper. Returns `yyyyMMdd`. */
function toYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
}

/**
 * Localize the GDT-supplied {@code EINV_INVOICESTATUS} (Original /
 * Adjustment / Replacement / Cancelled) into the active language. Falls
 * back to the raw GDT string when the value isn't one of the four
 * known constants — keeps the UI robust to any new code GDT might
 * introduce without a frontend bump.
 *
 * Legacy `card_0001_002.ts` left these strings as-is on the wire; the
 * refactor localizes client-side so the same DOM doesn't render
 * "Adjustment" under Korean / Vietnamese locales.
 */
function localizeEInvStatus(raw: string, t: (key: string) => string): string {
    const key = raw.trim().toLowerCase();
    switch (key) {
        case "original":    return t("payment.card.link.einv_status.original");
        case "adjustment":  return t("payment.card.link.einv_status.adjustment");
        case "replacement": return t("payment.card.link.einv_status.replacement");
        case "cancelled":
        case "canceled":    return t("payment.card.link.einv_status.cancelled");
        default:            return raw;
    }
}

/* ── Receipt table — legacy `card_0001_002.ts:766-773` ─────────── */

function ReceiptTable({
    rows,
    loading,
    selected,
    onToggle,
}: {
    rows:     ApiLinkableReceiptRow[];
    loading:  boolean;
    selected: ReadonlySet<string>;
    onToggle: (docId: string) => void;
}) {
    const { t, locale } = useTranslation();
    return (
        <table className="w-full text-wb-13">
            <thead className="sticky top-0 z-10 border-b border-wb-table-border bg-wb-bg-sidebar text-wb-dark">
                <tr>
                    <th className="w-10 px-3 py-2.5 text-left font-semibold" />
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.date")}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.merchant")}</th>
                    <th className="px-3 py-2.5 text-right font-semibold">{t("payment.card.link.col.amount")}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.purpose")}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.description")}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t("payment.card.link.col.payment_method")}</th>
                </tr>
            </thead>
            <tbody>
                {loading && (
                    <tr>
                        <td colSpan={7} className="px-3 py-20 text-center text-wb-13 text-wb-ntrl-6">
                            {t("common.loading")}
                        </td>
                    </tr>
                )}
                {!loading && rows.length === 0 && (
                    <tr>
                        <td colSpan={7} className="px-3 py-20 text-center text-wb-13 text-wb-ntrl-6">
                            {t("payment.card.link.empty")}
                        </td>
                    </tr>
                )}
                {!loading && rows.map((r) => {
                    const isSel = selected.has(r.doc_id);
                    return (
                        <tr
                            key={r.doc_id}
                            onClick={() => onToggle(r.doc_id)}
                            className={cn(
                                "cursor-pointer border-b border-wb-table-border last:border-b-0",
                                isSel ? "bg-brand-soft" : "hover:bg-black/[0.02]",
                            )}
                        >
                            <td className="px-3 py-3">
                                <Checkbox
                                    checked={isSel}
                                    onCheckedChange={() => onToggle(r.doc_id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                {formatIssuDt(r.use_dt, locale)}
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                {r.merch_nm ?? ""}
                            </td>
                            <td className="px-3 py-3 text-right text-wb-13 font-medium text-wb-ink">
                                {formatAmount(r.totl_amt, r.ccy_cd ?? "VND", false)}
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                {r.purpose ?? ""}
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ink">
                                {r.description ?? ""}
                            </td>
                            <td className="px-3 py-3 text-wb-13 font-medium text-wb-ntrl-6">
                                {/* Phase B — receipts don't carry a payment-method
                                    column on BUSA_DOC_MSTR; the legacy r002 query
                                    leaves this blank too (it lives on a JOIN that
                                    isn't ported). */}
                                {""}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
