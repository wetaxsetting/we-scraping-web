/**
 * e-Invoice local-engine scrape helpers — refactor port of the legacy
 * `nxisas_einvoice.js` `scrapingProcess` driver (the "Real-Time Online
 * Inquire" button on the Update e-Invoice popup).
 *
 * <p>These are pure functions: build the `orgObj` the engine's
 * `_v2nxisas.callNxisas` consumes, and parse the engine's raw callback
 * payload into the structured rows the backend intake expects.
 *
 * <p><b>Legacy parity (2026-06-03 rewrite).</b> The earlier refactor ran
 * a simplified single-phase, single-job scrape. This restores the full
 * legacy behaviour:
 * <ul>
 *   <li><b>Phase 1 — INVOICE_LIST.</b> Sales issues ONE job
 *       (`invoiceType:'1'`); Expenses issues THREE jobs in the legacy
 *       order — C (`testResult:''`), K (`testResult:'1'`), POS
 *       (`testResult:'2', resultType:'2'`). Mirrors
 *       `nxisas_einvoice.js:308-376`.</li>
 *   <li><b>Phase 2 — INVOICE_DETAIL.</b> One job per listed invoice,
 *       carrying the symbol identity + (expense) testResult/resultType/
 *       sellerName, run with `nonLogin:true` to reuse the phase-1
 *       session. Mirrors `nxisas_einvoice.js:582-599, 822-849`
 *       (`runDetailScrapping3/4`).</li>
 * </ul>
 *
 * <p><b>GDT engine config (unchanged):</b> `bankCd = 'VIETNAM_GDT'`,
 * Module `GLOBAL/VNM/PUBLIC_GDT`, Class `COMMON` (resolved by the
 * jexjs-adapter), `use2ndCertRuleForGDT:true`, `threadCount:5`, over
 * `nxisas_v2.js` — never `nxisas_api*`.
 *
 * <p><b>Decrypt boundary (OQ-S2, resolved 2026-07-14 — now full legacy
 * parity):</b> legacy sets `nonDecrypt:true` and the JEX backend decrypts
 * the engine `Result` with Coocon `ISASSeedCBC` server-side. The refactor
 * now does the same: the builders below set `nonDecrypt:true`, and the
 * scrape driver posts each raw engine callback to
 * `POST /api/v1/addon/einvoices/decrypt` (`decryptEInvoiceEngineData`),
 * which decrypts every `Output.Result` via the shared backend
 * `SeedCbcDecryptService` (the same `isas1.0.jar` legacy uses) before the
 * `extract*` parsers run. The earlier `nonDecrypt:false` + client-side
 * pass-through left every payload encrypted → the parse silently yielded
 * zero rows ("scrape success, no data"). Documented in
 * `wecms-api/docs/audits/sales-expense-einvoices-scraping-parity.md`.
 */
import type { NxisasScrapingInput } from "@/components/banking/own-account-transfer/hooks/use-nxisas-engine";
import type {
    ApiScrapedEInvoiceRow,
    ApiScrapedEInvoiceDetailRow,
    ApiScrapedEInvoiceDetailProduct,
    ApiScrapedEInvoiceDetailFee,
    ApiScrapedEInvoiceDetailTax,
} from "@/lib/types/api";

/** GDT credential the engine logs in with (legacy `getCertInfo()`). */
export type EInvoiceScrapeCert = {
    /** `GDT_CERT_INFO.SEQ_NO`. */
    seqNo: number;
    /** GDT portal login id (`CERT_INFO_CON`). */
    loginId: string;
    /** GDT portal password — revealed via `revealLoginCredential`. */
    password: string;
};

/** Engine outcome extracted from the phase-1 callback payload. */
export type EInvoiceScrapeOutcome = {
    /** Engine `ErrorCode`, normalised — `"00000000"` on success OR when the
     *  only non-success code was the GDT no-data marker `42110000`
     *  (legacy treats them identically — see {@link NO_DATA_CODES}). A
     *  genuine error code is preserved verbatim. */
    rsltCd: string;
    /** Engine `ErrorMessage` (of the genuine error, if any). */
    rsltMsg: string;
    /** True when the only job(s) returned were auth jobs (LOGIN / CAPTCHA
     *  / OTP / QNA) — legacy login-failure branch
     *  (`nxisas_einvoice.js:406`). */
    loginFailed: boolean;
    /** True when the inquiry completed cleanly with ZERO invoices (no
     *  genuine error) — the normal "no transactions this period" result,
     *  incl. GDT `42110000`. The modal renders this as a completed inquiry
     *  with 0 rows, NOT a partial-failure warning (D2). */
    noData: boolean;
    /** Every genuine engine error across the phase-1 job records, formatted
     *  `"message (code)"` — the legacy `_failList` entries the modal shows
     *  in the "Partially Failed" / "Fail" hover tooltip
     *  (`nxisas_einvoice.js:416,602`). Empty when no genuine error occurred
     *  (`42110000` / `00000000` are not errors). */
    errors: string[];
    invoices: ApiScrapedEInvoiceRow[];
};

