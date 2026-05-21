/**
 * Approver picker types + per-feature constants.
 *
 * <p>{@link ApproverRow} is the in-memory shape every approver flows
 * through — used by the Add Approver popover, the chain table inside
 * the Add / Edit dialog, and the API mappers. Keys map 1:1 to the
 * Spring `ApprovalLineApproverRow` DTO (`apprvrId`, `apprvrNm`,
 * `apprvrPosi`, `apprvrDept`, `apprvrDispOrd`, `userImgUrl`).
 *
 * <p>{@link MAX_APPROVERS} is the hard cap pinned in
 * {@code wecms-api} via
 * {@code ApprovalLineConstants.MAX_APPROVERS} and the
 * {@code WBE_APPROVAL_LINE_TOO_MANY_APPROVERS} error code. Bean
 * validation + DB column {@code NUMERIC(1,0)} + the service-layer
 * guard share this value.
 *
 * <p>{@link APPROVER_POOL} is a static directory retained as an
 * offline-dev affordance only — the dialog now reads the live
 * tenant directory via {@code useApiData(fetchTenantUsers)}
 * against {@code GET /api/v1/users}. Test fixtures + Storybook
 * may still import this constant; production renders never do.
 */
export type ApproverRow = {
    /** Same value as the Spring DTO's {@code apprvrId} — used as the
     *  primary key for diff-sync on Update + as the deduplication key
     *  inside the picker. */
    id:         string;
    name:       string;
    position:   string;
    department: string;
    /** Optional 1-based display order. Server-authoritative on writes
     *  (service ignores the wire value and re-numbers 1..N from array
     *  position), but the dialog table renders the supplied value for
     *  read-side correctness. */
    dispOrd?:   number;
    /** Optional `/api/v1/users/{id}/image` URL. Null / undefined →
     *  frontend renders the existing `<Avatar>` icon fallback. */
    userImgUrl?: string;
};

/** Maximum approvers per chain — mirrors backend
 *  {@code ApprovalLineConstants.MAX_APPROVERS}. */
export const MAX_APPROVERS = 5;

/**
 * Static directory of selectable approvers. Offline-dev affordance —
 * the dialog will switch to a tenant-users fetch when the shared
 * endpoint ships. Names / positions / departments match Figma
 * 9196:12153.
 */
export const APPROVER_POOL: ApproverRow[] = [
    { id: "p-kim-thu",    name: "Kim Thu",    position: "UX / UI DESIGN", department: "P.O." },
    { id: "p-test-d",     name: "TEST D",     position: "QA",             department: "P.O." },
    { id: "p-test-a",     name: "TEST A",     position: "UX / UI DESIGN", department: "P.O." },
    { id: "p-test-c",     name: "TEST C",     position: "QA",             department: "P.O." },
    { id: "p-thuy-linh",  name: "Thuy Linh",  position: "UX / UI DESIGN", department: "P.O." },
];
