"use client";

import { AlertCircle, Ban, CheckCircle2, Hourglass } from "lucide-react";

import UserAvatar from "@/components/settings/users/UserAvatar";
import { avatarColorFor } from "@/components/settings/users/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ApproverChainEntry, ApproverStatusCode } from "./types";

type ApproverChainListProps = {
    approvers: ApproverChainEntry[];
    className?: string;
};

/**
 * Shared approver-chain list (Figma `comm_0195_001` hover-card). Renders the
 * approval line as a vertical list — one {@link ApproverRow} per approver:
 * line-number · initials-avatar · name + acted-at / status-description ·
 * status label + icon (right).
 *
 * It is the single source of truth for the approver popup body. The Approval
 * Box badge-popover ({@link ApproverPopoverCell}), every Payment Scheduled
 * batch list, and the Approve / Reject confirmation dialog all consume it, so
 * the surfaces stay byte-identical.
 */
export default function ApproverChainList({ approvers, className }: ApproverChainListProps) {
    const { t } = useTranslation();
    if (approvers.length === 0) {
        return (
            <span className="text-wb-13 font-normal text-wb-muted">
                {t("approval.approver.none")}
            </span>
        );
    }
    return (
        <div className={cn("flex flex-col", className)}>
            {approvers.map((a, idx) => (
                <ApproverRow
                    key={`${a.seed}-${idx}`}
                    approver={a}
                    lineNo={a.lineNo ?? idx + 1}
                    showDivider={idx > 0}
                />
            ))}
        </div>
    );
}

/**
 * One row inside the approver list.
 * Layout: line-number · avatar · name + secondary stack · status pill (right).
 * Secondary line is the acted-at timestamp when the approver has acted,
 * otherwise a status-specific description (Pending / Unable / Not-yet-turn).
 */
function ApproverRow({
    approver,
    lineNo,
    showDivider,
}: {
    approver: ApproverChainEntry;
    lineNo: number;
    showDivider: boolean;
}) {
    const { t } = useTranslation();
    const secondary = approver.actedAt ?? secondaryDescription(approver.status, t);
    return (
        <div
            className={cn(
                "flex items-center gap-3 px-4 py-3",
                showDivider && "border-t border-wb-table-border",
            )}
        >
            <span className="w-4 shrink-0 text-center text-wb-13 font-medium text-wb-ntrl-9">
                {lineNo}
            </span>
            {/* Reuses the User Management avatar (initials disc on an
                identity-stable pastel background). No `imageUrl`/`userId` is
                passed, so it renders the initials fallback with zero API
                calls; approver wires carry no profile image today. Once they
                do, pass `imageUrl`+`userId` here for the real photo. Size is
                overridden to 32px to keep the compact popover row rhythm. */}
            <UserAvatar
                name={approver.name}
                color={avatarColorFor(approver.seed)}
                className="size-8"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-wb-13 font-semibold text-wb-ink">
                    {approver.name}
                </span>
                {secondary && (
                    <span className="truncate text-wb-12 font-normal text-wb-muted">
                        {secondary}
                    </span>
                )}
            </div>
            <ApproverStatusPill status={approver.status} />
        </div>
    );
}

/**
 * Status pill on the right of each approver row. Colour + icon + label per
 * Figma:
 *   A → Approved (green, solid check circle)
 *   R → Rejected (red, solid ban circle)
 *   P → Pending  (gold/orange hourglass)
 *   W → Unable   (gold/orange, solid alert circle)
 *   S → Unable   (gold/orange, solid alert circle)
 */
function ApproverStatusPill({ status }: { status: ApproverStatusCode }) {
    const { t } = useTranslation();
    const labelKey =
        status === "W" || status === "S"
            ? "approval.approver_status.unable"
            : `approval.approver_status.${status}`;
    const { tone, iconClass, Icon } = statusVisuals(status);
    return (
        <span className={cn("inline-flex shrink-0 items-center gap-1 text-wb-13 font-medium", tone)}>
            <span>{t(labelKey)}</span>
            <Icon className={iconClass} strokeWidth={1.8} aria-hidden />
        </span>
    );
}

/**
 * Status-specific secondary line shown when the approver has not acted (no
 * timestamp). Approved / Rejected always carry an acted-at timestamp, so they
 * never fall through to here.
 */
function secondaryDescription(
    status: ApproverStatusCode,
    t: (key: string) => string,
): string | null {
    switch (status) {
        case "P":
            return t("approval.approver_desc.P");
        case "W":
            return t("approval.approver_desc.W");
        case "S":
            return t("approval.approver_desc.S");
        default:
            return null;
    }
}

function statusVisuals(status: ApproverStatusCode): {
    tone: string;
    iconClass: string;
    Icon: typeof Hourglass;
} {
    switch (status) {
        case "A":
            return {
                tone: "text-wb-status-approved-text",
                iconClass: "size-4 fill-wb-status-approved-text text-white",
                Icon: CheckCircle2,
            };
        case "R":
            return {
                tone: "text-wb-status-rejected-text",
                iconClass: "size-4 fill-wb-status-rejected-text text-white",
                Icon: Ban,
            };
        case "P":
            return {
                tone: "text-wb-warning",
                iconClass: "size-4 text-wb-warning",
                Icon: Hourglass,
            };
        case "W":
        case "S":
        default:
            return {
                tone: "text-wb-warning",
                iconClass: "size-4 fill-wb-warning text-white",
                Icon: AlertCircle,
            };
    }
}
