"use client";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { cn } from "@/lib/utils";

import type { DetailTransaction } from "./types";

/**
 * Shared cell renderers for Payment detail tables (Scheduled + Result).
 *
 * Extracted so every Payment detail page (Internal Transfer, Vendor,
 * Expense, Payroll, …) renders long-text columns and the Result column
 * identically — see the per-module audits. Previously these lived as
 * page-local copies in the Internal Transfer detail pages; centralised
 * here to satisfy the "do not duplicate components" rule.
 */

/**
 * Long-text cell — clamps to 2 lines + ellipsis and reveals the full
 * value on hover via the shared `<EllipsisTooltip>` (the common WeCMS
 * tooltip), only when the text actually overflows the clamp. `lines={2}`
 * keeps the row height stable. Used for Recipient Name / Remarks /
 * Description / Document No. on every detail table.
 */
export function DetailClampCell({ text }: { text: string }) {
    return (
        <EllipsisTooltip
            text={text}
            lines={2}
            className="text-wb-13 font-medium text-wb-ink"
        />
    );
}

/**
 * Reporting Account cell for the **Result** detail (read-only) — the
 * chart-account code on line 1 and the breadcrumb on line 2, each a
 * single-line `<EllipsisTooltip>` so the cell never exceeds 2 lines and a
 * long value truncates with the shared tooltip. Mirrors the legacy
 * read-only reporting-account stack.
 */
export function ResultReportingAccountClampCell({ row }: { row: DetailTransaction }) {
    if (!row.reportingAccount) return null;
    return (
        <div className="flex flex-col gap-0.5">
            <EllipsisTooltip
                text={row.reportingAccount}
                lines={1}
                className="text-wb-13 font-medium text-wb-ink"
            />
            {row.reportingAccountBreadcrumb && (
                <EllipsisTooltip
                    text={row.reportingAccountBreadcrumb}
                    lines={1}
                    className="text-wb-12 font-normal text-wb-ntrl-6"
                />
            )}
        </div>
    );
}

/**
 * Legacy `pymn_000X_002` renders the Results column as PLAIN TEXT with a
 * colour class — `cGreen` (Success), `cBlue` (In Progress), `cRed`
 * (Failed) — never a badge/background. These tokens are the WB365
 * equivalents used across the Payment Result detail pages. `cancelled`
 * has no legacy counterpart in this view → muted neutral.
 */
export const RESULT_TEXT_COLOR: Record<string, string> = {
    success:   "text-wb-status-approved-text",  // legacy cGreen
    failed:    "text-wb-status-rejected-text",  // legacy cRed
    pending:   "text-wb-status-progress-text",  // legacy cBlue (In Progress)
    cancelled: "text-wb-ntrl-6",
};

/**
 * Results cell — plain text + legacy colour class (no badge / background),
 * matching legacy `pymn_000X_002`. Preserves the failed-row `RS_MSG`
 * hover tooltip (legacy `error_message`).
 */
export function ResultPlainText({
    row,
    t,
}: {
    row: DetailTransaction;
    t: (key: string, vars?: Record<string, string>) => string;
}) {
    if (!row.result) return null;
    const colorClass = RESULT_TEXT_COLOR[row.result] ?? "text-wb-ink";
    const text = (
        <span className={cn("text-wb-13 font-medium", colorClass)}>
            {t(`payment.result.${row.result}`)}
        </span>
    );
    if (row.result === "failed" && row.rsMsg && row.rsMsg.trim().length > 0) {
        return (
            <span title={row.rsMsg} className="inline-flex cursor-help">
                {text}
            </span>
        );
    }
    return text;
}
