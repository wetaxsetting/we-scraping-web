/**
 * Envelope for every backend response. Field names are lowercase
 * snake_case (CTO directive 2026-05-08); the api side enforces this
 * via a global Jackson SNAKE_CASE strategy in
 * `wecms-api-main/.../config/JacksonConfig.java`. Per-feature data
 * DTOs below still carry UPPER_SNAKE field names — they'll move to
 * lowercase as their matching backend feature lands in scope; the
 * envelope is the only piece that's already global lowercase.
 *
 * `timestamp` / `path` / `trace_id` are populated by the backend's
 * `GlobalExceptionHandler` on error responses so the frontend can
 * render `trace_id` in the error dialog (and ops can grep server logs
 * by the same id). Successes drop them.
 */
export interface CommonHead {
    error: boolean;
    code: string;
    message: string;
}

export interface ApiResponse<T> {
    status: CommonHead;
    data?: T;
    timestamp?: string;
    path?: string;
    trace_id?: string;
}

/**
 * Screen-option (View Setting) wire types — matches
 * wecms-api-main/.../domain/setting/dto/*. One row per column on a
 * page.
 *
 * <p>Field-name convention: property names are lowercase snake_case
 * (`field_id`, `disp_ord`) matching the wire. **Values** are stable
 * UPPERCASE semantic identifiers (`field_id === "BANK"`, `disp_yn ===
 * "Y"`) — those don't change.
 *
 * @property field_id  Stable column key (e.g. `"BANK"`, `"ACCT_NICK_NM"`)
 * @property field_nm  User-visible label
 * @property disp_ord  1-based render order
 * @property disp_yn   `"Y"` to render at all, `"N"` to hide
 * @property use_yn    Visibility toggle
 * @property fix_yn    User can't hide / reorder
 * @property size      Width hint (e.g. `"250px"`)
 * @property sort_yn   Header is sortable
 * @property html_cont Optional pre-rendered header HTML
 */
export interface ApiScreenOptionItem {
    field_id: string;
    field_nm: string;
    disp_ord: number;
    disp_yn?: "Y" | "N";
    use_yn: "Y" | "N";
    fix_yn: "Y" | "N";
    size?: string;
    sort_yn?: "Y" | "N";
    html_cont?: string | null;
}

export interface ApiScreenOptionListResponse {
    web_svc_id: string;
    dym_area_id: string;
    items: ApiScreenOptionItem[];
}

/** Payload for `GET /api/v1/screen-options/{webSvcId}/areas`. Used by
 *  multi-area pages to drive a tabbed View Setting popover. Single-area
 *  pages don't need this call. */
export interface ApiScreenAreaListResponse {
    web_svc_id: string;
    areas: Array<{
        dym_area_id: string;
        column_count: number;
    }>;
}

/**
 * Wire shape for `POST /api/v1/auth/login`. Matches the api side's
 * {@code LoginResponse} record. Two-shape envelope, discriminated by
 * presence of {@code companies_available}.
 *
 * <p><b>Operational expectation: one user = one company account.</b>
 * Current WeCMS operation treats a single login user as belonging to
 * exactly one active company. The **authenticated** shape below is
 * therefore the normal production response. The **chooser** shape is
 * an exceptional / test-demo path that only appears when a user has
 * ≥ 2 active USER_BUSI_CONN_INFM links — kept as a safe generic
 * fallback, not as a routine UX surface. See
 * {@code wecms-api-main/CLAUDE.md} §"Operational model: one user = one
 * company account" for the canonical rule.
 *
 * <ul>
 *   <li><b>Authenticated (normal).</b> {@code access_token},
 *       {@code biz_key}, {@code auth_gr_cd}, etc. are all present;
 *       {@code companies_available} is absent (the backend ships
 *       {@code NON_NULL} so it isn't serialised at all). Frontend
 *       persists the token and navigates to home directly.</li>
 *   <li><b>Chooser (exceptional).</b> {@code companies_available} is
 *       non-empty (length ≥ 2); {@code access_token} + tenant fields
 *       are absent. Frontend renders the company-chooser UI and
 *       resends the same credentials with the user's {@code biz_key}
 *       pick.</li>
 * </ul>
 *
 * <p>Every field is marked optional so a single TypeScript type
 * covers both shapes; the auth client narrows by checking
 * {@code companies_available}.
 *
 * <p>Stable role identifiers ({@code "ADMIN"} / {@code "USER"}) — see
 * the wire-naming rule in CLAUDE.md.
 */
export interface CompanyOptionRec {
    biz_key: string;
    cmpn_nm: string;
    auth_gr_cd: "ADMIN" | "USER";
    /** Verbatim {@code BUSI_INFM.PRDT_TYPE} letter for this option —
     *  any legacy code, may be {@code null}. The refactor explicitly
     *  recognises {@code F} / {@code M} / {@code H}; other letters
     *  are round-tripped but not used for gating. Frontend may render
     *  a product label next to the option but must not gate behaviour
     *  on it (no JWT exists yet for an unselected company). */
    prdt_type?: string | null;
}

export interface LoginResponseRec {
    /** Authenticated shape — present iff the login resolved to a single company. */
    access_token?: string;
    token_type?: string;
    expires_in?: number;

    user_id: string;
    user_nm: string;

    /** Authenticated shape — the BIZ_KEY the JWT was issued for. */
    biz_key?: string;
    lang_cd?: string;
    cmpn_nm?: string;
    auth_gr_cd?: "ADMIN" | "USER";

    /** Verbatim {@code BUSI_INFM.PRDT_TYPE} letter for the selected
     *  company. Null on the chooser shape; per-option product type is
     *  on each {@link CompanyOptionRec}. */
    prdt_type?: string | null;

    /** Verbatim {@code BUSI_INFM.TAX_ID} for the selected company —
     *  rendered in the Lock Screen popup (Figma 83:12764). Null on the
     *  chooser shape (no company selected yet) and null when the row
     *  has no value. The wire's {@code biz_key} is the internal WeCMS
     *  tenant identifier and must NEVER surface to the user. */
    tax_id?: string | null;

    /** Chooser shape — non-empty when the user has ≥ 2 active company
     *  links and must pick one before the JWT can be issued. */
    companies_available?: CompanyOptionRec[];
}

export interface MeResponseRec {
    user_id: string;
    user_nm: string;
    biz_key: string;
    lang_cd: string;
    cmpn_nm: string;
    auth_gr_cd: "ADMIN" | "USER";
    /** Echoed from the JWT claim. Verbatim {@code BUSI_INFM.PRDT_TYPE}
     *  letter for the active company; may be {@code null}. */
    prdt_type?: string | null;
    /** Verbatim {@code BUSI_INFM.TAX_ID} re-queried on every {@code
     *  /me} call (not signed into the JWT). May be {@code null} when
     *  the row carries no value. */
    tax_id?: string | null;
}

/**
 * Wire body for the second-step login call (the chooser-finalize
 * request). The frontend resends the original credentials plus the
 * BIZ_KEY the user picked from {@link LoginResponseRec#companies_available}.
 *
 * The backend re-validates the link exists for the (user_id, biz_key)
 * pair, ignoring any biz_key the user could not actually access.
 */
