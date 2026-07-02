/* ============================================================================
 *  Memo drawer — shared static-UI types.
 *
 *  STATIC UI ONLY. These types back local React state — there is no wire
 *  DTO, no API contract, and no snake_case boundary here. When this drawer
 *  is later wired to a real endpoint, add the wire type to lib/types/api.ts
 *  and a mapper; do NOT reshape these in-memory types to match the wire.
 * ========================================================================== */

/** The six color tags surfaced in the Memo header (Figma 5549:24188-96).
 *  Single-letter PNG suffix scheme mirrors the live JEX memo drawer:
 *  G=green, B=blue, Y=yellow, W=white/gray, R=red/pink, P=purple. */
export type MemoColor = "green" | "blue" | "yellow" | "gray" | "pink" | "purple";

/** One memo (comment) rendered in the list. `datetime` is a pre-formatted
 *  display string (`dd-MM-yyyy HH:mm`) — no Date object is stored so the
 *  static list renders identically on every reload. */
export interface Memo {
    id:       string;
    author:   string;
    message:  string;
    datetime: string;
    /** Author-only gate (wired mode) — Edit / Delete render only when
     *  `true`. `undefined` means editable (static preview default). */
    canEdit?: boolean;
}