export type EInvoiceDetailOutcome = {
    rsltCd: string;
    rsltMsg: string;
    /** Every genuine per-invoice detail error, formatted
     *  `"[numericSymbol+invoiceSymbol-invoiceNo] message (code)"` — the
     *  legacy `_failList` detail entries (`nxisas_einvoice.js:1498,1555`).
     *  Empty when every detail job succeeded. */
    errors: string[];
    details: ApiScrapedEInvoiceDetailRow[];
};

/** GDT bank code the engine keys the session on. Exported so the scrape
 *  driver can issue the explicit LOGOUT (D1) against the same bank code. */
export const GDT_BANK_CD = "VIETNAM_GDT";

/** Engine job names this flow drives (all GDT / `GLOBAL/VNM/PUBLIC_GDT`). */
const JOB_INVOICE_LIST = "INVOICE_LIST";
const JOB_INVOICE_DETAIL = "INVOICE_DETAIL";
/** GDT business-registration lookup (D3/#40477). Legacy's spelling has the
 *  double-S ("BUSSINESS") — keep it verbatim; the engine matches literally. */
const JOB_BUSINESS_REGISTRATION_DETAIL = "BUSSINESS_REGISTRATION_DETAIL";
const AUTH_JOBS = new Set(["LOGIN", "CAPTCHA", "OTP", "QNA"]);

/**
 * GDT engine ErrorCodes that mean "no records for this period", NOT a
 * failure. Legacy `nxisas_einvoice_c001_act.jsp:112` accepts `00000000`
 * AND `42110000` identically (the latter's message is "Transaction
 * results do not exist"). Treated here as a clean empty result so a
 * legitimate no-data inquiry never surfaces as a partial-failure warning
 * and never poisons an Expense multi-bucket aggregate where another
 * bucket returned data (D2).
 */
const NO_DATA_CODES = new Set(["42110000"]);

/** Expense symbol buckets in legacy order: C, K, POS. The index is the
 *  `einv_testResults` stamp; POS additionally carries `resultType:'2'`. */
const EXPENSE_BUCKETS: ReadonlyArray<{ testResult: string; resultType?: string }> = [
    { testResult: "" },              // C — coded e-invoice
    { testResult: "1" },             // K — no-code e-invoice
    { testResult: "2", resultType: "2" }, // POS
];

/* ================================================================== */
/* Phase 1 — INVOICE_LIST input                                        */
/* ================================================================== */

/**
 * Build the single `orgObj` array `_v2nxisas.callNxisas` consumes for the
 * INVOICE_LIST phase. Sales → 1 job; Expenses → 3 jobs (C / K / POS).
 * Mirrors legacy `nxisas_einvoice.js:294-380`.
 *
 * @param type   SALES → engine `invoiceType '1'`, EXPENSE → `'2'`.
 * @param fromDt YYYYMMDD
 * @param toDt   YYYYMMDD
 */
export function buildInvoiceListInputs(
    cert: EInvoiceScrapeCert,
    type: "SALES" | "EXPENSE",
    fromDt: string,
    toDt: string,
): NxisasScrapingInput[] {
    const invoiceType = type === "SALES" ? "1" : "2";
    const job =
        type === "SALES"
            ? [
                  {
                      Job: JOB_INVOICE_LIST,
                      Input: { invoiceType, startDate: fromDt, endDate: toDt },
                  },
              ]
            : EXPENSE_BUCKETS.map((b) => ({
                  Job: JOB_INVOICE_LIST,
                  Input: {
                      invoiceType,
                      startDate: fromDt,
                      endDate: toDt,
                      testResult: b.testResult,
                      ...(b.resultType ? { resultType: b.resultType } : {}),
                  },
              }));

    return [
        {
            bankCd: GDT_BANK_CD,
            bankCertSeq: cert.seqNo,
            loginID: cert.loginId,
            loginPWD: cert.password,
            nonLogout: true,
            // Legacy parity: nonDecrypt:true leaves each Output.Result as
            // Coocon SEED-CBC ciphertext; the refactor decrypts it
            // server-side via decryptEInvoiceEngineData → the backend
            // SeedCbcDecryptService (OQ-S2, resolved 2026-07-14). The
            // vendor's own client-side nxisas_decrypt is a pass-through in
            // the refactor, so it must be skipped here.
            nonDecrypt: true,
            use2ndCertRuleForGDT: true,
            threadCount: 5,
            job,
        },
    ];
}