export interface LoginRequestRec {
    user_id: string;
    user_pw: string;
    biz_key?: string;
}

// ---------------------------------------------------------------------------
// Sprint 1 — Banking + Add-on Service wire DTOs.
// Property names are lowercase snake_case matching the wire (CTO directive
// 2026-05-08); mappers in lib/api/mappers.ts translate to camelCase frontend
// row types. Out-of-scope groups (Transaction History / Transfer / Reports)
// further down still carry UPPER_SNAKE — they migrate when their matching
// backend feature lands in scope.
// ---------------------------------------------------------------------------

// Banking — Account Inquiry
export interface ApiAccountRow {
    acct_seq_no: string;
    bank_cd: string;
    bank_nm: string;
    acct_no: string;
    acct_type_cd: string;
    /** Legacy English label kept for one MR cycle. Frontend SHOULD
     *  render via `acct_type_key` (resolved through `t(...)`); falls
     *  back to this verbatim string when the key is `null`. */
    acct_type_nm: string;
    /** Server-resolved i18n key under `bank.acct_type.*` (e.g.
     *  `bank.acct_type.03` for Current). `null` when the wire
     *  `acct_type_cd` has no registered enum entry — frontend falls
     *  back to `acct_type_nm`. Resolved via the Spring `AcctTypeCd`
     *  enum (mirrors legacy `wabooks.enums.AcctTypeCd`). Added
     *  2026-05-08 alongside the modernized backend enum. */
    acct_type_key: string | null;
    ccy_cd: string;
    acct_nick_nm: string;
    bal: string;
    real_amt: string;
    acct_bal_inq_stts: string;
    acct_bal_upd_dtm: string;
}

/**
 * Per-currency aggregation entry. One per distinct ccy_cd in the
 * filtered result. Drives the FCY page's per-currency summary tiles
 * (USD card + KRW card + …); VND page sees a single-entry list (VND).
 */
export interface ApiCurrencyTotal {
    ccy_cd: string;
    count: number;
    balance: string;
    available_bal: string;
}

/**
 * Distinct bank entry returned in the {@code banks_available} list of
 * the Account Inquiry response. Drives the bank-filter dropdown options
 * — option key is `bank_cd`, label is `bank_nm`. The list is independent
 * of the current bank/keyword/page filters so selecting one bank never
 * narrows the dropdown.
 */
export interface ApiBankOption {
    bank_cd: string;
    bank_nm: string;
}

export interface ApiAccountListResponse {
    /** Rows on the requested page. Length equals `page_size` except on
     *  the last page (or when the caller asked for the unpaged shape). */
    accounts: ApiAccountRow[];
    /** Unpaged filtered total — drives the "TOTAL ACCOUNTS" pill and
     *  the pagination chrome. NOT collapsed to the page slice. */
    total_count: number;
    /** Cross-currency scalar — only meaningful when wire `currency` is
     *  a single concrete CCY (VND, USD, KRW, …). FCY page must NOT
     *  render this as a single-currency total; use `totals_by_ccy`.
     *  Computed over the full filtered result, NOT the page slice. */
    available_bal: string;
    /** Cross-currency scalar — see `available_bal` note above. */
    balance: string;
    /** Per-currency breakdown — one entry per distinct `ccy_cd` in the
     *  full filtered result (NOT the page slice). */
    totals_by_ccy: ApiCurrencyTotal[];
    /** Zero-based page index (Spring Data convention). Frontend converts
     *  to one-based for display. */
    page_number: number;
    /** Rows per page actually used by the server (after clamp). */
    page_size: number;
    /** Total page count given the current filter + page size. {@code 1}
     *  when the response is unpaged. */
    total_pages: number;
    /** Distinct bank list for the dropdown — scoped to tenant +
     *  currency only, never narrowed by `bankCd` or `keyword`. The
     *  dropdown's option set stays stable as the user filters. */
    banks_available: ApiBankOption[];
}

// Banking — Transaction History
export interface ApiTransactionRow {
    ACCT_SEQ_NO: string;
    TRSC_DT: string;
    TRSC_TM: string;
    INOUT_DV: string;
    DEPOSIT_AMT: string;
    WITHDRAW_AMT: string;
    BAL: string;
    RMRK: string;
    CONF_YN: string;
    CONFIRMED_BY: string;
    CONFIRMED_DTM: string;
}

export interface ApiTransactionListResponse {
    ROWS: ApiTransactionRow[];
    TOTAL_COUNT: number;
    DEPOSIT_TOTAL: string;
    WITHDRAW_TOTAL: string;
}

// Banking — Transfer Own Accounts (re-uses ApiAccountRow)
export interface ApiOwnAccountListResponse {
    accounts: ApiAccountRow[];
    total_count: number;
    bal_total: string;
    avail_total: string;
}

// Banking — Withdrawal Account autocomplete (firm-banking-settings Create)
//
// Wire shape for `GET /api/v1/banking/accounts/by-bank?out_bank_cd=...`.
// Mirrors the backend `AccountLookupRow` projection. `acct_no` is the
// raw value the form submits; `acct_no_masked` is the server-formatted
// display variant (first/last 4 + middle asterisks). Currency suffix
// (`(VND)`/`(USD)`/...) is rendered client-side from `ccy_cd`.
export interface ApiAccountLookupRow {
    acct_no: string;
    acct_no_masked: string;
    ccy_cd: string;
    /** Optional nickname (e.g. `"Shinhan VN2658"`); null for most rows. */
    acct_nick_nm: string | null;
    /** Optional account holder name; null for some rows. */
    acct_nm: string | null;
}

export interface ApiAccountLookupListResponse {
    list: ApiAccountLookupRow[];
}

// Banking — Transfer History
export interface ApiTransferRow {
    SEQ_NO: string;
    REG_DT: string;
    REG_TM: string;
    OUT_BANK_CD: string;
    OUT_BANK_NM: string;
    OUT_ACCT_NO: string;
    OUT_CCY_CD: string;
    IN_BANK_CD: string;
    IN_BANK_NM: string;
    IN_ACCT_NO: string;
    IN_CCY_CD: string;
    CCY_CD: string;
    TRSC_AMT: string;
    FEE: string;
    RMRK: string;
    TRNS_STTS: string;
    TRNS_MSG: string;
    STATUS: string;
}

export interface ApiCurrencyTotal {
    CCY_CD: string;
    COUNT: number;
    AMOUNT: string;
}

export interface ApiTransferHistoryResponse {
    ROWS: ApiTransferRow[];
    TOTAL_COUNT: number;
    TOTALS: ApiCurrencyTotal[];
}

// Reports — Daily Cash
export interface ApiDailyCashSummaryRow {
    CCY_CD: string;
    CASH: string;
    CURRENT: string;
    SAVINGS: string;
    TIME_DEPOSIT: string;
    AVAILABLE: string;
}

export interface ApiDailyCashHoldingRow {
    ID: string;
    TYPE: string;
    CCY_CD: string;
    OPENING_BAL: string;
    NUM_DEBITS: number;
    DEBIT: string;
    NUM_CREDITS: number;
    CREDIT: string;
    BAL: string;
}

