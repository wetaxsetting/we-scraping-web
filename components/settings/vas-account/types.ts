/**
 * VAS Account panel — Figma 9194:8615 (Settings popup submenu).
 *
 * The table is a two-level tree: parent rows (3-digit code, e.g. 111 / 112 /
 * 113) own a set of child rows (4-digit code, e.g. 1111 / 1112). The flat
 * row list below carries `kind: "parent" | "child"` so the table renderer
 * can switch styling without holding a separate parent / child collection
 * (mirrors the canonical pattern from Chart of Accounts).
 *
 * The tree shape is **client-derived** from the flat backend response by
 * `buildTree(rows)` — the DB has no `parent_id` column. Backend ships a
 * flat list keyed by `vas_acct_seq_no`; the prefix-tree builder groups
 * children whose `vas_acct_cd` starts with a parent's code.
 */
export type VasAccountStatus = "active" | "inactive";

/** Three legacy account-type codes. Backend ships the raw "0"/"1"/"2"
 *  string + an i18n key; the in-memory shape carries both so the row
 *  menu / detail dialog can re-render the label without a re-fetch. */
export type VasAccountType = "dual" | "credit" | "debit";

/**
 * In-memory row used by the table + dialog UI. Stable across refetches
 * because it carries the server-issued `id` (`vas_acct_seq_no` as
 * string) — never the legacy WSVC id.
 */
export type VasAccountRow =
    | {
        id: string;
        kind: "parent";
        seqNo: string;
        vasCode: string;
        accountName: string;
        englishName: string | null;
        type: VasAccountType;
        typeKey: string | null;
        status: VasAccountStatus;
        statusKey: string | null;
        notes: string | null;
    }
    | {
        id: string;
        kind: "child";
        seqNo: string;
        vasCode: string;
        accountName: string;
        englishName: string | null;
        type: VasAccountType;
        typeKey: string | null;
        parentCode: string;
        status: VasAccountStatus;
        statusKey: string | null;
        notes: string | null;
    };

/** Form values for the Add / Edit dialog. Internal camelCase shape;
 *  the API client translates to the snake_case wire body.
 *
 *  Note: `type`, `englishName`, and `notes` are intentionally NOT on
 *  the form. Type / English Name were retired by the PO call
 *  2026-05-11; the Notes / Optional description field followed in the
 *  subsequent UI cleanup pass. The wire makes all three optional —
 *  the backend defaults Type to Dual on Create and preserves the
 *  existing entity value on Update for Type / English Name / Notes
 *  alike (so a future tool that sets any of them won't be silently
 *  wiped by an Edit dialog submit). The in-memory {@link VasAccountRow}
 *  still carries them because the API ships them on read paths. */
export type VasAccountFormValues = {
    vasCode: string;
    accountName: string;
    status: VasAccountStatus;
};
