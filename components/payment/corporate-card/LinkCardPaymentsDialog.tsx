"use client";

import { ChevronDown, Paperclip, X } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { matchInvoiceStatus } from "@/lib/api/einvoiceStatus";
import {
    downloadCardReceiptFile,
    fetchLinkableEInvoices,
    fetchLinkableReceipts,
    linkCardExpenses,
} from "@/lib/api/cardTransactions";
import { fetchLoginCredentials } from "@/lib/api/loginCredentials";
import { useApiData } from "@/lib/api/useApiData";
import {
    type ManualDateRange,
    type PeriodKey,
    isoFromYyyymmdd,
    yyyymmddFromIso,
    yyyymmddToday,
} from "@/components/payment/shared/PaymentPeriodDropdown";
import DateRangeFilter, {
    type DateRangeFilterPreset,
    type DateRangeFilterValue,
} from "@/components/shared/DateRangeFilter";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import SearchInput from "@/components/shared/SearchInput";
import GdtAccountManagementDialog from "@/components/shared/popups/GdtAccountManagementDialog";
import { useDialog } from "@/components/shared/dialog";
import { formatAmount } from "@/lib/currency";
import { formatDateLang } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type {
    ApiLinkableEInvoiceRow,
    ApiLinkableReceiptRow,
    ApiReceiptFileRow,
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
 *  UI mirrors Figma 4664:23299 — header with the Esc chip + close icon,
 *  the tab strip, the period dropdown + calendar + search toolbar, the
 *  per-tab CTAs, and the GDT-setup empty state on the Expenses tab when
 *  no GDT login credential is registered. Data wiring (link / unlink /
 *  amount-matching) is unchanged from the existing implementation.
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
    const { t, locale } = useTranslation();
    const sysDialog = useDialog();

    const [activeTab, setActiveTab]   = useState<LinkTab>("expenses");
    /** GDT "Account Management" dialog — opened directly from the
     *  Expenses-tab setup empty state's CTA. No SettingsModal is
     *  involved; the shared {@link GdtAccountManagementDialog} owns the
     *  same save/validation flow the Settings panel uses. */
    const [gdtDialogOpen, setGdtDialogOpen] = useState(false);
    const [search, setSearch]         = useState("");
    /** Period filter — three presets ("30d" / "90d" / "180d") plus
     *  "manual" which opens the shared range picker. Backed by the shared
     *  {@code <DateRangeFilter>} so the chrome (period dropdown + calendar
     *  trigger) reads identical to every other Payment / Add-on filter
     *  row. Mirrors legacy {@code card_0001_002_view.jsp:240-274}. */
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

    // GDT-credential presence — drives the Expenses tab's empty state.
    // The Expenses e-Invoice list is sourced from GDT-synced bills; when
    // no GDT login is registered the list can only ever be empty, so the
    // popup shows the "set up your GDT login" prompt instead of the plain
    // "No Data Found" (legacy `card_0001_002` behaviour). Read-only reuse
    // of the existing Login Credentials list endpoint — no backend change.
    // `refreshKey` bumps after a successful GDT save so this re-fetches
    // and the empty state flips from "set up GDT" to the normal list.
    const gdtState = useApiData(() => fetchLoginCredentials(), [refreshKey]);
    const gdtConfigured: boolean | null = gdtState.data
        ? gdtState.data.items.some((g) => g.type === "GDT")
        : null;

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
                    sum:    formatAmount(pickedAmtSum, row.ccyCd ?? "VND", false),
                    target: formatAmount(trscAmt, row.ccyCd ?? "VND", false),
                }),
                errorCode:   "WBE_LINK_AMOUNT_MISMATCH",
            });
            return;
        }

        // L2 — pre-check that every picked document's currency matches the
        // card currency. When either side is blank the check is skipped (the
        // backend applies the same "only reject a concrete mismatch" rule);
        // the server re-validates and rejects with WBE_LINK_CURRENCY_MISMATCH.
        const cardCcy = (row.ccyCd ?? "").trim().toUpperCase();
        if (cardCcy !== "") {
            const mismatch = picks.find((p) => {
                const docCcy = (p.ccy_cd ?? "").trim().toUpperCase();
                return docCcy !== "" && docCcy !== cardCcy;
            });
            if (mismatch) {
                sysDialog.open({
                    type:        "error",
                    title:       t("dialog.error"),
                    description: t("payment.card.link.error.currency_mismatch", {
                        docCurrency:  (mismatch.ccy_cd ?? "").trim().toUpperCase(),
                        cardCurrency: cardCcy,
                    }),
                    errorCode:   "WBE_LINK_CURRENCY_MISMATCH",
                });
                return;
            }
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

    /** Open the GDT "Account Management" dialog directly on top of this
     *  popup — no Settings modal. Backs the "Go to GDT Login Info Setting"
     *  button on the Expenses-tab setup empty state. Reuses the shared
     *  {@link GdtAccountManagementDialog} (same component + save flow the
     *  Settings panel uses). */
    const handleGoToGdt = () => {
        setGdtDialogOpen(true);
    };

    // Adapt the popup's `period` / `manualRange` state to the shared
    // `<DateRangeFilter>` value shape. The parent keeps `period` /
    // `manualRange` as the source of truth (so the `fromDt` / `toDt`
    // window logic above is untouched); this only maps between the two
    // representations for the shared control.
    const dateRangeValue: DateRangeFilterValue =
        period === "manual" && manualRange
            ? {
                  mode:   "manual",
                  preset: periodToPreset(period),
                  start:  isoFromYyyymmdd(manualRange.fromDate),
                  end:    isoFromYyyymmdd(manualRange.toDate),
              }
            : { mode: "preset", preset: periodToPreset(period), start: "", end: "" };

    return (
        <>
            <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
                <DialogContent
                    /* Standard WeCMS modal height — reuses the Settings shell's
                       shared size token (`--w-wb-settings-card-h` = 760px, the
                       height every Level-2 dialog uses: Settings, Approval Line,
                       Contacts, Chart of Accounts, Purpose). Width stays the
                       Figma 4664:23299 width. Both viewport-capped (the primitive
                       keeps max-h-[calc(100vh-32px)]) and centered by the primitive. */
                    className="flex h-[var(--w-wb-settings-card-h)] w-[min(1077px,calc(100vw-32px))] max-w-none flex-col p-0"
                    aria-describedby={undefined}
                    /* Own header renders the Esc chip + close icon (Figma
                       4664:23302) so the default X is suppressed. */
                    hideClose
                    /* Disable outside-click dismiss — the `useDialog()`
                       system success / error popup portals outside this
                       dialog's Radix tree, so a click on its OK button
                       registers as an "outside click" and unmounts this
                       popup. Users close this popup explicitly via the
                       X button or ESC. */
                    closeOnOutsideClick={false}
                >
                    {/* Header — title left, Esc chip + close right (Figma 4664:23300). */}
                    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-wb-table-border p-5">
                        <DialogTitle className="min-w-0 flex-1 truncate text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                            {t("payment.card.link.title")}
                        </DialogTitle>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded bg-wb-ntrl-3 px-1 py-px text-wb-13 font-medium text-black/40">
                                {t("settings.esc")}
                            </span>
                            <button
                                type="button"
                                aria-label={t("settings.close")}
                                onClick={onClose}
                                className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                            >
                                <X className="size-[18px]" strokeWidth={2} />
                            </button>
                        </div>
                    </div>

                    {/* Body — tab strip, toolbar, table (Figma 4664:23317:
                       px-20 / pt-20 / pb-40 / gap-20). */}
                    <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 pt-5 pb-10">
                        {/* Tab strip — legacy `card_0001_002_view.jsp:188-197` */}
                        <div className="flex shrink-0 items-center border-b border-wb-table-border">
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

                        {/* Toolbar — period dropdown + calendar + search (left), per-tab CTAs (right). */}
                        <div className="flex shrink-0 items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <DateRangeFilter
                                    value={dateRangeValue}
                                    onChange={(next) => {
                                        if (next.mode === "manual") {
                                            if (next.start && next.end) {
                                                setManualRange({
                                                    fromDate: yyyymmddFromIso(next.start),
                                                    toDate:   yyyymmddFromIso(next.end),
                                                });
                                            }
                                            if (period !== "manual") setPeriod("manual");
                                            return;
                                        }
                                        setPeriod(presetToPeriod(next.preset));
                                    }}
                                    presetClassName="w-[136px]"
                                    formatValue={(iso) => formatDateLang(iso.replace(/-/g, ""), locale)}
                                />
                                <SearchInput
                                    value={search}
                                    onChange={setSearch}
                                    placeholder={
                                        activeTab === "expenses"
                                            ? t("payment.card.link.search_placeholder")
                                            : t("payment.card.link.search_placeholder_receipt")
                                    }
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                {activeTab === "receipt" && (
                                    <button
                                        type="button"
                                        onClick={() => setNewReceiptOpen(true)}
                                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                                    >
                                        {t("payment.card.link.new_receipt")}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleLink}
                                    disabled={!canLink}
                                    className={cn(
                                        "flex h-8 items-center justify-center rounded-md px-3 text-wb-14-tight font-medium",
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
                        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                            {activeTab === "expenses" ? (
                                <ExpensesTable
                                    rows={expenses}
                                    /* Wait on the GDT-status lookup too so an
                                       empty result doesn't flash "No Data Found"
                                       before flipping to the setup empty state. */
                                    loading={(expensesState.loading || gdtState.loading) && expenses.length === 0}
                                    gdtConfigured={gdtConfigured}
                                    onGoToGdt={handleGoToGdt}
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

            {/* GDT "Account Management" — opened DIRECTLY from the setup
                empty state's CTA (no SettingsModal). Same shared dialog +
                save/validation flow the Settings > Login Credentials panel
                uses. The setup empty state only renders when GDT is NOT
                configured, so this path always creates a new credential
                (`existingSeqNo={null}`). On success `refreshKey` bumps →
                the GDT-config lookup re-runs → the empty state flips. */}
            {gdtDialogOpen && (
                <GdtAccountManagementDialog
                    existingSeqNo={null}
                    onClose={() => setGdtDialogOpen(false)}
                    onSaved={() => setRefreshKey((k) => k + 1)}
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
                "relative -mb-px cursor-pointer border-0 bg-transparent px-3 py-[11px] text-wb-14 font-medium",
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
    gdtConfigured,
    onGoToGdt,
    selected,
    onToggle,
}: {
    rows:          ApiLinkableEInvoiceRow[];
    loading:       boolean;
    /** `null` while the GDT-credential lookup is in flight, then a
     *  boolean. The setup empty state renders only when this is
     *  explicitly `false`. */
    gdtConfigured: boolean | null;
    onGoToGdt:     () => void;
    selected:      ReadonlySet<string>;
    onToggle:      (docId: string) => void;
}) {
    const { t, locale } = useTranslation();
    const isEmpty = !loading && rows.length === 0;
    return (
        <div className="flex min-h-full flex-col">
            <table className="w-full table-fixed text-wb-13">
                {/* Column widths from Figma 4664:23760 (sum = 1037 = body inner width). */}
                <colgroup>
                    <col className="w-12" />
                    <col className="w-[124px]" />
                    <col className="w-[168px]" />
                    <col className="w-[320px]" />
                    <col className="w-[114px]" />
                    <col className="w-[76px]" />
                    <col />
                </colgroup>
                <thead className="sticky top-0 z-10 border-y border-wb-table-border bg-wb-bg-card text-wb-dark">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold" />
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.date")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.einvoice_no")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.merchant")}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t("payment.card.link.col.amount")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.currency")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.items")}</th>
                    </tr>
                </thead>
                {!loading && rows.length > 0 && (
                    <tbody>
                        {rows.map((r) => {
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
                                    <td className="px-4 py-3 align-top">
                                        <Checkbox
                                            checked={isSel}
                                            onCheckedChange={() => onToggle(r.doc_id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        {formatIssuDt(r.issu_dt, locale)}
                                    </td>
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        <div className="flex flex-col gap-0.5">
                                            {/* Invoice number stays on ONE line (the
                                               status renders as the 2nd line below). */}
                                            <span className="whitespace-nowrap">{r.disp_doc_id || r.doc_id}</span>
                                            {r.einv_invoicestatus && (
                                                <span className={cn("text-wb-12 font-medium", einvStatusColor(r.einv_invoicestatus))}>
                                                    {localizeEInvStatus(r.einv_invoicestatus, t)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <EllipsisTooltip text={r.merch_nm ?? ""} />
                                            {r.merch_tax_id && (
                                                <span className="text-wb-12 font-normal text-wb-ntrl-6">
                                                    MST : {r.merch_tax_id}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top text-right text-wb-13 font-medium text-wb-ink">
                                        {formatAmount(r.totl_amt, r.ccy_cd ?? "VND", false)}
                                    </td>
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        {r.ccy_cd ?? ""}
                                    </td>
                                    {/* Items — one bill can carry one or many GDT
                                        line items (`r.items`, from `BUSA_DOC_DETL`).
                                        1 item → name only; 2+ → first name + dropdown
                                        popup (Figma 7122:26535). Blank when the row
                                        carries no items (never fabricated). */}
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        <ItemsCell items={eInvoiceItemNames(r)} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                )}
            </table>

            {/* Loading / empty states render below the (always-visible) header
                and fill the remaining height so they sit vertically centred —
                mirrors Figma 4664:23762. */}
            {loading && (
                <div className="flex flex-1 items-center justify-center px-4 py-16 text-wb-13 text-wb-ntrl-6">
                    {t("common.loading")}
                </div>
            )}
            {isEmpty && (
                <div className="flex flex-1 items-center justify-center">
                    {gdtConfigured === false ? (
                        <GdtSetupEmptyState onGoToGdt={onGoToGdt} />
                    ) : (
                        <div className="px-4 py-16 text-center text-wb-13 text-wb-ntrl-6">
                            {t("payment.card.link.empty")}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** Normalise a linkable-e-invoice row's optional `items` into a clean
 *  list of non-empty item names. Never invents data — an absent / empty
 *  `items` yields `[]` and the Items cell renders blank. */
function eInvoiceItemNames(r: ApiLinkableEInvoiceRow): string[] {
    if (!Array.isArray(r.items)) return [];
    return r.items.map((s) => (s ?? "").trim()).filter((s) => s.length > 0);
}

/**
 * Items column cell (Expenses e-Invoice tab). One bill can carry one or
 * many GDT line items:
 *   • 0 items → blank cell.
 *   • 1 item  → the name only, no affordance.
 *   • 2+ items → the first name + a dropdown chevron; clicking opens the
 *     floating popup listing every name (Figma 7122:26535).
 *
 * The trigger stops click propagation so opening the popup never toggles
 * the row's selection (row-select logic is unchanged). Only one popup is
 * open at a time — opening another cell's popup dismisses this one via
 * the shared outside-click path.
 */
function ItemsCell({ items }: { items: string[] }) {
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const btnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (document.getElementById("items-popup")?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            // Close only this popup — stop the event before Radix's dialog
            // ESC handler sees it, so the modal itself stays open.
            e.stopPropagation();
            setOpen(false);
        };
        // Any scroll (table body included) / resize detaches the anchor,
        // so close rather than let the popup float away.
        const onReflow = () => setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey, true);
            window.removeEventListener("resize", onReflow);
            window.removeEventListener("scroll", onReflow, true);
        };
    }, [open]);

    if (items.length === 0) return null;

    // Single item — clamp to 2 lines with ellipsis; the shared tooltip
    // surfaces the full name on hover when it overflows (no dropdown
    // affordance for a lone item).
    if (items.length === 1) {
        return <EllipsisTooltip text={items[0]} lines={2} />;
    }

    const toggle = (e: React.MouseEvent) => {
        // Never let the Items affordance toggle the row's checkbox.
        e.stopPropagation();
        if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
        setOpen((o) => !o);
    };

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex w-full cursor-pointer items-start gap-1 text-left"
            >
                {/* First item name — clamp to 2 lines before the ellipsis
                   (matches the single-item cell, which already uses lines={2}). */}
                <span className="line-clamp-2 min-w-0 flex-1">{items[0]}</span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={1.8}
                />
            </button>
            {open && rect && <ItemsPopup items={items} rect={rect} />}
        </>
    );
}

/**
 * Floating list of every item name for a bill. Portalled to `document.body`
 * (the modal's `-translate-*` + `overflow-hidden` would otherwise clip a
 * `position:fixed` child) and anchored to the trigger cell, clamped inside
 * the viewport. Matches Figma 7122:26535: white card, 6px radius, layered
 * shadow, 5px padding, 13/20 medium rows that wrap long names.
 */
function ItemsPopup({ items, rect }: { items: string[]; rect: DOMRect }) {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width, 220), vw - margin * 2);
    let left = rect.left;
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;

    const spaceBelow = vh - rect.bottom;
    const openUp = spaceBelow < 240 && rect.top > spaceBelow;
    const style: CSSProperties = openUp
        ? { position: "fixed", left, bottom: vh - rect.top + 4, width, zIndex: 120 }
        : { position: "fixed", left, top: rect.bottom + 4, width, zIndex: 120 };

    return createPortal(
        <div
            id="items-popup"
            role="listbox"
            style={style}
            /* `pointer-events-auto` re-enables clicks: Radix's modal dialog
               sets `pointer-events:none` on <body>, and this popup portals to
               <body> (outside the dialog layer) to escape the modal's
               `overflow-hidden` + transform clip. */
            className="custom-scrollbar-y pointer-events-auto flex max-h-[320px] flex-col gap-0.5 overflow-auto rounded-md bg-white p-[5px] shadow-[0px_0px_0.5px_rgba(0,0,0,0.22),0px_1px_1px_rgba(0,0,0,0.06),0px_4px_10px_rgba(0,0,0,0.15)]"
        >
            {items.map((name, i) => (
                <div
                    key={`${name}-${i}`}
                    role="option"
                    aria-selected={false}
                    className="break-words rounded-md px-2 py-1.5 text-wb-13 font-medium leading-5 text-wb-ink"
                >
                    {name}
                </div>
            ))}
        </div>,
        document.body,
    );
}

/**
 * Attachment cell (Receipt tab) — paperclip glyph + "(N)" count. Clicking
 * opens a floating dropdown listing every file; each row downloads through
 * the shared authenticated blob helper (audit G3/G5, `BUSA_DOC_FILE`). Mirrors
 * the {@link ItemsCell} portal pattern so the popup escapes the modal's
 * `overflow-hidden` + transform clip. Renders nothing when the doc has no
 * attachments. The trigger stops propagation so opening never toggles the
 * row's selection.
 */
function AttachmentsCell({
    docId,
    count,
    files,
}: {
    docId: string;
    count: number;
    files: ApiReceiptFileRow[];
}) {
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const btnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (document.getElementById("attachments-popup")?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            setOpen(false);
        };
        const onReflow = () => setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey, true);
            window.removeEventListener("resize", onReflow);
            window.removeEventListener("scroll", onReflow, true);
        };
    }, [open]);

    if (count <= 0) return null;

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation(); // never toggle the row's checkbox
        if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
        setOpen((o) => !o);
    };

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex cursor-pointer items-center gap-1 text-brand"
            >
                <Paperclip aria-hidden className="size-4 shrink-0 -rotate-45" strokeWidth={1.8} />
                <span className="text-wb-13 font-medium">({count})</span>
            </button>
            {open && rect && files.length > 0 && (
                <AttachmentsPopup docId={docId} files={files} rect={rect} onDownloaded={() => setOpen(false)} />
            )}
        </>
    );
}

/** Floating list of a document's attachments. Portalled to `document.body`
 *  (same reason as {@link ItemsPopup}); each row is a download button. */
function AttachmentsPopup({
    docId,
    files,
    rect,
    onDownloaded,
}: {
    docId: string;
    files: ApiReceiptFileRow[];
    rect: DOMRect;
    onDownloaded: () => void;
}) {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width, 220), vw - margin * 2);
    let left = rect.right - width; // right-align to the paperclip
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;

    const spaceBelow = vh - rect.bottom;
    const openUp = spaceBelow < 240 && rect.top > spaceBelow;
    const style: CSSProperties = openUp
        ? { position: "fixed", left, bottom: vh - rect.top + 4, width, zIndex: 120 }
        : { position: "fixed", left, top: rect.bottom + 4, width, zIndex: 120 };

    const onDownload = (e: React.MouseEvent, f: ApiReceiptFileRow) => {
        e.stopPropagation();
        // Fire-and-forget; the shared helper surfaces its own errors.
        void downloadCardReceiptFile(docId, f.file_id, f.org_file_nm ?? f.file_id);
        onDownloaded();
    };

    return createPortal(
        <div
            id="attachments-popup"
            role="listbox"
            style={style}
            className="custom-scrollbar-y pointer-events-auto flex max-h-[320px] flex-col gap-0.5 overflow-auto rounded-md bg-white p-[5px] shadow-[0px_0px_0.5px_rgba(0,0,0,0.22),0px_1px_1px_rgba(0,0,0,0.06),0px_4px_10px_rgba(0,0,0,0.15)]"
        >
            {files.map((f) => (
                <button
                    key={f.file_id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={(e) => onDownload(e, f)}
                    className="flex cursor-pointer items-center gap-2 break-words rounded-md px-2 py-1.5 text-left text-wb-13 font-medium leading-5 text-wb-ink hover:bg-black/[0.04]"
                >
                    <Paperclip aria-hidden className="size-3.5 shrink-0 -rotate-45 text-wb-ntrl-6" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1 break-words">{f.org_file_nm ?? f.file_id}</span>
                </button>
            ))}
        </div>,
        document.body,
    );
}

/** GDT-setup empty state (Figma 4664:23762) — shown on the Expenses
 *  e-Invoice tab when no GDT login credential is registered. */
function GdtSetupEmptyState({ onGoToGdt }: { onGoToGdt: () => void }) {
    const { t } = useTranslation();
    return (
        // Figma 4664:23762 — gap-24 between the illustration block and the CTA,
        // gap-40 between the gear and the message; message 16/semibold, 24px leading.
        <div className="flex flex-col items-center gap-6 px-4">
            <div className="flex flex-col items-center gap-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/payment/ico-gear.svg"
                    alt=""
                    aria-hidden
                    className="size-24"
                />
                <p className="max-w-[520px] text-center text-wb-16 font-semibold leading-6 text-wb-ink">
                    {t("payment.card.link.gdt_setup_message")}
                </p>
            </div>
            <button
                type="button"
                onClick={onGoToGdt}
                className="flex cursor-pointer items-center justify-center rounded-lg bg-brand px-3 py-3 text-wb-18 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
            >
                {t("payment.card.link.gdt_setup_cta")}
            </button>
        </div>
    );
}

/** Purpose cell (Receipt tab) — render "{code} {name}" so the user
 *  sees the human-readable purpose, not just the raw `BUSA_USAG_CD`
 *  code (Figma parity: `6000000057 Loan Repaid`). Falls back to the
 *  code alone when the resolved name isn't on the payload yet, and to
 *  the name alone if a row ever carries a name without a code. */
function formatPurpose(code: string | null, name?: string | null): string {
    return [code?.trim(), name?.trim()].filter(Boolean).join(" ");
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

/** {@link PeriodKey} → {@link DateRangeFilterPreset}. "manual" maps to
 *  the 30-day preset (the dropdown label the manual mode falls back to). */
function periodToPreset(period: PeriodKey): DateRangeFilterPreset {
    if (period === "90d")  return "last_90_days";
    if (period === "180d") return "last_180_days";
    return "last_30_days";
}

/** {@link DateRangeFilterPreset} → {@link PeriodKey}. */
function presetToPeriod(preset: DateRangeFilterPreset): PeriodKey {
    if (preset === "last_90_days")  return "90d";
    if (preset === "last_180_days") return "180d";
    return "30d";
}

/**
 * Localize the GDT-supplied {@code EINV_INVOICESTATUS} into the active
 * language. The backend stores the canonical GDT <b>Vietnamese</b> string
 * (e.g. {@code "Hóa đơn mới"}), so this resolves the logical state through the
 * shared {@link matchInvoiceStatus} matcher (same source of truth as the
 * Sales / Expenses e-Invoice list) and renders the localized label — English
 * {@code "Original"} etc. Any value outside the 6 known GDT states falls back
 * to the raw string, so the UI stays robust to a new code.
 */
function localizeEInvStatus(raw: string, t: (key: string) => string): string {
    const logical = matchInvoiceStatus(raw);
    if (logical === "other") return raw;
    return t(`payment.card.link.einv_status.${logical}`);
}

/** e-Invoice status → text colour (Figma 4664 data state): Original = green,
 *  Cancelled = red, everything else (Replacement / Adjustment / Replaced /
 *  Adjusted) = normal dark text. */
function einvStatusColor(raw: string): string {
    const logical = matchInvoiceStatus(raw);
    if (logical === "original") return "text-wb-status-approved-text";
    if (logical === "cancelled") return "text-wb-status-rejected-text";
    return "text-wb-ink";
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
    const isEmpty = !loading && rows.length === 0;
    return (
        <div className="flex min-h-full flex-col">
            <table className="w-full table-fixed text-wb-13">
                {/* Receipt-tab column widths (sum = 1037 = body inner width). The
                    trailing attachment/action column is the fixed 64px slot. */}
                <colgroup>
                    <col className="w-12" />
                    <col className="w-[96px]" />
                    <col className="w-[300px]" />
                    <col className="w-[110px]" />
                    <col className="w-[150px]" />
                    <col className="w-[170px]" />
                    <col className="w-[99px]" />
                    <col className="w-16" />
                </colgroup>
                <thead className="sticky top-0 z-10 border-y border-wb-table-border bg-wb-bg-card text-wb-dark">
                    <tr>
                        <th className="px-4 py-3 text-left font-semibold" />
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.date")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.merchant")}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t("payment.card.link.col.amount")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.purpose")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.description")}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t("payment.card.link.col.payment_method")}</th>
                        {/* Attachment / action column (Figma 4664 Receipt tab) —
                            no header label; per-row attachment glyph + count. */}
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                {!loading && rows.length > 0 && (
                    <tbody>
                        {rows.map((r) => {
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
                                    <td className="px-4 py-3 align-top">
                                        <Checkbox
                                            checked={isSel}
                                            onCheckedChange={() => onToggle(r.doc_id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        {formatIssuDt(r.use_dt, locale)}
                                    </td>
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <EllipsisTooltip text={r.merch_nm ?? ""} />
                                            {r.merch_tax_id && (
                                                <span className="text-wb-12 font-normal text-wb-ntrl-6">
                                                    MST : {r.merch_tax_id}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top text-right text-wb-13 font-medium text-wb-ink">
                                        {formatAmount(r.totl_amt, r.ccy_cd ?? "VND", false)}
                                    </td>
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        <EllipsisTooltip text={formatPurpose(r.purpose, r.purpose_nm)} lines={2} />
                                    </td>
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ink">
                                        <EllipsisTooltip text={r.description ?? ""} lines={2} />
                                    </td>
                                    <td className="px-4 py-3 align-top text-wb-13 font-medium text-wb-ntrl-6">
                                        {/* Phase B — receipts don't carry a payment-method
                                            column on BUSA_DOC_MSTR; the legacy r002 query
                                            leaves this blank too (it lives on a JOIN that
                                            isn't ported). */}
                                        {""}
                                    </td>
                                    {/* Attachment — Figma paperclip + "(N)" count +
                                        dropdown (audit G3/G5, BUSA_DOC_FILE). */}
                                    <td className="px-4 py-3 align-top">
                                        <AttachmentsCell
                                            docId={r.doc_id}
                                            count={r.file_count ?? (r.files?.length ?? 0)}
                                            files={r.files ?? []}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                )}
            </table>

            {loading && (
                <div className="flex flex-1 items-center justify-center px-4 py-16 text-wb-13 text-wb-ntrl-6">
                    {t("common.loading")}
                </div>
            )}
            {isEmpty && (
                <div className="flex flex-1 items-center justify-center px-4 py-16 text-center text-wb-13 text-wb-ntrl-6">
                    {t("payment.card.link.empty")}
                </div>
            )}
        </div>
    );
}