export interface ApiDailyCashAccountLedgerRow {
    ID: string;
    BANK: string;
    ACCT_NO: string;
    CCY_CD: string;
    NUM_DEBITS: number;
    DEBIT: string;
    NUM_CREDITS: number;
    CREDIT: string;
    BAL: string;
}

export interface ApiDailyCashReport {
    AS_OF_DT: string;
    CURRENCY_SCOPE: string;
    SUMMARY: ApiDailyCashSummaryRow[];
    HOLDINGS: ApiDailyCashHoldingRow[];
    ACCOUNTS: ApiDailyCashAccountLedgerRow[];
}

// Reports — Daily Financial CMC
export interface ApiFinancialStatusRow {
    CCY_CD: string;
    TOTAL: string;
    CURRENT_ACCOUNTS: string;
    SAVING_ACCOUNTS: string;
}

export interface ApiCurrentAccountRow {
    ID: string;
    BANK: string;
    ACCT_NO: string;
    ACCT_NICK_NM: string;
    CCY_CD: string;
    NUM_DEBITS: number;
    DEBIT: string;
    NUM_INTERNAL_DEBITS: number;
    INTERNAL_DEBIT: string;
    NUM_CREDITS: number;
    CREDIT: string;
    NUM_INTERNAL_CREDITS: number;
    INTERNAL_CREDIT: string;
    BAL: string;
}

export interface ApiDailyFinancialCmcReport {
    AS_OF_DT: string;
    CURRENCY_SCOPE: string;
    FINANCIAL_STATUS: ApiFinancialStatusRow[];
    CURRENT_ACCOUNTS: ApiCurrentAccountRow[];
}

// Reports — Daily Financial HS (STUB — returns deterministic seed)
export interface ApiHsLedgerRow {
    BANK_NM: string;
    ACCT_NO: string;
    CCY_CD: string;
    RCV_PAY_CD: string;
    DESCRIPTION_KO: string;
    DESCRIPTION_EN: string;
    DEBIT: string;
    CREDIT: string;
    BAL: string;
    ROW_TYPE: string; // DETAIL | SUBTOTAL | TOTAL
}

export interface ApiDailyFinancialHsReport {
    AS_OF_DT: string;
    BANK_CD: string;
    ROWS: ApiHsLedgerRow[];
}

// Reports — Cash Flow (STUB — returns deterministic seed)
export interface ApiCashFlowDetailRow {
    ID: string;
    ITEM_CD: string;
    ITEM_NM: string;
    MONTHS: string[];
}

export interface ApiCashFlowSubgroup {
    ID: string;
    LABEL_KO: string;
    LABEL_EN: string;
    DETAILS: ApiCashFlowDetailRow[];
}

export interface ApiCashFlowGroup {
    ID: string;
    LABEL_KO: string;
    LABEL_EN: string;
    SUBGROUPS: ApiCashFlowSubgroup[];
    SUB_TOTALS: string[];
}

export interface ApiCashFlowReport {
    MONTHS: string[];
    OPENING_BAL: string[];
    GROUPS: ApiCashFlowGroup[];
    SALES_PROFIT: string[];
    NON_SALES_PROFIT: string[];
    END_BAL: string[];
}

// Add-on — e-Invoices
/**
 * Wire row for `GET /api/v1/addon/einvoices`. Field set tracks Backend
 * MR B's `EInvoiceRow` record verbatim — Sales / Bill share the shape.
 *
 * <p>`INV_TYPE` is intentionally absent (rule IR-7): legacy WSVC drops
 * it, and the static UI's "invoice type" sub-line actually carries an
 * `einv_invoicestatus` value, not an `inv_type` one.
 *
 * <p>`issu_tm` is a refactor-only proxy sliced from `REG_DTM[8..14]`
 * — legacy doesn't expose any issue-time field.
 */
export interface ApiEInvoiceRow {
    doc_id: string;
    disp_doc_id: string;
    issu_dt: string;
    issu_tm: string;
    einv_invoicesymbol: string;
    trco_cmnm: string;
    trco_tax_id: string;
    trco_trsc_ccy_cd: string;
    totl_amt: string;
    sply_amt_sum: string;
    tax_amt_sum: string;
    einv_invoicestatus: string;
    einv_invoicestatus_bef: string | null;
    prov_stts: string | null;
    due_dt: string | null;
    over_due_days: string | null;
}

/**
 * Per-currency total row in the e-Invoice listing footer. Distinct from
 * the Banking / Transfer {@link ApiCurrencyTotal} variants — this shape
 * carries `amount` + `tax_amount` + `pretax_amount`, computed by the
 * backend's sibling unpaged aggregation query (rule IR-6 — totals reflect
 * the full filtered dataset, not the page slice).
 */
export interface ApiEInvoiceCurrencyTotal {
    ccy_cd: string;
    count: number;
    amount: string;
    tax_amount: string;
    pretax_amount: string;
}

export interface ApiEInvoiceListResponse {
    rows: ApiEInvoiceRow[];
    /** Unpaged filtered total — drives the "X of Y" pagination label. */
    total_count: number;
    /** Total page count given the current filter + page size. */
    total_pages: number;
    /** Zero-based page index (Spring Data convention). */
    page_number: number;
    /** Rows per page actually used by the server (after clamp). */
    page_size: number;
    totals: ApiEInvoiceCurrencyTotal[];
}

// Add-on — Operation Status
export interface ApiOperationStatusRow {
    taxcode: string;
    company_nm: string;
    company_status: string;
    status_cd: string;
    office_add: string;
    last_update: string;
}

export interface ApiOperationStatusListResponse {
    rows: ApiOperationStatusRow[];
    total_count: number;
    /** Zero-based page index (Spring Data convention). */
    page_number: number;
    /** Rows per page actually used by the server (after clamp). */
    page_size: number;
    total_pages: number;
}

// Settings — Firm Banking History
/**
 * Wire row for `GET /api/v1/settings/firm-banking-history`. Mirrors
 * the Phase 2 backend `FirmBankingHistoryRow` record verbatim
 * (`wecms-api-main/.../domain/setting/firmbankinghistory/dto/FirmBankingHistoryRow.java`).
 *
 * <p>The five legacy source legs (TB_FIRM_TRAN, NXSIAS gdt + business
 * inquiry, NAPAS scraping transfer, EXT_TRAN scraping balance/txn/card)
 * are unioned into one shape via the `V_FIRM_BANKING_HISTORY` view
 * (V60). `svc_type` discriminates the leg: `F` / `S` / `G` / `B`.
 *
 * <p>`tarn_dtm` is `YYYYMMDDHHmmss`. The frontend slices it into
 * `date` / `time` parts in {@code mapFirmBankingHistoryRow}.
 *
 * <p>`req_data` is leg-specific JSON: G leg carries the e-Invoice symbol
 * + number, B leg carries the search Tax ID. Other legs send `null`.
 */
