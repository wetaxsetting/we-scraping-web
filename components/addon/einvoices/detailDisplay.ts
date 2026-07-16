/**
 * Display adapter for the "View e-Invoice Details" modal: maps the camelCase
 * {@link EInvoiceDetail} (raw dates + decimal amounts) into the presentation
 * {@link MockInvoice} shape the modal markup already renders — so binding the
 * live API changes NO markup (the component's own contract).
 *
 * Amounts format via {@link formatAmount} (no symbol — legacy strips ₫/$);
 * dates format from the raw legacy `YYYYMMDD` / `HHmmss` strings.
 *
 * <p><b>Print</b> is NOT built here — it uses the server-rendered HTML from
 * `GET /api/v1/addon/einvoices/{docId}/print` (the same openhtmltopdf template
 * the PDF uses), so Print and PDF stay pixel-aligned (OQ-PDF/Print, 2026-07-15).
 */
import qrcode from "qrcode-generator";

import { formatAmount } from "@/lib/currency";

import type { EInvoiceDetail } from "./detailTypes";
import type { MockInvoice, MockInvoiceItem } from "./mockInvoice";

/**
 * Render the GDT-supplied QR payload (the verbatim `EINV_QRCODE` string) to a
 * QR code as a raster data-URI for an `<img>`. Returns `null` for a blank payload.
 *
 * <p><b>Why a raster (GIF) data-URI, not SVG:</b> the QR must render identically
 * on three surfaces — the modal, Print (the modal DOM is cloned via `innerHTML`),
 * and the PDF (html2canvas-pro capture). html2canvas does <i>not</i> reliably
 * rasterize an inline `data:image/svg+xml` `<img>` — it drops most of the matrix
 * and only a corner survives (the broken-QR bug). A raster bitmap `<img>` (GIF)
 * both serializes into the Print `innerHTML` clone AND rasterizes cleanly in
 * html2canvas. `createDataURL` is pure JS (no `<canvas>`/DOM), so it is
 * SSR-safe too.
 *
 * <p><b>Encoder:</b> `qrcode-generator` (same d-project core as the legacy
 * `qrcodejs`), ECC level <b>M</b> → version 5 (41×41) for these payloads,
 * matching the GDT portal's matrix. Alphanumeric mode reproduces GDT's compact
 * matrix (payloads are uppercase + digits + "."); byte mode is the fallback for
 * any out-of-charset character (larger matrix, identical decoded text).
 * `cellSize=8, margin=0` renders a crisp ~328px bitmap that downscales cleanly
 * into the 88px display box.
 *
 * <p>We only <b>render</b> the payload GDT generated — we never construct it.
 * See {@code docs/gdt-einvoice-qr-generation-analysis.md}.
 */
export function qrDataUri(payload: string): string | null {
    const text = (payload ?? "").trim();
    if (!text) return null;
    const build = (mode: "Alphanumeric" | "Byte"): string => {
        const qr = qrcode(0, "M"); // typeNumber 0 = auto-fit smallest version
        qr.addData(text, mode);
        qr.make();
        return qr.createDataURL(8, 0); // cellSize 8px, no quiet zone → data:image/gif
    };
    try {
        return build("Alphanumeric");
    } catch {
        return build("Byte");
    }
}

/** "20241014" → "Ngày 14 tháng 10 năm 2024" (legacy `.no-date`). Blank when short. */
function issueDateLine(d8: string): string {
    if (!d8 || d8.length < 8) return "";
    return `Ngày ${d8.slice(6, 8)} tháng ${d8.slice(4, 6)} năm ${d8.slice(0, 4)}`;
}

/** ("20241014","112646") → "2024-10-14 11:26:46" (legacy seller-sign line). */
function signedAt(d8: string, t6: string): string {
    const date =
        d8 && d8.length >= 8 ? `${d8.slice(0, 4)}-${d8.slice(4, 6)}-${d8.slice(6, 8)}` : "";
    const time =
        t6 && t6.length >= 6 ? `${t6.slice(0, 2)}:${t6.slice(2, 4)}:${t6.slice(4, 6)}` : "";
    return [date, time].filter(Boolean).join(" ");
}

