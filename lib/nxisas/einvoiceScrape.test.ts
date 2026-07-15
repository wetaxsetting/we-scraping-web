import { describe, expect, it } from "vitest";

import {
    extractScrapedInvoices,
    extractScrapedDetails,
    blankSellerTaxCodes,
    buildRegistrationDetailInputs,
    extractRegistrationDetails,
    applyRegistrationEnrichment,
} from "./einvoiceScrape";
import type { ApiScrapedEInvoiceDetailRow } from "@/lib/types/api";

/**
 * D2 — GDT ErrorCode 42110000 ("Transaction results do not exist") is a
 * NORMAL empty result, not a failure. Legacy `nxisas_einvoice_c001_act.jsp:112`
 * accepts 00000000 AND 42110000 identically. These tests pin the refactor's
 * outcome normalisation so a no-data inquiry never surfaces as a
 * partial-failure warning and never poisons an Expense multi-bucket
 * aggregate where another bucket returned data.
 */

/** Build one engine job record with an ErrorCode + optional invoiceList. */
function listJob(errorCode: string, invoices: Array<Record<string, unknown>> = []) {
    return {
        Job: "INVOICE_LIST",
        Input: {},
        Output: {
            ErrorCode: errorCode,
            ErrorMessage:
                errorCode === "42110000" ? "Transaction results do not exist." : errorCode === "00000000" ? "" : `err ${errorCode}`,
            Result:
                invoices.length > 0 ? JSON.stringify({ invoiceList: invoices }) : "",
        },
    };
}

/** Wrap job records in the engine's `[{ result: [...] }]` envelope. */
function raw(...jobs: Array<Record<string, unknown>>) {
    return [{ result: jobs }];
}

const INV = {
    numericSymbol: "1",
    invoiceSymbol: "C25TAB",
    invoiceNo: "7",
    invoiceDate: "20260701",
    totalAmt: "1000",
    sellerTaxCode: "0100000001",
};

describe("extractScrapedInvoices — 42110000 no-data normalisation (D2)", () => {
    it("Sales: 42110000 only → clean no-data success (no error, noData=true)", () => {
        const out = extractScrapedInvoices(raw(listJob("42110000")), "SALES");
        expect(out.rsltCd).toBe("00000000");
        expect(out.noData).toBe(true);
        expect(out.loginFailed).toBe(false);
        expect(out.invoices).toHaveLength(0);
    });

    it("Expense: all three buckets 42110000 → clean no-data success", () => {
        const out = extractScrapedInvoices(
            raw(listJob("42110000"), listJob("42110000"), listJob("42110000")),
            "EXPENSE",
        );
        expect(out.rsltCd).toBe("00000000");
        expect(out.noData).toBe(true);
        expect(out.invoices).toHaveLength(0);
    });

    it("Expense: one success (1 row) + two 42110000 → success, has data, NOT noData", () => {
        const out = extractScrapedInvoices(
            raw(listJob("00000000", [INV]), listJob("42110000"), listJob("42110000")),
            "EXPENSE",
        );
        expect(out.rsltCd).toBe("00000000");
        expect(out.noData).toBe(false);
        expect(out.invoices).toHaveLength(1);
        expect(out.invoices[0].invoice_no).toBe("7");
    });

    it("Expense: one real error + one success + one 42110000 → real error preserved, success rows still collected", () => {
        const out = extractScrapedInvoices(
            raw(listJob("80000015"), listJob("00000000", [INV]), listJob("42110000")),
            "EXPENSE",
        );
        // Genuine error wins over both the success and the no-data codes.
        expect(out.rsltCd).toBe("80000015");
        expect(out.rsltMsg).toBe("err 80000015");
        expect(out.noData).toBe(false);
        // The successful bucket's row is still collected (parity with legacy,
        // which processes each bucket independently).
        expect(out.invoices).toHaveLength(1);
    });

    it("Sales: success with rows → success, not noData", () => {
        const out = extractScrapedInvoices(raw(listJob("00000000", [INV, INV])), "SALES");
        expect(out.rsltCd).toBe("00000000");
        expect(out.noData).toBe(false);
        expect(out.invoices).toHaveLength(2);
    });

    it("collects every genuine error into `errors` (skips 42110000 / success)", () => {
        const out = extractScrapedInvoices(
            raw(listJob("80000015"), listJob("00000000", [INV]), listJob("42110000")),
            "EXPENSE",
        );
        // Only the genuine error is collected — formatted "message (code)".
        expect(out.errors).toEqual(["err 80000015 (80000015)"]);
    });

    it("no genuine error → `errors` is empty", () => {
        const out = extractScrapedInvoices(
            raw(listJob("00000000", [INV]), listJob("42110000")),
            "EXPENSE",
        );
        expect(out.errors).toEqual([]);
    });

    it("login-only response → loginFailed=true (no INVOICE_LIST job)", () => {
        const loginOnly = [
            {
                result: [
                    {
                        Job: "LOGIN",
                        Input: {},
                        Output: { ErrorCode: "WBE1009", ErrorMessage: "bad creds", Result: "" },
                    },
                ],
            },
        ];
        const out = extractScrapedInvoices(loginOnly, "SALES");
        expect(out.loginFailed).toBe(true);
    });
});

