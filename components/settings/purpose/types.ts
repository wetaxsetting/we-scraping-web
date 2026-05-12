/**
 * Purpose tree (Figma 9438:19204).
 *
 * Two-level hierarchy: level-1 nodes (e.g. BD01) may carry children
 * (BD01-01 … BD01-04). Children never carry their own children — the
 * tree is intentionally flat beyond depth 2 to mirror the JEX live
 * system + Chart of Accounts pattern.
 *
 * Phase 3 (2026-05-12) extended this shape with the wire-derived
 * fields the live API surfaces: `useUsagCd` (10-digit system PK —
 * opaque to the UI, used for every write path; distinct from the
 * user-visible `code` which is `hand_use_usag_cd` on the wire),
 * `parentSystemCd`/`parentHandCd` (resolved against the level-1
 * index by the mapper), `modId`/`modDtm` (audit display surface), and
 * `dispOrd` (reorder support). All new fields are optional so the
 * static mock seed and offline-dev fallback continue to compile
 * unchanged.
 */
export type PurposeNode = {
    /** Stable React key. Mirrors `useUsagCd` post-API-wire-up; falls
     *  back to a slug for static-UI seed rows. */
    id: string;
    /** System PK from the wire — 10-digit zero-padded
     *  (`use_usag_cd`). Optional only for the static seed; every row
     *  produced by the mapper carries this. */
    useUsagCd?: string;
    /** User-visible purpose code (e.g. "BD01", "BD01-01"). Wire field
     *  `hand_use_usag_cd`. */
    code: string;
    /** Business-facing label (e.g. "Financial Investment Income").
     *  Wire field `use_usag_nm`. */
    name: string;
    /** Free-form description; "-" renders as a literal dash in the
     *  cell. Wire field `use_usag_cont`. */
    description: string;
    /** On/off toggle state. Stored per node so the table can show
     *  mixed state. Wire-derived: `disp_yn === "Y"`. */
    enabled: boolean;
    /**
     * True when this purpose has at least one transaction referencing
     * it. Delete is disabled (and the trash button reads as inert)
     * while this flag is set — the real check happens on the server
     * (OQ-5 recursive: server returns `true` when the row itself OR
     * any of its active children is referenced, so the frontend never
     * walks the tree itself).
     */
    usedInTransactions?: boolean;
    /** System code of the parent level-1 row (wire field
     *  `parent_use_usag_cd`). `null`/undefined ⇒ level-1 row. */
    parentSystemCd?: string | null;
    /** User-visible parent code, resolved against the level-1 index.
     *  The form's parent picker speaks user codes; this is what it
     *  pre-fills on edit. */
    parentHandCd?: string | null;
    /** Last editor login id — surfaced for audit display only. */
    modId?: string;
    /** Last modification timestamp (`yyyyMMddHHmmss` UTC). */
    modDtm?: string;
    /** Per-tenant sort order. Drives the reorder payload's
     *  `disp_ord` field. */
    dispOrd?: number;
    /** Children for level-1 nodes; undefined / empty = leaf row. */
    children?: PurposeNode[];
};
