"use client";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { fetchReceiptDetail } from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import { formatAmount } from "@/lib/currency";
import { formatDateLang } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";

/* ============================================================================
 *  Receipt Detail popup — read-only. Opens from the linked-doc dropdown
 *  on the Card Transactions table (legacy `card_0001_001.ts:337-350`
 *  `.detail-receipt`). Mirrors the `prch_0011_001` "New Receipt" popup
 *  layout but every field is locked.
 *
 *  Scope: receipts (DOC_TYPE='E') AND bills (DOC_TYPE='B'). The title
 *  switches between "Receipt" and "Bill" based on the resolved doc.
 * ========================================================================== */

type ReceiptDetailDialogProps = {
    /** {@code BUSA_DOC_MSTR.DOC_ID} to fetch. */
    docId:    string;
    onClose:  () => void;
};

export default function ReceiptDetailDialog({
    docId,
    onClose,
}: ReceiptDetailDialogProps) {
    const { t, locale } = useTranslation();

    const state = useApiData(
        () => fetchReceiptDetail(docId),
        [docId],
    );
    const detail = state.data;

    const title = detail?.doc_type === "B"
        ? t("payment.card.receipt_detail.title_bill")
        : t("payment.card.receipt_detail.title_receipt");

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent
                stackLevel={2}
                className="w-[520px] max-w-[calc(100vw-32px)] p-0"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
            >
                <DialogTitle className="px-6 pt-6 text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                    {title}
                </DialogTitle>

                <div className="flex flex-col gap-4 px-6 py-4">
                    {state.loading && (
                        <p className="px-1 py-6 text-center text-wb-13 text-wb-muted">
                            {t("common.loading")}
                        </p>
                    )}

                    {!state.loading && !detail && (
                        <p className="px-1 py-6 text-center text-wb-13 text-wb-muted">
                            {t("payment.card.receipt_detail.not_found")}
                        </p>
                    )}

                    {detail && (
                        <>
                            <ReadOnlyField
                                label={t("payment.card.receipt_detail.doc_no")}
                                value={detail.disp_doc_id}
                            />
                            <ReadOnlyField
                                label={t("payment.card.receipt_detail.date")}
                                value={formatDateLang(detail.date, locale)}
                            />
                            <ReadOnlyField
                                label={t("payment.card.receipt_detail.contact")}
                                value={detail.contact_name ?? ""}
                            />
                            <ReadOnlyField
                                label={t("payment.card.receipt_detail.tax_id")}
                                value={detail.tax_id ?? ""}
                            />
                            <ReadOnlyField
                                label={t("payment.card.receipt_detail.amount")}
                                value={formatAmount(detail.amount, detail.ccy_cd ?? "VND", true)}
                            />
                            <ReadOnlyField
                                label={t("payment.card.receipt_detail.purpose")}
                                value={detail.purpose_nm
                                    ?? detail.purpose_cd
                                    ?? ""}
                            />
                            <ReadOnlyField
                                label={t("payment.card.receipt_detail.description")}
                                value={detail.description ?? ""}
                                multiline
                            />
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-wb-table-border px-6 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-4 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/3"
                    >
                        {t("dialog.close")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ReadOnlyField({
    label,
    value,
    multiline,
}: {
    label:     string;
    value:     string;
    multiline?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-wb-13 font-medium text-wb-ink">{label}</span>
            {multiline ? (
                <div className="min-h-9 w-full rounded-md border border-wb-ntrl-4 bg-wb-bg-card px-3 py-2 text-wb-13 font-normal whitespace-pre-line text-wb-ntrl-8">
                    {value || "—"}
                </div>
            ) : (
                <input
                    type="text"
                    value={value || "—"}
                    readOnly
                    className="h-9 w-full rounded-md border border-wb-ntrl-4 bg-wb-bg-card px-3 text-wb-13 font-normal text-wb-ntrl-8"
                />
            )}
        </div>
    );
}
