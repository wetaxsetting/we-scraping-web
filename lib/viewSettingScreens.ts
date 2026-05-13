/**
 * Central screenId registry for View Setting.
 *
 * Single source of truth for the {@link SCREEN_IDS} the View Setting
 * feature consumes — frontend hooks, backend API requests, and
 * `SYS_SCR_OPTION_WECMS.web_svc_id` / `USER_SCR_OPTION_WECMS.web_svc_id`
 * Flyway seeds all key against the same constants exported here.
 *
 * ## Convention
 *
 * Screen ids follow `<module>-<page>[-<type>]` in lowercase kebab-case,
 * derived from the Next.js route + the page's display context. Examples:
 *
 *   /banking/account-inquiry      + VND  →  banking-account-inquiry-vnd
 *   /banking/account-inquiry-fcy  + FCY  →  banking-account-inquiry-fcy
 *   /payment/approval-box         + —    →  payment-approval-box
 *   /addon/sales-einvoices        + —    →  addon-sales-einvoices
 *
 * The id is **derived from** the route, not equal to it — the route
 * `/banking/account-inquiry` is a path, the screenId
 * `banking-account-inquiry-vnd` is a stable identifier carrying the
 * additional VND/FCY context. New pages add a constant here in the same
 * MR that wires View Setting; pages consume the constant, never the raw
 * string.
 *
 * ## Forbidden patterns (caught at review)
 *
 * - Raw URL paths: `"/banking/account-inquiry"` ← do not use as screenId.
 * - Legacy JEX ids: `"fnsh_0001_001"`, `"fnap_0001_001"`, … ← legacy IDs
 *   are read-only references inside `WECMS DEV/`; the refactor frontend
 *   never imports them.
 * - Duplicated tokens: `"banking-banking-account-inquiry-vnd"`,
 *   `"banking-account-inquiry-account-inquiry-vnd"`.
 * - Too-short ids missing module: `"account-inquiry-vnd"` —
 *   `<module>-<page>-<type>` is the minimum.
 *
 * ## Why not derive at runtime from `usePathname()` / `lib/routes.ts`?
 *
 * - Routes are user-visible URLs; ids are stable database keys. They
 *   may diverge (a route can be moved to `/banking/inquire-accounts`
 *   without bumping the id, preserving every user's saved overrides).
 * - VND / FCY twins live at **distinct** routes
 *   (`/banking/account-inquiry` vs. `/banking/account-inquiry-fcy`) and
 *   need distinct ids — the type segment cannot come from the URL alone,
 *   and the registry is the only place keyed by both.
 * - Backend must reject unknown ids; if every page generated its own
 *   string from the URL, typos would silently spawn new sys/user rows.
 *   A centralised constant set caught at compile time prevents that.
 */

/** Default `dymAreaId` for single-area pages. Multi-area pages declare
 *  their own kebab-case area names alongside their screenId; never use
 *  legacy numeric names like `table1` / `table2`. */
export const DEFAULT_AREA_ID = "default";

/**
 * The closed set of screenIds wired into the View Setting feature.
 * Every consumer (frontend hook, Flyway seed, integration test) must
 * route through this map. Adding a new screen = one entry here + one
 * `SYS_SCR_OPTION_WECMS` seed migration.
 *
 * IMPORTANT — preventing duplicates:
 *
 * - **Every value must be unique** across this object. The module-load
 *   guard below throws at import time if two keys resolve to the same
 *   string, so accidental copy-paste is caught before any consumer
 *   renders. Don't delete the guard.
 * - **Never inline a literal `"banking-account-inquiry-vnd"`** at the
 *   call site — always import the constant. A typo (e.g.
 *   `banking-account-iquiry-vnd`) would silently spawn an unknown id
 *   and orphan rows under the wrong key. The registry is the only
 *   authoritative source.
 */
