"use client";

import { useEffect, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import { patchCardTransaction } from "@/lib/api/cardTransactions";
import { useDialog } from "@/components/shared/dialog";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { CardTransaction } from "./cardTransactionMappers";

type EditDescriptionDialogProps = {
    /** Row being edited. Dialog is open whenever this is non-null. */
    row:        CardTransaction | null;
    onClose:    () => void;
    /** Fires after a successful save so the page can refresh the list. */
    onSaved:    () => void;
};

const MAX_LEN = 200;

/**
 * Inline-edit dialog for the Card Transactions description (legacy
 * `card_0001_001_u001` with `FIELD_ID='CONT'`). Posts to
 * `PATCH /api/v1/payment/card-transactions/{cardSeqNo}` with
 * `{ field: "description", value }` and dispatches the result through
 * the shared `useDialog()` so success / error toasts follow the
 * project-wide variant rules ([wecms-web-main/CLAUDE.md §"Dialog
 * variant"]).
 *
 * <p>Conditional-mount + `key` re-seed pattern: the parent renders this
 * with `{row && <EditDescriptionDialog key={row.cardSeqNo} row={…} … />}`
 * so opening row B after row A starts the form with row B's value.
 */
export default function EditDescriptionDialog({
    row,
    onClose,
    onSaved,
}: EditDescriptionDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [value, setValue] = useState<string>(row?.description ?? "");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setValue(row?.description ?? "");
    }, [row?.cardSeqNo, row?.description]);

    if (!row) return null;

    async function handleSave() {
        if (!row) return;
        const trimmed = value.trim();
        const next = trimmed.length === 0 ? null : trimmed;
        // No-op when the value is unchanged.
        if ((row.description ?? "") === (next ?? "")) {
            onClose();
            return;
        }
        setSaving(true);
        try {
            await patchCardTransaction(row.cardSeqNo, {
                field: "description",
                value: next,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("payment.card.toast.saved"),
            });
            onSaved();
            onClose();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("payment.card.dialog.edit_description.save_failed");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>
                        {t("payment.card.dialog.edit_description.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {row.cardNm ?? ""}{row.cardNm ? " · " : ""}{row.cardNo} · {row.merchNm ?? ""}
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <label
                        htmlFor="card-tx-description-input"
                        className="mb-1 block text-wb-12 font-medium text-wb-muted"
                    >
                        {t("payment.card.col.note")}
                    </label>
                    <textarea
                        id="card-tx-description-input"
                        value={value}
                        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
                        maxLength={MAX_LEN}
                        placeholder={t("payment.card.dialog.edit_description.placeholder")}
                        rows={4}
                        className={cn(
                            "w-full resize-none rounded-md border border-wb-ntrl-4 bg-white px-3 py-2",
                            "text-wb-13 font-normal text-wb-ink",
                            "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40",
                        )}
                    />
                    <p className="mt-1 text-right text-wb-11 font-medium text-wb-muted">
                        {value.length} / {MAX_LEN}
                    </p>
                </DialogBody>
                <DialogFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="inline-flex h-[var(--h-wb-filter-btn)] items-center rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50 disabled:opacity-50"
                    >
                        {t("dialog.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex h-[var(--h-wb-filter-btn)] items-center rounded-md bg-brand px-4 text-wb-13 font-semibold text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:opacity-50"
                    >
                        {t("dialog.save")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
