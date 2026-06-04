/**
 * Envelope for every backend response. Field names are lowercase
 * snake_case (CTO directive 2026-05-08); the api side enforces this
 * via a global Jackson SNAKE_CASE strategy in
 * `wecms-api/.../config/JacksonConfig.java`. Per-feature data
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
 * wecms-api/.../domain/setting/dto/*. One row per column on a
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
 * {@code wecms-api/CLAUDE.md} §"Operational model: one user = one
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

/** Wire body for {@code POST /api/v1/auth/change-password}. */
export interface ChangePasswordRequestRec {
    current_password: string;
    new_password: string;
    confirm_password: string;
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
    /** Manual-registration flag (`"Y"` / `"N"`) — verbatim from
     *  {@code ACCT_MSTR.HAND_REG_YN}. Drives the disabled checkbox + the
     *  "Manual Account is not able to use Real-time Online Inquiry"
     *  tooltip on the Account Inquiry row (legacy `fnsh_0005_001.ts:708-709`). */
    hand_reg_yn: "Y" | "N";
    /** Bank-certificate connection flag (`"Y"` / `"N"`) — backend-derived
     *  per-bank: `"Y"` when {@code ACCT_MSTR.BANK_CD} has at least one
     *  non-blank credential row in {@code BANK_CERT_INFO} for the
     *  tenant, `"N"` otherwise. Per-bank rather than per-{@code
     *  BANK_CERT_SEQ}-FK so the flag stays correct after Login
     *  Credentials add/delete cycles. When `"N"` (and the row is not
     *  manual), drives the disabled checkbox + the "Online Account with
     *  disconnected bank …" tooltip (legacy `fnsh_0005_001.ts:711` /
     *  `fnsh_0005_001_j052`). */
    cert_conn_yn: "Y" | "N";
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

/**
 * Wire shape for the Bank Transaction Sync &gt; History popup
 * ({@code GET /api/v1/banking/sync-history}). One row per past scrape
 * attempt the user (or system) made against a bank. Mirrors legacy
 * {@code fnsh_0001_003_r001} response, exposed under the refactor's
 * lowercase snake_case wire convention.
 *
 * <p>Sources:
 * <ul>
 *   <li>{@code reg_dtm} ({@code yyyyMMddHHmmss}) — when the scrape ran.
 *       Frontend renders as {@code dd-MM-yyyy HH:mm:ss}.</li>
 *   <li>{@code start_date} / {@code end_date} ({@code yyyyMMdd}) — the
 *       window the scrape covered.</li>
 *   <li>{@code rslt_cd} — verbatim legacy code; {@code "00000000"} is
 *       success. {@code result_key} is the server-resolved i18n key for
 *       a localised Success / Failed label.</li>
 *   <li>{@code acct_type_key} / {@code acct_type_nm} — same convention
 *       as {@link ApiAccountRow}; render via
 *       {@code t(acct_type_key)} and fall back to {@code acct_type_nm}.</li>
 * </ul>
 */
export interface ApiSyncHistoryRow {
    ref_date: string;
    seq_no: string;
    reg_dtm: string;
    bank_cd: string;
    bank_nm: string;
    acct_no: string;
    acct_nick_nm: string;
    acct_type_cd: string;
    acct_type_nm: string;
    acct_type_key: string | null;
    ccy_cd: string;
    start_date: string;
    end_date: string;
    rslt_cd: string | null;
    result_key: string;
    err_cont: string;
}

export interface ApiSyncHistoryListResponse {
    rows: ApiSyncHistoryRow[];
    total_count: number;
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
    /** Smart Organizer — `'Y'` when this row is matched to a payment
     *  via `BUSI_MATCH_LOG` (LOCKED_YN='Y'). */
    LINK_MATCH_YN?: string;
    /** Reporting Account (chart of accounts) currently assigned to the
     *  bank transaction. Null when unassigned — picker cell renders
     *  the "Select Account" placeholder. */
    CHART_ACCT_CD?: string | null;
    CHART_ACCT_SEQ_NO?: string | null;
    /** Purpose (USE_USAG_CD) currently assigned to the bank
     *  transaction. Lives on `ACCT_TRNS_RCV_PAY_INFM.RCV_PAY_USAG_CD`;
     *  null when unassigned — picker cell renders the "Select Purpose"
     *  placeholder. */
    USE_USAG_CD?: string | null;
    /** VAS Account currently assigned to the bank transaction.
     *  Lives on `ACCT_TRNS_RCV_PAY_INFM.VAS_ACCT_CD`; null when
     *  unassigned. */
    VAS_ACCT_CD?: string | null;
    /** Contact key (TRCO_KEY) currently assigned to this transaction.
     *  Lives on `ACCT_TRNS_RCV_PAY_INFM.RCV_PAY_TRCO_KEY`. */
    RCV_PAY_TRCO_KEY?: string | null;
    /** Contact display-name snapshot at pick time
     *  (`RCV_PAY_TRCO_NM`). The picker re-renders using this name
     *  even when the master contact is later renamed in Settings. */
    RCV_PAY_TRCO_NM?: string | null;
}

export interface ApiTransactionListResponse {
    ROWS: ApiTransactionRow[];
    TOTAL_COUNT: number;
    DEPOSIT_TOTAL: string;
    WITHDRAW_TOTAL: string;
}

/**
 * Wire shape for `GET .../transactions/summary` — count + confirmed/unconfirmed
 * split + in/out totals. UPPER_SNAKE per the Transaction holdover policy.
 */
export interface ApiTransactionSummaryResponse {
    TOTAL_COUNT: number;
    CONFIRMED_COUNT: number;
    UNCONFIRMED_COUNT: number;
    DEPOSIT_TOTAL: string;
    WITHDRAW_TOTAL: string;
}

/**
 * Wire shape for `GET .../transactions/{trnsSeqNo}` and the response of
 * `PUT .../transactions/{trnsSeqNo}/confirm`. Carries the base list-row
 * fields plus VAS account, counterparty, and confirmation metadata.
 */
export interface ApiTransactionDetailResponse {
    ACCT_SEQ_NO: string;
    TRSC_DT: string;
    TRSC_TM: string;
    INOUT_DV: string;
    DEPOSIT_AMT: string | null;
    WITHDRAW_AMT: string | null;
    BAL: string;
    RMRK: string;
    RMRK2: string;
    BANK_REF_NO: string | null;
    CCY_CD: string | null;
    CONF_YN: string;
    RCV_PAY_TRCO_KEY: string | null;
    RCV_PAY_TRCO_NM: string | null;
    RCV_PAY_USAG_CD: string | null;
    VAS_ACCT_CD: string | null;
    CONFIRMED_BY_ID: string | null;
    CONFIRMED_BY_NM: string | null;
    CONFIRMED_DTM: string | null;
}

/**
 * Body for `PUT .../transactions/{trnsSeqNo}/confirm`. All fields optional — a
 * bare confirm just flips `CNFM_YN` to 'Y'. Wire shape is lowercase snake_case
 * because the backend DTO has no `@JsonProperty` overrides (global Jackson
 * SNAKE_CASE strategy applies).
 */
export interface ApiTransactionConfirmRequest {
    rcv_pay_trco_key?: string | null;
    rcv_pay_trco_nm?: string | null;
    rcv_pay_usag_cd?: string | null;
    vas_acct_cd?: string | null;
}

/** Body for
 *  `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/reporting-account`.
 *  Backend validates both fields are non-blank + resolve to one
 *  active row in `CHART_ACCT_INFM` for the current tenant. */
export interface ApiTransactionReportingAccountRequest {
    chart_acct_seq_no: string;
    chart_acct_cd: string;
}

/** Body for
 *  `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/purpose`.
 *  Backend validates the picker entry exists, is active
 *  (`USE_YN='Y'`), and belongs to the current tenant. */
export interface ApiTransactionPurposeRequest {
    use_usag_cd: string;
}

/** Body for
 *  `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/vas-account`.
 *  Backend validates the VAS row exists, is active
 *  (`STTS='A'`, `DEL_YN='N'`), and belongs to the current tenant. */
export interface ApiTransactionVasAccountRequest {
    vas_acct_cd: string;
}

/** Body for
 *  `PATCH /api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/contact`.
 *  Backend validates the contact exists, is non-trashed
 *  (`TRCO_STTS != 'C'`), and belongs to the current tenant. */
export interface ApiTransactionContactRequest {
    trco_key: string;
}

// --------------------------------------------------------------------- //
// Smart Organizer (bank ↔ payment match) — legacy comm_0196_001 popup.
// Wire shape is UPPER_SNAKE (matches the backend DTO records which
// declare `@JsonProperty("UPPER_SNAKE")` per the Transaction History
// family — these types follow the same convention until both sides
// flip to lowercase in the same MR, per CLAUDE.md "Refactoring rules".)
// --------------------------------------------------------------------- //

/** One candidate payment that the bank transaction could be matched to. */
export interface ApiMatchCandidateRow {
    PAY_TRNS_ID:        string;
    /** `'S'` = domestic scheduled (only variant in the first slice). */
    PAY_TYPE_CD:        string;
    SCDUL_PYMN_NO:      string;
    SCDUL_PYMN_DETL_NO: string;
    SCDUL_PYMN_TYPE_CD: string;
    TRNF_DT:            string;
    TRNF_DTM:           string | null;
    TRAN_AMT:           string;
    TRNF_CCY_CD:        string;
    RCPT_NM:            string;
    BNFC_BANK_CD:       string | null;
    BNFC_BANK_NM:       string | null;
    BNFC_ACCT_NO:       string | null;
    TRAN_USAG:          string | null;
    TITL:               string;
}

export interface ApiMatchCandidateListResponse {
    ROWS:        ApiMatchCandidateRow[];
    TOTAL_COUNT: number;
}

/** Body for `POST .../transactions/{trnsSeqNo}/match`. */
export interface ApiCreateMatchRequest {
    PAY_TRNS_ID: string;
    PAY_TYPE_CD: string;
    MEMO?:       string | null;
}

/** Envelope for both `POST .../match` and `DELETE .../match`. */
export interface ApiMatchResultResponse {
    ACCT_SEQ_NO:   string;
    LINK_MATCH_YN: string;
    PAY_TRNS_ID:   string;
    MATCH_LOG_SEQ: string;
}

/**
 * Body for `POST /api/v1/banking/accounts/transactions-sync` — Account
 * Inquiry "Bank Transaction Sync" popup. Wire shape is lowercase snake_case
 * via the global Jackson SNAKE_CASE strategy.
 *
 * `auto = true` lets the backend pick its own date window; `auto = false`
 * sends the user-picked `from_dt` / `to_dt` (ISO `YYYY-MM-DD`).
 */
export interface ApiTransactionsSyncRequest {
    accounts: Array<{ bank_cd: string; acct_no: string }>;
    from_dt?: string;
    to_dt?: string;
    auto?: boolean;
}

/**
 * Wire response from the sync endpoint AND its resume endpoints
 * (`POST .../transactions-sync/{sessionId}/{qna|otp|captcha}`).
 *
 * Discriminator: `status`.
 *  - `COMPLETED` — every selected account synced. Read `accounts_synced`,
 *    `debit_count`, `credit_count`, `last_update`. Dismiss the popup.
 *  - `OTP_REQUIRED` / `QNA_REQUIRED` / `CAPTCHA_REQUIRED` — Coocon stopped
 *    at the current bank's LOGIN. Open the matching dialog (same dialogs
 *    Login Credentials Setup uses), POST the answer back to
 *    `/transactions-sync/{session_id}/{kind}`, loop on the new response.
 *  - `ERROR` — terminal bank-side / gateway-side rejection. Show the
 *    standard error dialog using `error_code` + `error_message`.
 *
 * Server uses `@JsonInclude(NON_NULL)` so each status carries only the
 * fields it needs — `null` everywhere else.
 */
export interface ApiTransactionsSyncResponse {
    session_id: string | null;
    status:
        | "COMPLETED"
        | "OTP_REQUIRED"
        | "QNA_REQUIRED"
        | "CAPTCHA_REQUIRED"
        | "ERROR";

