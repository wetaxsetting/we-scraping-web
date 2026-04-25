"use client";

import { ChevronDown } from "lucide-react";

import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ApprovalTableColumns from "./ApprovalTableColumns";
import StatusBadge from "./StatusBadge";
import type { ApprovalRow } from "./types";

type ApprovalTableProps = {
    rows: ApprovalRow[];
    className?: string;
};

/**
 * Approval Box main table (thead + tbody only). Rendered as a plain <table>
 * without a built-in overflow wrapper so the parent can compose it with the
 * footer summary inside a single shared horizontal-scroll container.
 */
export default function ApprovalTable({ rows, className }: ApprovalTableProps) {
    const { t } = useTranslation();
    return (
        <table
            className={cn(
                "w-full min-w-[var(--w-wb-ap-table-min)] table-fixed border-collapse",
                className,
            )}
        >
            <ApprovalTableColumns />
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                    <TableHeaderCell>{t("approval.col.date")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.type")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.document_no")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.title")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.file_name")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.currency")}</TableHeaderCell>
                    <TableHeaderCell align="right">{t("approval.col.amount")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.status")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.scheduled")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.requestor")}</TableHeaderCell>
                    <TableHeaderCell>{t("approval.col.approver")}</TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row.id}
                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                    >
                        <TextCell>{row.date}</TextCell>
                        <TextCell>{row.type}</TextCell>
                        <TextCell>{row.documentNo}</TextCell>
                        <TextCell className="pr-4">{row.title}</TextCell>
                        <TextCell className="pr-4">{row.fileName}</TextCell>
                        <TextCell>{row.currency}</TextCell>
                        <TextCell align="right">{row.amount}</TextCell>
                        <TableCell className="px-2.5 py-2.5">
                            <StatusBadge
                                status={row.status}
                                step={row.statusStep}
                                label={t(`approval.tab.${row.status}`)}
                            />
                        </TableCell>
                        <TextCell>
                            {row.scheduledDate ?? t("approval.scheduled_empty")}
                        </TextCell>
                        <TextCell>{row.requestor}</TextCell>
                        <TableCell className="px-2.5 py-2.5">
                            {/* Figma 1:8408 — name 13/medium black, FCY-style
                               count pill (ntrl-3 bg + ntrl-4 border, 4px
                               radius), then 18px chevron. */}
                            <div className="flex items-center gap-1">
                                <span className="truncate text-wb-13 font-medium text-wb-ink">
                                    {row.approver}
                                </span>
                                {row.approverCount != null && (
                                    <span className="inline-flex items-center justify-center rounded-[4px] border border-wb-ntrl-4 bg-wb-ntrl-3 px-1 text-wb-10 font-medium uppercase text-black/70">
                                        {row.approverCount}
                                    </span>
                                )}
                                <ChevronDown
                                    aria-hidden
                                    className="size-[18px] shrink-0 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                />
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </table>
    );
}

function TextCell({
    children,
    align = "left",
    className,
}: {
    children: React.ReactNode;
    align?: "left" | "right";
    className?: string;
}) {
    return (
        <TableCell
            className={cn(
                "px-2.5 py-2.5",
                align === "right" && "text-right",
                className,
            )}
        >
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {children}
            </span>
        </TableCell>
    );
}