/* ================================================================== */
/* Phase 2 — INVOICE_DETAIL input                                      */
/* ================================================================== */

/**
 * Build the INVOICE_DETAIL `orgObj` from the phase-1 rows. One job per
 * invoice, run with `nonLogin:true` to reuse the phase-1 GDT session
 * (legacy keeps the session via phase-1 `nonLogout:true`). Mirrors
 * `nxisas_einvoice.js:582-599` (Sales) / `:822-849` (Expenses).
 *
 * <p>Returns an empty array when there are no rows — the caller skips
 * the detail engine call entirely (legacy guards on
 * `_selCount + _purCount > 0`).
 */
export function buildInvoiceDetailInputs(
    type: "SALES" | "EXPENSE",
    rows: ApiScrapedEInvoiceRow[],
    fromDt: string,
    toDt: string,
): NxisasScrapingInput[] {
    if (rows.length === 0) return [];
    const invoiceType = type === "SALES" ? "1" : "2";
    const job = rows.map((r) => {
        const Input: Record<string, unknown> = {
            invoiceType,
            // legacy numericSymbol = DOC_ID.substring(0,1); we carry the
            // scraped numericSymbol directly (same value).
            numericSymbol: r.numeric_symbol,
            invoiceSymbol: r.invoice_symbol,
            invoiceNo: r.invoice_no,
            startDate: fromDt,
            endDate: toDt,
            sellerTaxCode: r.seller_tax_code,
        };
        if (type === "EXPENSE") {
            // legacy passes the bucket testResult + sellerName on expense
            // detail jobs (nxisas_einvoice.js:838-841).
            Input.testResult = r.einv_test_results;
            Input.sellerName = r.trco_cmnm;
            if (r.einv_test_results === "2") Input.resultType = "2"; // POS (#38052)
        }
        return { Job: JOB_INVOICE_DETAIL, Input };
    });

    return [
        {
            bankCd: GDT_BANK_CD,
            nonLogin: true,
            nonLogout: true,
            // Legacy parity — decrypt server-side (see buildInvoiceListInputs).
            nonDecrypt: true,
            threadCount: 5,
            job,
        },
    ];
}

/* ================================================================== */
/* Phase 2b — BUSSINESS_REGISTRATION_DETAIL (Expense seller enrichment) */
/* ================================================================== */

/** One registration record: company / representative / person-in-charge. */
export type RegistrationDetail = {
    companyName: string;
    chairman: string;
    accountant: string;
};

/**
 * The unique seller tax codes of detail rows whose {@code seller_name} is
 * blank — the legacy trigger for the BUSSINESS_REGISTRATION_DETAIL lookup
 * ({@code nxisas_einvoice.js:1633-1643}). Empty ⇒ no lookup needed.
 */
export function blankSellerTaxCodes(rows: ApiScrapedEInvoiceDetailRow[]): string[] {
    const set = new Set<string>();
    for (const r of rows) {
        if (str(r.seller_name).trim() === "" && str(r.seller_tax_code).trim() !== "") {
            set.add(r.seller_tax_code);
        }
    }
    return [...set];
}

/**
 * Build the Expense BUSSINESS_REGISTRATION_DETAIL org object (D3, legacy
 * {@code runDetailScrapping3}): one job per unique seller tax code, run with
 * {@code nonLogin:true} to reuse the phase-1 GDT session (legacy
 * {@code _v2nxisas.execute(jobs, 1, …)}). Returns [] when there is nothing to
 * look up so the caller skips the engine round-trip.
 */
