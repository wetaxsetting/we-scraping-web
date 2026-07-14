"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { fetchEInvoiceDetailHistory } from "@/lib/api/addon";
import { formatAmount } from "@/lib/currency";
import { formatDateLang } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";

/**
 * e-Invoice "Latest Inquiry — Detail" popup — the drill-down opened by the
 * result-card **View** action on the Update e-Invoice Information modal.
 * Refactor port of legacy {@code nxisas_einvhis_dt} (view + JS +
 * {@code nxisas_einvhis_dt_r001_act.jsp}).
 *
 * <p>Lists the {@code BUSA_DOC_MSTR} invoices ONE inquiry batch produced —
 * keyed on the batch {@code mod_dtm} (the phase-1 {@code /scrape-results}
 * timestamp, preserved through phase 2), the issue-date window, and the
 * doc type. Works for BOTH Sales ({@code DOC_TYPE 'I'}) and Expenses
 * ({@code 'B'}) — the legacy action only rejects the distinct {@code 'E'}
 * type. When the inquiry completed with zero results the table renders
 * empty (legacy parity — View still opens, shows no rows).
 *
 * <p>Columns mirror the legacy {@code nxisas_einvhis_dt_view.jsp} table:
 * Date (ISSU_DT) · e-Invoice No (DISP_DOC_ID) · Buyer's / Seller's Name
 * (TRCO_CMNM) · Total Amount (TOTL_AMT) · Status (EINV_INVOICESTATUS).
 *
 * <p>{@code stackLevel={2}} — opens on top of the Update e-Invoice
 * Information popup (L1).
 */
type Props = {
    /** Drives the doc type + column heading (Buyer vs Seller). */
    variant: "SALES" | "EXPENSE";
    /** Batch id — the completed inquiry's `mod_dtm` (`yyyyMMddHHmmss`). */
    modDtm: string;
    /** Batch issue-date window, ISO `YYYY-MM-DD`. */
    startIso: string;
    endIso: string;
    onClose: () => void;
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
}: Props) {
    const { t, locale } = useTranslation();

    const [rows, setRows] = useState<DetailRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    // One fetch per open — the batch is immutable (a completed inquiry),
    // so nothing here re-queries after mount. Cancel-guarded.
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
                className="w-[1100px] max-w-[calc(100vw-48px)] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col px-6 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {title}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="sr-only">{title}</DialogDescription>

                    {/* Read-only inquiry window (legacy renders the range disabled). */}
                    <p className="mt-3 text-wb-13 font-medium text-wb-ntrl-8">
                        {formatDateLang(startIso, locale)} ~ {formatDateLang(endIso, locale)}
                    </p>

                    <div className="mt-4 min-h-[300px] overflow-hidden rounded-md border border-wb-table-border bg-white">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                <tr className="border-b border-wb-table-border">
                                    <Th>{t("einvoice_detail.col.date")}</Th>
                                    <Th>{t("einvoice_detail.col.invoice_no")}</Th>
                                    <Th>{counterpartyHeader}</Th>
                                    <Th align="right">{t("einvoice_detail.col.amount")}</Th>
                                    <Th>{t("einvoice_detail.col.status")}</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <StateRow>{t("einvoice_detail.loading")}</StateRow>
                                ) : error ? (
                                    <StateRow error>
                                        {t("einvoice_detail.load_error")}
                                    </StateRow>
                                ) : rows.length === 0 ? (
                                    <StateRow>{t("einvoice_detail.empty")}</StateRow>
                                ) : (
                                    rows.map((r) => (
                                        <tr
                                            key={r.id}
                                            className="h-[50px] border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                                        >
                                            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                                                {r.date}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                                                {r.docId}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                                                {r.counterparty}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-wb-13 font-medium text-wb-ink">
                                                {formatAmount(r.amount, "VND")}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                                                {r.status}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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

function StateRow({
    children,
    error,
}: {
    children: React.ReactNode;
    error?: boolean;
}) {
    return (
        <tr>
            <td
                colSpan={5}
                className={
                    "h-[260px] text-center align-middle text-wb-13 font-medium " +
                    (error ? "text-wb-status-rejected-text" : "text-wb-muted")
                }
            >
                {children}
            </td>
        </tr>
    );
}
