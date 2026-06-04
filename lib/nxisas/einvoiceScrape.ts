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
 * <p><b>Decrypt boundary (OQ-S2, unavoidable deviation):</b> legacy sets
 * `nonDecrypt:true` and the JEX backend decrypts the engine `Result`
 * with Coocon `ISASSeedCBC` server-side. The refactor does NOT bundle
 * the Coocon cipher, so we keep `nonDecrypt:false` (engine decrypts
 * client-side) and POST the already-plaintext structured rows. This is
 * the only legacy behaviour that cannot be matched byte-for-byte; every
 * other facet of the flow is restored. Documented in
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
    /** Engine `ErrorCode` — `"00000000"` on success. */
    rsltCd: string;
    /** Engine `ErrorMessage` (if any). */
    rsltMsg: string;
    /** True when the only job(s) returned were auth jobs (LOGIN / CAPTCHA
     *  / OTP / QNA) — legacy login-failure branch
     *  (`nxisas_einvoice.js:406`). */
    loginFailed: boolean;
    invoices: ApiScrapedEInvoiceRow[];
};

export type EInvoiceDetailOutcome = {
    rsltCd: string;
    rsltMsg: string;
    details: ApiScrapedEInvoiceDetailRow[];
};

const GDT_BANK_CD = "VIETNAM_GDT";

/** Engine job names this flow drives (all GDT / `GLOBAL/VNM/PUBLIC_GDT`). */
const JOB_INVOICE_LIST = "INVOICE_LIST";
const JOB_INVOICE_DETAIL = "INVOICE_DETAIL";
const AUTH_JOBS = new Set(["LOGIN", "CAPTCHA", "OTP", "QNA"]);

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
            // Legacy uses nonDecrypt:true (server-side ISASSeedCBC). The
            // refactor does not bundle the Coocon cipher → engine decrypts
            // client-side (OQ-S2). Only documented deviation.
            nonDecrypt: false,
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
            nonDecrypt: false,
            threadCount: 5,
            job,
        },
    ];
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

/** Parse the engine `Result` payload (`ENC=`-prefixed when still
 *  encrypted; plaintext JSON otherwise) and return the requested array. */
function parseResultArray(record: Record<string, unknown>, key: string): unknown[] {
    const output = asRecord(record.Output);
    const rawResult = (output && output.Result) ?? record.Result ?? null;
    if (typeof rawResult !== "string" || rawResult.length === 0) return [];
    let json = rawResult;
    if (json.startsWith("ENC=")) json = json.slice(4);
    try {
        const parsed = asRecord(JSON.parse(json));
        const list = parsed?.[key];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
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

    let rsltCd = "00000000";
    let rsltMsg = "";
    let outcomeSet = false;
    for (const rec of records) {
        const { code, msg } = errorCodeOf(rec);
        if (!code) continue;
        if (!outcomeSet) {
            rsltCd = code;
            rsltMsg = msg;
            outcomeSet = true;
        }
        if (code !== "00000000") {
            rsltCd = code;
            rsltMsg = msg;
            break;
        }
    }

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

    return { rsltCd, rsltMsg, loginFailed, invoices };
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

    let rsltCd = "00000000";
    let rsltMsg = "";
    let outcomeSet = false;
    for (const rec of records) {
        const { code, msg } = errorCodeOf(rec);
        if (!code) continue;
        if (!outcomeSet) {
            rsltCd = code;
            rsltMsg = msg;
            outcomeSet = true;
        }
        if (code !== "00000000") {
            rsltCd = code;
            rsltMsg = msg;
            break;
        }
    }

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
            // line items
            products: parseProducts(d),
            fees: parseFees(d),
            taxes: parseTaxes(d),
        });
    });

    return { rsltCd, rsltMsg, details };
}