export function buildRegistrationDetailInputs(taxCodes: string[]): NxisasScrapingInput[] {
    if (taxCodes.length === 0) return [];
    return [
        {
            bankCd: GDT_BANK_CD,
            nonLogin: true,
            nonLogout: true,
            // Legacy parity — decrypt server-side (see buildInvoiceListInputs).
            nonDecrypt: true,
            threadCount: 1,
            job: taxCodes.map((tc) => ({
                Job: JOB_BUSINESS_REGISTRATION_DETAIL,
                Input: { search: tc },
            })),
        },
    ];
}

/**
 * Parse the BUSSINESS_REGISTRATION_DETAIL callback into a
 * {@code taxCode → RegistrationDetail} map. Mirrors legacy
 * {@code registrationDetail[].{taxCode,companyName,chairman,accountant}}
 * ({@code nxisas_einvoice.js:1660-1668}).
 */
export function extractRegistrationDetails(raw: unknown): Map<string, RegistrationDetail> {
    const out = new Map<string, RegistrationDetail>();
    for (const rec of orderedJobRecords(raw)) {
        for (const r of parseResultArray(rec, "registrationDetail")) {
            const o = asRecord(r);
            if (!o) continue;
            const tc = str(o.taxCode).trim();
            if (!tc) continue;
            out.set(tc, {
                companyName: str(o.companyName),
                chairman: str(o.chairman),
                accountant: str(o.accountant),
            });
        }
    }
    return out;
}

/**
 * Merge registration lookups into the detail rows in place: for each row
 * whose {@code seller_name} is blank, fill {@code trco_name} (companyName),
 * {@code seller_rppr_enm} (chairman) and {@code seller_pic_name} (accountant)
 * from the matched tax code — legacy {@code nxisas_einvoice.js:1654-1671}.
 * Rows with a non-blank seller name (or no match) are left untouched, so a
 * good scraped name is never overwritten.
 */
export function applyRegistrationEnrichment(
    rows: ApiScrapedEInvoiceDetailRow[],
    byTaxCode: Map<string, RegistrationDetail>,
): void {
    for (const r of rows) {
        if (str(r.seller_name).trim() !== "") continue;
        const reg = byTaxCode.get(str(r.seller_tax_code).trim());
        if (!reg) continue;
        r.trco_name = reg.companyName;
        r.seller_rppr_enm = reg.chairman;
        r.seller_pic_name = reg.accountant;
    }
}

/* ================================================================== */
/* Result parsing — defensive walk of the opaque vendor payload         */
/* ================================================================== */

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
}

function str(v: unknown): string {
    if (v === null || v === undefined) return "";
    return typeof v === "string" ? v : String(v);
}

/**
 * Return the ordered per-job result records of the first org-object the
 * engine returned. Legacy reads `results[0].result[]` — one entry per
 * job, in submission order (so the C/K/POS bucket index is positional).
 * Falls back to a defensive deep walk if the vendor nests differently.
 */
function orderedJobRecords(raw: unknown): Record<string, unknown>[] {
    let node: unknown = raw;
    if (Array.isArray(node)) node = node[0];
    const obj = asRecord(node);
    if (obj && Array.isArray(obj.result)) {
        const recs = obj.result.map(asRecord).filter(Boolean) as Record<string, unknown>[];
        if (recs.length > 0) return recs;
    }
    // Fallback: deep-collect anything that looks like a job record.
    const out: Record<string, unknown>[] = [];
    const visit = (n: unknown, depth: number): void => {
        if (depth > 6 || n === null || n === undefined) return;
        if (Array.isArray(n)) {
            for (const el of n) visit(el, depth + 1);
            return;
        }
        const o = asRecord(n);
        if (!o) return;
        if ("Job" in o || "Output" in o) out.push(o);
        if (Array.isArray(o.result)) visit(o.result, depth + 1);
        if (Array.isArray(o.job)) visit(o.job, depth + 1);
    };
    visit(raw, 0);
    return out;
}

function jobNameOf(record: Record<string, unknown>): string {
    const output = asRecord(record.Output);
    return str(record.Job ?? output?.Job);
}

function errorCodeOf(record: Record<string, unknown>): { code: string; msg: string } {
    const output = asRecord(record.Output);
    return {
        code: str(output?.ErrorCode ?? record.ErrorCode),
        msg: str(output?.ErrorMessage ?? record.ErrorMessage),
    };
}