export interface ApiFirmBankingHistoryRow {
    tarn_dtm: string;
    svc_type: string;
    /**
     * Server-resolved i18n key under
     * {@code settings.firm_banking_history.service_type.*}, derived
     * from {@link svc_type} via the Spring {@code FirmBankingSvcType}
     * enum. One of:
     * <ul>
     *   <li>{@code firm_banking_transaction} (F)</li>
     *   <li>{@code scraping_transfer} (S)</li>
     *   <li>{@code vietnam_gdt_inquiry} (G)</li>
     *   <li>{@code vietnam_business_inquiry} (B)</li>
     * </ul>
     *
     * <p>{@code null} only when the wire {@code svc_type} is not one
     * of the four known letters — frontend renders the raw character
     * in that case (never blank).
     *
     * <p>Added 2026-05-08 to retire the frontend's
     * {@code coerceFirmBankingServiceType} switch in
     * {@code mappers.ts}. The matching i18n keys already exist in
     * {@code locales/{en,ko,vi}.json}.
     */
    svc_type_key: string | null;
    svc_nm: string;
    /**
     * Server-resolved i18n key under the {@code fb_history.service.*}
     * namespace. Source of truth for service-name display: the F-leg
     * resolves through the Spring {@code TranTp} enum (mirrors legacy
     * {@code wabooks.enums.TranTp}); S/G/B legs resolve against the
     * V60 view's CASE-WHEN literals via
     * {@code FirmBankingServiceNameResolver}.
     *
     * <p>{@code null} when the {@code (svc_type, svc_nm)} pair has no
     * registered key — frontend falls back to {@code svc_nm} verbatim
     * (legacy parity with {@code SERVICE_NAME_MAP}'s missing-key path
     * at {@code comm_0221_001.ts:646}).
     */
    svc_name_key: string | null;
    seq_no: string;
    dep_bank_cd: string;
    rslt_cd: string;
    rslt_msg: string;
    job: string;
    req_data: string | null;
    van_org_cd: string | null;
}

export interface ApiFirmBankingHistoryListResponse {
    list: ApiFirmBankingHistoryRow[];
    total_count: number;
    /** Zero-based page index (Spring Data convention). */
    page_number: number;
    /** Rows per page actually used by the server (after clamp). */
    page_size: number;
    total_pages: number;
}

// Settings — ERP Transaction History
/**
 * Wire row for `GET /api/v1/settings/erp-transaction-history`. Mirrors
 * the Phase 2 backend `ErpTrnsHistoryRow` record verbatim
 * (`wecms-api-main/.../domain/setting/erptransactionhistory/dto/ErpTrnsHistoryRow.java`).
 *
 * <p>The refactor screen is read-only: list + 4 tab counts + per-row
 * file download. Tenant scoping happens server-side from
 * {@code TenantContext.currentBizKey()} so the wire shape has no
 * {@code biz_key} field. Per OQ-2 (resolved 2026-05-11) the refactor
 * is product-agnostic — there is no HAENGSUNG-only branching here.
 *
 * <p>Two server-resolved i18n keys ride the row alongside the raw
 * legacy codes (the {@code *_key} pattern documented in
 * {@code wecms-api-main/CLAUDE.md §"Domain enums"}):
 * <ul>
 *   <li>{@code erp_type_key} — `settings.erp_transaction_history.direction.{wecms_to_erp|erp_to_wecms|deleted}`</li>
 *   <li>{@code trns_type_key} — `settings.erp_transaction_history.type.{01..17}`</li>
 * </ul>
 *
 * <p>Both can be {@code null} when the wire code is outside the known
 * set (defensive — should not happen in practice for refactor-seeded
 * rows). Frontend falls back to the raw {@link erp_type} /
 * {@link trns_type_cd} characters in that case.
 */
export interface ApiErpTransactionHistoryRow {
    /** NUMERIC(10,0) DEV; serialised as a JSON number (fits int safely
     *  — DEV max value < 10B which is well under 2^53). Used as the
     *  composite-key half + download row id. */
    seq_no: number;
    org_file_nm: string;
    save_file_nm: string;
    file_size: number;
    /** {@code W} / {@code E} / {@code D}. */
    erp_type: string;
    erp_type_key: string | null;
    /** Two-digit string {@code "01".."17"}. */
    trns_type_cd: string;
    trns_type_key: string | null;
    /** UTC `yyyyMMddHHmmss` — frontend splits via `lib/datetime.ts`. */
    reg_dtm: string;
    reg_id: string;
    /** Resolved `USER_INFM.USER_NM` via backend LEFT JOIN. */
    user_nm: string | null;
}

/**
 * Wire envelope for the ERP transaction history list call. Carries the
 * paged slice plus four tab counts (the latter coming from a separate
 * aggregate query that intentionally drops the {@code ERP_TYPE}
 * predicate — mirrors legacy `getDynamicCNT` so all four tab chips
 * reflect the same date / type / keyword scope).
 */
export interface ApiErpTransactionHistoryListResponse {
    list: ApiErpTransactionHistoryRow[];
    total_count: number;
    total_count_wecms: number;
    total_count_erp: number;
    total_count_deleted: number;
    /** Zero-based page index (Spring Data convention). */
    page_number: number;
    /** Rows per page actually used by the server (after clamp). */
    page_size: number;
    total_pages: number;
}

// Settings — Firm Banking Settings
/**
 * Wire row for `GET /api/v1/settings/firm-banking-settings`. Mirrors
 * the Phase 2 backend `FirmBankingSettingRow` record verbatim
 * (`wecms-api-main/.../domain/setting/firmbankingsettings/dto/FirmBankingSettingRow.java`).
 *
 * <p>Backed by the {@code V_FIRM_BANKING_SETTING} read-only view (V64),
 * which LEFT-JOINs {@code TB_FIRM_CONF} to {@code ACCT_MSTR} (for
 * {@code ccy_cd} / {@code bal} / {@code expi_dt}) and to
 * {@code TB_FIRM_BANK_CODE} (for {@code bank_nm} via
 * {@code COALESCE(BANK_NM, BANK_ENG_NM)} filtered to
 * {@code ANT_DIV_CD = 'NAPAS'}).
 *
 * <p><b>Masking.</b> {@code wdrl_act_no} is shipped as <b>cleartext</b>
 * — it is the PK component the frontend addresses for Delete / Update /
 * Detail / Audit reads. Earlier revisions had the backend mask this
 * field server-side, but that broke every write flow because the
 * masked string contains characters the path-validation regex
 * rejects. Masking is now presentation-layer only and lives in the
 * frontend mapper ({@code mapFirmBankingSettingRow}) — the displayed
 * row uses a frontend-derived masked string, while this PK field
 * stays cleartext so it can be passed to API calls. See feature §9.
 */
