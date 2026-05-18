import type { ApiChartOfAccountRow } from "@/lib/types/api";

import type { ReportingAccountOption } from "./types";

/**
 * Translate the live `/api/v1/settings/chart-of-accounts` rows into
 * `<ReportingAccountSelect>` options. Walks each row's parent chain
 * (via `parent_chart_acct_cd`) to build a "ROOT > MID > …" breadcrumb
 * matching the dropdown in the screenshot (REVENUE > OTHERS).
 *
 *  • Active rows only (`stts === "A"`) — inactive accounts shouldn't be
 *    picked for a new classification.
 *  • Restricted roots (ACC-01 REVENUE, etc.) are included as
 *    selectable options because legacy `fnsh_0200_001` exposes the
 *    full tree, not just the leaves.
 *  • Cycles in the input (legacy DEV seeds carry a few) are detected
 *    via a visited set so the walk terminates.
 *  • Sort: collation-aware by code so the option order matches the
 *    Settings > Chart of Accounts panel.
 */
export function buildReportingAccountOptions(
    rows: ApiChartOfAccountRow[],
): ReportingAccountOption[] {
    if (rows.length === 0) return [];

    const byCode = new Map<string, ApiChartOfAccountRow>();
    for (const row of rows) {
        byCode.set(row.chart_acct_cd, row);
    }

    const breadcrumbFor = (row: ApiChartOfAccountRow): string | null => {
        const trail: string[] = [];
        let cursor = row.parent_chart_acct_cd;
        const visited = new Set<string>([row.chart_acct_cd]);
        while (cursor) {
            if (visited.has(cursor)) break; // cycle guard
            visited.add(cursor);
            const parent = byCode.get(cursor);
            if (!parent) break;
            trail.unshift(parent.chart_acct_nm_en);
            cursor = parent.parent_chart_acct_cd;
        }
        return trail.length > 0 ? trail.join(" > ") : null;
    };

    const collator = new Intl.Collator(undefined, {
        sensitivity: "base",
        numeric: true,
    });

    return rows
        .filter((r) => r.stts === "A")
        .map<ReportingAccountOption>((r) => ({
            chartAcctSeqNo: r.chart_acct_seq_no,
            code:           r.chart_acct_cd,
            name:           r.chart_acct_nm_en,
            breadcrumb:     breadcrumbFor(r),
        }))
        .sort((a, b) => collator.compare(a.code, b.code));
}
