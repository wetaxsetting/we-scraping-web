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
    /** Banking > Transaction History — per-account ledger (one screenId
     *  serves both VND and FCY scopes; CCY filtering is parameter-driven).
     *  Seeded by V128. Popover not rendered yet — entry exists so the
     *  shared Excel export pipeline (`POST /api/v1/banking/accounts/transactions/export`)
     *  passes the registry + visibility intersection without WBE2013. */
    BANKING_TRANSACTION_HISTORY: "banking-transaction-history",
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
    /** Payment > Vendor Payment > Scheduled Payment — batch list of
     *  scheduled (pre-dispatch) vendor payment files. Mirrors the
     *  Internal Transfer scheduled screen (Figma 24:1398). Seeded by
     *  V141. */
    PAYMENT_VENDOR_PAYMENT_SCHEDULED: "payment-vendor-payment-scheduled",
    /** Payment > Vendor Payment > Scheduled Payment > Detail — per-line
     *  table inside the Vendor detail page (Figma 24:4705). Mirrors
     *  legacy `pymn_0001_003`. Seeded by V142. */
    PAYMENT_VENDOR_PAYMENT_SCHEDULED_DETAIL: "payment-vendor-payment-scheduled-detail",
    /** Payment > Vendor Payment > Payment Result — read-only batch list
     *  of dispatched / in-progress vendor payments. Mirrors legacy
     *  `pymn_0002_001`. (Seed pending — frontend uses FALLBACK_COLUMNS.) */
    PAYMENT_VENDOR_PAYMENT_RESULT: "payment-vendor-payment-result",
    /** Payment > Vendor Payment > Payment Result detail — per-line table
     *  with PROC_STAT / RS_CD / RS_MSG. Mirrors legacy `pymn_0002_002`. */
    PAYMENT_VENDOR_PAYMENT_RESULT_DETAIL: "payment-vendor-payment-result-detail",
    /** Payment > Expense Payment > Scheduled Payment — batch list of
     *  scheduled expense payment files. Mirrors legacy `pymn_0003_001`.
     *  Seeded by V143. */
    PAYMENT_EXPENSE_PAYMENT_SCHEDULED: "payment-expense-payment-scheduled",
    /** Payment > Expense Payment > Scheduled Payment > Detail — per-line
     *  table inside the Expense detail page. Mirrors legacy
     *  `pymn_0003_003`. Seeded by V143. */
    PAYMENT_EXPENSE_PAYMENT_SCHEDULED_DETAIL: "payment-expense-payment-scheduled-detail",
    /** Payment > Expense Payment > Payment Result — read-only batch list
     *  of dispatched / in-progress expense payments. Mirrors legacy
     *  `pymn_0004_001`. Seeded by V143. */
    PAYMENT_EXPENSE_PAYMENT_RESULT: "payment-expense-payment-result",
    /** Payment > Expense Payment > Payment Result detail — per-line table
     *  with PROC_STAT / RS_CD / RS_MSG (Phase B fields return null on
     *  the wire until dispatch tables land). Mirrors legacy
     *  `pymn_0004_002`. Seeded by V143. */
    PAYMENT_EXPENSE_PAYMENT_RESULT_DETAIL: "payment-expense-payment-result-detail",
    /** Payment > Payroll Payment > Scheduled Payment — batch list of
     *  scheduled payroll payment files. Mirrors legacy `pymn_0005_001`.
     *  Seeded by V144. */
    PAYMENT_PAYROLL_PAYMENT_SCHEDULED: "payment-payroll-payment-scheduled",
    /** Payment > Payroll Payment > Scheduled Payment > Detail — per-line
     *  table inside the Payroll detail page. Mirrors legacy
     *  `pymn_0005_003`. Seeded by V144. */
    PAYMENT_PAYROLL_PAYMENT_SCHEDULED_DETAIL: "payment-payroll-payment-scheduled-detail",
    /** Payment > Payroll Payment > Payment Result — read-only batch list
     *  of dispatched / in-progress payroll payments. Mirrors legacy
     *  `pymn_0006_001`. Seeded by V144. */
    PAYMENT_PAYROLL_PAYMENT_RESULT: "payment-payroll-payment-result",
    /** Payment > Payroll Payment > Payment Result detail — per-line table
     *  with PROC_STAT / RS_CD / RS_MSG (Phase B fields return null on
     *  the wire until dispatch tables land). Mirrors legacy
     *  `pymn_0006_002`. Seeded by V144. */
    PAYMENT_PAYROLL_PAYMENT_RESULT_DETAIL: "payment-payroll-payment-result-detail",
    /** Settings > Contacts — per-tenant contact directory (Local +
     *  Overseas counterparties) inside the Settings modal. Seeded by
     *  V88 (8 columns including CHECKBOX + ETC specials). The popover
     *  itself is NOT rendered today (Figma 9194:9683 has no list-icon
     *  button on the toolbar — same scope decision as VAS Account /
     *  Purpose Settings); this entry reserves the screenId for the
     *  `AUDIT_LOGS_INFM.WSVC_ID` slug + future popover wiring. */
    SETTINGS_CONTACTS: "contacts",
    /** Settings > Approval Line — per-tenant approval-chain
     *  configuration inside the Settings modal. Mirrors legacy
     *  `comm_0222_*`. View Setting is NOT adopted in MVP (feature
     *  § 11 / OQ — legacy panel has no toolbar list-icon button,
     *  same precedent as ERP Transaction History / VAS Account /
     *  Purpose Settings / Contacts); no `SYS_SCR_OPTION_WECMS` seed
     *  ships in this MR. This entry reserves the screenId for the
     *  refactor identifier surface so log tags + any future seed
     *  migration + a possible popover wiring all key against the
     *  same canonical slug. */
    SETTINGS_APPROVAL_LINE: "approval-line",
    /** Settings > Chart of Accounts — per-tenant general-ledger
     *  account master inside the Settings modal. Mirrors legacy
     *  `comm_0223_001_*`. View Setting is NOT adopted in MVP (the
     *  legacy panel has no toolbar list-icon button — same precedent
     *  as approval-line / contacts / vas-account / purpose-settings);
     *  no `SYS_SCR_OPTION_WECMS` seed ships in this MR. This entry
     *  reserves the screenId for the refactor identifier surface so
     *  log tags, `AUDIT_LOGS_INFM.WSVC_ID` rows (slug
     *  `"chart-of-accounts"`), and a possible future popover wiring
     *  all key against the same canonical slug. */
    SETTINGS_CHART_OF_ACCOUNTS: "chart-of-accounts",
    /** Settings > Bank Account — per-tenant ACCT_MSTR list inside the
     *  Settings modal. Mirrors live JEX `comm_0183_*`. The seed lives in
     *  V127 (`bank-account-screen-seed.sql`) and keys the popover +
     *  sort whitelist (`BankAccountSortField`). Slug is `bank-account`
     *  (matches `SettingsBankAccountService.WSVC_ID`). */
    SETTINGS_BANK_ACCOUNT: "bank-account",
    /** Settings > Firm Banking History — read-only audit ledger of every
     *  outbound integration call (F / S / G / B legs). Mirrors legacy
     *  `comm_0221_001_r001`. View Setting popover NOT rendered today
     *  (legacy panel has no toolbar list-icon button — same precedent
     *  as ERP Transaction History / Approval Line / Chart of Accounts).
     *  This entry reserves the screenId for the V153 seed + Excel
     *  export pipeline (`POST /api/v1/settings/firm-banking-history/export`).
     *  The seed is required because `ExcelExportService` intersects
     *  requested columns against `SYS_SCR_OPTION_WECMS` — without the
     *  seed every column would be dropped with `WBE2013`. */
    SETTINGS_FIRM_BANKING_HISTORY: "firm-banking-history",
    /** Settings > ERP Transaction History — read-only audit ledger of
     *  files exchanged between WeCMS and the customer's ERP. Mirrors
     *  legacy `comm_0219_001`. View Setting popover NOT rendered
     *  (OQ-FE-2 resolved 2026-05-11). This entry reserves the screenId
     *  for the V154 seed + Excel export pipeline
     *  (`POST /api/v1/settings/erp-transaction-history/export`). */
    SETTINGS_ERP_TRANSACTION_HISTORY: "erp-transaction-history",
    /** Banking > Reports > Cash Flow — annual plan-vs-actual matrix.
     *  Mirrors legacy `cash_0001_001`. The popover is NOT rendered on
     *  the report page (Figma 9183:23697 has no list-icon button — same
     *  precedent as the Daily Cash / Daily Financial reports). This
     *  entry reserves the screenId so the V124 seed + Excel export
     *  pipeline + log/audit tags all key against the same canonical
     *  slug. Seeded by V124. */
    CASH_FLOW_REPORT: "cash-flow-report",
    /** Banking > Own Account Transfer — source-account picker for the
     *  Coocon NXiSAS-driven own-account transfer (legacy `trns_0001_001`).
     *  Scope: VND-only, same-`biz_key` only (PO 2026-05-18 OQ-A). The
     *  popover is shown via the toolbar icon and consumes the standard
     *  view-setting popover wiring used by transaction-history /
     *  operation-status. Backend slug + audit `WSVC_ID` match this
     *  string. */
    OWN_ACCOUNT_TRANSFER: "own-account-transfer",
    /** Banking > Internal Transfer > Transfer History — read-only list
     *  of NAPAS-routed inter-bank / intra-bank transfers populated by
     *  the upstream client-side Coocon iSAS-NX scrape. Mirrors legacy
     *  `trns_0003_001`. View Setting popover is NOT rendered (feature
     *  spec § 8.4 / OQ-5 — legacy panel has no toolbar list-icon
     *  button; same precedent as approval-line / chart-of-accounts /
     *  erp-transaction-history). This entry reserves the screenId for
     *  the refactor identifier surface so log tags, the audit
     *  `WSVC_ID` slug, and a possible future popover wiring all key
     *  against the same canonical slug. No `SYS_SCR_OPTION_WECMS`
     *  seed ships — the backend deliberately skipped that step. */
    TRANSFER_HISTORY: "transfer-history",
    /** Payment > Overseas Payment > Scheduled Payment — batch list of
     *  scheduled (pre-dispatch) overseas payment files. Mirrors legacy
     *  `pymn_0007_001` scheduled tab (OVRS_PYMN_MSTR rows). Seeded by
     *  V178. List-icon popover rendered. */
    PAYMENT_OVERSEAS_PAYMENT_SCHEDULED: "payment-overseas-payment-scheduled",
    /** Payment > Overseas Payment > Scheduled Payment > Detail — per-line
     *  table inside the Overseas detail page (Figma 29:15858). Mirrors
     *  legacy `pymn_0007_004` `<table-list-wrap[name='SCHEDULED_PAYMENT_DETAIL']>`.
     *  10-column layout: BNFC_NM · BNFC_BANK_NM · BNFC_ACCT_NO · BNFC_ADDR ·
     *  TRNF_CCY_CD · TRNF_AMT · FEE_PAYER_CD · MEMO · CHART_ACCT_CD ·
     *  BANK_TRAN_ID. Seeded by V214. */
    PAYMENT_OVERSEAS_PAYMENT_SCHEDULED_DETAIL: "payment-overseas-payment-scheduled-detail",
    /** Payment > Overseas Payment > Payment Result — read-only batch
     *  list of dispatched / in-progress overseas payments. Mirrors legacy
     *  `pymn_0007_001` result tab (OVRS_PYMN_SUMR rows filtered by date
     *  range + trnf_yn). Seeded by V176. List-icon popover rendered. */
    PAYMENT_OVERSEAS_PAYMENT_RESULT: "payment-overseas-payment-result",
    /** Payment > Overseas Payment > Payment Result detail — per-line
     *  table with beneficiary bank, account, name, currency, transfer
     *  amount, memo, and transfer result (TRNF_YN). Mirrors legacy
     *  `pymn_0007_001` detail view (OVRS_PYMN_SUMR_DETL rows).
     *  Seeded by V161. No View Setting popover — detail pages do not
     *  render the list-icon toolbar button. */
    PAYMENT_OVERSEAS_PAYMENT_RESULT_DETAIL: "payment-overseas-payment-result-detail",
    /** Payment > Corporate Card > Card Transactions — scraped card
     *  ledger. Mirrors legacy `card_0001_001`. Seeded by V176 (two
     *  `dym_area_id` variants: `table1` for PRDT_TYPE F/M, `table2`
     *  for HAENGSUNG `H`). The popover is NOT rendered in MVP — the
     *  seed exists to unlock the shared Excel export pipeline +
     *  reserve the slug for log / audit / future popover wiring. */
    PAYMENT_CARD_TRANSACTIONS: "card-transactions",
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
    [SCREEN_IDS.BANKING_TRANSACTION_HISTORY]: "/banking/transaction-history",
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
    [SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_SCHEDULED]:
        "/payment/vendor-payment/scheduled-payment",
    [SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_SCHEDULED_DETAIL]:
        "/payment/vendor-payment/scheduled-payment/[id]",
    [SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_RESULT]:
        "/payment/vendor-payment/payment-result",
    [SCREEN_IDS.PAYMENT_VENDOR_PAYMENT_RESULT_DETAIL]:
        "/payment/vendor-payment/payment-result/[id]",
    [SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_SCHEDULED]:
        "/payment/expense-payment/scheduled-payment",
    [SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_SCHEDULED_DETAIL]:
        "/payment/expense-payment/scheduled-payment/[id]",
    [SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_RESULT]:
        "/payment/expense-payment/payment-result",
    [SCREEN_IDS.PAYMENT_EXPENSE_PAYMENT_RESULT_DETAIL]:
        "/payment/expense-payment/payment-result/[id]",
    [SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_SCHEDULED]:
        "/payment/payroll/scheduled-payment",
    [SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_SCHEDULED_DETAIL]:
        "/payment/payroll/scheduled-payment/[id]",
    [SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_RESULT]:
        "/payment/payroll/payment-result",
    [SCREEN_IDS.PAYMENT_PAYROLL_PAYMENT_RESULT_DETAIL]:
        "/payment/payroll/payment-result/[id]",
    // Contacts lives inside the Settings modal (no top-level route).
    // Tooling-only route placeholder — same convention as VAS Account
    // / Purpose Settings above.
    [SCREEN_IDS.SETTINGS_CONTACTS]: "/banking/account-inquiry",
    // Approval Line lives inside the Settings modal (no top-level
    // route). Tooling-only route placeholder — same convention as
    // VAS Account / Purpose Settings / Contacts above.
    [SCREEN_IDS.SETTINGS_APPROVAL_LINE]: "/banking/account-inquiry",
    // Chart of Accounts lives inside the Settings modal (no top-level
    // route). Tooling-only route placeholder — same convention as
    // VAS Account / Purpose Settings / Contacts / Approval Line.
    [SCREEN_IDS.SETTINGS_CHART_OF_ACCOUNTS]: "/banking/account-inquiry",
    // Bank Account lives inside the Settings modal (no top-level
    // route). Tooling-only route placeholder — same convention as
    // VAS Account / Purpose Settings / Contacts / Approval Line /
    // Chart of Accounts above.
    [SCREEN_IDS.SETTINGS_BANK_ACCOUNT]: "/banking/account-inquiry",
    // Firm Banking History lives inside the Settings modal (no top-level
    // route). Tooling-only route placeholder — same convention as
    // VAS Account / Purpose Settings / Contacts / Approval Line.
    [SCREEN_IDS.SETTINGS_FIRM_BANKING_HISTORY]: "/banking/account-inquiry",
    // ERP Transaction History lives inside the Settings modal (no
    // top-level route). Tooling-only route placeholder.
    [SCREEN_IDS.SETTINGS_ERP_TRANSACTION_HISTORY]: "/banking/account-inquiry",
    [SCREEN_IDS.CASH_FLOW_REPORT]: "/banking/reports/cash-flow",
    [SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_SCHEDULED]:
        "/payment/overseas-payment/scheduled-payment",
    [SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_SCHEDULED_DETAIL]:
        "/payment/overseas-payment/scheduled-payment/[id]",
    [SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_RESULT]:
        "/payment/overseas-payment/payment-result",
    [SCREEN_IDS.PAYMENT_OVERSEAS_PAYMENT_RESULT_DETAIL]:
        "/payment/overseas-payment/payment-result/[id]",
    [SCREEN_IDS.PAYMENT_CARD_TRANSACTIONS]:
        "/payment/corporate-card/card-transactions",
    [SCREEN_IDS.OWN_ACCOUNT_TRANSFER]: "/banking/own-account-transfer",
    [SCREEN_IDS.TRANSFER_HISTORY]: "/banking/transfer-history",
};

/** True if the candidate string is a registered screenId. Backend
 *  validators may also enforce the `<module>-<page>[-<type>]` regex,
 *  but the closed set is the authoritative gate on the frontend. */
export function isKnownScreenId(candidate: string): candidate is ScreenId {
    return (Object.values(SCREEN_IDS) as readonly string[]).includes(candidate);
}