export interface ApiFirmBankingSettingRow {
    biz_key: string;
    /** NAPAS bank code (Shinhan {@code 970424} / Vietcombank
     *  {@code 970436} / Woori {@code 970457}). Drives the bank logo
     *  pick on the frontend. */
    out_bank_cd: string;
    /** Localized bank name from {@code TB_FIRM_BANK_CODE}.
     *  {@code null} when the bank code is not in the dictionary. */
    bank_nm: string | null;
    /** Currency from the joined {@code ACCT_MSTR} row. {@code null}
     *  when no matching ledger row exists. */
    ccy_cd: string | null;
    bank_prtn_id: string;
    van_org_cd: string;
    /** {@code OrgStat} discriminator: {@code 0} WAITING /
     *  {@code 1} AVAILABLE / {@code 2} SUSPENDED / {@code 3} TERMINATED.
     *  Frontend treats {@code "1"} as active; everything else inactive. */
    org_stat: string;
    /** Account number — <b>cleartext PK</b> on the wire. The
     *  frontend mapper masks for display; this field is the PK used
     *  by every API call originating from the row. Never display
     *  this value verbatim; always pass through
     *  {@code maskAccountNumber} for UI rendering. */
    wdrl_act_no: string;
    file_type: string;
    bat_tran_branch_div: string;
    bat_tran_branch_limit: number;
    /** Legacy {@code yyyyMMddHHmmss} string. Wired to "Last updated"
     *  via {@link mapFirmBankingSettingRow} — splits into a
     *  human-readable {@code DD-MM-YYYY} display. */
    reg_dttm: string;
    start_dttm: string | null;
    end_dttm: string | null;
    /** Last modification time. Same shape as {@link reg_dttm}; preferred
     *  source for the row's "last updated" display. */
    mod_dttm: string | null;
    /** Display name of the user who last edited the row (legacy
     *  {@code WbUser.getName()}). Joined with {@link mod_dttm} on the
     *  row's last-updated line. */
    last_edtr: string | null;
    /** Account balance from the joined {@code ACCT_MSTR} row.
     *  {@code null} when no matching ledger row exists. Unused by the
     *  static UI today; reserved for a future balance display. */
    bal: number | null;
    /** Account expiry date ({@code yyyyMMdd}). {@code null} when not
     *  set in the ledger. */
    expi_dt: string | null;
}

export interface ApiFirmBankingSettingListResponse {
    list: ApiFirmBankingSettingRow[];
}

/**
 * Wire shape for the detail endpoint
 * (`GET /api/v1/settings/firm-banking-settings/{out_bank_cd}/{wdrl_act_no}`).
 * Mirrors the Phase 2 backend {@code FirmBankingSettingDetail} record.
 *
 * <p><b>Cleartext.</b> {@code wdrl_act_no} is returned in cleartext
 * here (not masked) because the detail endpoint feeds the edit dialog
 * — masking would break the round-trip value. See feature §9.
 *
 * <p>No JOIN columns ({@code bank_nm} / {@code ccy_cd} / {@code bal} /
 * {@code expi_dt}) — those belong to the list-view shape only.
 */
export interface ApiFirmBankingSettingDetail {
    biz_key: string;
    out_bank_cd: string;
    bank_prtn_id: string;
    van_org_cd: string;
    org_stat: string;
    /** Cleartext — see Javadoc above. */
    wdrl_act_no: string;
    file_type: string;
    bat_tran_branch_div: string;
    bat_tran_branch_limit: number;
    reg_dttm: string;
    start_dttm: string | null;
    end_dttm: string | null;
    mod_dttm: string | null;
    last_edtr: string | null;
}

/**
 * Wire row for the audit-log endpoint
 * (`GET /api/v1/settings/firm-banking-settings/{out_bank_cd}/{wdrl_act_no}/audit`).
 * Mirrors the Phase 2 backend {@code FirmBankingAuditEntry} record.
 *
 * <p>Activity / detail strings are pre-localized to the caller's
 * locale at write time — the read filters by the caller's
 * {@code lang_cd}. Render verbatim; do not pass through a translation
 * lookup on the frontend.
 *
 * <p>{@code reg_dtm} is {@code yyyyMMddHHmmss}; the frontend splits it
 * into {@code date} / {@code time} for the audit-log table.
 */
export interface ApiFirmBankingAuditEntry {
    audit_logs_actv: string | null;
    audit_logs_actv_dtl: string;
    reg_id: string;
    reg_nm: string;
    reg_dtm: string;
}

export interface ApiFirmBankingAuditListResponse {
    list: ApiFirmBankingAuditEntry[];
}

/**
 * Wire shape for {@code GET /api/v1/settings/environment-settings/{env_set_inf}}
 * and the response of {@code PUT} of the same path. Mirrors legacy
 * {@code comm_0600_001_r001} / {@code comm_0215_001_u001} - a single
 * {@code (env_set_inf, env_set_cont)} pair per call.
 *
 * <p>Read path returns {@code COALESCE(BUSI override, SYS default)} -
 * the IDO LEFT JOINs SYS to BUSI so a tenant that hasn't been
 * bootstrapped for the code yet still gets the system default. Update
 * path is pure UPDATE on the BUSI row (the row is pre-seeded by the
 * tenant-bootstrap copy, mirroring legacy {@code wb_init_busi_data}).
 *
 * <p>Codes consumed today: {@code "00078"} (Auto Transfer) and
 * {@code "00079"} (Auto Match). New codes land without changing this
 * shape - the endpoints accept any 5-char alphanumeric identifier
 * registered in {@code SYS_ENV_SET_INFM}.
 *
 * <p>{@code env_set_cont} is permissive (free-text up to 1000 chars,
 * matching the legacy {@code VARCHAR(1000)} column). The toggle UI
 * constrains its values to {@code "Y"}/{@code "N"} client-side; the
 * consumer treats anything other than exactly {@code "Y"} as "off".
 */
export interface ApiEnvironmentSetting {
    /** Five-char zero-padded code (e.g. {@code "00078"}). */
    env_set_inf: string;
    /** COALESCE(BUSI override, SYS default). May be {@code null} only
     *  when the SYS default itself is null. */
    env_set_cont: string | null;
}

/**
 * Wire body for `PUT /api/v1/settings/environment-settings/{env_set_inf}`.
 * Single-flag immediate save mirroring legacy `comm_0215_001_u001`.
 */
export interface ApiEnvironmentSettingUpdateRequest {
    /** Free-text up to 1000 chars (matches legacy
     *  {@code VARCHAR(1000)}). The toggle UI sends {@code "Y"} or
     *  {@code "N"}; other codes (e.g. document-id prefix) ship
     *  free-text values. */
    env_set_cont: string;
}

// =============================================================================
// Settings > VAS Account
// =============================================================================
// Wire types for /api/v1/settings/vas-account (Spring controller
// VasAccountController). Every field is lowercase snake_case via the global
// Jackson SNAKE_CASE strategy. `vas_acct_seq_no` ships as a STRING — the legacy
// NUMERIC(10,0) PK is opaque to JS, sent verbatim so JS-number precision can't
// silently truncate it.
//
// `vas_acct_type` ("0"/"1"/"2") + `stts` ("A"/"I") are the raw legacy codes;
// the accompanying `*_key` fields carry the i18n key the frontend resolves via
// `t(key)` — backend never ships localized labels.