/**
 * Pick the first GENUINE engine error across the job records, treating
 * `00000000` (success) and every {@link NO_DATA_CODES} entry (e.g. GDT
 * `42110000` "no records") as non-errors. Returns `{ "00000000", "" }`
 * when no genuine error is present — so a real error in ANY (Expense)
 * bucket still wins even when another bucket returned data or a no-data
 * code, and a no-data-only inquiry normalises to success (D2, legacy
 * `nxisas_einvoice_c001_act.jsp:112`).
 */
function pickGenuineError(records: Record<string, unknown>[]): { code: string; msg: string } {
    for (const rec of records) {
        const { code, msg } = errorCodeOf(rec);
        if (!code || code === "00000000" || NO_DATA_CODES.has(code)) continue;
        return { code, msg };
    }
    return { code: "00000000", msg: "" };
}

/**
 * Format one engine error the way legacy builds `_failList` entries —
 * `"message (code)"`, degrading gracefully when only one part is present
 * (`nxisas_einvoice.js:416,602`). An optional `prefix` carries the
 * per-invoice `[symbol-no]` tag used on detail errors.
 */
function formatEngineError(code: string, msg: string, prefix = ""): string {
    const body = msg && code ? `${msg} (${code})` : msg || code;
    return prefix ? `${prefix} ${body}` : body;
}

/**
 * Collect EVERY genuine engine error across the job records (not just the
 * first, like {@link pickGenuineError}) — the legacy `_failList` the modal
 * renders in the "Partially Failed" / "Fail" hover tooltip. `42110000`
 * (no data) and `00000000` (success) are skipped (D2). When `prefixOf` is
 * supplied, each error is tagged with that record's `[symbol-no]` prefix
 * (detail phase); otherwise the raw `"message (code)"` is used (list phase).
 */
function collectGenuineErrors(
    records: Record<string, unknown>[],
    prefixOf?: (record: Record<string, unknown>, index: number) => string,
): string[] {
    const out: string[] = [];
    records.forEach((rec, idx) => {
        const { code, msg } = errorCodeOf(rec);
        if (!code || code === "00000000" || NO_DATA_CODES.has(code)) return;
        out.push(formatEngineError(code, msg, prefixOf ? prefixOf(rec, idx) : ""));
    });
    return out;
}

/**
 * Parse the engine `Result` payload and return the requested array.
 *
 * <p>After the server-side decrypt round-trip
 * ({@code decryptEInvoiceEngineData}) each `Output.Result` is an
 * already-parsed JSON **object** (`{ invoiceList: [...] }`) — the backend
 * replaces the ciphertext string with the parsed node, mirroring legacy
 * `nxisas_decrypt_act.jsp`. This also tolerates a plaintext JSON **string**
 * (`ENC=`-stripped) as a defensive fallback for any path that skipped the
 * decrypt step, and returns `[]` (never throws) on anything unparseable.
 */
function parseResultArray(record: Record<string, unknown>, key: string): unknown[] {
    const output = asRecord(record.Output);
    const rawResult = (output && output.Result) ?? record.Result ?? null;
    if (rawResult == null) return [];

    let parsed: Record<string, unknown> | null = null;
    if (typeof rawResult === "string") {
        if (rawResult.length === 0) return [];
        let json = rawResult;
        if (json.startsWith("ENC=")) json = json.slice(4);
        try {
            parsed = asRecord(JSON.parse(json));
        } catch {
            return [];
        }
    } else {
        // Server-decrypted: Result is the parsed JSON object itself.
        parsed = asRecord(rawResult);
    }

    const list = parsed?.[key];
    return Array.isArray(list) ? list : [];
}

/** Parse a single detail object: prefer the `invoiceDetail[0]` element. */
function parseInvoiceDetailObject(record: Record<string, unknown>): Record<string, unknown> | null {
    const arr = parseResultArray(record, "invoiceDetail");
    if (arr.length === 0) return null;
    return asRecord(arr[0]);
}

/* ------------------------------------------------------------------ */
/* Phase 1 extract                                                     */
/* ------------------------------------------------------------------ */

/**
 * Extract the phase-1 invoice rows + engine outcome from the raw
 * `callNxisas` callback. For Expenses the job index maps to the symbol
 * bucket (`['', '1', '2']`) — the same order
 * {@link buildInvoiceListInputs} submitted; each row is stamped with its
 * bucket's `einv_testResults`. Mirrors the legacy accept of
 * `result.result[0..2]` per `EINV_TYPE` (`nxisas_einvoice.js:457-706`).
 */
