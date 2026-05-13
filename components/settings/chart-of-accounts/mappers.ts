import type {
    ApiChartOfAccountCreateRequest,
    ApiChartOfAccountRow,
    ApiChartOfAccountUpdateRequest,
} from "@/lib/types/api";

import type {
    ChartOfAccountsFormValues,
    ChartOfAccountsRow,
} from "./types";

/**
 * Translate one backend row to the frontend in-memory shape. The
 * panel's table renderer is preserved verbatim — restricted level-1
 * rows become `kind: "group"`, everything else becomes
 * `kind: "child"`. The mapping is total: every backend row resolves
 * to exactly one frontend row.
 *
 * <p>The {@code restricted} flag is treated as the single source of
 * truth for "group vs. child" — not {@code chart_acct_level === 1}.
 * Legacy DEV data carries non-restricted level-1 rows (e.g. seq 90 in
 * the V97 demo seed); those render as {@code child} rows with
 * {@code parentCode: null}. Restricted rows always have null parent
 * and {@code chart_acct_level === 1} (verified in V96 seed).
 */
export function toChartOfAccountsRow(api: ApiChartOfAccountRow): ChartOfAccountsRow {
    const audit = {
        regId:  api.reg_id,
        regDtm: api.reg_dtm,
        modId:  api.mod_id,
        modDtm: api.mod_dtm,
    };
    if (api.restricted) {
        return {
            id:             api.chart_acct_seq_no,
            chartAcctSeqNo: api.chart_acct_seq_no,
            kind:           "group",
            accountCode:    api.chart_acct_cd,
            accountTypeEn:  api.chart_acct_nm_en,
            accountTypeVi:  api.chart_acct_nm_vn ?? api.chart_acct_nm_en,
            accountTypeKo:  api.chart_acct_nm_ko ?? api.chart_acct_nm_en,
            restricted:     true,
            chartAcctLevel: 1,
            audit,
        };
    }
    return {
        id:             api.chart_acct_seq_no,
        chartAcctSeqNo: api.chart_acct_seq_no,
        kind:           "child",
        accountCode:    api.chart_acct_cd,
        accountTypeEn:  api.chart_acct_nm_en,
        accountTypeVi:  api.chart_acct_nm_vn ?? "",
        accountTypeKo:  api.chart_acct_nm_ko ?? "",
        parentCode:     api.parent_chart_acct_cd,
        calcRule:       calRuleToGlyph(api.cal_rule),
        status:         api.stts === "A" ? "active" : "inactive",
        restricted:     false,
        chartAcctLevel: api.chart_acct_level,
        audit,
    };
}

/**
 * Render order — restricted roots first (ACC-01, ACC-02, ACC-03),
 * then for each root every descendant depth-first (sorted by code),
 * then non-restricted roots + their descendants, then any orphans
 * (parent missing or grandfathered cycle) at the end. Keeps the
 * tabular hierarchy readable when the backend's default sort
 * (CHART_ACCT_CD ASC) interleaves restricted roots with numeric
 * codes.
 *
 * <p>The tree walk uses {@code chart_acct_cd} → row map, so it's
 * O(n) on tenant size (~50 rows in practice). Cycles in the input
 * data (e.g. seq 104 in the V97 demo seed which parents itself) are
 * detected via a visited set so the walk terminates.
 */
export function sortChartOfAccountsRows(rows: ChartOfAccountsRow[]): ChartOfAccountsRow[] {
    if (rows.length === 0) return rows;

    const byCode = new Map<string, ChartOfAccountsRow>();
    const childrenByParent = new Map<string, ChartOfAccountsRow[]>();
    for (const row of rows) {
        byCode.set(row.accountCode, row);
        const parent = row.kind === "child" ? row.parentCode : null;
        if (parent) {
            const arr = childrenByParent.get(parent) ?? [];
            arr.push(row);
            childrenByParent.set(parent, arr);
        }
    }

    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    for (const arr of childrenByParent.values()) {
        arr.sort((a, b) => collator.compare(a.accountCode, b.accountCode));
    }

    const visited = new Set<string>();
    const out: ChartOfAccountsRow[] = [];

    function emit(row: ChartOfAccountsRow) {
        if (visited.has(row.chartAcctSeqNo)) return;
        visited.add(row.chartAcctSeqNo);
        out.push(row);
        const children = childrenByParent.get(row.accountCode) ?? [];
        for (const child of children) {
            if (child.chartAcctSeqNo === row.chartAcctSeqNo) continue; // self-parent
            emit(child);
        }
    }

    // 1. Restricted roots first, sorted by code (ACC-01, ACC-02, ACC-03).
    const restrictedRoots = rows
        .filter((r) => r.kind === "group")
        .sort((a, b) => collator.compare(a.accountCode, b.accountCode));
    restrictedRoots.forEach(emit);

    // 2. Non-restricted root children (kind:"child" with no parent) — sorted by code.
    const nonRestrictedRoots = rows
        .filter((r) => r.kind === "child" && !r.parentCode && !visited.has(r.chartAcctSeqNo))
        .sort((a, b) => collator.compare(a.accountCode, b.accountCode));
    nonRestrictedRoots.forEach(emit);

    // 3. Any row we haven't visited (orphan parent / cycle) — emit verbatim.
    for (const row of rows) {
        if (!visited.has(row.chartAcctSeqNo)) {
            out.push(row);
            visited.add(row.chartAcctSeqNo);
        }
    }

    return out;
}

/**
 * Build a Create / Update wire body from the inline-row form
 * values. Empty strings on the wire-optional fields collapse to
 * `null` — the backend treats `""` as a real value otherwise (legacy
 * `comm_0223_001_c001` validates `parent_chart_acct_cd` with
 * `isNotBlank`; sending `""` would trip the parent-not-found guard).
 */
export function toChartOfAccountsRequest(
    form: ChartOfAccountsFormValues,
): ApiChartOfAccountCreateRequest {
    return {
        chart_acct_cd:         form.accountCode.trim(),
        chart_acct_nm_en:      form.nameEn.trim(),
        chart_acct_nm_vn:      blankToNull(form.nameVi),
        chart_acct_nm_ko:      blankToNull(form.nameKo),
        parent_chart_acct_cd:  blankToNull(form.parentCode),
        cal_rule:              glyphToCalRule(form.calcRule),
        stts:                  form.status === "active" ? "A" : "I",
    };
}

/** Update bodies share the Create shape; alias for call-site clarity. */
export const toChartOfAccountsUpdateRequest = toChartOfAccountsRequest as (
    form: ChartOfAccountsFormValues,
) => ApiChartOfAccountUpdateRequest;

/**
 * Seed the inline Edit form from an existing child row.
 */
export function toFormValues(
    row: Extract<ChartOfAccountsRow, { kind: "child" }>,
): ChartOfAccountsFormValues {
    return {
        accountCode: row.accountCode,
        nameEn:      row.accountTypeEn,
        nameVi:      row.accountTypeVi,
        nameKo:      row.accountTypeKo,
        parentCode:  row.parentCode ?? "",
        calcRule:    row.calcRule ?? "",
        status:      row.status,
    };
}

/* ----------------------------------------------------------------- */

function calRuleToGlyph(value: "P" | "M" | null): "+" | "-" | null {
    if (value === "P") return "+";
    if (value === "M") return "-";
    return null;
}

function glyphToCalRule(value: "+" | "-" | ""): "P" | "M" | null {
    if (value === "+") return "P";
    if (value === "-") return "M";
    return null;
}

function blankToNull(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
