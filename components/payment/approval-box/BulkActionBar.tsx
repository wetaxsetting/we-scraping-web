"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import {
    ApprovalBoxApiError,
    bulkApproveApprovalBoxRows,
} from "@/lib/api/approval-box";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type BulkActionBarProps = {
    selectedIds: string[];
    onClear: () => void;
    onSuccess: () => void;
    className?: string;
};

/**
 * Sticky action bar that surfaces only when at least one row is ticked
 * on the page. Bulk Approve is the only batch operation currently
 * supported by the backend (`POST /api/v1/payment/approval-box/bulk-approve`);
 * Bulk Reject is intentionally absent until the PO confirms scope
 * (see `discovery.md` OQ-2).
 */
export default function BulkActionBar({
    selectedIds,
    onClear,
    onSuccess,
    className,
}: BulkActionBarProps) {
    const { t } = useTranslation();
    const sysDialog = useDialog();
    const [submitting, setSubmitting] = useState(false);

    if (selectedIds.length === 0) return null;

    function trigger() {
        sysDialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("approval.bulk.confirm", { count: selectedIds.length }),
            confirmText: t("approval.action.approve.cta"),
            cancelText: t("dialog.cancel"),
            onConfirm: () => void submit(),
        });
    }

    async function submit() {
        setSubmitting(true);
        try {
            const result = await bulkApproveApprovalBoxRows({
                appr_seq_nos: selectedIds,
            });
            onSuccess();
            onClear();
            const successCount = result.successes.length;
            const failureCount = result.failures.length;
            if (failureCount === 0) {
                sysDialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("approval.bulk.success", { count: successCount }),
                });
            } else {
                const firstFailure = result.failures[0];
                sysDialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("approval.bulk.partial", {
                        success: successCount,
                        failure: failureCount,
                    }),
                    errorCode: firstFailure?.code,
                });
            }
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
        <div
            className={cn(
                "sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3",
                "rounded-md border border-wb-border-sidebar bg-wb-bg-card px-4 py-2 shadow-wb-card",
                className,
            )}
        >
            <div className="flex items-center gap-2 text-wb-13 font-medium text-wb-ink">
                <span>{t("approval.bulk.selected", { count: selectedIds.length })}</span>
                <button
                    type="button"
                    onClick={onClear}
                    className="inline-flex items-center gap-1 text-wb-12 font-medium text-wb-muted hover:text-wb-ink"
                >
                    <X aria-hidden className="size-3" />
                    {t("approval.bulk.clear")}
                </button>
            </div>
            <button
                type="button"
                onClick={trigger}
                disabled={submitting}
                className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md bg-brand px-4",
                    "text-wb-14 font-medium text-white shadow-wb-brand-btn",
                    "hover:bg-brand-hover disabled:opacity-60",
                )}
            >
                <Check aria-hidden className="size-4" />
                {t("approval.bulk.approve")}
            </button>
        </div>
    );
}
