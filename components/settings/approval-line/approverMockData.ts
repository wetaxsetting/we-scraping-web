/**
 * Static directory + chain helpers for the Add Approval Line dialog
 * (Figma 9196:11969 / 9196:11547) and the Add Approver popup
 * (Figma 9196:12153 / 9196:12218 / 9196:12296).
 *
 * Two roles:
 *   - `APPROVER_POOL`  — the directory of people the user can pick from
 *                        in the popup. Each entry carries the position +
 *                        department fields the dialog table needs once
 *                        a pick lands in the chain.
 *   - `MAX_APPROVERS`  — chain cap (5). Drives the footer "n of 5" badge,
 *                        the "+ Add Approver" disabled state, and the
 *                        popover's per-pick capacity calculation.
 */
export type ApproverRow = {
    id: string;
    name: string;
    position: string;
    department: string;
};

/**
 * Directory of selectable approvers shown inside the Add Approver popup.
 * Names match the user-supplied static spec; position + department are
 * Figma-style placeholders so the dialog table looks complete once a pick
 * lands in the chain. Replace with the real `/api/v1/users` directory
 * call when the backend lands.
 */
export const APPROVER_POOL: ApproverRow[] = [
    { id: "p-kim-thu", name: "Kim Thu", position: "UX / UI DESIGN", department: "P.O." },
    { id: "p-test-d", name: "TEST D", position: "QA", department: "P.O." },
    { id: "p-test-a", name: "TEST A", position: "UX / UI DESIGN", department: "P.O." },
    { id: "p-test-c", name: "TEST C", position: "QA", department: "P.O." },
    { id: "p-thuy-linh", name: "Thuy Linh", position: "UX / UI DESIGN", department: "P.O." },
];

/** Maximum approvers per chain (mirrors Figma "5" cap). */
export const MAX_APPROVERS = 5;