describe("extractScrapedDetails — 42110000 no-data normalisation (D2)", () => {
    it("detail 42110000 → rsltCd normalised to success", () => {
        const detailRaw = [
            {
                result: [
                    {
                        Job: "INVOICE_DETAIL",
                        Input: {},
                        Output: { ErrorCode: "42110000", ErrorMessage: "no data", Result: "" },
                    },
                ],
            },
        ];
        const out = extractScrapedDetails(detailRaw, []);
        expect(out.rsltCd).toBe("00000000");
        expect(out.errors).toEqual([]);
    });

    it("detail error → `errors` carries the [symbol-no] prefix from the paired row", () => {
        const detailRaw = [
            {
                result: [
                    {
                        Job: "INVOICE_DETAIL",
                        Input: {},
                        Output: {
                            ErrorCode: "8000720E",
                            ErrorMessage: "Wrong tax bill code. Please check and try again.",
                            Result: "",
                        },
                    },
                ],
            },
        ];
        const srcRows = [
            {
                numeric_symbol: "1", invoice_symbol: "C25TAB", invoice_no: "7",
                invoice_date: "", total_amt: "0", total_amt_without_tax: "0",
                total_tax_amt: "0", total_discount: "0", invoice_status: "",
                check_result: "", invoice_info: "", seller_tax_code: "0100000001",
                einv_test_results: "", currency_cd: "VND", trco_cmnm: "",
            },
        ];
        const out = extractScrapedDetails(detailRaw, srcRows);
        expect(out.errors).toEqual([
            "[1C25TAB-7] Wrong tax bill code. Please check and try again. (8000720E)",
        ]);
    });
});

/**
 * D3 — Expense BUSSINESS_REGISTRATION_DETAIL seller enrichment (#40477).
 * When a scraped invoice has a blank seller name, legacy runDetailScrapping3
 * looks the seller up by tax code and fills company / chairman / accountant.
 */
describe("registration enrichment (D3)", () => {
    function detailRow(over: Partial<ApiScrapedEInvoiceDetailRow>): ApiScrapedEInvoiceDetailRow {
        return {
            numeric_symbol: "1", invoice_symbol: "C25TAB", invoice_no: "7",
            seller_tax_code: "", einv_test_results: "", currency_cd: "VND",
            invoice_title: "", seller_name: "", total_amt: "0", total_amt_without_tax: "0",
            total_tax_amt: "0", total_discount: "0", buyer_name: "", buyer_tax_code: "",
            buyer_addr: "", buyer_bank_acc: "", buyer_bank_name: "", buyer_citizen_id: "",
            seller_addr: "", seller_bank_acc: "", seller_bank_name: "", seller_phone: "",
            mccqt: "", original_invoice: "", payment_type: "", list_number: "", list_date: "",
            total_fee: "", total_amt_in_letter: "", buyer_sign_by: "", buyer_sign_date: "",
            buyer_sign_time: "", seller_sign_by: "", seller_sign_date: "", seller_sign_time: "",
            qr_code: "", rate: "", seller_rppr_enm: "", seller_pic_name: "", trco_name: "",
            products: [], fees: [], taxes: [],
            ...over,
        };
    }

    it("blankSellerTaxCodes collects the unique tax codes of blank-seller rows only", () => {
        const rows = [
            detailRow({ seller_name: "", seller_tax_code: "T1" }),      // blank → include
            detailRow({ seller_name: "Has Name", seller_tax_code: "T2" }), // named → skip
            detailRow({ seller_name: "  ", seller_tax_code: "T1" }),    // blank dup → dedup
            detailRow({ seller_name: "", seller_tax_code: "" }),        // no tax code → skip
        ];
        expect(blankSellerTaxCodes(rows)).toEqual(["T1"]);
    });

    it("buildRegistrationDetailInputs builds one nonLogin job per tax code (empty → [])", () => {
        expect(buildRegistrationDetailInputs([])).toEqual([]);
        const input = buildRegistrationDetailInputs(["T1", "T2"]);
        expect(input).toHaveLength(1);
        expect(input[0].bankCd).toBe("VIETNAM_GDT");
        expect(input[0].nonLogin).toBe(true);
        expect(input[0].job).toHaveLength(2);
        expect(input[0].job[0]).toEqual({
            Job: "BUSSINESS_REGISTRATION_DETAIL",
            Input: { search: "T1" },
        });
    });

    it("extractRegistrationDetails maps taxCode → company/chairman/accountant", () => {
        const raw = [
            {
                result: [
                    {
                        Job: "BUSSINESS_REGISTRATION_DETAIL",
                        Output: {
                            ErrorCode: "00000000",
                            Result: JSON.stringify({
                                registrationDetail: [
                                    { taxCode: "T1", companyName: "Full Co", chairman: "Chair", accountant: "Acct" },
                                ],
                            }),
                        },
                    },
                ],
            },
        ];
        const map = extractRegistrationDetails(raw);
        expect(map.get("T1")).toEqual({ companyName: "Full Co", chairman: "Chair", accountant: "Acct" });
    });

    it("applyRegistrationEnrichment fills blank-seller rows and leaves named rows untouched", () => {
        const blank = detailRow({ seller_name: "", seller_tax_code: "T1" });
        const named = detailRow({ seller_name: "Existing Co", seller_tax_code: "T1" });
        const map = new Map([["T1", { companyName: "Full Co", chairman: "Chair", accountant: "Acct" }]]);

        applyRegistrationEnrichment([blank, named], map);

        expect(blank.trco_name).toBe("Full Co");
        expect(blank.seller_rppr_enm).toBe("Chair");
        expect(blank.seller_pic_name).toBe("Acct");
        // Named row: untouched (a good scraped name is never overwritten).
        expect(named.trco_name).toBe("");
        expect(named.seller_rppr_enm).toBe("");
    });
});