export function extractScrapedInvoices(
    raw: unknown,
    type: "SALES" | "EXPENSE",
): EInvoiceScrapeOutcome {
    const records = orderedJobRecords(raw);

    // Login-failure branch (legacy:406): the only record(s) are auth jobs.
    const nonAuth = records.filter((r) => !AUTH_JOBS.has(jobNameOf(r)));
    const loginFailed = records.length > 0 && nonAuth.length === 0;

    // Genuine-error scan — 42110000 (no data) is NOT an error (D2). The
    // first error drives rsltCd/rsltMsg (audit + failed-state message); the
    // full list feeds the "Partially Failed" tooltip.
    const { code: rsltCd, msg: rsltMsg } = pickGenuineError(records);
    const errors = collectGenuineErrors(records);

    const invoices: ApiScrapedEInvoiceRow[] = [];
    const listRecords = nonAuth.length > 0 ? nonAuth : records;
    listRecords.forEach((rec, idx) => {
        // Per-job testResult: prefer the echoed Input, else the positional
        // bucket (Expenses C/K/POS); Sales is always ''.
        const inputTestResult = str(asRecord(rec.Input)?.testResult);
        const bucketTestResult =
            type === "SALES" ? "" : EXPENSE_BUCKETS[idx]?.testResult ?? "";
        const testResult = inputTestResult || bucketTestResult;

        for (const r of parseResultArray(rec, "invoiceList")) {
            const inv = asRecord(r);
            if (!inv) continue;
            invoices.push({
                numeric_symbol: str(inv.numericSymbol),
                invoice_symbol: str(inv.invoiceSymbol),
                invoice_no: str(inv.invoiceNo),
                invoice_date: str(inv.invoiceDate),
                total_amt: str(inv.totalAmt),
                total_amt_without_tax: str(inv.totalAmtWithoutTax),
                total_tax_amt: str(inv.totalTaxAmt),
                total_discount: str(inv.totalDiscount),
                invoice_status: str(inv.invoiceStatus),
                check_result: str(inv.checkResult),
                invoice_info: str(inv.invoiceInfo),
                seller_tax_code: str(inv.sellerTaxCode),
                einv_test_results: testResult,
                currency_cd: str(inv.currencyCd),
                trco_cmnm: str(inv.sellerName ?? inv.trcoCmnm),
            });
        }
    });

    // Clean no-data: no genuine error AND zero rows (incl. 42110000).
    const noData = rsltCd === "00000000" && invoices.length === 0;
    return { rsltCd, rsltMsg, loginFailed, noData, errors, invoices };
}

/* ------------------------------------------------------------------ */
/* Phase 2 extract                                                     */
/* ------------------------------------------------------------------ */

function num(v: unknown): string {
    return str(v);
}

function parseProducts(detail: Record<string, unknown>): ApiScrapedEInvoiceDetailProduct[] {
    const arr = Array.isArray(detail.productArr) ? detail.productArr : [];
    const out: ApiScrapedEInvoiceDetailProduct[] = [];
    arr.forEach((p, i) => {
        const o = asRecord(p);
        if (!o) return;
        out.push({
            disp_ord: i + 1,
            product_name: str(o.productName),
            product: str(o.product),
            unit: str(o.unit),
            unit_price: num(o.unitPrice),
            quantity: num(o.amt),
            supply_amt: num(o.amtWithoutTax),
            tax_rate: str(o.taxRate),
            discount: num(o.discount),
        });
    });
    return out;
}

function parseFees(detail: Record<string, unknown>): ApiScrapedEInvoiceDetailFee[] {
    const arr = Array.isArray(detail.feeArr) ? detail.feeArr : [];
    const out: ApiScrapedEInvoiceDetailFee[] = [];
    arr.forEach((f, i) => {
        const o = asRecord(f);
        if (!o) return;
        out.push({ disp_ord: i + 1, fee_name: str(o.feeName), fee: num(o.fee) });
    });
    return out;
}

function parseTaxes(detail: Record<string, unknown>): ApiScrapedEInvoiceDetailTax[] {
    const arr = Array.isArray(detail.taxArr) ? detail.taxArr : [];
    const out: ApiScrapedEInvoiceDetailTax[] = [];
    arr.forEach((t, i) => {
        const o = asRecord(t);
        if (!o) return;
        out.push({
            disp_ord: i + 1,
            tax_rate: str(o.taxRate),
            amt_without_tax: num(o.amtWithoutTax),
            tax_amt: num(o.taxAmt),
        });
    });
    return out;
}

