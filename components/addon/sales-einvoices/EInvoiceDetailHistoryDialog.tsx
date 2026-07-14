"use client";

import { useEffect, useRef, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { fetchEInvoiceDetailHistory } from "@/lib/api/addon";
import { formatAmount } from "@/lib/currency";
import { formatDateLang, formatLegacyDtmInDisplayTz } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";

import EInvoiceStatusText from "./EInvoiceStatusText";

/**
 * e-Invoice "Latest Inquiry" popup — the drill-down opened by the
 * result-card **View** action on the Update e-Invoice Information modal.
 * Refactor port of legacy {@code nxisas_einvhis_dt} (view + JS +
 * {@code nxisas_einvhis_dt_r001_act.jsp}). Shared by BOTH Sales
 * ({@code DOC_TYPE 'I'}) and Expenses ({@code 'B'}) — the only
 * per-variant differences are the title, the party-name column heading
 * (Buyer vs Seller), the backend `type`, and the "View Details" target.
 *
 * <p>Lists the {@code BUSA_DOC_MSTR} invoices ONE inquiry batch produced —
 * keyed on the batch {@code mod_dtm} (the phase-1 {@code /scrape-results}
 * timestamp, preserved through phase 2), the issue-date window, and the
 * doc type. When the inquiry completed with zero results the table renders
 * the centered "No Data Found" state (legacy parity — View still opens).
 *
 * <p>Columns mirror the legacy {@code nxisas_einvhis_dt_view.jsp} table:
 * Date (ISSU_DT) · e-Invoice No (DISP_DOC_ID) · Buyer's / Seller's Name
 * (TRCO_CMNM) · Total Amount (TOTL_AMT, VND) · Invoice Status
 * (EINV_INVOICESTATUS, rendered via the shared {@link EInvoiceStatusText}
 * colour map — identical to the main list).
 *
 * <p>"View Details" (legacy {@code #view-details}) redirects the legacy
 * page to the e-Invoice LIST screen per scrape variant ({@code
 * einv_0001_000} Sales / {@code einv_0001_001} Expenses). The refactor
 * equivalent is owned by the parent list client via {@link
 * Props.onViewDetails}: it navigates to the matching main route and
 * refreshes the list, then closes the modal chain. Rendered only when a
 * handler is supplied (never a dead button).
 *
 * <p>{@code stackLevel={2}} — opens on top of the Update e-Invoice
 * Information popup (L1).
 */
type Props = {
    /** Drives the title, doc type + party-name column heading. */
    variant: "SALES" | "EXPENSE";
    /** Batch id — the completed inquiry's `mod_dtm` (`yyyyMMddHHmmss`). */
    modDtm: string;
    /** Batch issue-date window, ISO `YYYY-MM-DD`. */
    startIso: string;
    endIso: string;
    onClose: () => void;
    /**
     * "View Details" handler (legacy list-page redirect equivalent).
     * When omitted the button is not rendered — never a no-op affordance.
     */
    onViewDetails?: () => void;
};

type DetailRow = {
    id: string;
    date: string;
    docId: string;
    counterparty: string;
    amount: number;
    status: string;
};

export default function EInvoiceDetailHistoryDialog({
    variant,
    modDtm,
    startIso,
    endIso,
    onClose,
    onViewDetails,
}: Props) {
    const { t, locale } = useTranslation();

    const [rows, setRows] = useState<DetailRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Guard against a double-click firing the navigation twice before the
    // modal unmounts (the parent closes this on View Details). Reset per
    // mount, so re-opening the popup restores the affordance.
    const viewDetailsFiredRef = useRef(false);
    const handleViewDetailsClick = () => {
        if (!onViewDetails || viewDetailsFiredRef.current) return;
        viewDetailsFiredRef.current = true;
        onViewDetails();
    };

    // One fetch per open — the batch is immutable (a completed inquiry),
    // so nothing here re-queries after mount. Cancel-guarded. Backend
    // returns rows in the legacy default order (ISSU_DT DESC → newest
    // first); the popup preserves that order (no client re-sort).
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        (async () => {
            try {
                const res = await fetchEInvoiceDetailHistory({
                    type: variant,
                    from: toYmd(startIso),
                    to: toYmd(endIso),
                    modDtm,
                });
                if (cancelled) return;
                setRows(
                    res.rows.map((r, i) => ({
                        id: `${r.doc_id}-${i}`,
                        // ISSU_DT is a calendar date (date-only) → locale-format
                        // only, no TZ shift.
                        date: formatDateLang(r.issu_dt, locale),
                        docId: r.disp_doc_id || r.doc_id,
                        counterparty: r.trco_cmnm,
                        amount: Number(r.totl_amt) || 0,
                        status: r.einv_invoice_status,
                    })),
                );
            } catch {
                if (!cancelled) {
                    setError(true);
                    setRows([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [variant, modDtm, startIso, endIso, locale]);

    const title =
        variant === "SALES"
            ? t("einvoice_detail.title_sales")
            : t("einvoice_detail.title_expenses");
    const counterpartyHeader =
        variant === "SALES"
            ? t("einvoice_detail.col.buyer")
            : t("einvoice_detail.col.seller");

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                className="h-[820px] max-h-[calc(100vh-32px)] w-[1300px] max-w-[calc(100vw-32px)] rounded-2xl p-0"
            >
                <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {title}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">{title}</DialogDescription>

                    {/* ── Inquiry date range (read-only) + View Details ──────
                       Legacy renders two disabled DDMMYYYY inputs joined by
                       "~" (nxisas_einvhis_dt_view.jsp), plus the top-right
                       #view-details button. */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <ReadonlyDate value={fmtRange(startIso)} />
                            <span className="text-wb-13 font-medium text-wb-ntrl-8">~</span>
                            <ReadonlyDate value={fmtRange(endIso)} />
                        </div>
                        {onViewDetails && (
                            <button
                                type="button"
                                onClick={handleViewDetailsClick}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t("einvoice_detail.view_details")}
                            </button>
                        )}
                    </div>

                    {/* ── Result table — header always visible; body scrolls;
                       loading / error / empty states center below it. ──── */}
                    <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-wb-table-border bg-white">
                        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                            <div className="flex min-h-full flex-col">
                                <table className="w-full table-fixed border-collapse">
                                    <colgroup>
                                        <col className="w-[12%]" />
                                        <col className="w-[18%]" />
                                        <col className="w-[38%]" />
                                        <col className="w-[14%]" />
                                        <col className="w-[18%]" />
                                    </colgroup>
                                    <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                        <tr className="border-b border-wb-table-border">
                                            <Th>{t("einvoice_detail.col.date")}</Th>
                                            <Th>{t("einvoice_detail.col.invoice_no")}</Th>
                                            <Th>{counterpartyHeader}</Th>
                                            <Th align="right">
                                                {t("einvoice_detail.col.amount")}
                                            </Th>
                                            <Th>{t("einvoice_detail.col.status")}</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!loading &&
                                            !error &&
                                            rows.map((r) => (
                                                <tr
                                                    key={r.id}
                                                    className="h-[48px] border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                                                >
                                                    <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                                                        {r.date}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                                                        {r.docId}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        <EllipsisTooltip
                                                            text={r.counterparty}
                                                            className="text-wb-13 font-medium text-wb-ink"
                                                        />
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-wb-13 font-medium text-wb-ink">
                                                        {formatAmount(r.amount, "VND")}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        <EInvoiceStatusText value={r.status} />
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>

                                {/* State overlays — only ONE shows at a time,
                                   centered in the remaining flex space so it
                                   sits below the always-visible header. */}
                                {(loading || error || rows.length === 0) && (
                                    <div
                                        className={
                                            "flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium " +
                                            (error
                                                ? "text-wb-status-rejected-text"
                                                : "text-wb-ntrl-6")
                                        }
                                    >
                                        {loading
                                            ? t("common.loading")
                                            : error
                                              ? t("einvoice_detail.load_error")
                                              : t("common.no_data_found")}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** ISO `YYYY-MM-DD` → `YYYYMMDD` for the wire. */
function toYmd(iso: string): string {
    return iso.replace(/-/g, "");
}

/**
 * Format the inquiry-period bounds as `DD-MM-YYYY` (legacy DDMMYYYY
 * picker parity, req. #3). Accepts either ISO `YYYY-MM-DD` or a compact
 * `yyyyMMdd` string; strips the separators and routes through the shared
 * {@link formatLegacyDtmInDisplayTz} date-only path (no TZ shift). Blank /
 * malformed → empty string.
 */
function fmtRange(value: string): string {
    return formatLegacyDtmInDisplayTz(value.replace(/-/g, ""), {
        dateFormat: "DMY",
    }).date;
}

/** Compact read-only date box mirroring the legacy disabled input. */
function ReadonlyDate({ value }: { value: string }) {
    return (
        <span className="flex h-8 min-w-[110px] items-center rounded-md border border-wb-border-sidebar bg-wb-bg-card px-3 text-wb-13 font-medium text-wb-ink">
            {value}
        </span>
    );
}

function Th({
    children,
    align,
}: {
    children: React.ReactNode;
    align?: "right";
}) {
    return (
        <th
            className={
                "whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 align-middle text-wb-13 font-semibold text-wb-dark " +
                (align === "right" ? "text-right" : "text-left")
            }
        >
            {children}
        </th>
    );
}
