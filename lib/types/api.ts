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
 * `LoginResponse` record after the lowercase cutover. Note `access_token`
 * — the only OAuth-style key; the rest follow the strict snake-case of
 * the Java field name.
 */
export interface LoginResponseRec {
    access_token: string;
    token_type: string;
    expires_in: number;
    user_id: string;
    user_nm: string;
    biz_key: string;
    lang_cd: string;
    cmpn_nm: string;
}

export interface MeResponseRec {
    user_id: string;
    user_nm: string;
    biz_key: string;
    lang_cd: string;
    cmpn_nm: string;
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