/**
 * Extract phase-2 detail rows from the INVOICE_DETAIL callback. Detail
 * records are paired with the originating {@code rows} by position (the
 * jobs were submitted in the same order), so each detail row carries the
 * identity needed to locate its master ({@code numeric_symbol},
 * {@code invoice_symbol}, {@code invoice_no}, {@code seller_tax_code},
 * {@code einv_test_results}) plus the parsed line items / fees / taxes.
 */
export function extractScrapedDetails(
    raw: unknown,
    rows: ApiScrapedEInvoiceRow[],
): EInvoiceDetailOutcome {
    const records = orderedJobRecords(raw);

    // Genuine-error scan — 42110000 (no data) is NOT an error (D2). Detail
    // errors carry the legacy `[numericSymbol+invoiceSymbol-invoiceNo]`
    // prefix, sourced from the positionally-paired phase-1 row.
    const { code: rsltCd, msg: rsltMsg } = pickGenuineError(records);
    const errors = collectGenuineErrors(records, (_rec, idx) => {
        const src = rows[idx];
        return src
            ? `[${src.numeric_symbol}${src.invoice_symbol}-${src.invoice_no}]`
            : "";
    });

    const details: ApiScrapedEInvoiceDetailRow[] = [];
    records.forEach((rec, idx) => {
        const detail = parseInvoiceDetailObject(rec);
        const src = rows[idx];
        if (!src) return; // can't anchor to a master without the source row
        const d = detail ?? {};
        details.push({
            // identity (from the source row → composes the master DOC_ID)
            numeric_symbol: src.numeric_symbol,
            invoice_symbol: src.invoice_symbol,
            invoice_no: src.invoice_no,
            seller_tax_code: src.seller_tax_code,
            einv_test_results: src.einv_test_results,
            // master enrichment (from the engine invoiceDetail payload)
            currency_cd: str(d.currency ?? src.currency_cd),
            invoice_title: str(d.invoiceTitle),
            seller_name: str(d.sellerName ?? src.trco_cmnm),
            total_amt: str(d.totalAmt ?? src.total_amt),
            // legacy detail uses the (typo'd) `totlAmtWithoutTax` key.
            total_amt_without_tax: str(
                d.totlAmtWithoutTax ?? d.totalAmtWithoutTax ?? src.total_amt_without_tax,
            ),
            total_tax_amt: str(d.totalTaxAmt ?? src.total_tax_amt),
            total_discount: str(d.totalDiscount ?? src.total_discount),
            // Full master enrichment — raw buyer/seller-side fields; the
            // backend resolves issuer vs counterparty by type.
            buyer_name: str(d.buyerName),
            buyer_tax_code: str(d.buyerTaxCode),
            buyer_addr: str(d.buyerAddr),
            buyer_bank_acc: str(d.buyerBankAcc),
            buyer_bank_name: str(d.buyerBankName),
            buyer_citizen_id: str(d.buyerCitizenId),
            seller_addr: str(d.sellerAddr),
            seller_bank_acc: str(d.sellerBankAcc),
            seller_bank_name: str(d.sellerBankName),
            seller_phone: str(d.sellerPhone),
            mccqt: str(d.mccqt),
            original_invoice: str(d.originalInvoice),
            payment_type: str(d.paymentType),
            list_number: str(d.listNumber),
            list_date: str(d.listDate),
            total_fee: str(d.totalFee),
            total_amt_in_letter: str(d.totalAmtInLetter),
            buyer_sign_by: str(d.buyerSignBy),
            buyer_sign_date: str(d.buyerSignDate),
            buyer_sign_time: str(d.buyerSignTime),
            seller_sign_by: str(d.sellerSignBy),
            seller_sign_date: str(d.sellerSignDate),
            seller_sign_time: str(d.sellerSignTime),
            qr_code: str(d.qrCode),
            rate: str(d.rate),
            // D3 registration enrichment — only present after the Expense
            // BUSSINESS_REGISTRATION_DETAIL merge (applyRegistrationEnrichment);
            // "" otherwise. Legacy reads these off invoiceDetail post-merge.
            seller_rppr_enm: str(d.sellerRpprEnm),
            seller_pic_name: str(d.sellerPicName),
            trco_name: str(d.trcoName),
            // line items
            products: parseProducts(d),
            fees: parseFees(d),
            taxes: parseTaxes(d),
        });
    });

    return { rsltCd, rsltMsg, errors, details };
}