export const SCREEN_IDS = {
    /** Banking > Account Inquiry — VND view. */
    ACCOUNT_INQUIRY_VND: "banking-account-inquiry-vnd",
    /** Banking > Account Inquiry — FCY view (wired when the FCY twin
     *  ships its View Setting popup). */
    ACCOUNT_INQUIRY_FCY: "banking-account-inquiry-fcy",
    /** Add-on Service > Sales e-Invoices — outbound customer invoices.
     *  Per IR-9 the page consumes View Setting *data* (column metadata
     *  + Excel export integration) but does NOT render the popover or
     *  expose a list-view toolbar icon. Seeded by V45. */
    ADDON_SALES_EINVOICES: "addon-sales-einvoices",
    /** Add-on Service > Bill / Expenses e-Invoices — inbound supplier
     *  invoices. Same View Setting data consumption + same UI scope as
     *  the Sales sibling. Seeded by V45. */
    ADDON_EXPENSES_EINVOICES: "addon-expenses-einvoices",
    /** Add-on Service > Operation Status Inquiry — counterparty GDT
     *  operating-status snapshot. Page consumes View Setting *data*
     *  (Excel export column intersection) but does NOT render the
     *  popover — Figma 12346:109158 has no list-view icon, toolbar is
     *  Excel + Print + Update + Inquire only. Seeded by V56. */
    ADDON_OPERATION_STATUS: "addon-operation-status",
    /** Settings > VAS Account — per-tenant accounting code list inside
     *  the Settings modal. Seeded by V79 (refactor `vas-account.md`
     *  feature spec §8). The popover itself is NOT rendered yet — the
     *  modal panel has no toolbar list-icon button — so this entry
     *  reserves the screenId for the V79 seed + future popover wiring
     *  without changing the panel chrome. */
    SETTINGS_VAS_ACCOUNT: "vas-account",
    /** Settings > Purpose — per-tenant transaction-purpose master list
     *  inside the Settings modal. Reserves the screenId for the
     *  `AUDIT_LOGS_INFM.WSVC_ID` slug + future View Setting popover
     *  wiring. The popover itself is NOT rendered today (OQ-FE-1 in
     *  the Phase 1 feature spec — Figma 9438:19204 has no list-icon
     *  button on the toolbar). This entry exists so the audit-log
     *  filter, log/MDC tags, and any future seed migration all key
     *  against the same canonical constant. */
    SETTINGS_PURPOSE_SETTINGS: "purpose-settings",
    /** Payment > Approval Box — centralized approval inbox for the six
     *  payment types (APPR_DV in 21/31/32/33/34/35). Seeded by the
     *  Phase 1 backend MR (V84). */
    PAYMENT_APPROVAL_BOX: "approval-box",
    /** Payment > Internal Transfer > Scheduled Transfer — batch list of
     *  scheduled (pre-dispatch) internal transfer files. Seeded by V85.
     *  The list-view popover is NOT rendered yet — the page is static-UI
     *  today and the toolbar list-icon is inert. This entry reserves the
     *  screenId for the V85 seed + future popover wiring. */
    PAYMENT_INTERNAL_TRANSFER_SCHEDULED: "payment-internal-transfer-scheduled",
    /** Payment > Internal Transfer > Scheduled Transfer detail — per-line
     *  table inside the detail page. */
    PAYMENT_INTERNAL_TRANSFER_SCHEDULED_DETAIL: "payment-internal-transfer-scheduled-detail",
    /** Payment > Internal Transfer > Transfer Result — read-only batch
     *  list of dispatched / in-progress transfers. */
    PAYMENT_INTERNAL_TRANSFER_RESULT: "payment-internal-transfer-result",
    /** Payment > Internal Transfer > Transfer Result detail — per-line
     *  table with `proc_stat` / `rs_cd` / `rs_msg` (Phase B fields return
     *  null on the wire until dispatch tables land). */
    PAYMENT_INTERNAL_TRANSFER_RESULT_DETAIL: "payment-internal-transfer-result-detail",
} as const;

export type ScreenId = (typeof SCREEN_IDS)[keyof typeof SCREEN_IDS];

/**
 * Module-load guard: throws on import if SCREEN_IDS values collide.
 * Catches accidental copy-paste duplicates before any consumer renders.
 */
(function assertUniqueScreenIdValues() {
    const seen = new Set<string>();
    for (const [key, value] of Object.entries(SCREEN_IDS)) {
        if (seen.has(value)) {
            throw new Error(
                `Duplicate screenId in SCREEN_IDS: '${value}' is used by multiple keys (last seen on '${key}'). ` +
                    "Each entry must map to a unique kebab-case id.",
            );
        }
        seen.add(value);
    }
})();

/**
 * Reverse mapping: every entry in {@link SCREEN_IDS} that resolves to a
 * concrete Next.js route. Used by tooling / tests to walk every wired
 * screen and assert its View Setting wiring is intact (popover renders,
 * COLUMN_REGISTRY exists, fallback columns match the seed). VND/FCY
 * twins live at **distinct** routes (`/banking/account-inquiry` vs.
 * `/banking/account-inquiry-fcy`); the registry holds both ids so the
 * lookup is screenId-keyed, not route-keyed.
 */
export const SCREEN_ID_TO_ROUTE: Readonly<Record<ScreenId, string>> = {
    [SCREEN_IDS.ACCOUNT_INQUIRY_VND]: "/banking/account-inquiry",
    [SCREEN_IDS.ACCOUNT_INQUIRY_FCY]: "/banking/account-inquiry-fcy",
    [SCREEN_IDS.ADDON_SALES_EINVOICES]: "/addon/sales-einvoices",
    [SCREEN_IDS.ADDON_EXPENSES_EINVOICES]: "/addon/expenses-einvoices",
    [SCREEN_IDS.ADDON_OPERATION_STATUS]: "/addon/operation-status",
    // VAS Account lives inside the Settings modal, not a top-level
    // route — there is no Next.js `app/settings/vas-account/page.tsx`.
    // The "route" here points at the dashboard root, used only by
    // tooling that walks the registry; the panel is reached via
    // `<SettingsModal>` (see `components/settings/SettingsNav.tsx`).
    [SCREEN_IDS.SETTINGS_VAS_ACCOUNT]: "/banking/account-inquiry",
    // Purpose Settings lives inside the Settings modal (no top-level
    // route). Tooling-only route placeholder — same convention as VAS
    // Account above.
    [SCREEN_IDS.SETTINGS_PURPOSE_SETTINGS]: "/banking/account-inquiry",
    [SCREEN_IDS.PAYMENT_APPROVAL_BOX]: "/payment/approval-box",
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED]:
        "/payment/internal-transfer/scheduled-transfer",
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED_DETAIL]:
        "/payment/internal-transfer/scheduled-transfer/[id]",
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT]:
        "/payment/internal-transfer/transfer-result",
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT_DETAIL]:
        "/payment/internal-transfer/transfer-result/[id]",
};

/** True if the candidate string is a registered screenId. Backend
 *  validators may also enforce the `<module>-<page>[-<type>]` regex,
 *  but the closed set is the authoritative gate on the frontend. */
export function isKnownScreenId(candidate: string): candidate is ScreenId {
    return (Object.values(SCREEN_IDS) as readonly string[]).includes(candidate);
}