export interface ApiVasAccountRow {
    vas_acct_seq_no: string;
    vas_acct_cd: string;
    vas_acct_nm: string;
    vas_acct_enm: string | null;
    /** `"0"` Dual / `"1"` Credit / `"2"` Debit. */
    vas_acct_type: string;
    /** i18n key — e.g. `"settings.vas_account.type.debit"`. */
    vas_acct_type_key: string | null;
    /** `"A"` Active / `"I"` Inactive. */
    stts: string;
    /** i18n key — e.g. `"settings.vas_account.status.active"`. */
    stts_key: string | null;
    /** Optional description / notes (≤ 200 chars). */
    cont: string | null;
    /** Audit — last modifier id. */
    mod_id: string;
    /** Audit — last modification timestamp, `yyyyMMddHHmmss` UTC. */
    mod_dtm: string;
}

export interface ApiVasAccountListResponse {
    list: ApiVasAccountRow[];
    /** Unpaged filtered total (post `search_wd` + `stts`). */
    total_count: number;
    /** Zero-based page index (Spring Data convention). */
    page_number: number;
    /** Rows per page actually used by the server (after clamp). */
    page_size: number;
    total_pages: number;
}

export interface ApiVasAccountCreateRequest {
    vas_acct_cd: string;
    vas_acct_nm: string;
    /** Optional. The UI no longer surfaces an English-Name field
     *  (PO call 2026-05-11); omit on the wire and the backend stores
     *  null on Create / preserves the existing value on Update. */
    vas_acct_enm?: string | null;
    /** Optional. The UI no longer surfaces a Type selector
     *  (PO call 2026-05-11); omit on the wire and the backend
     *  defaults to {@code "0"} (Dual) on Create / preserves the
     *  existing value on Update. */
    vas_acct_type?: "0" | "1" | "2";
    stts: "A" | "I";
    /** Optional. ≤ 200 chars (DB authority — DN-3). */
    cont?: string | null;
}

/** Update body — same shape as create; identity travels via the
 *  `{vasAcctSeqNo}` path segment. */
export type ApiVasAccountUpdateRequest = ApiVasAccountCreateRequest;

// =============================================================================
// Settings > Contacts
// =============================================================================
// Wire types for /api/v1/settings/contacts (Spring controller
// ContactsController). CRUD over TRCO_INFM + TRCO_ADDR_INFM + TRCO_ACCT_INFO
// + TRCO_OVRS_INFM. Field names lowercase snake_case via the global Jackson
// SNAKE_CASE strategy.
//
// `trco_key` is the global per-row identifier (V85 sq_trco_key — allocated
// via the ported `wb_get_next_val` branch, OQ-4). It rides through every wire
// payload + the path segment on detail / update / delete; never inferred from
// a composite (biz_key, trco_key) on the wire even though the DB carries the
// composite PK.
//
// `disp_ord` on address rows is the current/previous discriminator (OQ-8 —
// 1 = current, 2 = previous); NEVER compared against `trco_addr_key`.
//
// Sub-row keys (`trco_addr_key`, `trco_acct_key`, `trco_ovrs_key`) are
// REQUIRED on every `upsert` op — the backend uses the caller-supplied key
// directly. Frontend generates a fresh client-side id (e.g. `nanoid()` or
// `crypto.randomUUID()` truncated) for new sub-rows and reuses the server
// key for edits.

/** Discriminator for the radio toggle in the Add / Edit dialog. Wire
 *  values are `'L'` (Local) and `'O'` (Overseas). */
export type ApiContactType = "L" | "O";

/** Address discriminator per OQ-8 — `1` Current / `2` Previous. The
 *  refactor's frontend never inspects `trco_addr_key` for business
 *  meaning. */
export type ApiContactAddressDispOrd = 1 | 2;

/**
 * Sub-row op discriminator. Every nested `addresses` / `accounts` /
 * `overseas_beneficiaries` element on create / update carries an
 * `op` field — the legacy `comm_0184_005_u001` flow's REC2/REC4/REC5
 * sub-records folded into a single transaction body.
 */
export type ApiContactSubRowOp = "upsert" | "delete";

/**
 * Address sub-row on a contact's list / detail response (no `op` —
 * those exist only on the write path).
 *
 * <p>{@code disp_ord} is the current/previous discriminator (OQ-8).
 * {@code issu_dt} / {@code due_dt} are legacy `yyyyMMdd` strings.
 */
export interface ApiContactAddressRow {
    trco_addr_key: string;
    trco_bsun_post_adrs: string | null;
    disp_ord: number | null;
    issu_dt: string | null;
    due_dt: string | null;
}

/**
 * Bank-account sub-row on a Local contact (read path). `bank_nm` is
 * the server-resolved display name (via the legacy
 * `wb_get_napas_bank_nm_or_citad_bank_nm` function, V86 / OQ-7); when
 * the function returns null for the locale the frontend falls back
 * to the row's stored display copy if any.
 */
export interface ApiContactAccountRow {
    trco_acct_key: string;
    acct_no: string | null;
    disp_ord: number | null;
    bank_nm: string | null;
    napas_bank_cd: string | null;
    citad_bank_cd: string | null;
    acct_ccy_cd: string | null;
    finc_mda_owner_nm: string | null;
    owac_addr: string | null;
}

/** Overseas-beneficiary sub-row on an Overseas contact (read path). */
export interface ApiContactOverseasRow {
    trco_ovrs_key: string;
    bene_name: string | null;
    bene_acct_no: string | null;
    bic_code: string | null;
    bene_bank_name: string | null;
    bene_bank_code: string | null;
    bene_addr: string | null;
}

/**
 * Master contact row. Used identically by the list (`rows[]`) and the
 * detail (`getOne`) endpoints — every response carries the full graph
 * of addresses + accounts + overseas beneficiaries inline. Frontend
 * mapper derives presentation values (primary address, primary bank
 * name, extra-address count) from the nested arrays.
 */
export interface ApiContactRow {
    trco_key: string;
    hand_trco_key: string;
    trco_cmnm: string;
    /** Required NotBlank on Create / Update — Vietnamese contacts use
     *  this column as the English / Latin transliteration of the
     *  contact name. */
    trco_cmenm: string;
    trco_tax_id: string | null;
    trco_type: ApiContactType;
    /** Soft-delete flag — `'C'` means trashed. The list query
     *  hard-filters trashed rows server-side (OQ-5) so this is
     *  effectively always null / blank on list responses. */
    trco_stts: string | null;
    /** Legacy `yyyyMMddHHmmss` audit string — drives the default
     *  ORDER BY tiebreaker. */
    mod_dtm: string;
    addresses: ApiContactAddressRow[];
    accounts: ApiContactAccountRow[];
    /** Overseas contacts can have multiple beneficiaries — wire ships
     *  an array even though the canonical Figma frame shows one. */
    overseas_beneficiaries: ApiContactOverseasRow[];
}

/**
 * Wire envelope for `GET /api/v1/settings/contacts`. Field names
 * mirror the Spring `ContactListResponse` record literally — note
 * the unusual `total_count: long` carried verbatim (`number` on the
 * wire because JS doesn't separate int / long).
 */
export interface ApiContactListResponse {
    rows: ApiContactRow[];
    /** Unpaged filtered total. */
    total_count: number;
    /** Zero-based page index. */
    page: number;
    /** Rows per page actually used by the server (after clamp). */
    size: number;
    total_pages: number;
}

/** Detail payload is the same shape as a single list row — full
 *  graph in one trip. */
