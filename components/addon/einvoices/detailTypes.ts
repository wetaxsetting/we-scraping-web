/**
 * In-memory model for the shared "View e-Invoice Details" popup. camelCase
 * semantic names per the three-layer naming rule — the wire → this shape
 * translation lives in `lib/api/mappers.ts` (`mapEInvoiceDetail`), consumed
 * by `fetchEInvoiceDetail` in `lib/api/addon.ts`.
 *
 * <p>Values are RAW (dates = legacy `YYYYMMDD` / `HHmmss` strings; amounts =
 * decimal strings). The modal formats them at display time via
 * `lib/currency.ts` + `lib/datetime.ts` — never pre-format in the mapper
 * (the same rule the list rows follow).
 */

export type EInvoiceParty = {
    name: string;
    taxId: string;
    address: string;
    phone: string;
    /** Buyer only. */
    fullName: string;
    /** Buyer only. */
    citizenId: string;
    bankAcc: string;
    bankName: string;
    /** Seller only. */
    signBy: string;
    /** Seller only — raw `YYYYMMDD`. */
    signDate: string;
    /** Seller only — raw `HHmmss`. */
    signTime: string;
};

export type EInvoiceDetailItem = {
    dispOrd: number | null;
    itemNm: string;
    productName: string;
    itemSpec: string;
    /** Raw decimal string. */
    itemQunt: string;
    /** Raw decimal string. */
    itemUnitAmt: string;
    /** Raw decimal string. */
    dcAmt: string;
    taxRate: string;
    /** Raw decimal string. */
    splyAmt: string;
};

export type EInvoiceDetailFee = {
    dispOrd: number | null;
    feeName: string;
    /** Raw decimal string. */
    fee: string;
};

export type EInvoiceDetailTax = {
    taxRate: string;
    /** Raw decimal string. */
    amt: string;
    /** Raw decimal string. */
    taxAmt: string;
};

export type EInvoiceDetailTotals = {
    splyAmtSum: string;
    taxAmtSum: string;
    totlFeeAmt: string;
    totlDisAmt: string;
    totlAmt: string;
    totalAmtInLetter: string;
};

export type EInvoiceDetail = {
    docId: string;
    /** `"I"` (sale) or `"B"` (bill). */
    docType: string;
    invoiceTitle: string;
    numericSymbol: string;
    invoiceSymbol: string;
    handDocId: string;
    invoiceStatus: string;
    mccqt: string;
    qrcode: string;
    originalInvoice: string;
    /** Raw `YYYYMMDD`. */
    issuDt: string;
    currencyCd: string;
    rate: string;
    listNumber: string;
    listDate: string;
    paymentType: string;
    /** GDT test-invoice class — `"2"` hides bank/address, shows citizen id. */
    testResult: string;
    seller: EInvoiceParty;
    buyer: EInvoiceParty;
    items: EInvoiceDetailItem[];
    fees: EInvoiceDetailFee[];
    taxes: EInvoiceDetailTax[];
    totals: EInvoiceDetailTotals;
};