    /* ── COMPLETED-only ── */
    accounts_synced: number | null;
    debit_count: number | null;
    credit_count: number | null;
    /** Sum of TRSC_AMT for newly-inserted IN (deposit) rows, as a
     *  string (preserves VND precision). `null` for any non-COMPLETED
     *  status. */
    credit_total: string | null;
    /** Sum of TRSC_AMT for newly-inserted OUT (withdraw) rows. */
    debit_total: string | null;
    last_update: string | null;

    /* ── *_REQUIRED-only ── */
    challenge_prompt: string | null;
    /** Populated only when `status === "QNA_REQUIRED"`. */
    qna_questions: ApiQnaQuestion[] | null;
    /** Base64 image bytes for `CAPTCHA_REQUIRED`. */
    captcha_image: string | null;
    /** `"png"` for most banks; `"svg+xml"` for VIETNAM_GDT. */
    captcha_image_format: string | null;
    /** Bank-credential username for the account whose LOGIN raised the
     *  challenge — populated on `QNA_REQUIRED` so the Security Question
     *  popup can render the registered Login ID. Null on every other
     *  status (backend's `@JsonInclude(NON_NULL)` drops it from the wire). */
    login_id: string | null;

    /* ── ERROR-only ── */
    error_code: string | null;
    error_message: string | null;
}

/**
 * One security-question entry inside a `QNA_REQUIRED` response — shared
 * with the Login Credentials scrape flow.
 */
export interface ApiQnaQuestion {
    /** Bank-supplied opaque id; echoed back unchanged on the answer. */
    hidden_value: string;
    question: string;
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

/**
 * One firm-banking-capable withdrawal account row returned from
 * `GET /api/v1/payment/{module}/withdrawal-accounts`.
 *
 * Mirrors `WithdrawalAccountRow.java` — serialised to snake_case by
 * the global Jackson SNAKE_CASE strategy.
 *
 * Display format (legacy pymn_0007_003.ts:521):
 * `"${bank_nm} ${acct_no} (${acctTypeLabel} ${ccy_cd})"`.
 */
export interface ApiWithdrawalAccountRow {
    bank_cd:      string;
    bank_nm:      string;
    acct_no:      string;
    acct_type_cd: string;
    ccy_cd:       string;
    acct_nick_nm: string | null;
}

// Banking — Internal Transfer > Transfer History
//
// Wire shape for `GET /api/v1/banking/internal-transfer/transfer-history`.
// Backend DTO is `com.kosign.wecms.domain.banking.transferhistory.dto.*`;
// lowercase snake_case enforced by the global Jackson `SNAKE_CASE`
// strategy (no per-field `@JsonProperty` on the server side). Stable
// identifier *values* (`trns_stts === "00000000"`, `ccy_cd === "VND"`)
// stay UPPERCASE per the wecms-web naming rule.
export interface ApiTransferHistoryRow {
    seq_no:        number;
    trns_dt:       string;          // YYYYMMDD
    trns_tm:       string;          // HHmm
    out_bank_code: string;
    out_bank_nm:   string;
    out_acct_no:   string;
    in_bank_code:  string;
    in_bank_nm:    string;
    in_acct_no:    string;
    owan_nm:       string;          // recipient holder name (legacy OWAC_NM AS OWAN_NM)
    ccy_cd:        string;
    trsc_amt:      string | number;
    fee:           string | number | null;
    trans_type:    string | null;
    rmrk:          string | null;
    trns_stts:     string;          // "00000000" on success
    trns_msg:      string | null;
    user_nm:       string;
}

export interface ApiTransferHistoryResponse {
    total_count:       number;
    total_vnd_amount:  string | number;
    total_usd_amount:  string | number;
    total_vnd_count:   number;
    total_usd_count:   number;
    rows:              ApiTransferHistoryRow[];
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

export interface ApiTransactionDetailRow {
    ACCT_SEQ_NO: string;
    TRSC_TM: string;
    TRSC_AMT: string;
    BAL: string;
    INOUT_DV: string;
    RMRK: string;
    RCV_PAY_USAG_CD: string;
    RCV_PAY_USAG_NM: string;
}

export interface ApiCurrentAccountRow {
    ID: string;
    BANK: string;
    BANK_CD: string;
    ACCT_NO: string;
    ACCT_NICK_NM: string;
    CCY_CD: string;
    ACCT_TYPE_CD: string;
    ACTV_YN: string;
    NUM_DEBITS: number;
    DEBIT: string;
    NUM_INTERNAL_DEBITS: number;
    INTERNAL_DEBIT: string;
    NUM_CREDITS: number;
    CREDIT: string;
    NUM_INTERNAL_CREDITS: number;
    INTERNAL_CREDIT: string;
    BAL: string;
    TRANSACTIONS?: ApiTransactionDetailRow[];
}

export interface ApiDailyFinancialCmcReport {
    AS_OF_DT: string;
    CURRENCY_SCOPE: string;
    ACTIVE_ACCOUNTS_ONLY: boolean;
    INCLUDE_INTERNAL_TRANSFERS: boolean;
    FINANCIAL_STATUS: ApiFinancialStatusRow[];
    CURRENT_ACCOUNTS: ApiCurrentAccountRow[];
}

/**
 * Daily Financial — Transaction History popup. Returned by
 * GET /api/v1/banking/reports/daily-financial/transactions.
 * Mirrors legacy `rept_0015_002_r001`.
 */
export interface ApiDailyFinancialTransactionRow {
    TRSC_TM: string;
    CCY_CD: string;
    TRSC_AMT: string;
    BAL: string;
    INOUT_DV: string; // "1" = credit/in, "2" = debit/out
    RMRK: string;
}

export interface ApiDailyFinancialTransactionsReport {
    TOT_CNT: number;
    TOT_IN_AMT: string;
    TOT_OUT_AMT: string;
    TOT_BAL: string;
    PAGE_NO: number;
    PAGE_PER_CNT: number;
    REC: ApiDailyFinancialTransactionRow[];
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

// Reports — Cash Flow
// Wire shape for GET /api/v1/banking/reports/cash-flow-report. Backend
// records use camelCase Java fields that ship as lowercase snake_case
// via the global Jackson SNAKE_CASE strategy. See
// docs/refactor-wecms/features/cash-flow-report.md.

export interface ApiCashFlowMonthlyAmounts {
    jan: string | number | null;
    feb: string | number | null;
    mar: string | number | null;
    apr: string | number | null;
    may: string | number | null;
    jun: string | number | null;
    jul: string | number | null;
    aug: string | number | null;
    sep: string | number | null;
    oct: string | number | null;
    nov: string | number | null;
    dec: string | number | null;
}

export interface ApiCashFlowRow {
    display_order: string;
    display_cd: string;
    display_nm: string;
    item_cd: string | null;
    item_nm: string | null;
    /**
     * Verbatim row-type from the legacy function: "Opening Balance",
     * "Level 1", "Level 2", "Level 3", "Level 1 Subtotal", "End Balance",
     * "Grand Total", "SALES PROFIT", "NON SALES PROFIT".
     */
    row_type: string;
    group_cd: string | null;
    parent_l2_cd: string | null;
    display_currency: string;
    monthly: ApiCashFlowMonthlyAmounts;
    annual_total: string | number | null;
}

export interface ApiCashFlowReport {
    year: number;
    quarter: number | null;
    base_currency: string;
    usd_rate: string | number | null;
    krw_rate: string | number | null;
    rows: ApiCashFlowRow[];
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

// Add-on — e-Invoice "Update" (scrape) intake
/**
 * One decrypted GDT invoice row posted to
 * `POST /api/v1/addon/einvoices/scrape-results`. Mirrors the backend
 * {@code ScrapedEInvoiceRow} (the legacy engine {@code invoiceList[]}
 * element). The browser drives the local NXiSAS engine, decrypts the
 * result client-side, and posts these structured rows — the refactor
 * does not bundle Coocon {@code ISASSeedCBC} server-side (OQ-S2).
 */
export interface ApiScrapedEInvoiceRow {
    numeric_symbol: string;
    invoice_symbol: string;
    invoice_no: string;
    invoice_date: string;
    total_amt: string;
    total_amt_without_tax: string;
    total_tax_amt: string;
    total_discount: string;
    invoice_status: string;
    check_result: string;
    invoice_info: string;
    seller_tax_code: string;
    einv_test_results: string;
    currency_cd: string;
    trco_cmnm: string;
}

/** Body for `POST /api/v1/addon/einvoices/scrape-results`. */
export interface ApiEInvoiceScrapeRequest {
    type: "SALES" | "EXPENSE";
    from_dt: string;
    to_dt: string;
    /** Engine ErrorCode for the call (`00000000` = success). */
    rslt_cd: string;
    rslt_msg?: string;
    /** Own-company tax code for SALES rows (server resolves from
     *  BUSI_INFM.TAX_ID first; this is a fallback). */
    issuer_tax_code?: string;
    engine_vendor?: string;
    engine_version?: string;
    invoices: ApiScrapedEInvoiceRow[];
}

/** Response of the scrape-intake call. */
export interface ApiEInvoiceScrapeResult {
    saved_count: number;
    updated_count: number;
    skipped_count: number;
    mod_dtm: string;
}

// Add-on — e-Invoice "Update" phase 2 (INVOICE_DETAIL) intake
/** One line item of a scraped invoice detail (engine `productArr[]`). */
export interface ApiScrapedEInvoiceDetailProduct {
    disp_ord: number;
    product_name: string;
    product: string;
    unit: string;
    unit_price: string;
    quantity: string;
    supply_amt: string;
    tax_rate: string;
    discount: string;
}

/** One fee line of a scraped invoice detail (engine `feeArr[]`). */
export interface ApiScrapedEInvoiceDetailFee {
    disp_ord: number;
    fee_name: string;
    fee: string;
}

/** One tax-rate breakdown line of a scraped invoice detail (engine `taxArr[]`). */
export interface ApiScrapedEInvoiceDetailTax {
    disp_ord: number;
    tax_rate: string;
    amt_without_tax: string;
    tax_amt: string;
}

/**
 * One decrypted GDT invoice DETAIL row posted to
 * `POST /api/v1/addon/einvoices/scrape-detail-results`. Mirrors the
 * legacy engine `invoiceDetail[0]` element + the legacy
 * `nxisas_einvoice_c002` REC_IN shape. The identity fields
 * (`numeric_symbol` / `invoice_symbol` / `invoice_no` / `seller_tax_code`
 * / `einv_test_results`) let the backend recompose the master `DOC_ID`
 * and locate the row written by phase 1; the line-item / fee / tax arrays
 * are written to `BUSA_DOC_DETL` / `EINV_FEE_DETL` / `EINV_TAX_DETL`.
 */
export interface ApiScrapedEInvoiceDetailRow {
    numeric_symbol: string;
    invoice_symbol: string;
    invoice_no: string;
    seller_tax_code: string;
    einv_test_results: string;
    currency_cd: string;
    invoice_title: string;
    seller_name: string;
    total_amt: string;
    total_amt_without_tax: string;
    total_tax_amt: string;
    total_discount: string;
    // Full master enrichment (Scope 3) — raw engine invoiceDetail fields;
    // the backend resolves issuer vs counterparty by type.
    buyer_name: string;
    buyer_tax_code: string;
    buyer_addr: string;
    buyer_bank_acc: string;
    buyer_bank_name: string;
    buyer_citizen_id: string;
    seller_addr: string;
    seller_bank_acc: string;
    seller_bank_name: string;
    seller_phone: string;
    mccqt: string;
    original_invoice: string;
    payment_type: string;
    list_number: string;
    list_date: string;
    total_fee: string;
    total_amt_in_letter: string;
    buyer_sign_by: string;
    buyer_sign_date: string;
    buyer_sign_time: string;
    seller_sign_by: string;
    seller_sign_date: string;
    seller_sign_time: string;
    qr_code: string;
    rate: string;
    products: ApiScrapedEInvoiceDetailProduct[];
    fees: ApiScrapedEInvoiceDetailFee[];
    taxes: ApiScrapedEInvoiceDetailTax[];
}

/** Body for `POST /api/v1/addon/einvoices/scrape-detail-results`. */
export interface ApiEInvoiceScrapeDetailRequest {
    type: "SALES" | "EXPENSE";
    from_dt: string;
    to_dt: string;
    /** Engine ErrorCode for the detail call (`00000000` = success). */
    rslt_cd: string;
    rslt_msg?: string;
    details: ApiScrapedEInvoiceDetailRow[];
}

/** Response of the detail scrape-intake call. */
export interface ApiEInvoiceScrapeDetailResult {
    detail_saved: number;
    detail_updated: number;
    detail_skipped: number;
    line_items: number;
    mod_dtm: string;
}

// Add-on — e-Invoice "Latest Inquiry History" (read of EXT_TRAN_CALL_HIS)
/**
 * One past GDT scrape call, read back for the History popup. Mirrors the
 * backend `EInvoiceHistoryRow` (legacy `nxisas_einvhis_r001`).
 */
export interface ApiEInvoiceHistoryRow {
    /** 14-digit inquiry timestamp `yyyyMMddHHmmss`. */
    reg_dtm: string;
    /** `SALES` / `EXPENSE` / `""` (derived from SVC_ID). */
    type: string;
    svc_id: string;
    /** Queried range, `yyyyMMdd`. */
    start_date: string;
    end_date: string;
    result: "SUCCESS" | "FAIL";
    rslt_cd: string;
    err_message: string | null;
}

export interface ApiEInvoiceHistoryResponse {
    rows: ApiEInvoiceHistoryRow[];
}

// Add-on — e-Invoice "Latest Inquiry — Detail" popup (drill-down read of
// BUSA_DOC_MSTR for one inquiry batch). Mirrors the backend
// `EInvoiceDetailHistoryRow` (legacy `nxisas_einvhis_dt_r001`).
export interface ApiEInvoiceDetailHistoryRow {
    /** Internal document id. */
    doc_id: string;
    /** Issue date `yyyyMMdd`. */
    issu_dt: string;
    /** Counterparty company name. */
    trco_cmnm: string;
    /** Total amount (wire number). */
    totl_amt: number | string;
    /** Raw `EINV_INVOICESTATUS` (locale-resolved on the legacy backend). */
    einv_invoice_status: string;
    /** Hand-registered flag `Y` / `N`. */
    hand_reg_yn: string;
    /** Display-friendly document id. */
    disp_doc_id: string;
}

export interface ApiEInvoiceDetailHistoryResponse {
    rows: ApiEInvoiceDetailHistoryRow[];
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
 * (`wecms-api/.../domain/setting/firmbankinghistory/dto/FirmBankingHistoryRow.java`).
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
 * (`wecms-api/.../domain/setting/erptransactionhistory/dto/ErpTrnsHistoryRow.java`).
 *
 * <p>The refactor screen is read-only: list + 4 tab counts + per-row
 * file download. Tenant scoping happens server-side from
 * {@code TenantContext.currentBizKey()} so the wire shape has no
 * {@code biz_key} field. Per OQ-2 (resolved 2026-05-11) the refactor
 * is product-agnostic — there is no HAENGSUNG-only branching here.
 *
 * <p>Two server-resolved i18n keys ride the row alongside the raw
 * legacy codes (the {@code *_key} pattern documented in
 * {@code wecms-api/CLAUDE.md §"Domain enums"}):
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
 * (`wecms-api/.../domain/setting/firmbankingsettings/dto/FirmBankingSettingRow.java`).
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

/**
 * Lightweight VAS Account row for the Edit Bank Account picker. Backend
 * filters to {@code STTS='A'} + {@code DEL_YN='N'} so inactive entries
 * are never offered as a new mapping target. Mirrors legacy
 * {@code comm_1002_001}.
 */
export interface ApiVasAccountLookupRow {
    vas_acct_seq_no: number;
    vas_acct_cd: string;
    vas_acct_nm: string;
}

export interface ApiVasAccountLookupResponse {
    items: ApiVasAccountLookupRow[];
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
// Payment > Approval Box
// =============================================================================
// Wire types for `/api/v1/payment/approval-box` — list + approve / reject /
// bulk-approve. Mirrors the Phase 1 backend
// `wecms-api/.../domain/payment/approvalbox/dto/*` records verbatim.
//
// Stable identifier values stay UPPERCASE:
//   - `appr_stts`        : "P" / "I" / "C" / "R" / "A" / "X"
//   - `apprvr_stts`      : "P" / "A" / "R" / "W" / "S"
//   - `currency`         : "VND" (refactor exposes a single currency per row;
//                          legacy KHR/USD column split retired — see
//                          design-backend.md §13 D1)
//   - `pay_end_yn`       : "Y" / "N"
//   - `appr_dv`          : "21" / "31" / "32" / "33" / "34" / "35"
//   - `type_label`       : "payroll" / "vendor" / "expense" /
//                          "corporate_card" / "overseas" / "internal_transfer"

export interface ApiApprovalBoxApprover {
    apprvr_line_no: number;
    apprvr_id: string;
    apprvr_nm: string;
    apprvr_stts: "P" | "A" | "R" | "W" | "S";
    /** UTC `yyyyMMddHHmmss`; null until the approver acts. */
    appr_dtm: string | null;
}

export interface ApiApprovalBoxRow {
    appr_seq_no: string;
    doc_no: string;
    title: string;
    /** Uploaded payment-batch file name — server-resolved from
     *  COALESCE(SCDUL_PYMN_SUMR.TITL, OVRS_PYMN_SUMR.TITL). Empty string
     *  when the approval has no source batch row carrying a title. */
    file_name: string;
    /** Free-form approval content the requestor filled in on Request
     *  Approval. Surfaces on the Approval Details popup's "Approval
     *  Content" section. Null when no note was provided. */
    cont: string | null;
    /** Raw APPR_DV digit. Use `type_label` for the i18n key. */
    appr_dv: string;
    /** Stable slug — frontend resolves `approval.type.<slug>` via t(). */
    type_label: string | null;
    /** Always `"VND"` in this MR; reserved for the multi-currency port. */
    currency: string;
    /** Numeric string — never a float. */
    tot_pay_amt: string;
    /** Scheduled payment date `YYYYMMDD`; nullable for draft rows. */
    pay_date: string | null;
    draft_user_id: string;
    draft_user_nm: string;
    /** Registration timestamp `yyyyMMddHHmmss`. */
    reg_dtm: string;
    appr_stts: "P" | "I" | "C" | "R" | "A" | "X";
    apprvr_tot_cnt: number;
    apprvr_appr_tot_cnt: number;
    pay_end_yn: "Y" | "N";
    approvers: ApiApprovalBoxApprover[];
}

/**
 * Per-tab document counts. Counts ignore `appr_type_cd` server-side
 * (mirrors legacy `resl_0001_001_r001_act.jsp:80-86`) so every tab
 * chip reflects the same date / search / visibility scope.
 */
export interface ApiApprovalBoxTabCounts {
    pending: number;
    in_progress: number;
    approved: number;
    rejected: number;
}

export interface ApiApprovalBoxListResponse {
    list: ApiApprovalBoxRow[];
    total_count: number;
    tab_counts: ApiApprovalBoxTabCounts;
    /** Zero-based page index (Spring Data convention). */
    page_number: number;
    page_size: number;
    total_pages: number;
}

/**
 * Final state of the document after Approve / Reject. Used by the
 * dialog footer + the bulk-approve breakdown so the row's badge can
 * refresh in place without a full list refetch.
 */
export interface ApiApprovalBoxActionResponse {
    appr_seq_no: string;
    appr_stts: "P" | "I" | "C" | "R" | "A" | "X";
    apprvr_appr_tot_cnt: number;
    apprvr_tot_cnt: number;
}

export interface ApiApprovalBoxBulkApproveRequest {
    appr_seq_nos: string[];
}

export interface ApiApprovalBoxBulkApproveFailure {
    appr_seq_no: string;
    code: string;
    message: string;
}

export interface ApiApprovalBoxBulkApproveResponse {
    successes: ApiApprovalBoxActionResponse[];
    failures: ApiApprovalBoxBulkApproveFailure[];
}

/* ----------------------------------------------------------------------------
 * Internal Transfer (refactor slug `internal-transfer`).
 *
 * Mirrors the Phase A Spring backend at
 * `com.kosign.wecms.domain.payment.internaltransfer.controller`. Wire
 * shape is lowercase snake_case via the global Jackson naming strategy
 * (see `wecms-api/CLAUDE.md` § API Naming & Serialization
 * Standards). The matching in-memory camelCase shapes live in
 * `lib/api/mappers.ts`; never read a snake_case property off a wire
 * response inside a component.
 *
 * Phase A scope: list + detail for Scheduled Transfer + Transfer
 * Result. Create / delete / dispatch / parse-Excel wire types are
 * declared for the matching backend endpoints but the page-level
 * wiring is deferred to Phase B (depends on the dispatch-table
 * schema migration that backend doc §15.6 defers). Several response
 * fields are intentionally nullable today — `appr_stts*`, `proc_*`,
 * `rs_cd`/`rs_msg`, `rslt_dttm` — Phase A backend returns null until
 * EXPT_RESOL_MSTR + TB_PAY_TARGET/TB_PAY_FILE_DATA land locally.
 * -------------------------------------------------------------------------- */

export interface ApiInternalTransferCurrencyTotal {
    /** Per-currency sum of `total_tran_amt` across the page slice. */
    total_amount: string;
    /** Number of batches in the page slice for this currency. */
    total_count: number;
    ccy_cd: string;
    /** Sum of `tot_trns_cnt` across the page slice (per-currency). */
    total_transaction_count: number;
}

/** One row in `GET /api/v1/payment/internal-transfer`. */
export interface ApiScheduledTransferRow {
    scdul_pymn_no: string;
    /** Always "03" for Internal Transfer batches. */
    scdul_pymn_type_cd: string;
    ccy_cd: string;
    titl: string;
    /** null while the batch is still a draft (no approval requested). */
    appr_seq_no: string | null;
    /** Decimal string (BigDecimal serialised verbatim by Jackson). */
    total_tran_amt: string;
    /** Decimal string (NUMERIC(15,0)). */
    tot_trns_cnt: string;
    /** `yyyyMMddHHmmss` server time at create (UTC). */
    reg_dtm: string;
    reg_id: string;
    /** Phase B (deferred — needs EXPT_RESOL_MSTR join). */
    appr_stts: string | null;
    /** Phase B — `payment.appr_stts.*` i18n key. */
    appr_stts_key: string | null;
    /** Phase B (deferred). */
    trnf_stts: string | null;
    /** `'Y'` once dispatched, `'N'` while still pre-dispatch. */
    trnf_yn: "Y" | "N";
    out_bank_cd: string;
    wdrl_act_no: string;
    /** Legacy `PAY_TRAN_DT` — `yyyyMMdd` or null. */
    pay_date: string | null;
    /** Original uploaded file name. */
    file_nm: string | null;
    /** Legacy `ERP_FILE_NUM` — re-purposed for the "Doc No." column. */
    doc_no: string | null;
    wdrl_ccy_cd: string | null;
    /**
     * Legacy `APPR_FUND_TP` (Payroll Type) — joined from `EXPT_RESOL_MSTR`.
     * `"0"`=Salary, `"1"`=Bonus, else blank. Only the Payroll Scheduled
     * list populates it (legacy `pymn_0005_001`); null on every other
     * Payment kind that shares this row shape.
     */
    appr_fund_tp: string | null;
    /**
     * First approver's display name (legacy `APPRVR_NM`, line-1 of the
     * `EXPT_RESOL_APPRVR_INFM` chain). null when the batch has no approval
     * request yet. Populated by the Internal Transfer Scheduled list.
     */
    approver: string | null;
    /**
     * Total number of approvers in the chain (legacy "[N]" count badge).
     * null when the batch has no approval request yet. Populated by the
     * Internal Transfer Scheduled list (Phase 1).
     */
    approver_count: number | null;
    /**
     * Full approval chain (name + status + datetime) in line order — feeds
     * the legacy approver-cell click popup (Phase 2). null when the batch
     * has no approval request yet. Internal Transfer only.
     */
    approvers: ApiScheduledTransferApprover[] | null;
}

/** One approver in a Scheduled Transfer batch's approval chain. */
export interface ApiScheduledTransferApprover {
    /** Approver display name (legacy `APPRVR_NM`). */
    apprvr_nm: string | null;
    /** Single-letter status (legacy `APPRVR_STTS`): P/A/R/W/S. */
    apprvr_stts: string | null;
    /** Approval datetime `yyyyMMddHHmmss`; null until the approver acts. */
    appr_dtm: string | null;
}

export interface ApiScheduledTransferListResponse {
    total_count: number;
    page: number;
    size: number;
    currency_totals: ApiInternalTransferCurrencyTotal[];
    rows: ApiScheduledTransferRow[];
}

export interface ApiTransferLineDetail {
    scdul_pymn_detl_no: string;
    ant_div_cd: string | null;
    rcpt_nm: string | null;
    tar_bank_cd: string | null;
    /** Human-readable bank name resolved server-side from `tar_bank_cd`
     *  via `BankCdResolver`. Null when the code is missing / unknown. */
    tar_bank_nm: string | null;
    finc_mda_no: string;
    tran_usag: string | null;
    /** Decimal string. */
    tran_amt: string;
    /** Legacy `TRNF_CCY_CD` on the detail row. */
    ccy_cd: string;
    trco_key: string | null;
    hand_trco_key: string | null;
    doc_no: string | null;
    note: string | null;
    citad_bank_cd: string | null;
    chart_acct_cd: string | null;
    chart_acct_seq_no: string | null;
    /** Ancestor-chain breadcrumb (e.g. `"EXPENSES > PAYMENT"`) built
     *  server-side from `CHART_ACCT_INFM`. Excludes the leaf — the
     *  leaf's own name renders on the primary line. Null when the row
     *  has no chart account or the lookup misses. */
    chart_acct_breadcrumb: string | null;
    depo_ccy_cd: string | null;
    bank_trns_short_id: string | null;
}

export interface ApiScheduledTransferDetailResponse {
    scdul_pymn_no: string;
    scdul_pymn_type_cd: string;
    out_bank_cd: string;
    /** Human-readable name of the withdrawal bank — resolved server-side
     *  via the same two-step `BankCdResolver` → V86 NAPAS/CITAD lookup
     *  the per-line deposit-bank cell uses. `null` when neither lookup
     *  matches; the UI falls back to the code alone. */
    out_bank_nm: string | null;
    wdrl_act_no: string;
    titl: string;
    total_tran_amt: string;
    tot_trns_cnt: string;
    /** Reuses legacy `ERP_FILE_NUM` slot — surfaced as "Doc No." on
     *  the page header. */
    doc_no: string | null;
    reg_id: string;
    /** Requester display name (legacy `EXPT_RESOL_MSTR.DRAFT_USER_NM`); null
     *  when no approval request — the UI falls back to `reg_id`. */
    requestor: string | null;
    /** `yyyyMMddHHmmss` — when the batch was originally created. */
    reg_dtm: string;
    appr_seq_no: string | null;
    appr_stts: string | null;
    appr_stts_key: string | null;
    /** `yyyyMMddHHmmss` — last-modification time. After the
     *  approval-action endpoint stamps `appr_stts`, this reflects the
     *  action time; the dialog formats it as the approver chip's "has
     *  approved on …" / "has rejected on …" date. */
    mod_dtm: string;
    trnf_yn: "Y" | "N";
    /** `yyyyMMddHHmmss` UTC; null while batch not yet dispatched. */
    trnf_dtm: string | null;
    ccy_cd: string;
    wdrl_ccy_cd: string | null;
    org_file_nm: string | null;
    /** File size in bytes (BigDecimal serialised verbatim). */
    file_size: string | null;
    rows: ApiTransferLineDetail[];
    /** Approval-request attachments registered against this batch's
     *  `appr_seq_no`. Empty when the batch has no approval submission
     *  yet, or when the user submitted with zero attachments. The
     *  Approval Details popup renders one file chip per row + streams
     *  the binary back via
     *  `GET .../{id}/approval/{appr_seq_no}/attachments/{file_id}`. */
    attachments: ApiApprovalAttachment[];
}

/** One row in `ApiScheduledTransferDetailResponse.attachments` —
 *  metadata only, the binary lives on a separate download endpoint. */
export interface ApiApprovalAttachment {
    file_id:     string;
    org_file_nm: string;
    /** Decimal byte count or null when the upload had no Content-Length. */
    file_size:   string | null;
    /** Display name of the user who attached the file at submit time. */
    reg_nm:      string;
    /** `yyyyMMddHHmmss` — when the attachment was registered. */
    reg_dtm:     string;
}

/** Body for `POST /api/v1/payment/internal-transfer` — JSON-part of
 *  the multipart create request. The companion `file_data` multipart
 *  part is a binary File on the wire, not part of this type. */
export interface ApiCreateScheduledTransferRequest {
    titl: string;
    bank_cd: string;
    acct_no: string;
    ccy_cd: string;
    trnf_ccy_cd: string;
    lines: ApiTransferLineInput[];
}

export interface ApiTransferLineInput {
    /** Decimal — wire accepts a number or a numeric string. */
    tran_amt: string | number;
    ant_div_cd?: string | null;
    rcpt_nm?: string | null;
    tar_bank_cd?: string | null;
    finc_mda_no: string;
    tran_usag?: string | null;
    trco_key?: string | null;
    hand_trco_key?: string | null;
    doc_no?: string | null;
    note?: string | null;
    citad_bank_cd?: string | null;
    trco_cmnm?: string | null;
    trco_cmenm?: string | null;
    chart_acct_seq_no?: string | null;
    chart_acct_cd?: string | null;
    trnf_ccy_cd?: string | null;
    depo_ccy_cd?: string | null;
}

export interface ApiCreateScheduledTransferResponse {
    scdul_pymn_no: string;
}

/**
 * One firm-banking-capable withdrawal account returned by
 * {@code GET /api/v1/payment/internal-transfer/withdrawal-accounts}.
 * Mirrors legacy {@code WSVC.comm_1001_001.xml:rule_Sub_0} (subset —
 * fields the Internal Transfer upload dialog actually consumes).
 * Display format: {@code "${bank_nm} ${acct_no} (${ACCT_TYPE} ${ccy_cd})"}
 * — mirrors legacy {@code pymn_0009_002.ts:573}.
 */
export interface ApiWithdrawalAccountRow {
    bank_cd: string;
    bank_nm: string;
    acct_no: string;
    acct_type_cd: string;
    ccy_cd: string;
    acct_nick_nm: string | null;
}

export interface ApiUpdateReportingAccountRequest {
    chart_acct_seq_no: string;
    chart_acct_cd: string;
}

export interface ApiDispatchRequest {
    trnf_ccy_cd: string;
}

/** `POST /api/v1/payment/internal-transfer/{id}/request-approval` request body.
 *  Mirrors the legacy `comm_0192_001_c005` payload at
 *  `WECMS DEV/.../comm_0194_001.ts:1443-1457`, narrowed to the fields
 *  the refactor consumes today. The full per-leg snapshot lands when
 *  the `EXPT_RESOL_*` tables are ported. */
export interface ApiRequestApprovalRequest {
    post_title:   string;
    post_cont?:   string;
    bank_cd:      string;
    acct_no:      string;
    ccy_cd:       string;
    pay_date?:    string;       // yyyyMMdd
    appr_line_no: number;
    approvers:    ApiRequestApprovalApproverInput[];
    files?:       ApiRequestApprovalFileInput[];
}

export interface ApiRequestApprovalApproverInput {
    apprvr_id: string;
    apprvr_nm: string;
}

export interface ApiRequestApprovalFileInput {
    org_file_nm:  string;
    save_file_nm: string;
    file_size?:   number;
}

/** Response from `POST /api/v1/payment/internal-transfer/{id}/request-approval`. */
export interface ApiRequestApprovalResponse {
    appr_seq_no: string;
}

/** Body for `POST /api/v1/payment/internal-transfer/{id}/approval-action`.
 *  Drives the Approve / Reject footer buttons on
 *  `<ApprovalDetailsDialog>` (legacy `comm_0195_001` lines 916-919 →
 *  `bltb_0001_003_u001`). The action enum on the wire is uppercase
 *  for parity with the validated `@Pattern` on the backend record. */
export interface ApiApprovalActionRequest {
    action:   "APPROVE" | "REJECT";
    /** Optional approver comment — accepted-and-audited by the backend
     *  Phase A endpoint but not persisted on the master (BLTB_POST_INFM
     *  comment write lands with the per-approver chain port). */
    comment?: string;
}

/** Response from `POST /api/v1/payment/internal-transfer/uploads/parse`.
 *  Phase A backend ships an empty preview — Apache POI workbook walk
 *  is deferred (backend doc §15.6). */
export interface ApiParsedTransferLine {
    tran_amt: string | null;
    ant_div_cd: string | null;
    rcpt_nm: string | null;
    tar_bank_cd: string | null;
    tar_bank_nm: string | null;
    finc_mda_no: string | null;
    tran_usag: string | null;
    /** Comma-separated FIELD_IDs of cells that failed validation. */
    err_fld: string | null;
    err_fld_caus: string | null;
    trco_key: string | null;
    hand_trco_key: string | null;
    doc_no: string | null;
    note: string | null;
    citad_bank_cd: string | null;
    trco_cmnm: string | null;
    trco_cmenm: string | null;
    chart_acct_seq_no: string | null;
    chart_acct_cd: string | null;
    trnf_ccy_cd: string | null;
    depo_ccy_cd: string | null;
}

export interface ApiParseExcelResponse {
    tot_cnt: string;
    suc_cnt: string;
    err_cnt: string;
    rows: ApiParsedTransferLine[];
}

/** One row in `GET /api/v1/payment/internal-transfer/results`. */
export interface ApiTransferResultRow {
    scdul_pymn_no: string;
    scdul_pymn_type_cd: string;
    ccy_cd: string;
    titl: string;
    /** Original Excel name (`ScdulPymnSumr.orgFileNm`). Surfaced as the
     *  separate "File Name" column on the legacy pymn_0010_001 view —
     *  distinct from `titl` which carries the approval-request title. */
    file_nm: string | null;
    total_tran_amt: string;
    tot_trns_cnt: string;
    /** Phase B — computed from dispatch tables when they land. */
    tot_trns_succ_cnt: string | null;
    tot_trns_error_cnt: string | null;
    trnf_stts: string | null;
    reg_dtm: string;
    appr_seq_no: string | null;
    doc_no: string | null;
}

export interface ApiTransferResultListResponse {
    total_count: number;
    page: number;
    size: number;
    currency_totals: ApiInternalTransferCurrencyTotal[];
    rows: ApiTransferResultRow[];
}

export interface ApiTransferResultLine {
    scdul_pymn_detl_no: string;
    tran_amt: string;
    ant_div_cd: string | null;
    rcpt_nm: string | null;
    tar_bank_cd: string | null;
    /** Server-resolved human-readable deposit-bank name (BANK_INFM →
     *  V86 NAPAS/CITAD function → CITAD_BANK_CD canonical fallback).
     *  Null when no lookup matches; UI renders the code alone. */
    tar_bank_nm: string | null;
    finc_mda_no: string;
    tran_usag: string | null;
    /** Legacy `TRNF_CCY_CD` on the detail row. */
    ccy_cd: string;
    trnf_ccy_cd: string | null;
    depo_ccy_cd: string | null;
    note: string | null;
    doc_no: string | null;
    chart_acct_cd: string | null;
    chart_acct_seq_no: string | null;
    bank_trns_short_id: string | null;
    /** Phase B (deferred — joins dispatch tables). */
    proc_stat: string | null;
    proc_stat_key: string | null;
    proc_dttm: string | null;
    rslt_dttm: string | null;
    rs_cd: string | null;
    rs_msg: string | null;
}

export interface ApiTransferResultDetailResponse {
    scdul_pymn_no: string;
    out_bank_cd: string;
    /** Resolved withdrawal-bank display name (legacy `OUT_BANK_NM`); null when
     *  unresolvable — frontend falls back to `out_bank_cd`. */
    out_bank_nm: string | null;
    wdrl_act_no: string;
    titl: string;
    total_tran_amt: string;
    tot_trns_cnt: string;
    appr_seq_no: string | null;
    doc_no: string | null;
    ccy_cd: string;
    wdrl_ccy_cd: string | null;
    trnf_yn: "Y" | "N";
    trnf_dtm: string | null;
    org_file_nm: string | null;
    file_size: string | null;
    /** User id of the requester — populated from the master row. */
    reg_id: string | null;
    /** Requester display name (legacy `EXPT_RESOL_MSTR.DRAFT_USER_NM`); null
     *  when no approval request — frontend falls back to `reg_id`. */
    requestor: string | null;
    /** Phase B — computed from dispatch tables. */
    suc_cnt: string | null;
    err_cnt: string | null;
    prc_cnt: string | null;
    rows: ApiTransferResultLine[];
}

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

/** Request body for {@code POST /api/v1/settings/contacts/excel/import}. */
export interface ApiContactBulkImportRequest {
    contacts: ApiContactCreateRequest[];
}

/** Per-row failure entry inside {@link ApiContactBulkImportResponse}. */
export interface ApiContactImportError {
    index: number;
    hand_trco_key: string;
    code: string;
    message: string;
}

/** Response from {@code POST /api/v1/settings/contacts/excel/import}. */
export interface ApiContactBulkImportResponse {
    total: number;
    imported: number;
    failed: number;
    errors: ApiContactImportError[];
}

/**
 * Preflight request — one row per parsed Excel line, carrying just the
 * two fields the backend can dedup against the tenant
 * (`hand_trco_key` + optional `trco_tax_id`). Wire shape for
 * `POST /api/v1/settings/contacts/excel/preflight`.
 */
export interface ApiContactsExcelPreflightRequest {
    rows: ApiContactsExcelPreflightRow[];
}

export interface ApiContactsExcelPreflightRow {
    hand_trco_key: string;
    trco_tax_id?: string | null;
}

/**
 * Per-row preflight result. `hand_trco_key_exists` / `trco_tax_id_exists`
 * are `true` when the value already points to an active contact in the
 * tenant (excludes soft-deleted rows — legacy `trco_stts <> 'C'`).
 */
export interface ApiContactsExcelPreflightResult {
    row_index: number;
    hand_trco_key_exists: boolean;
    trco_tax_id_exists: boolean;
}

export interface ApiContactsExcelPreflightResponse {
    results: ApiContactsExcelPreflightResult[];
}

/**
 * Bulk bank-name → bank-code + recipient resolution for the
 * Local-Contact Excel-upload preview. Wire shape for
 * `POST /api/v1/settings/contacts/excel/resolve-recipients`.
 *
 * Mirrors per-row work in legacy
 * `comm_0184_007_r001_act.jsp:475-533` so the preview table can
 * show the Recipient column populated and stamp NAPAS/CITAD codes
 * onto each row's account upsert before the user clicks Upload.
 */
export interface ApiContactsExcelResolveRecipientsRequest {
    rows: ApiContactsExcelResolveRecipientsRow[];
}

export interface ApiContactsExcelResolveRecipientsRow {
    row_index: number;
    bank_name?: string | null;
    acct_no?: string | null;
    currency?: string | null;
}

/**
 * Per-row resolution result. `bank_found = false` means the bank
 * name in the cell didn't match any NAPAS / CITAD entry. When
 * `bank_found = true`, exactly one of `napas_bank_cd` /
 * `citad_bank_cd` is populated (per `ant_div_cd`). The
 * `finc_mda_owner_nm` is populated only for NAPAS rows with
 * `currency = "VND"`.
 */
export interface ApiContactsExcelResolveRecipientsResult {
    row_index: number;
    bank_found: boolean;
    ant_div_cd: "NAPAS" | "CITAD" | null;
    napas_bank_cd: string | null;
    citad_bank_cd: string | null;
    finc_mda_owner_nm: string | null;
}

export interface ApiContactsExcelResolveRecipientsResponse {
    results: ApiContactsExcelResolveRecipientsResult[];
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
 *  Settings > Users — management surface (slug: user-management)
 *
 *  Wire types for the Spring `UserManagementController` endpoints
 *  under `/api/v1/settings/users` (NOT the same path as the
 *  tenant-user picker `UserController` at `/api/v1/users` above).
 *  Six endpoints — list / detail / check-id / create / update /
 *  delete — backing the Settings > Users panel.
 *
 *  Differences from `ApiTenantUserRow` above: this surface carries
 *  every column the management grid renders (email, phone,
 *  position, department, admin flag, "is current user" flag) plus
 *  the active-user count. No plan cap — legacy JEX defines a 5-user
 *  message but never throws it; the refactor preserves the
 *  unrestricted behaviour.
 * ================================================================= */

/** One row in the Settings > Users management list / detail
 *  response. The backend resolves `is_admin` from `BUSI_ADMN_INFM`,
 *  `is_current_user` from the JWT caller's id. */
export interface ApiUserMgmtRow {
    user_id:         string;
    user_nm:         string;
    eml:             string;
    clph_no:         string;
    posi_nm:         string | null;
    dept_nm:         string | null;
    is_admin:        boolean;
    is_current_user: boolean;
    user_img_url:    string | null;
}

/** Envelope for `GET /api/v1/settings/users`. The panel renders
 *  `total_count` in its subtitle. No plan cap — legacy JEX defines a
 *  5-user message but never throws it; the refactor preserves the
 *  unrestricted behaviour. */
export interface ApiUserMgmtListResponse {
    users:       ApiUserMgmtRow[];
    total_count: number;
}

/** Body for `POST /api/v1/settings/users`. */
export interface ApiUserMgmtCreateRequest {
    user_id:      string;
    user_pw:      string;
    user_nm:      string;
    eml:          string;
    clph_no:      string;
    posi_nm:      string;
    dept_nm:      string;
    set_as_admin: boolean;
}

/** Body for `PUT /api/v1/settings/users/{user_id}`. `user_pw` is
 *  optional — omit / leave blank to keep the existing hash. */
export interface ApiUserMgmtUpdateRequest {
    user_nm:      string;
    eml:          string;
    clph_no:      string;
    posi_nm:      string;
    dept_nm:      string;
    set_as_admin: boolean;
    user_pw?:     string;
}

/** Response for `GET /api/v1/settings/users/check-id?login_id=…`.
 *  `available = true` when no `USER_INFM` row exists for the candidate id. */
export interface ApiCheckLoginIdResponse {
    available: boolean;
}

/** Response for `GET / PUT /api/v1/settings/users/{user_id}/menu-entitlement`.
 *  Y-only storage — backend stores only granted slugs; absence implies
 *  denial. Frontend renders the entitlement tree by intersecting this
 *  list against its static `ENTITLEMENT_SECTIONS`. */
export interface ApiMenuEntitlementResponse {
    user_id:        string;
    menu_auth_cds:  string[];
}

/** Body for `PUT /api/v1/settings/users/{user_id}/menu-entitlement`.
 *  Carries the FULL set of granted slugs — the backend replaces every
 *  prior grant via delete-then-insert. Empty list = revoke all. */
export interface ApiMenuEntitlementUpdateRequest {
    menu_auth_cds: string[];
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

/** Request body for {@code POST /api/v1/settings/chart-of-accounts/bulk-upload}.
 *  Each element is validated server-side as a normal create request. */
export interface ApiChartOfAccountBulkUploadRequest {
    items: ApiChartOfAccountCreateRequest[];
}

/** Response for {@code POST /api/v1/settings/chart-of-accounts/bulk-upload}.
 *  {@code created} rows were persisted; {@code failed} rows threw an error
 *  (duplicate code, parent not found, depth exceeded, etc.). */
export interface ApiChartOfAccountBulkUploadResponse {
    created: number;
    failed:  number;
}

/** Request body for {@code POST /api/v1/settings/chart-of-accounts/bulk-delete}
 *  and {@code POST .../bulk-deactivate}. Each {@code chart_acct_seq_no} is
 *  processed independently on the backend — a per-row failure does NOT
 *  roll back rows that already committed. */
export interface ApiChartOfAccountBulkActionRequest {
    chart_acct_seq_nos: string[];
}

/** Response for the bulk delete / bulk deactivate endpoints.
 *  {@code processed} rows succeeded; {@code failed} rows surfaced a
 *  per-row error (restricted code, not found, etc.) and were skipped. */
export interface ApiChartOfAccountBulkActionResponse {
    processed: number;
    failed:    number;
}

// =============================================================================
// Banking — Exchange Rate Inquiry
// =============================================================================
// Wire types for GET /api/v1/banking/exchange-rates. Mirrors the Spring
// controller ExchangeRateController + ExchangeRateListResponse / ExchangeRateRow
// records. All amounts are serialised as strings (BigDecimal → JSON string via
// Jackson) so JS-number precision cannot silently truncate fractional rates.

/**
 * One counter-currency row in the exchange rate response.
 *
 * Field names are lowercase snake_case matching the global Jackson
 * SNAKE_CASE strategy on the api side. Amount fields may be null when the
 * source API did not provide a value for that rate type on the requested date.
 */
export interface ApiExchangeRateRow {
    /** Counter currency code, e.g. USD, EUR, JPY. */
    ccy_cd: string;
    /** Base/reference currency the rates are quoted against, e.g. KRW. */
    ref_ccy_cd: string;
    /** Basic (middle) rate. */
    basic_rate: number | null;
    /** Basic transfer rate. */
    basic_tran: number | null;
    /** Spot buy rate. */
    buy_amt: number | null;
    /** Spot sell rate. */
    sell_amt: number | null;
    /** Transfer buy rate (remittance receive). */
    tran_buy_amt: number | null;
    /** Transfer sell rate (remittance send). */
    tran_sell_amt: number | null;
    /** Stand point from the Coocon API resultData. */
    stand_point: string | null;
    /** Last update date from the source — YYYYMMDD. */
    last_update_date: string | null;
    /** Last update time from the source — HHMMSS. */
    last_update_time: string | null;
    /** Datetime the rate was registered in the source — YYYYMMDDHHMMSS. */
    exch_rate_reg_dtm: string | null;
}

/**
 * One entry from GET /api/v1/banking/exchange-rates/banks.
 * Serialised by Jackson SNAKE_CASE from ExchangeRateBankItem(bankCd, bankNm).
 */
export interface ApiExchangeRateBankItem {
    bank_cd: string;
    bank_nm: string;
}

/**
 * One entry from GET /api/v1/banking/exchange-rates/rounds.
 */
export interface ApiExchangeRateRoundItem {
    seq_no: string;
    last_update_time: string | null;
}

/**
 * Response body for GET /api/v1/banking/exchange-rates.
 *
 * Mirrors ExchangeRateListResponse on the api side — one row per
 * counter-currency, columns for each rate type, ordered by ccy_cd ASC.
 */
export interface ApiExchangeRateListResponse {
    /** Reference date the rates apply to — YYYYMMDD. */
    ref_date: string;
    /** Bank code whose rates are returned, e.g. "11704088" (Shinhan). */
    bank_cd: string;
    /** Bank display name resolved from BANK_INFM. */
    bank_nm: string;
    /** Exchange rates, one entry per counter-currency, ordered by CCY_CD. */
    rates: ApiExchangeRateRow[];
    /** Available batch rounds for the selected bank and date. */
    rounds: ApiExchangeRateRoundItem[];
}

/* ============================================================================
 *  Login Credentials (slug "login-credentials") — wire types
 *
 *  Mirrors the backend slice at
 *  wecms-api/.../domain/setting/logincredentials/. Endpoints:
 *    GET    /api/v1/login-credentials                         → list (BANK ∪ GDT)
 *    DELETE /api/v1/login-credentials/{type}/{seqNo}          → delete one row
 *    POST   /api/v1/login-credentials/{type}/{seqNo}/reveal   → re-auth + decrypt
 *    GET    /api/v1/login-credentials/{type}/{seqNo}/audit-logs
 *  ========================================================================== */

/** One credential row inside a {@link ApiLoginCredentialGroup}. The
 *  password ciphertext is NEVER on the wire — only the login id. */
export interface ApiLoginCredentialAccount {
    /** {@code BANK_CERT_INFO.SEQ_NO} or {@code GDT_CERT_INFO.SEQ_NO}.
     *  Numeric on the wire — Jackson serialises BigDecimal as a JSON
     *  number, so axios delivers a JS `number`. */
    seq_no: number;
    login_id: string | null;
    nxisas_gb_seq_no: number | null;
    /** Human-readable sub-type label from
     *  {@code BANK_CERT_INFO.CERT_INFO_DETL_CON3} (e.g. "Corporate",
     *  "Personal Connect", "DigiBiz"). Surfaced so the Login ID/PW
     *  popover can disambiguate two rows that share the same
     *  {@code login_id} but were registered against different bank
     *  sub-types (the legacy popover hid this field, so identical
     *  login IDs looked like duplicates). Null/blank for GDT and for
     *  legacy rows registered before the sub-type was captured. */
    login_type: string | null;
}

/** One linked bank account under a {@link ApiLoginCredentialGroup}.
 *  Mirrors the legacy {@code BANK_CERT_INFO_R005} {@code REC_1} element
 *  ({@code BANK_CD} / {@code ACCT_NO} / {@code ACCT_NICK_NM}). Per-bank
 *  (keyed on BANK_CD), so every credential row under the bank shares it. */
export interface ApiLoginCredentialBankAccount {
    bank_cd: string | null;
    acct_no: string;
    acct_nick_nm: string | null;
}

/** One row of the Login Credentials list — either a bank (one or more
 *  accounts grouped by BANK_CD) or the single GDT row. */
export interface ApiLoginCredentialGroup {
    /** {@code "BANK"} or {@code "GDT"}. */
    type: "BANK" | "GDT";
    /** Bank code for BANK rows; {@code null} for GDT. */
    bank_cd: string | null;
    /** Display name — bank registry lookup for BANK rows; the literal
     *  "GDT" for GDT. */
    institution: string;
    /** Last MOD_ID across the group's accounts. */
    modified_by: string | null;
    /** Last MOD_DTM (legacy yyyyMMddHHmmss) across the group. */
    modified_at: string | null;
    accounts: ApiLoginCredentialAccount[];
    /** Bank accounts linked to this BANK_CD — drives the Registered
     *  Login Credentials popup's "Bank Account" column + {@code +N}
     *  badge. Empty for GDT. */
    bank_accounts: ApiLoginCredentialBankAccount[];
}

export interface ApiLoginCredentialListResponse {
    items: ApiLoginCredentialGroup[];
}

/** Re-auth payload for {@code POST /{type}/{seqNo}/reveal}. */
export interface ApiLoginCredentialRevealRequest {
    user_password: string;
}

/** Decrypted credential surfaced after a successful re-auth. */
export interface ApiLoginCredentialRevealResponse {
    login_id: string | null;
    password: string | null;
}

/** One row in the audit-logs popup (legacy {@code comm_0218_005}). */
export interface ApiLoginCredentialAuditRow {
    audit_logs_seq_no: number;
    audit_logs_actv: string | null;
    audit_logs_actv_dtl: string | null;
    reg_id: string | null;
    reg_nm: string | null;
    /** {@code yyyyMMddHHmmss}. */
    reg_dtm: string | null;
}

export interface ApiLoginCredentialAuditResponse {
    items: ApiLoginCredentialAuditRow[];
}

/** Create-bank wire body for {@code POST /api/v1/login-credentials/bank}.
 *  Per-bank extras (mirrors legacy {@code comm_0218_003_c001}):
 *  {@code extra} → {@code CERT_INFO_DETL_CON2} (Corporate ID);
 *  {@code login_type} → {@code CERT_INFO_DETL_CON3} (ABBANK / Vietcom
 *  Personal OTP selector); {@code nxisas_gb_seq_no} → sub-type
 *  discriminator (0 = Corporate, 1 = Personal, 2 = VCB DigiBiz). */
export interface ApiLoginCredentialBankCreateRequest {
    bank_cd:            string;
    login_id:           string;
    password:           string;
    extra?:             string;
    login_type?:        string;
    nxisas_gb_seq_no?:  number;
}

/** Update-bank wire body — every field optional. */
export interface ApiLoginCredentialBankUpdateRequest {
    login_id?:          string;
    password?:          string;
    extra?:             string;
    login_type?:        string;
    nxisas_gb_seq_no?:  number;
}

/** GDT create wire body — same fields as bank minus {@code bank_cd}. */
export interface ApiLoginCredentialGdtCreateRequest {
    login_id: string;
    password: string;
    extra?:   string;
}

/** GDT update wire body — every field optional. */
export interface ApiLoginCredentialGdtUpdateRequest {
    login_id?: string;
    password?: string;
    extra?:    string;
}

/** Response from every Create endpoint — the newly allocated SEQ_NO.
 *  Backend serialises BigDecimal as JSON number; axios delivers a JS
 *  {@code number}. */
export interface ApiLoginCredentialCreateResponse {
    seq_no: number;
}

/** One row in the Add-Bank picker. Mirrors the legacy
 *  {@code nxisas_acctList_r002} payload — real {@code BANK_CD},
 *  display name, and icon path. The icon path is the legacy
 *  {@code /assets_v2/images/banking_VN/…} location from the live
 *  WeCMS asset folder. */
export interface ApiLoginCredentialBankPickerRow {
    bank_cd:  string;
    bank_nm:  string;
    bank_img: string | null;
}

export interface ApiLoginCredentialBankPickerResponse {
    items: ApiLoginCredentialBankPickerRow[];
}

/** One sub-type entry for a bank's Login ID/PW form. The legacy
 *  picker shows one record per SEQ_NO; multi-sub-type banks (Shinhan,
 *  BIDV, Vietcom) render radio buttons across the entries; single-
 *  sub-type banks just take the lone entry's labels. */
export interface ApiLoginCredentialBankFormInfoSubType {
    bank_cd:        string;
    seq_no:         number;
    /** Sub-type display name (e.g. "Corporate Banking",
     *  "Personal Banking", "VCB iB@nking"). Empty string when the
     *  bank has only one sub-type. */
    seq_nm:         string | null;
    /** Logo path with the {@code {LANG_CODE}} placeholder still in
     *  place; the frontend substitutes EN / KO / VI at render time
     *  based on the user's locale. */
    logo_url:       string | null;
    /** Localised label for the ID field, e.g. "Tên truy cập". */
    id_label:       string | null;
    /** Localised label for the Password field. */
    password_label: string | null;
    /** Localised label for the Confirm Password field. */
    confirm_label:  string | null;
    /** Localised label for the optional extra Corporate-ID input
     *  (Agribank, MB use this). Empty string → no extra input. */
    extra_label:    string | null;
}

export interface ApiLoginCredentialBankFormInfoResponse {
    bank_cd:   string;
    sub_types: ApiLoginCredentialBankFormInfoSubType[];
}

/* ============================================================================
 *  Settings > Preferences (slug "preferences")
 *
 *  Wire types for the Spring `PreferencesController` — two endpoints
 *  under `/api/v1/settings/preferences`, mirroring the BUSI_INFM half
 *  of legacy `comm_0215_001`. The two preference toggles (Use Purpose
 *  / Use VAS Account) ride on the generic env-settings endpoint pair
 *  with codes `00077` / `00074` — see ApiEnvironmentSetting above.
 *  ========================================================================== */

/** Company address — mirrors `BUSI_INFM.RPRS_BSUN_*` columns 1:1. The
 *  panel composes / decomposes these four parts when rendering the
 *  address field in read vs. edit mode. */
export interface ApiPreferencesAddress {
    post_address:   string;
    detail_address: string | null;
    city:           string;
    state:          string;
}

/** GET `/api/v1/settings/preferences` response. */
export interface ApiPreferencesResponse {
    vietnamese_name:      string;
    display_name:         string | null;
    tax_id:               string;
    representative_name:  string | null;
    representative_email: string;
    tel_no:               string | null;
    fax_no:               string | null;
    address:              ApiPreferencesAddress;
    /** Null until the logo-upload endpoint lands. */
    logo_url:             string | null;
    modified_by:          string | null;
    /** ISO-8601 with offset. */
    modified_at:          string | null;
}

/** PUT `/api/v1/settings/preferences` body. Required fields mirror the
 *  legacy `BusiInfm` validation: vietnamese_name, tax_id,
 *  representative_email, and every address part except detail_address. */
export interface ApiPreferencesUpdateRequest {
    vietnamese_name:      string;
    display_name?:        string | null;
    tax_id:               string;
    representative_name?: string | null;
    representative_email: string;
    tel_no?:              string | null;
    fax_no?:              string | null;
    address:              ApiPreferencesAddress;
}

/**
 * Settings > Bank Account row — mirrors the backend
 * `BankAccountRow` record (`wecms-api/.../domain/setting/bankaccount/dto/BankAccountRow.java`).
 * Lowercase snake_case via the global Jackson naming strategy.
 */
export interface ApiBankAccountRow {
    bank_cd:            string;
    bank_name:          string;
    acct_no:            string;
    currency:           string | null;
    nickname:           string | null;
    description:        string | null;
    account_type_cd:    string | null;
    /** ISO `yyyy-MM-dd` or null (current accounts). */
    maturity_date:      string | null;
    vas_acct_seq_no:    number | null;
    vas_acct_cd:        string | null;
    vas_acct_nm:        string | null;
    vas_account_bank:   string | null;
    prn_seq:            number | null;
    bal:                string | null;
    real_amt:           string | null;
    last_modified_by:   string | null;
    /** Legacy `yyyyMMddHHmmss`. */
    last_modified_at:   string | null;
    /** Composed server-side: first active grantee + " + N more" when
     *  count > 1; null when no grantee exists. */
    view_permission_label:       string | null;
    withdrawal_permission_label: string | null;
}

export interface ApiBankAccountListResponse {
    items: ApiBankAccountRow[];
}

/**
 * One row in the View / Withdrawal Permission roster. Mirrors backend
 * `BankAccountPermissionMember`.
 */
export interface ApiBankAccountPermissionMember {
    user_id:     string;
    user_nm:     string;
    /** `ADMIN` when {@code BUSI_ADMN_INFM} carries a row for this user;
     *  `USER` otherwise. */
    user_type:   "ADMIN" | "USER";
    /** Masked phone (e.g. `•••••1234`); null when no phone on file. */
    phone_no:    string | null;
    is_selected: boolean;
    is_locked:   boolean;
    /** `ADMIN` | `SELF` | null. */
    lock_reason: "ADMIN" | "SELF" | null;
}

export interface ApiBankAccountPermissionResponse {
    /** Echoed from the request — `VIEW` or `WITHDRAWAL`. */
    kind:           "VIEW" | "WITHDRAWAL";
    /** Server-composed `"<BANK_CD> / <ACCT_NO> (<CCY>)"`. */
    account_label:  string;
    members:        ApiBankAccountPermissionMember[];
    total_selected: number;
}

export interface ApiBankAccountPermissionUpdateRequest {
    kind:     "VIEW" | "WITHDRAWAL";
    user_ids: string[];
}

/* =================================================================
 *  Banking > Own Account Transfer (refactor slug: own-account-transfer).
 *
 *  Mirrors the four backend endpoints under
 *  /api/v1/banking/own-account-transfer/*. Wire shape is lowercase
 *  snake_case (global Jackson naming strategy) — no @JsonProperty
 *  overrides on the Java side.
 *
 *  Scope rule (PO 2026-05-18 OQ-A): VND only, same-`biz_key` only.
 *  Both source AND target accounts must be active VND rows in the
 *  caller's own ACCT_MSTR. External NAPAS recipients are NOT
 *  supported.
 * ================================================================= */

/** Row in GET /source-accounts. Mirrors backend
 *  `SourceAccountRow`. Amounts are NUMERIC on the wire; treat as
 *  numbers for arithmetic and string for formatting. */
export interface ApiOwnAccountSourceRow {
    bank_cd:                string;
    bank_nm:                string | null;
    acct_no:                string;
    acct_nick_nm:           string | null;
    acct_type_cd:           string;
    bal:                    number | null;
    real_amt:               number | null;
    ccy_cd:                 string;
    acct_bal_inq_stts:      string | null;
    acct_bal_inq_msg:       string | null;
    /** Last balance-changed dtm (yyyyMMddHHmmss UTC). */
    acct_bal_upd_dtm:       string | null;
    /** Last inquiry dtm (yyyyMMddHHmmss UTC, success or failure). */
    acct_bal_lst_inq_dtm:   string | null;
    /** Computed server-side: true when the user has WITHDRAW grant
     *  (or is ADMIN). Drives the per-row Transfer button visibility. */
    can_transfer:           boolean;

