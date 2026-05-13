/**
 * Chart of Accounts panel — Figma 9196:12740 (Settings popup submenu).
 *
 * Phase 1 wires the existing static-UI rows to the Spring
 * `/api/v1/settings/chart-of-accounts` family. The visual contract is
 * unchanged — the table still renders a two-level tree with `kind:
 * "group" | "child"` discriminator — but each row now carries the
 * backend metadata the panel needs to drive Save / Edit / Delete
 * round-trips:
 *
 *   - `chartAcctSeqNo` — server-allocated PK component; pinned for
 *     Update / Delete path-variable. Carried as `string` end-to-end
 *     because the DB column is `VARCHAR(14)` (see backend doc).
 *   - `restricted` — true iff the row's code is in the system-managed
 *     set {ACC-01, ACC-02, ACC-03}. Drives both `kind: "group"`
 *     visual styling and the disabled-Edit / disabled-Delete guard.
 *   - `chartAcctLevel` — 1..4 for in-cap rows; null for grandfathered
 *     orphan / cycle / depth-violator rows (legacy DEV data carries
 *     some — render under a "Deprecated depth" footnote per the
 *     feature spec).
 *
 * The `kind` discriminator stays so the existing renderer keeps
 * working: restricted level-1 rows render bold with no parent /
 * status / calc-rule / action affordances; everything else carries
 * the standard child cell set.
 */

/** Active / Inactive status. `cal_rule` on the wire is `"P" | "M"`;
 *  the in-memory shape exposes the rendered glyph instead so the
 *  table cell can render `+` / `-` directly. */
export type ChartOfAccountsStatus = "active" | "inactive";

/** Backend audit fields, carried through to the in-memory row for
 *  future row-level audit-log expansion + tooltip display. */
export type ChartOfAccountsAudit = {
    regId:  string;
    regDtm: string;
    modId:  string;
    modDtm: string;
};

export type ChartOfAccountsRow =
    | {
        /** Stable id used as the React key — backend `chartAcctSeqNo`. */
        id: string;
        /** Backend surrogate; pinned for Update / Delete paths. */
        chartAcctSeqNo: string;
        kind: "group";
        accountCode: string;
        accountTypeEn: string;
        accountTypeVi: string;
        accountTypeKo: string;
        /** Always `true` on group rows — restricted root code
         *  (ACC-01 / ACC-02 / ACC-03). Group rows are always
         *  restricted in the refactor data shape. */
        restricted: true;
        chartAcctLevel: 1;
        audit: ChartOfAccountsAudit;
    }
    | {
        id: string;
        chartAcctSeqNo: string;
        kind: "child";
        accountCode: string;
        accountTypeEn: string;
        accountTypeVi: string;
        accountTypeKo: string;
        /** May be `null` when the row is an orphan / grandfathered
         *  cycle (`chartAcctLevel === null` then). */
        parentCode: string | null;
        /** Rendered glyph — `+` or `-`. The wire carries `P` / `M`;
         *  the mapper translates. `null` when the row has no rule. */
        calcRule: "+" | "-" | null;
        status: ChartOfAccountsStatus;
        /** Refactor adds non-restricted level-1 rows (legacy DEV
         *  carried some; e.g. seq 90). Renders as a "child" row
         *  visually but has no parent. */
        restricted: false;
        /** 1..4 for in-cap rows; null for grandfathered orphans /
         *  cycles. */
        chartAcctLevel: number | null;
        audit: ChartOfAccountsAudit;
    };

/** Per-row form state used by the inline Add / Edit row. Mirrors the
 *  visible form fields, not the wire shape — the mapper at
 *  `./mappers.ts` translates to {@link ApiChartOfAccountCreateRequest} /
 *  {@link ApiChartOfAccountUpdateRequest} at the API boundary. */
export type ChartOfAccountsFormValues = {
    accountCode:   string;
    nameEn:        string;
    nameVi:        string;
    nameKo:        string;
    /** Empty string ⇒ root row (server stores `null`). */
    parentCode:    string;
    /** Empty ⇒ no rule (server stores `null`). */
    calcRule:      "+" | "-" | "";
    status:        ChartOfAccountsStatus;
};

/** Inline-row mode threaded down from the panel. `null` keeps the
 *  table read-only; the panel renders a sibling inline-row table
 *  below the read-only one when the mode is set. */
export type InlineRowMode =
    | { kind: "add" }
    | { kind: "edit"; row: Extract<ChartOfAccountsRow, { kind: "child" }> }
    | null;
