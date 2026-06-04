"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import EInvoiceStatusText from "@/components/addon/sales-einvoices/EInvoiceStatusText";
import { fetchEInvoiceDetailHistory } from "@/lib/api/addon";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

/**
 * e-Invoice "Latest Inquiry — Detail" popup — refactor port of legacy
 * {@code nxisas_einvhis_dt} ({@code nxisas_einvhis_dt_view.jsp} +
 * {@code nxisas_einvhis_dt.ts} + {@code nxisas_einvhis_dt_r001}).
 *
 * <p>Opened from the History popup's per-row "View" button. Drills into a
 * single GDT inquiry batch and lists the invoices it produced, reading
 * {@code GET /api/v1/addon/einvoices/detail-history} (filters
 * {@code DOC_TYPE='I' + BIZ_KEY + ISSU_DT range + MOD_DTM=batch +
 * HAND_REG_YN='N'}; default sort {@code ISSU_DT DESC}).
 *
 * <p>Columns mirror the legacy popup exactly (legacy
 * {@code nxisas_einvhis_dt.ts:98-110}): Issue Date · Document ID
 * ({@code HAND_REG_YN='N' ? DISP_DOC_ID : DOC_ID}) · Buyer ·
 * Total Amount (VND) · Status (locale-coloured via the shared
 * {@code <EInvoiceStatusText>}).
 *
 * <p><b>Sales-only</b>: the legacy detail action rejects Expense, so the
 * parent only renders the "View" button on SALES rows.
 *
 * <p>{@code stackLevel={3}} — opens on top of the History popup (L2),
 * which itself opens on top of the Update e-Invoice popup (L1).
 */
type Props = {
    /** Batch timestamp (parent row's `reg_dtm`, 14-digit) — the MOD_DTM. */
    modDtm: string;
    /** Batch start date, `YYYYMMDD`. */
    fromYmd: string;
    /** Batch end date, `YYYYMMDD`. */
    toYmd: string;
    onClose: () => void;
};

type DetailRow = {
    id: string;
    issueDate: string;
    documentId: string;
    buyer: string;
    amount: string;
    status: string;
};

export default function EInvoiceDetailHistoryDialog({
    modDtm,
    fromYmd,
    toYmd,
    onClose,
}: Props) {
    const { t } = useTranslation();

    const [rows, setRows] = useState<DetailRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        (async () => {
            try {
                const res = await fetchEInvoiceDetailHistory({
                    type: "SALES",
                    from: fromYmd,
                    to: toYmd,
                    modDtm,
                });
                if (cancelled) return;
                setRows(
                    res.rows.map((r, i) => ({
                        id: `${r.doc_id}-${i}`,
                        issueDate: fmtDate(r.issu_dt),
                        // Legacy: HAND_REG_YN === "N" ? DISP_DOC_ID : DOC_ID.
                        documentId:
                            r.hand_reg_yn === "N"
                                ? (r.disp_doc_id ?? "") || ""
                                : (r.doc_id ?? "") || "",
                        buyer: r.trco_cmnm ?? "",
                        amount: formatAmount(r.totl_amt, "VND", true),
                        status: r.einv_invoice_status ?? "",
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
    }, [modDtm, fromYmd, toYmd]);

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={3}
                className="w-[1080px] max-w-[92vw] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col px-6 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {t("einvoice_detail_history.title")}
                        </h2>
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {`${fmtDate(fromYmd)} ~ ${fmtDate(toYmd)}`}
                    </DialogDescription>

                    <div className="mt-5 min-h-[300px] overflow-hidden rounded-md border border-wb-table-border bg-white">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                                <tr className="border-b border-wb-table-border">
                                    <Th>{t("einvoice_detail_history.col.issue_date")}</Th>
                                    <Th>{t("einvoice_detail_history.col.document_id")}</Th>
                                    <Th>{t("einvoice_detail_history.col.buyer")}</Th>
                                    <Th align="right">
                                        {t("einvoice_detail_history.col.amount")}
                                    </Th>
                                    <Th>{t("einvoice_detail_history.col.status")}</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <StateRow text={t("einvoice_detail_history.loading")} />
                                ) : error ? (
                                    <StateRow
                                        text={t("einvoice_detail_history.load_error")}
                                        tone="error"
                                    />
                                ) : rows.length === 0 ? (
                                    <StateRow text={t("einvoice_detail_history.empty")} />
                                ) : (
                                    rows.map((r) => (
                                        <tr
                                            key={r.id}
                                            className="h-[50px] border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                                        >
                                            <Td>{r.issueDate}</Td>
                                            <Td>{r.documentId}</Td>
                                            <Td>{r.buyer}</Td>
                                            <Td align="right">{r.amount}</Td>
                                            <td className="px-3 py-3 align-middle">
                                                <EInvoiceStatusText value={r.status} />
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

/** `yyyyMMdd` → `YYYY-MM-DD`. */
function fmtDate(s: string): string {
    if (!s || s.length < 8) return s ?? "";
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function Th({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
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
                "whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink " +
                (align === "right" ? "text-right" : "text-left")
            }
        >
            {children}
        </td>
    );
}

function StateRow({
    text,
    tone = "muted",
}: {
    text: string;
    tone?: "muted" | "error";
}) {
    return (
        <tr>
            <td
                colSpan={5}
                className={
                    "h-[260px] text-center align-middle text-wb-13 font-medium " +
                    (tone === "error"
                        ? "text-wb-status-rejected-text"
                        : "text-wb-muted")
                }
            >
                {text}
            </td>
        </tr>
    );
}