export type ApiContactDetail = ApiContactRow;

/** Address sub-op (write path). `trco_addr_key` is required on
 *  `upsert` ops — frontend generates a fresh client-side id for
 *  new rows and reuses the server-issued key for edits. */
export interface ApiContactAddressOp {
    op: ApiContactSubRowOp;
    trco_addr_key: string;
    trco_bsun_post_adrs?: string | null;
    disp_ord?: ApiContactAddressDispOrd | null;
    issu_dt?: string | null;
    due_dt?: string | null;
}

export interface ApiContactAccountOp {
    op: ApiContactSubRowOp;
    trco_acct_key: string;
    bank_nm?: string | null;
    acct_no?: string | null;
    napas_bank_cd?: string | null;
    citad_bank_cd?: string | null;
    acct_ccy_cd?: string | null;
    finc_mda_owner_nm?: string | null;
    owac_addr?: string | null;
    disp_ord?: number | null;
}

export interface ApiContactOverseasOp {
    op: ApiContactSubRowOp;
    trco_ovrs_key: string;
    bene_name?: string | null;
    bene_acct_no?: string | null;
    bic_code?: string | null;
    bene_bank_name?: string | null;
    bene_bank_code?: string | null;
    bene_addr?: string | null;
}

/** Folded sub-payload for the legacy `comm_0184_005_d001` single-account
 *  delete on the Update path. */
export interface ApiContactAccountDeleteKey {
    trco_acct_key: string;
}

export interface ApiContactOverseasDeleteKey {
    trco_ovrs_key: string;
}

/**
 * Create body. `trco_key` is allocated server-side via the V85
 * `sq_trco_key` global sequence (OQ-4) — never on the wire.
 */
export interface ApiContactCreateRequest {
    hand_trco_key: string;
    trco_cmnm: string;
    /** Required NotBlank server-side. */
    trco_cmenm: string;
    trco_tax_id?: string | null;
    trco_type: ApiContactType;
    addresses: ApiContactAddressOp[];
    accounts: ApiContactAccountOp[];
    /** Spring DTO field name — mirrors `overseasBeneficiaries`. */
    overseas_beneficiaries: ApiContactOverseasOp[];
}

/**
 * Update body — superset of Create. Identity travels via the
 * `{trcoKey}` path segment. Adds:
 *
 *   - `trco_stts` — null normally; `'C'` to flip to trash via the
 *     edit endpoint (OQ-2 in-use guard fires server-side).
 *   - `accounts_to_delete` / `overseas_to_delete` — single-row
 *     deletes folded into the same transaction (legacy
 *     `comm_0184_005_d001` / REC4 / REC6).
 */
export interface ApiContactUpdateRequest extends ApiContactCreateRequest {
    /** Null / unset normally. Set to `'C'` to flip the contact to
     *  trash via the edit endpoint (OQ-2). */
    trco_stts?: string | null;
    accounts_to_delete?: ApiContactAccountDeleteKey[];
    overseas_to_delete?: ApiContactOverseasDeleteKey[];
}

/** Bulk soft-delete body. Server runs the WBE1190 in-use guard
 *  per-key before flipping any row. */
export interface ApiContactBulkDeleteRequest {
    trco_keys: string[];
}

/**
 * One row in the bank-picker autocomplete for the Add / Edit Contact
 * dialog. Wire shape produced by `GET /api/v1/settings/contacts/banks`
 * — mirrors legacy `comm_0109_001_r002`. `status` is server-normalised
 * to `'Y'` / `'N'` / null; the frontend treats `'N'` (or USD currency)
 * as "manual Recipient Name", anything else as "Lookup Recipient".
 */
export interface ApiContactBankRow {
    bank_cd: string;
    ant_div_cd: "NAPAS" | "CITAD";
    bank_nm: string | null;
    bank_eng_nm: string | null;
    eng_abrvat_nm: string | null;
    status: "Y" | "N" | null;
}

export interface ApiContactBankListResponse {
    rows: ApiContactBankRow[];
}

/** Request body for `POST /api/v1/settings/contacts/lookup-recipient`. */
export interface ApiContactLookupRecipientRequest {
    napas_bank_cd?: string | null;
    citad_bank_cd?: string | null;
    acct_no: string;
}

/** Response — stub returns a synthetic recipient name; real bank
 *  integration is out of scope for this MR. */
export interface ApiContactLookupRecipientResponse {
    recipient_name: string;
}

/**
 * One attachment row on a contact. Returned by
 * `GET /api/v1/settings/contacts/{trcoKey}/files` and by the upload
 * endpoint after a successful POST. The server-side UUID filename
 * (`save_file_nm`) is intentionally NOT on the wire — the frontend
 * addresses each attachment by `file_id` and downloads via
 * `/api/v1/settings/contacts/{trcoKey}/files/{fileId}`.
 *
 * <p>`file_size` is a text token (legacy `TRCO_INFO_FILE.FILE_SIZE`
 * is `VARCHAR(100)`, NOT a numeric column). The frontend formats
 * it for display via `formatBytes` or similar.
 */
export interface ApiContactFileRow {
    file_id: string;
    org_file_nm: string;
    /** Byte count as text — e.g. `"24576"`. */
    file_size: string | null;
    /** Legacy `yyyyMMddHHmmss` audit string. */
    reg_dtm: string;
    /** Display name of the uploader (materialised from
     *  `USER_INFM.USER_NM` at insert time). */
    reg_nm: string;
    /** Default title — `"Business Registration"` for the first file
     *  per contact, `"New document"` for every subsequent file. */
    trco_infm_titl: string;
}

export interface ApiContactFileListResponse {
    rows: ApiContactFileRow[];
}

/* =================================================================
 *  Settings > Approval Line (slug: approval-line)
 *
 *  Wire types for the Spring `ApprovalLineController` — five
 *  endpoints under `/api/v1/settings/approval-line`, mirroring legacy
 *  `comm_0222_*`. Audit-log writes are NOT performed (feature § 14
 *  OQ-6 resolved 2026-05-13 — legacy parity).
 * ================================================================= */

/** One approver in an approval-line chain. `user_img_url` is null
 *  when the approver has no stored image; otherwise it's the shared
 *  REST URI `/api/v1/users/{apprvr_id}/image` (streaming endpoint
 *  itself is a follow-up MR — feature § 4.5 / OQ-1). */
export interface ApiApprovalLineApproverRow {
    apprvr_disp_ord: number;
    apprvr_id:       string;
    apprvr_nm:       string;
    /** Optional snapshot of the approver's position at save time. The
     *  service writes `""` (never null) on Create / Update for legacy
     *  parity, so wire values default to empty string instead of
     *  null. Kept nullable here for defensive parsing of legacy rows. */
    apprvr_posi:     string | null;
    apprvr_dept:     string | null;
    user_img_url:    string | null;
}

/** One approval-line row in the list / detail response. */
export interface ApiApprovalLineRow {
    appr_line_no: number;
    appr_line_nm: string;
    /** Legacy `yyyyMMddHHmmss` audit string — frontend formats for
     *  display. */
    reg_dtm:      string;
    /** Always present, always ordered by `apprvr_disp_ord ASC`. */
    approvers:    ApiApprovalLineApproverRow[];
}

