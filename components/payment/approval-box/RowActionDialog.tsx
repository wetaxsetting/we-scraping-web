"use client";

import { useState } from "react";

import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDialog } from "@/components/shared/dialog";
import {
    approveApprovalBoxRow,
    ApprovalBoxApiError,
    rejectApprovalBoxRow,
} from "@/lib/api/approval-box";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import StatusBadge from "./StatusBadge";
import ApproverHoverCard from "./ApproverHoverCard";
import type { ApprovalRow } from "./types";

export type RowAction = "approve" | "reject";

type RowActionDialogProps = {
    open: boolean;
    row: ApprovalRow | null;
    action: RowAction;
    onClose: () => void;
    onSuccess: () => void;
};

/**
 * Approve / Reject confirmation for a single Approval Box row. Renders
 * the document header + approver chain (read-only) so the user can
 * verify before committing. The shadcn `<Dialog>` primitive owns
 * positioning and a11y; per CLAUDE.md §3a the chrome (header padding,
 * footer separator, button heights) is non-negotiable.
 *
 * Success and failure paths funnel through the global `useDialog()`
 * system-feedback layer so the variant + button colours follow the
 * project's single source of truth.
 */
export default function RowActionDialog({
    open,
    row,
    action,
    onClose,
    onSuccess,
}: RowActionDialogProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();
    const [submitting, setSubmitting] = useState(false);

    if (!row) return null;

    async function submit() {
        if (!row) return;
        setSubmitting(true);
        try {
            if (action === "approve") {
                await approveApprovalBoxRow(row.apprSeqNo);
            } else {
                await rejectApprovalBoxRow(row.apprSeqNo);
            }
            onSuccess();
            onClose();
            sysDialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t(
                    action === "approve"
                        ? "approval.success.approved"
                        : "approval.success.rejected",
                ),
            });
        } catch (err) {
            const apiErr =
                err instanceof ApprovalBoxApiError
                    ? err
                    : new ApprovalBoxApiError("WBE_NETWORK", "Network error");
            sysDialog.open({
                type: "error",
                title: t("dialog.error"),
                description: apiErr.message,
                errorCode: apiErr.code,
                uuid: apiErr.traceId,
            });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
            <DialogContent
                className="max-w-[600px]"
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            action === "approve"
                                ? "approval.action.approve.title"
                                : "approval.action.reject.title",
                        )}
                    </DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="flex flex-col gap-4">
                        <p className="text-wb-13 font-normal text-wb-muted">
                            {t(
                                action === "approve"
                                    ? "approval.action.approve.body"
                                    : "approval.action.reject.body",
                            )}
                        </p>

                        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-wb-13 font-medium text-wb-ink">
                            <dt className="text-wb-muted">{t("approval.col.type")}</dt>
                            <dd>{row.type}</dd>

                            <dt className="text-wb-muted">{t("approval.col.document_no")}</dt>
                            <dd>{row.documentNo}</dd>

                            <dt className="text-wb-muted">{t("approval.col.title")}</dt>
                            <dd>{row.title}</dd>

                            <dt className="text-wb-muted">{t("approval.col.amount")}</dt>
                            <dd>
                                {formatAmount(row.amount, row.currency, false)}{" "}
                                <span className="text-wb-muted">{row.currency}</span>
                            </dd>

                            <dt className="text-wb-muted">{t("approval.col.status")}</dt>
                            <dd>
                                <StatusBadge
                                    status={row.status}
                                    step={row.statusStep}
                                    label={t(`approval.tab.${row.status}`)}
                                />
                            </dd>

                            <dt className="text-wb-muted">{t("approval.col.approver")}</dt>
                            <dd>
                                <ApproverHoverCard approvers={row.approvers} />
                            </dd>
                        </dl>
                    </div>
                </DialogBody>
                <DialogFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className={cn(
                            "h-9 rounded-md border border-wb-border-sidebar bg-white px-4",
                            "text-wb-14 font-medium text-black shadow-wb-btn",
                            "hover:bg-black/5 disabled:opacity-60",
                        )}
                    >
                        {t("dialog.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={submitting}
                        className={cn(
                            "h-9 rounded-md px-4 text-wb-14 font-medium text-white shadow-wb-brand-btn",
                            action === "approve"
                                ? "bg-brand hover:bg-brand-hover"
                                : "bg-destructive hover:bg-destructive/90",
                            "disabled:opacity-60",
                        )}
                    >
                        {t(
                            action === "approve"
                                ? "approval.action.approve.cta"
                                : "approval.action.reject.cta",
                        )}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
