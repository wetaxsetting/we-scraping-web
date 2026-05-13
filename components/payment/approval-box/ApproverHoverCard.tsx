"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ApprovalApprover, ApproverStatus } from "./types";

type ApproverHoverCardProps = {
    approvers: ApprovalApprover[];
    className?: string;
};

const STATUS_TONE: Record<ApproverStatus, string> = {
    A: "text-wb-status-approved-text",
    R: "text-wb-status-rejected-text",
    P: "text-wb-status-pending-text",
    W: "text-wb-status-pending-text",
    S: "text-wb-muted",
};

/**
 * Compact, always-rendered approver chain. Used in the row dialog +
 * (future) inline hover-card on the table's Approver column. Each line
 * follows the legacy hover-card design: line-number badge, name, status
 * key, optional acted-at timestamp.
 */
export default function ApproverHoverCard({ approvers, className }: ApproverHoverCardProps) {
    const { t } = useTranslation();
    if (approvers.length === 0) {
        return (
            <span className="text-wb-13 font-normal text-wb-muted">
                {t("approval.approver.none")}
            </span>
        );
    }
    return (
        <ul className={cn("flex flex-col gap-1.5", className)}>
            {approvers.map((a) => (
                <li
                    key={a.userId}
                    className="flex items-center gap-2 text-wb-13 font-medium text-wb-ink"
                >
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-wb-bg-sidebar text-wb-11 font-semibold text-wb-muted">
                        {a.lineNo}
                    </span>
                    <span className="truncate">{a.userName}</span>
                    <span className={cn("text-wb-12 font-medium", STATUS_TONE[a.status])}>
                        · {t(`approval.approver_status.${a.status}`)}
                    </span>
                    {a.actedAt && (
                        <span className="ml-auto text-wb-11 font-normal text-wb-muted">
                            {a.actedAt}
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}
