"use client";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Field,
    READONLY_FIELD,
    READONLY_MULTILINE,
} from "@/components/payment/corporate-card/receiptFormFields";
import { fetchReceiptDetail } from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import { formatAmount } from "@/lib/currency";
import { formatDateLang } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";

/* ============================================================================
 *  Receipt Detail popup — read-only. Opens from the linked-doc dropdown
 *  on the Card Transactions table (legacy `card_0001_001.ts:337-350`
 *  `.detail-receipt`). Mirrors the `prch_0011_001` "New Receipt" popup
 *  layout — the container, header, field rows, and footer are the same as
 *  {@link NewReceiptDialog} (shared field styling in ./receiptFormFields);
 *  every field is simply locked read-only.
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
                className="flex max-h-[calc(100vh-32px)] w-[452px] max-w-[calc(100vw-32px)] flex-col gap-6 rounded-2xl p-0"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
            >
                {/* Header — title (built-in close X sits at top-4 right-4) */}
                <div className="shrink-0 px-4 pr-12 pt-6">
                    <DialogTitle className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                        {title}
                    </DialogTitle>
                </div>

                {/* Body — scrolls if the viewport is short */}
                <div className="custom-scrollbar-y flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
                    {state.loading && (
                        <p className="px-1 py-6 text-center text-wb-14 text-wb-muted">
                            {t("common.loading")}
                        </p>
                    )}

                    {!state.loading && !detail && (
                        <p className="px-1 py-6 text-center text-wb-14 text-wb-muted">
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

                {/* Footer — Close only */}
                <div className="flex shrink-0 items-center justify-end gap-2.5 px-4 pb-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-4 text-wb-14 font-medium text-wb-ink shadow-wb-btn hover:bg-black/3"
                    >
                        {t("dialog.close")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ── Read-only field row — reuses the shared <Field> label + read-only
 *    field styling so it stays pixel-consistent with New Receipt. ── */

function ReadOnlyField({
    label,
    value,
    multiline,
}: {
    label:      string;
    value:      string;
    multiline?: boolean;
}) {
    return (
        <Field label={label}>
            {multiline ? (
                // Read-only content-height block — grows with the text (no
                // internal scrollbar); the modal body scrolls when long.
                <div className={READONLY_MULTILINE}>
                    {value || "—"}
                </div>
            ) : (
                <input
                    type="text"
                    value={value || "—"}
                    readOnly
                    className={READONLY_FIELD}
                />
            )}
        </Field>
    );
}