/** Envelope for `GET /api/v1/settings/approval-line`. No server-side
 *  pagination (OQ-3) — `total_count` equals `approval_lines.length`. */
export interface ApiApprovalLineListResponse {
    total_count:    number;
    approval_lines: ApiApprovalLineRow[];
}

/** One approver in a Create / Update request body. `apprvr_disp_ord`
 *  is intentionally absent — the service assigns 1..N from request-
 *  array position on every write (feature § 5.2 / OQ-4). */
export interface ApiApprovalLineApproverInput {
    apprvr_id:   string;
    apprvr_nm:   string;
    /** Optional. When omitted (null / empty), the service persists
     *  `""` (never null) — legacy parity with
     *  `comm_0222_003_u001_act.jsp:144-148`. */
    apprvr_posi: string | null;
    apprvr_dept: string | null;
}

/** Create body. */
export interface ApiApprovalLineCreateRequest {
    appr_line_nm: string;
    /** Length 1..5; duplicate `apprvr_id` rejected pre-DB with
     *  `WBE_APPROVAL_LINE_DUP_APPROVER`. */
    approvers:    ApiApprovalLineApproverInput[];
}

/** Update body. Same shape as Create; identity travels via the
 *  `{apprLineNo}` path segment. Server-side diff-sync inserts new
 *  approvers, updates existing ones with new display order /
 *  snapshot fields, and deletes removed ones — all in one tx. */
export type ApiApprovalLineUpdateRequest = ApiApprovalLineCreateRequest;

/* =================================================================
 *  Tenant-user directory (slug: users)
 *
 *  Wire types for the Spring `UserController` endpoint
 *  `GET /api/v1/users`, the refactor counterpart of legacy
 *  `comm_0192_001_r001` ("Inquiry Approver"). First consumer is
 *  the Approval Line "Add Approver" picker; future approver /
 *  signer pickers reuse the same shape.
 * ================================================================= */

/** One row in the tenant-user picker. {@code user_img_url} is null
 *  when the user has no stored image; otherwise it's the shared
 *  REST URI {@code /api/v1/users/{user_id}/image} (the streaming
 *  endpoint itself is a follow-up MR; the frontend's `<Avatar>`
 *  fallback tolerates a 404). */
export interface ApiTenantUserRow {
    user_id:      string;
    user_nm:      string;
    posi_nm:      string | null;
    dept_nm:      string | null;
    user_img_url: string | null;
}

/** Envelope for {@code GET /api/v1/users}. No server-side
 *  pagination — same precedent as approval-line list. */
export interface ApiTenantUserListResponse {
    total_count: number;
    users:       ApiTenantUserRow[];
}

/* =================================================================
 *  Settings > Chart of Accounts (slug: chart-of-accounts)
 *
 *  Wire types for the Spring `ChartOfAccountsController` — six
 *  endpoints under `/api/v1/settings/chart-of-accounts`, mirroring
 *  legacy `comm_0223_001_*`. Audit-log writes are PERFORMED (matches
 *  firm-banking-settings / contacts precedent; approval-line is the
 *  one documented exception in the Settings module).
 * ================================================================= */

/** One row in the list / tree response. The backend computes
 *  {@code chart_acct_level} (1..4) and {@code has_children} alongside
 *  the raw entity columns. {@code restricted} flags the three
 *  system-managed root codes ACC-01 / ACC-02 / ACC-03 which the
 *  panel renders as group rows and blocks from edit / delete.
 *
 *  {@code chart_acct_seq_no} is a numeric text token (VARCHAR(14) on
 *  the DB; carried as a string end-to-end — see prompt-2 backend
 *  implementation). {@code stts} is {@code "A"} / {@code "I"};
 *  {@code cal_rule} is {@code "P"} / {@code "M"} / null. */
export interface ApiChartOfAccountRow {
    chart_acct_seq_no:    string;
    chart_acct_cd:        string;
    chart_acct_nm_en:     string;
    chart_acct_nm_vn:     string | null;
    chart_acct_nm_ko:     string | null;
    chart_acct_type:      string | null;
    parent_chart_acct_cd: string | null;
    cal_rule:             "P" | "M" | null;
    stts:                 "A" | "I";
    /** 1..4 for in-cap rows; null for orphans / cycles / depth-violators
     *  (legacy DEV data carries some — render under a "Deprecated depth"
     *  footnote per the feature spec). */
    chart_acct_level:     number | null;
    has_children:         boolean;
    /** `true` iff the code is in {ACC-01, ACC-02, ACC-03}. */
    restricted:           boolean;
    /** Legacy `yyyyMMddHHmmss` audit strings. */
    reg_id:               string;
    reg_dtm:              string;
    mod_id:               string;
    mod_dtm:              string;
}

/** Envelope for {@code GET /api/v1/settings/chart-of-accounts}. */
export interface ApiChartOfAccountListResponse {
    items:            ApiChartOfAccountRow[];
    total_count:      number;
    /** Static set {ACC-01, ACC-02, ACC-03}; the frontend uses it to
     *  render localised display names for the restricted roots
     *  (REVENUE / EXPENSES / INVESTMENT). */
    restricted_codes: string[];
}

/** Tree-projection node for {@code GET .../tree} — powers the inline
 *  parent-account picker. Active rows whose level resolves to 1..4
 *  (orphans dropped). Sorted by {@code chart_acct_cd ASC} per the
 *  legacy R002 trailer. */
export interface ApiChartOfAccountTreeNode {
    chart_acct_seq_no:    string;
    chart_acct_cd:        string;
    chart_acct_nm_en:     string;
    parent_chart_acct_cd: string | null;
    chart_acct_level:     number;
    has_children:         boolean;
    restricted:           boolean;
    /** Pre-rendered display string in the legacy
     *  {@code "<rootCd> - <rootNm> / … / <currentCd> - <currentNm>"}
     *  shape. */
    breadcrumb:           string;
}

/** Envelope for {@code GET .../tree}. */
export interface ApiChartOfAccountTreeResponse {
    nodes: ApiChartOfAccountTreeNode[];
}

/** Create body. {@code chart_acct_seq_no} is allocated server-side
 *  via the V95 `wb_get_next_val` branch — the body MUST NOT carry
 *  it. {@code parent_chart_acct_cd} is null for a root row. */
export interface ApiChartOfAccountCreateRequest {
    chart_acct_cd:         string;
    chart_acct_nm_en:      string;
    chart_acct_nm_vn?:     string | null;
    chart_acct_nm_ko?:     string | null;
    chart_acct_type?:      string | null;
    parent_chart_acct_cd?: string | null;
    cal_rule?:             "P" | "M" | null;
    stts:                  "A" | "I";
}

/** Update body. Same shape as Create; identity travels via the
 *  {@code {chart_acct_seq_no}} path segment. Cannot rename TO a
 *  restricted code, cannot edit a restricted row — backend rejects
 *  both with `WBE_CHART_OF_ACCOUNTS_RESTRICTED_CODE`. */
export type ApiChartOfAccountUpdateRequest = ApiChartOfAccountCreateRequest;