    /* --- Phase B cert fields ---
     * Saved-bank-cert material the local NXiSAS engine needs to log
     * into the bank IB site. Resolved server-side via
     * BankCertInfo (joined by ACCT_MSTR.BANK_CERT_SEQ →
     * BANK_CERT_INFO.SEQ_NO). Plaintext on the wire — exposure is
     * gated by tenant + W-grant + VND scope; see SourceAccountRow
     * Javadoc on the backend. Null when no cert row is configured.
     */
    bank_cert_seq?:         string | null;
    cert_info_con?:         string | null;
    cert_info_detl_con?:    string | null;
    cert_info_detl_con2?:   string | null;
    nxisas_gb_seq_no?:      string | null;
}

export interface ApiOwnAccountSourceListResponse {
    list:              ApiOwnAccountSourceRow[];
    total_count:       number;
    tot_bal:           number | null;
    tot_avi_bal:       number | null;
    /** Canonical per-tenant bank allow-list (5 banks for default,
     *  1 for HAENGSUNG). Frontend renders the bank popover from this
     *  list regardless of which rows came back. */
    allowed_bank_cds:  string[];
}

/* Composer/execution MR (2026-05-20) added back the wire types Path A
 * had deferred: target-accounts list + scraping-result intake. The
 * transfer-history list type stays deferred — its endpoint ships with
 * the transfer-history page MR. */

/** Row in GET /target-accounts. Per OQ-A scope every row is
 *  `kind=OWN_ACCOUNT`; the literal is preserved on the wire so a
 *  future scope expansion (FCY / external recipients) can add
 *  additional kinds without renaming. `napas_bank_cd` is populated
 *  when the row's `bank_cd` resolves through `NAPAS_BANK_INFO`
 *  (cross-bank own→own routing); null when not in the dictionary
 *  (still listable for `SAME_BANK` transfers). */
export interface ApiOwnAccountTargetRow {
    kind:           "OWN_ACCOUNT";
    bank_cd:        string;
    bank_nm:        string | null;
    acct_no:        string;
    acct_nick_nm:   string | null;
    acct_type_cd:   string | null;
    ccy_cd:         string | null;
    napas_bank_cd:  string | null;
}

export interface ApiOwnAccountTargetListResponse {
    list:        ApiOwnAccountTargetRow[];
    total_count: number;
}

/** POST /scraping-result request — the structured engine result the
 *  frontend posts after the local NXiSAS engine reports completion.
 *  Spring re-validates ownership + idempotency + amount-tolerance +
 *  bank tx id format before persisting. See backend doc §9 and
 *  `ScrapingResultIntakeRequest` for the field-by-field contract. */
export interface ApiOwnAccountTransferScrapingResultRequest {
    /** Client-generated UUID (32-64 alphanumeric). Reposting the same
     *  key returns the prior recorded row with `already_recorded=true`. */
    idempotency_key:      string;
    transfer_type:        "SAME_BANK" | "NAPAS";
    source_bank_cd:       string;
    source_acct_no:       string;
    /** Required for SAME_BANK; optional for NAPAS (server resolves
     *  from `target_napas_bank_cd` when null). */
    target_bank_cd?:      string | null;
    /** Required for NAPAS; null for SAME_BANK. */
    target_napas_bank_cd?: string | null;
    target_acct_no:       string;
    /** Optional legacy `OWAC_NM`; empty for OAT own→own. */
    target_owac_nm?:      string | null;
    /** Always `"VND"` under the current scope (OQ-A). */
    ccy_cd:               "VND";
    /** What the user composed in Step 1. VND integer string. */
    requested_amt:        string;
    /** Engine-reported transferred amount. Must equal `requested_amt`
     *  for VND (server enforces). */
    actual_amt:           string;
    /** Bank-supplied transaction id from the engine (legacy
     *  `TRNS_STLM_ID`). Empty when the engine failed pre-OTP and
     *  returned without a tx id. */
    bank_tx_id?:          string | null;
    /** `"00000000"` = engine success; vendor error code otherwise. */
    trns_stts:            string;
    trns_msg?:            string | null;
    fee?:                 number | null;
    /** A=applicant (sender pays), B=beneficiary (recipient pays),
     *  S=split. Maps from the Step-1 radio (Sender pays / Recipient pays). */
    fee_dfr_sbj?:         "A" | "B" | "S" | null;
    rmrk?:                string | null;
    rmrk2?:               string | null;
    /** Audit-only metadata. Stored verbatim in `AUDIT_LOGS_INFM`;
     *  never used as a security signal (OQ-B). */
    engine_vendor?:       string | null;
    engine_version?:      string | null;
}

export interface ApiOwnAccountTransferScrapingResultResponse {
    seq_no:           string | null;
    idempotency_key:  string;
    bank_tx_id:       string | null;
    recorded_amt:     number | null;
    trns_stts:        string;
    status:           "success" | "failed";
    /** True when a prior intake POST with the same `idempotency_key`
     *  already recorded the row — the response carries the original
     *  outcome and no new DB write happened. */
    already_recorded: boolean;
}

/** POST /balance-refresh request — the post-scrape balance outcome the
 *  frontend posts after the local NXiSAS engine reports a BALANCE-job
 *  result. Spring patches `ACCT_MSTR` and returns the canonical row;
 *  audit-row writes happen server-side (OQ-4 audit-everywhere policy). */
export interface ApiBalanceRefreshRequest {
    bank_cd:             string;
    acct_no:             string;
    /** Engine-reported new balance. Optional — omit when the engine
     *  returned an error (`acct_bal_inq_stts != "00000000"`). */
    bal?:                number | null;
    /** Engine-reported available amount; optional. */
    real_amt?:           number | null;
    /** `"00000000"` = engine success; vendor error code otherwise. */
    acct_bal_inq_stts:   string;
    /** Engine error / status message; verbatim from the bundle. */
    acct_bal_inq_msg?:   string | null;
    /** Always `"VND"` under the current scope (OQ-A). Server rejects
     *  anything else with `WBE_OWN_ACCOUNT_TRANSFER_INVALID_CCY`. */
    ccy_cd?:             "VND" | null;
}

export interface ApiBalanceRefreshResponse {
    bank_cd:               string;
    acct_no:               string;
    /** Post-patch balance on success; pre-existing balance on failure
     *  (legacy `_u001_act.jsp:136-140` parity). */
    bal:                   number | null;
    ccy_cd:                string;
    /** UTC `yyyyMMddHHmmss` the server stamped on the row. */
    acct_bal_lst_inq_dtm:  string;
}

/** POST /engine-connection-check request — fire-and-forget audit sink
 *  the page mount posts after the bundle's `_v2nxisas.openNxisas(...)`
 *  resolves. The server writes one `AUDIT_LOGS_INFM` row and returns
 *  `204 No Content`. The row IS the only artifact. */
export interface ApiEngineConnectionCheckRequest {
    /** Probe outcome. Must match the server-side `@Pattern` regex. */
    result:           "OK" | "FAIL" | "TIMEOUT" | "NOT_INSTALLED";
    engine_vendor:    string;
    engine_version:   string;
    user_agent?:      string | null;
    os_platform?:     string | null;
    /** Engine-supplied session id when available — verbatim. */
    scrape_session_id?: string | null;
    error_code?:      string | null;
    error_message?:   string | null;
}

/** Row returned by GET /napas-bank-info/{napas_bank_cd}. The refactor
 *  entity carries only `napas_bank_cd` + `bank_cd` (per backend plan §3.5);
 *  `short_name` / `long_name_en` / `long_name_vn` ride as null until the
 *  composer MR widens the entity projection. */
export interface ApiNapasBankInfoRow {
    napas_bank_cd:  string;
    short_name:     string | null;
    long_name_en:   string | null;
    long_name_vn:   string | null;
    bank_cd:        string;
}

/* ----------------------------------------------------------------------------
 *  Payment > Card Transactions
 *
 *  Wire shapes for the Phase 2 backend at
 *  `wecms-api-main/.../domain/payment/cardtransactions/`. Lowercase
 *  snake_case throughout per the CTO directive (2026-05-08); the
 *  in-memory page types in `components/payment/corporate-card/` are
 *  the camelCase translation, produced by `cardTransactionMappers.ts`.
 * --------------------------------------------------------------------------*/

/** One ledger row, mirrors `CardTransactionRow` on the Spring side. */
export interface ApiCardTransactionRow {
    card_seq_no:           string;
    bank_cd:               string;
    bank_nm:               string;
    card_no:               string;
    card_nm:               string | null;
    card_nick_nm:          string | null;
    card_hldr_nm:          string | null;
    merch_nm:              string | null;
    ccy_cd:                string;
    /** BigDecimal serialised as string to preserve precision. */
    trsc_amt:              string | null;
    /** yyyyMMdd. */
    trsc_dt:               string;
    /** HHmmss. May be null on legacy seed rows. */
    trsc_tm:               string | null;
    card_trns_usage_code:  string | null;
    chart_acct_seq_no:     string | null;
    chart_acct_cd:         string | null;
    cont:                  string | null;
    appr_seq_no:           string | null;
    /** `EXPT_RESOL_MSTR.DOC_NO` (e.g. `"VO_260521_001"`) — the
     *  Approval Ref. column renders this instead of the raw numeric
     *  `appr_seq_no`. Null when the row hasn't been requested for
     *  approval or the matching master row was deleted. */
    appr_doc_no:           string | null;
    /** Raw single-character status code. */
    stts:                  string | null;
    /** i18n key the frontend resolves via `t(...)` — falls back to
     *  `stts` when the key has no locale entry. */
    stts_key:              string | null;
    /** Phase B placeholders — empty arrays today. */
    linked_docs:           ApiCardLinkedDocRef[];
    approvers:             ApiCardApproverRef[];
    reg_id:                string;
    reg_dtm:               string;
    mod_id:                string;
    mod_dtm:               string;
}

/** Phase B placeholder — empty in Sprint 0. */
export interface ApiCardLinkedDocRef {
    doc_id:       string;
    disp_doc_id:  string;
    hand_doc_id:  string | null;
    doc_type:     string;
    einv_yn:      string;
    totl_amt:     string | null;
}

/** Phase B placeholder — empty in Sprint 0. */
export interface ApiCardApproverRef {
    apprvr_id:   string;
    apprvr_nm:   string;
    apprvr_stts: string;
}

export interface ApiCardTransactionTotals {
    total_count:           number;
    totl_amt:              string;
    totl_appr_req_cnt:     number;
    totl_appr_req_amt:     string;
    totl_appr_not_req_cnt: number;
    totl_appr_not_req_amt: string;
}

export interface ApiCardTransactionListResponse {
    page:        number;
    page_size:   number;
    total_count: number;
    totals:      ApiCardTransactionTotals;
    rows:        ApiCardTransactionRow[];
}

export interface ApiActiveCard {
    bank_cd:      string;
    bank_nm:      string;
    card_no:      string;
    card_nm:      string | null;
    card_nick_nm: string | null;
    card_hldr_nm: string | null;
}

export interface ApiCardListResponse {
    cards: ApiActiveCard[];
}

/** Discriminated PATCH body — mirrors the backend's
 *  `CardTransactionPatchRequest` sealed interface. */
export type ApiCardTransactionPatchRequest =
    | { field: "description"; value: string | null }
    | { field: "purpose";     value: string | null };

export interface ApiUpdateCardReportingAccountRequest {
    chart_acct_seq_no: string;
    chart_acct_cd:     string;
}

/* ----------------------------------------------------------------------------
 *  Card Management Setting modal (legacy card_0001_003 family).
 * --------------------------------------------------------------------------*/

/** One row in the modal grid. Mirrors Phase 2's
 *  {@code CardManagementRow} on the Spring side. */
export interface ApiCardManagementRow {
    bank_cd:      string;
    bank_nm:      string;
    card_no:      string;
    card_nm:      string | null;
    card_nick_nm: string | null;
    card_hldr_nm: string;
    /** "Y" active / "N" inactive. */
    actv_yn:      string;
    mod_id:       string;
    /** Legacy yyyyMMddHHmmss. Frontend renders "X ago" / locale date. */
    mod_dtm:      string;
}

export interface ApiCardManagementListResponse {
    total_count: number;
    rows:        ApiCardManagementRow[];
}

/** Toggle body for the row's switch — `Y` or `N`. */
export interface ApiUpdateCardActiveRequest {
    actv_yn: "Y" | "N";
}

/** Inline-rename body — both fields always sent together (the
 *  frontend echoes the un-edited value from the row). */
export interface ApiUpdateCardInfoRequest {
    card_hldr_nm: string;
    card_nick_nm: string | null;
}

/* ----------------------------------------------------------------
 *  Card Management > Add Card flow (legacy comm_0218_nxisas chain)
 * ---------------------------------------------------------------- */

/** One scraped card row returned by the CARD_INFO Coocon job. Field
 *  shape mirrors the backend {@code ScrapedCard} record + maps 1:1
 *  to {@code ApiScrapedCardItem} for the save endpoint — no client-
 *  side reshaping between scrape result and save request. */
export interface ApiScrapedCard {
    card_no:          string | null;
    card_type_cd:     string | null;
    card_nm:          string | null;
    card_hldr_nm:     string | null;
    issu_dt:          string | null;
    expi_dt:          string | null;
    nxisas_acct_type: string | null;
    pymn_acct_no:     string | null;
}

/** Wire body for {@code POST /api/v1/payment/card-transactions/cards}. */
export interface ApiCreateCardsRequest {
    bank_cd:         string;
    bank_cert_seq?:  number | null;
    cards:           ApiCreateCardsRequest.ScrapedCardItem[];
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ApiCreateCardsRequest {
    export interface ScrapedCardItem {
        card_no:           string;
        card_type_cd:      string;
        issu_dt?:          string | null;
        expi_dt?:          string | null;
        card_nm?:          string | null;
        card_nick_nm?:     string | null;
        card_hldr_nm:      string;
        nxisas_acct_type?: string | null;
        pymn_acct_no?:     string | null;
    }
}

export interface ApiCreateCardsResponse {
    inserted_count: number;
    skipped_count:  number;
}

/** Wire body for {@code POST /api/v1/payment/card-transactions/sync}. */
export interface ApiSyncCardTransactionsRequest {
    from_date: string;   // yyyyMMdd
    to_date:   string;   // yyyyMMdd
    /** When true, the server ignores `from_date` and derives the range
     *  from each card's prior `TRN_LST_SUC_DTM`; `to_date` becomes
     *  today. Wire field stays the same shape — frontend still ships
     *  meaningful dates so a stale auto flag never reaches the
     *  backend with a malformed payload. */
    auto?:   boolean;
}

/** One per-card failure in {@link ApiSyncCardTransactionsResponse.errors}. */
export interface ApiCardSyncError {
    bank_cd: string;
    bank_nm: string | null;
    card_no: string;
    code:    string;
    message: string | null;
}

/** One per-card outcome inside a {@link ApiSyncGroup}. */
export interface ApiSyncGroupCard {
    card_no:        string;
    scraped_count:  number;
    inserted:       number;
    skipped:        number;
    error_code:     string | null;
    error_message:  string | null;
}

/**
 * Per-credential group in the sync response. Mirrors legacy
 * `_nxisas_dataArray` entry shape so the frontend can render the
 * `---- orgObj ----` / `---- tranList Result(Unit) ----` console
 * blocks identically.
 */
export interface ApiSyncGroup {
    bank_cd:             string;
    bank_nm:             string | null;
    bank_cert_seq:       string | null;
    login_ok:            boolean;
    login_error_code:    string | null;
    login_error_message: string | null;
    cards:               ApiSyncGroupCard[];
}

export interface ApiSyncCardTransactionsResponse {
    cards_attempted: number;
    cards_succeeded: number;
    inserted_count:  number;
    skipped_count:   number;
    errors:          ApiCardSyncError[];
    groups:          ApiSyncGroup[];
}

/** One row of the {@link ApiCardTranListPeriodLimitRequest} REC_IN. */
export interface ApiCardTranListPeriodLimitInput {
    bank_cd:       string;
    bank_cert_seq: number | string;
}

/**
 * Card Transactions &gt; Update — per-bank period-limit request.
 * Mirrors legacy {@code nxisas_cardTranList_r001} input shape
 * ({@code REC_IN = [{BANK_CD, BANK_CERT_SEQ}, ...]}).
 */
export interface ApiCardTranListPeriodLimitRequest {
    rec_in: ApiCardTranListPeriodLimitInput[];
}

/** One row of {@link ApiCardTranListPeriodLimitResponse} REC_OUT. */
export interface ApiCardTranListPeriodLimitRow {
    bank_cd:       string;
    bank_cert_seq: number | string;
    /** Period count — legacy {@code CONT1} ({@code "3"}, {@code "90"}). */
    cont1:         string;
    /** Period unit — legacy {@code CONT2} ({@code "days"} / {@code "months"} / {@code "years"}). */
    cont2:         string;
}

/**
 * Card Transactions &gt; Update — per-bank period-limit response.
 * Mirrors legacy {@code REC_OUT} shape so the TS module can pick the
 * longest period across all input rows without re-parsing.
 */
export interface ApiCardTranListPeriodLimitResponse {
    rec_out: ApiCardTranListPeriodLimitRow[];
}

/**
 * Payment > Card Transactions — Request Approval batch request.
 * Mirrors legacy `card_0001_001.ts:661-676` (`.RequestApproval`
 * click handler). Renamed from `ApiRequestApprovalRequest` to avoid
 * a name collision with the shared payment approval-request type
 * (see `payment/shared/RequestApprovalDialog.tsx`).
 */
export interface ApiCardRequestApprovalRequest {
    card_seq_nos: string[];
    appr_line_no: number;
    /** Big title the user typed at the top of the Request Approval
     *  popup. Surfaces verbatim on the Approval Box list + Approval
     *  Details popup ({@code EXPT_RESOL_MSTR.TITL}). Mirrors the
     *  {@code post_title} field shipped by every other Payment kind. */
    post_title?: string;
    /** Optional free-form approval content — the textarea in the
     *  Request Approval dialog's "Approval Content" section.
     *  Surfaces on the Approval Details popup. */
    post_cont?: string;
    /** Scheduled date picker on the Request Approval popup,
     *  {@code yyyyMMdd}. Optional. Surfaces on the Approval Box list
     *  + Approval Details popup. Mirrors {@code pay_date} on every
     *  other Payment kind. */
    pay_date?: string;
}

export interface ApiCardRequestApprovalResponse {
    updated:     number;
    skipped:     number;
    appr_seq_no: string;
}

/** One e-Invoice row eligible to be linked to a card transaction.
 *  Powers the Expenses e-Invoice tab on the Link Card Payments popup
 *  (legacy `card_0001_002_r001`). */
export interface ApiLinkableEInvoiceRow {
    doc_id:              string;
    issu_dt:             string;
    disp_doc_id:         string | null;
    einv_invoicestatus:  string | null;
    merch_nm:            string | null;
    merch_tax_id:        string | null;
    totl_amt:            string;
    ccy_cd:              string | null;
}

export interface ApiLinkableEInvoiceListResponse {
    total_count: number;
    rows:        ApiLinkableEInvoiceRow[];
}

/** One receipt row eligible to be linked to a card transaction.
 *  Powers the Receipt tab on the Link Card Payments popup (legacy
 *  `card_0001_002_r002`). */
export interface ApiLinkableReceiptRow {
    doc_id:       string;
    use_dt:       string;
    merch_nm:     string | null;
    totl_amt:     string;
    ccy_cd:       string | null;
    /** Raw {@code BUSA_USAG_CD} code — Phase B JOIN for the resolved name. */
    purpose:      string | null;
    description:  string | null;
}

export interface ApiLinkableReceiptListResponse {
    total_count: number;
    rows:        ApiLinkableReceiptRow[];
}

/** Wire payload for {@code POST /api/v1/payment/card-transactions/links}.
 *  Server enforces {@code SUM(items[*].dedu_amt) == card.trsc_amt}
 *  exactly — mismatch returns {@code WBE_LINK_AMOUNT_MISMATCH}. */
export interface ApiLinkExpensesRequest {
    card_seq_no: string;
    items: Array<{
        doc_id:   string;
        dedu_amt: string;
    }>;
}

export interface ApiLinkExpensesResponse {
    linked_count: number;
}

/** Wire payload for {@code POST /api/v1/payment/card-transactions/receipts}.
 *  Mirrors legacy {@code prch_0011_001}'s create flow. */
export interface ApiCreateReceiptRequest {
    use_dt:        string;
    /** {@code TRCO_INFM.TRCO_KEY} picked from the Contacts dropdown.
     *  Null in Manual mode — the backend fills the legacy
     *  "99999999999999999999" sentinel. */
    trco_key?:     string;
    contact_name:  string;
    tax_id?:       string;
    amount:        string;
    ccy_cd?:       string;
    /** {@code USAG_INFM.USE_USAG_CD} picked from the Purpose dropdown. */
    purpose_cd?:   string;
    description?:  string;
}

export interface ApiCreateReceiptResponse {
    doc_id: string;
}

/** One Purpose option in the New Receipt dropdown — backed by
 *  {@code USAG_INFM} filtered to {@code USAG_GRP_CD='6'}. The wire
 *  ships an already-localized {@code usag_nm}. */
export interface ApiPurposeOption {
    use_usag_cd: string;
    usag_nm:     string;
}

/** Memo color tag — legacy {@code wabooks.enums.ColorCd}. The
 *  side-panel category picker exposes a subset (white / green /
 *  blue / yellow / red / purple); the wire accepts the full set
 *  for forward compat with the legacy palette. */
export type MemoColor =
    | "white" | "blue" | "green" | "yellow"
    | "orange" | "red" | "gray" | "purple";

/** One memo row on the side-panel list. */
export interface ApiMemoRow {
    seq_no:   string;
    memo:     string;
    color:    MemoColor;
    reg_id:   string;
    reg_nm:   string;
    /** {@code yyyyMMddHHmmss}. Frontend resolves the timezone +
     *  renders the relative label. */
    reg_dtm:  string;
    can_edit: boolean;
}

export interface ApiMemoListResponse {
    total_count: number;
    rows:        ApiMemoRow[];
}

export interface ApiCreateMemoRequest {
    /** {@code CARD_TRNS_HSTR.CARD_SEQ_NO} the memo attaches to. */
    ref_no: string;
    memo:   string;
    color?: MemoColor;
}

/** Read-only detail of one linked receipt / bill — backs the View
 *  Detail action on the Card Transactions list's linked-doc cell. */
export interface ApiReceiptDetailResponse {
    doc_id:        string;
    disp_doc_id:   string;
    /** `'B'` Bill (e-Invoice) · `'E'` Expense (manual receipt). */
    doc_type:      string;
    /** {@code YYYYMMDD}. Use date for receipts, issue date for bills. */
    date:          string;
    contact_name:  string | null;
    tax_id:        string | null;
    amount:        string;
    ccy_cd:        string | null;
    purpose_cd:    string | null;
    /** Localized name from {@code USAG_INFM_LANG_DETL}; null when
     *  the doc has no purpose. */
    purpose_nm:    string | null;
    description:   string | null;
}

/**
 * Notification module wire types — match
 * `wecms-api/.../domain/notification/dto/*` (Phase 1). Property names are
 * lowercase snake_case per the global contract; the `read` flag is derived
 * server-side from `read_at != null`.
 */
export interface ApiNotificationRow {
    notification_id: number;
    /** Producer discriminator — "APPROVAL_REQUEST" in v1. */
    noti_type:       string;
    /** Referenced source id (APPR_SEQ_NO for approval requests); nullable. */
    source_id:       string | null;
    /** i18n key the frontend resolves to the visible message. */
    message_code:    string;
    /** Interpolation params — keys are verbatim snake_case (jsonb). */
    message_params:  Record<string, string> | null;
    /** Refactor slug route (+ params) the bell navigates to on click. */
    link_target:     string | null;
    read:            boolean;
    /** Read timestamp `yyyyMMddHHmmss` (UTC); null when unread. */
    read_at:         string | null;
    /** Creation timestamp `yyyyMMddHHmmss` (UTC) — list sort key. */
    reg_dtm:         string;
}

export interface ApiNotificationListResponse {
    list:        ApiNotificationRow[];
    total_count: number;
    unread_count: number;
    /** Zero-based page index (Spring Data convention). */
    page_number: number;
    page_size:   number;
    total_pages: number;
}

export interface ApiUnreadCountResponse {
    total_count: number;
}