/** Join a bank account number + bank name into the single "Số tài khoản" line. */
function bankLine(acc: string, name: string): string {
    return [acc, name].filter((s) => s && s.trim()).join(" ").trim();
}

export function toDisplayInvoice(d: EInvoiceDetail): MockInvoice {
    const ccy = d.currencyCd || "VND";
    const amt = (v: string) => formatAmount(v, ccy, false);

    const items: MockInvoiceItem[] = d.items.map((it, idx) => ({
        no: it.dispOrd ?? idx + 1,
        nature: it.itemNm,
        name: it.productName,
        unit: it.itemSpec,
        quantity: it.itemQunt ? amt(it.itemQunt) : "",
        unitPrice: it.itemUnitAmt ? amt(it.itemUnitAmt) : "",
        discount: it.dcAmt ? amt(it.dcAmt) : "",
        taxRate: it.taxRate,
        amountBeforeTax: it.splyAmt ? amt(it.splyAmt) : "",
    }));

    // Legacy einv_testresul === "2" GDT test-invoice variant (einv_0002_001.ts:142-173):
    // only meaningful for Expense / DOC_TYPE "B". Hides seller bank account + buyer
    // full-name / address / bank-account / payment-method + the currency block, and
    // instead shows buyer phone + citizen id.
    const testVariant = d.testResult === "2" && d.docType === "B";

    return {
        qrPayload: d.qrcode,
        testVariant,
        meta: {
            formNo: d.numericSymbol ? `Mẫu số ${d.numericSymbol}` : "",
            serialSymbol: d.invoiceSymbol,
            number: d.handDocId,
            issueDateLine: issueDateLine(d.issuDt),
            mccqt: d.mccqt,
        },
        seller: {
            name: d.seller.name,
            taxCode: d.seller.taxId,
            address: d.seller.address,
            phone: d.seller.phone,
            bankAccount: bankLine(d.seller.bankAcc, d.seller.bankName),
        },
        buyer: {
            companyName: d.buyer.name,
            buyerName: d.buyer.fullName,
            taxCode: d.buyer.taxId,
            address: d.buyer.address,
            bankAccount: bankLine(d.buyer.bankAcc, d.buyer.bankName),
            paymentMethod: d.paymentType,
            phone: d.buyer.phone,
            citizenId: d.buyer.citizenId,
        },
        currency: {
            code: d.currencyCd,
            listNo: d.listNumber,
            exchangeRate: d.rate,
            listDate: d.listDate,
        },
        items,
        // Left summary block — all fee lines (REC2) + all tax-rate rows (REC3),
        // full legacy parity (einv_0002_002 / einv_0002_001 listRec2/listRec3).
        fees: d.fees.map((f, i) => ({
            no: f.dispOrd ?? i + 1,
            name: f.feeName,
            amount: f.fee ? amt(f.fee) : "",
        })),
        taxRows: d.taxes.map((t) => ({
            taxRate: t.taxRate,
            amountBeforeTax: t.amt ? amt(t.amt) : "",
            taxAmount: t.taxAmt ? amt(t.taxAmt) : "",
        })),
        summary: {
            totalBeforeTax: d.totals.splyAmtSum ? amt(d.totals.splyAmtSum) : "",
            totalTaxAmount: d.totals.taxAmtSum ? amt(d.totals.taxAmtSum) : "",
            totalFee: d.totals.totlFeeAmt ? amt(d.totals.totlFeeAmt) : "",
            totalCommercialDiscount: d.totals.totlDisAmt ? amt(d.totals.totlDisAmt) : "",
            totalPaymentNumeric: d.totals.totlAmt ? amt(d.totals.totlAmt) : "",
            totalPaymentWords: d.totals.totalAmtInLetter,
        },
        signature: {
            valid: Boolean(d.seller.signBy || d.seller.signDate),
            signedBy: d.seller.signBy,
            signedAt: signedAt(d.seller.signDate, d.seller.signTime),
        },
    };
}
