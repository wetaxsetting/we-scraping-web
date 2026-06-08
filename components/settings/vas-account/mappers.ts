import type {
    ApiVasAccountCreateRequest,
    ApiVasAccountRow,
    ApiVasAccountUpdateRequest,
} from "@/lib/types/api";

import type {
    VasAccountFormValues,
    VasAccountRow,
    VasAccountStatus,
    VasAccountType,
} from "./types";

/**
 * Wire → in-memory mapping. Handles the legacy code → semantic enum
 * translation (`"0"` → `"dual"`, `"A"` → `"active"`) so components
 * never touch raw legacy codes. The wire-side i18n keys are passed
 * through verbatim so the table renders via `t(typeKey)` / `t(statusKey)`.
 *
 * The wire ships `vas_acct_seq_no` as a string already (legacy
 * NUMERIC(10,0); see `lib/types/api.ts ApiVasAccountRow`); the
 * in-memory row also keeps it as a string for the same reason.
 */
export function statusFromCode(code: string): VasAccountStatus {
    return code === "I" ? "inactive" : "active";
}

export function statusToCode(status: VasAccountStatus): "A" | "I" {
    return status === "inactive" ? "I" : "A";
}

export function typeFromCode(code: string): VasAccountType {
    if (code === "1") return "credit";
    if (code === "2") return "debit";
    return "dual";
}

// typeToCode removed 2026-05-11 — the dialog no longer surfaces a Type
// selector and the wire omits `vas_acct_type` on Create / Update (the
// backend defaults to Dual / preserves existing). The READ path still
// uses `typeFromCode` so the in-memory row carries the legacy enum.

/**
 * Build the two-level tree from the flat backend list. Mirrors the
 * legacy `comm_0217_001.ts buildHierarchy` prefix-tree logic:
 *
 *   1. Lookup every row by its `vas_acct_cd`.
 *   2. For each row, walk `vas_acct_cd[0..n-1]` shrinking by one
 *      character at a time, looking for a row whose code equals the
 *      prefix (e.g. `1111` → look for `111`).
 *   3. The first match is the parent; if no prefix matches, the row
 *      is a top-level parent.
 *
 * The function returns a stable, code-sorted flat list of `parent`
 * rows followed by their `child` rows, ready for the table renderer.
 *
 * Tree is computed over the FULL loaded dataset: the panel requests the
 * VAS Account list with `all: true` (no pagination), so every parent and
 * its prefix-children are present in the same response and never split
 * across pages. This matches legacy `comm_0217_001.ts buildHierarchy`,
 * which ran over all rows. (Supersedes the earlier DN-6 per-page-slice
 * note — see RISK-1 / RISK-2 in docs/features/vas-account/refactor-audit.md.)
 */
export function buildTree(rows: ApiVasAccountRow[]): VasAccountRow[] {
    if (rows.length === 0) return [];

    const byCode = new Map<string, ApiVasAccountRow>();
    for (const row of rows) byCode.set(row.vas_acct_cd, row);

    type Linked = { row: ApiVasAccountRow; parentCode: string | null; children: ApiVasAccountRow[] };
    const linked = new Map<string, Linked>();
    for (const row of rows) {
        linked.set(row.vas_acct_cd, { row, parentCode: null, children: [] });
    }

    // Find each row's nearest existing prefix-parent (≥ 3 chars).
    for (const row of rows) {
        const code = row.vas_acct_cd;
        for (let i = code.length - 1; i >= 3; i--) {
            const candidate = code.slice(0, i);
            if (byCode.has(candidate) && candidate !== code) {
                linked.get(code)!.parentCode = candidate;
                linked.get(candidate)!.children.push(row);
                break;
            }
        }
    }

    // Root nodes — sorted by code.
    const roots = rows
        .filter((r) => linked.get(r.vas_acct_cd)!.parentCode === null)
        .sort((a, b) => a.vas_acct_cd.localeCompare(b.vas_acct_cd));

    const out: VasAccountRow[] = [];
    const seen = new Set<string>();

    const emit = (apiRow: ApiVasAccountRow, isParent: boolean, parentCode?: string) => {
        if (seen.has(apiRow.vas_acct_cd)) return;
        seen.add(apiRow.vas_acct_cd);
        const base = {
            id: apiRow.vas_acct_seq_no,
            seqNo: apiRow.vas_acct_seq_no,
            vasCode: apiRow.vas_acct_cd,
            accountName: apiRow.vas_acct_nm,
            englishName: apiRow.vas_acct_enm,
            type: typeFromCode(apiRow.vas_acct_type),
            typeKey: apiRow.vas_acct_type_key,
            status: statusFromCode(apiRow.stts),
            statusKey: apiRow.stts_key,
            notes: apiRow.cont,
        };
        if (isParent) {
            out.push({ ...base, kind: "parent" });
        } else {
            out.push({ ...base, kind: "child", parentCode: parentCode! });
        }
    };

    for (const root of roots) {
        emit(root, true);
        const children = linked
            .get(root.vas_acct_cd)!
            .children.slice()
            .sort((a, b) => a.vas_acct_cd.localeCompare(b.vas_acct_cd));
        for (const child of children) emit(child, false, root.vas_acct_cd);
    }

    return out;
}

/** Form values → create wire body. Per PO call 2026-05-11 the UI no
 *  longer exposes `Type` or `VAS Account Name (English)`; the subsequent
 *  UI cleanup pass also retired the `Notes / Optional description`
 *  field. The wire omits all three keys; the backend defaults Type to
 *  Dual on Create and leaves English Name / Notes unset. */
export function toCreateRequest(values: VasAccountFormValues): ApiVasAccountCreateRequest {
    return {
        vas_acct_cd: values.vasCode.trim(),
        vas_acct_nm: values.accountName.trim(),
        stts: statusToCode(values.status),
    };
}

/** Form values → update wire body. Same fields as create — the
 *  backend preserves existing Type / English Name / Notes when omitted. */
export function toUpdateRequest(values: VasAccountFormValues): ApiVasAccountUpdateRequest {
    return toCreateRequest(values);
}
