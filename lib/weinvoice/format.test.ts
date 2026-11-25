import { describe, expect, it } from "vitest";

import { fmtInvoiceAmount, fmtInvoiceMoney, invoiceCurrency } from "@/lib/weinvoice/format";

// Regression (2026-11-25): a USD invoice of 7,303.84 (3600790154 C26TKS-445) was shown as "7.304 ₫".
describe("invoice amount in the invoice's own currency", () => {
    it("shows VND with its ISO code, like every other currency", () => {
        expect(fmtInvoiceMoney(48000, "VND")).toBe("48.000 VND");
        expect(fmtInvoiceAmount(48000, "VND")).toBe("48.000");
    });

    it("shows USD with cents and the USD unit, never VND", () => {
        expect(fmtInvoiceMoney(7303.84, "USD")).toBe("7.303,84 USD");
        expect(fmtInvoiceAmount(100, "USD")).toBe("100,00");
    });

    it("uses the currency's own minor units", () => {
        expect(fmtInvoiceMoney(15000, "KRW")).toBe("15.000 KRW");
        expect(fmtInvoiceMoney(12.5, "EUR")).toBe("12,50 EUR");
    });

    it("normalises VNĐ / blank to VND", () => {
        expect(invoiceCurrency("VNĐ")).toBe("VND");
        expect(invoiceCurrency(" vnd ")).toBe("VND");
        expect(invoiceCurrency(undefined)).toBe("VND");
        expect(fmtInvoiceMoney(1000, "")).toBe("1.000 VND");
    });
});
