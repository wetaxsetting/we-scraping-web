/**
 * Domain model for the WeInvoice MVP.
 *
 * Field names deliberately mirror what the future Spring Boot API will put
 * on the wire (camelCase here → snake_case on the wire, WeCMS convention),
 * and what WeCMS needs to fill BUSA_DOC_MSTR when it switches from Coocon
 * to the WeInvoice Partner API:
 *   sellerTaxId  → issu_tax_id / trco_tax_id
 *   templateNo   → einv_numericsymbol
 *   symbol       → einv_invoicesymbol
 *   number       → hand_doc_id (invoice number)
 *   cqtCode      → einv_mccqt
 */

export type Direction = "purchase" | "sales";

/** GDT invoice relationship / lifecycle status. */
export type InvoiceStatus =
    | "original"
    | "replacement"
    | "replaced"
    | "adjustment"
    | "adjusted"
    | "cancelled";

export type InvoiceSource = "gdt" | "email" | "upload";

export type FileKind = "xml" | "pdf" | "attachment";

export type InvoiceFile = {
    id: string;
    kind: FileKind;
    name: string;
    size: number;
    /** Where the file came from — shown in the "Invoice file record". */
    origin: "gdt" | "vendor" | "email" | "upload" | "rendered";
    addedAt: string;
    /** Raw content for uploaded XML so it can be re-downloaded / re-parsed. */
    content?: string;
    /** Where the binary lives (original PDF saved by the local engine: /files/pdf/…). */
    url?: string;
    /** api mode: the record points at this engine file but the server's disk does not have it (size unknown). */
    missing?: boolean;
};

/** Line kind (QĐ 1233 `HHDVu/TChat`, UI Spec v1.2 §3.14): 1 goods / service · 2 promotion · 3 trade discount · 4 note. */
export type ItemKind = "goods" | "promo" | "discount" | "note";

export type InvoiceItem = {
    name: string;
    unit: string;
    qty: number;
    price: number;
    amount: number;
    vatRate: number; // 0, 5, 8, 10, -1 = KCT
    /* UI Spec v1.2 — from the XML when the backend has it (absent in mock data / older backends). */
    kind?: ItemKind;
    /** Item code (`MHHDVu`). */
    code?: string;
    /** Line discount amount (`STCKhau`). */
    discount?: number;
    /** Line VAT as reconciled by the backend (§3.14); absent → computed for display only. */
    taxAmount?: number | null;
    /** Rate as written in the XML ("8%", "KCT", "KKKNT") — wins over `vatRate` for display. */
    vatLabel?: string;
};

/** Fee / charge not subject to VAT (`TToan/DSLPhi/LPhi`, UI Spec v1.2 §3.14). */
export type InvoiceFee = { name: string; amount: number };

/** One invoice related to another (UI Spec v1.2 §3.15). `id` null = the original is not stored yet ("⚠ chưa có HĐ gốc"). */
export type InvoiceRef = {
    id: string | null;
    /** That invoice's own relation: `replaces` / `adjusts`. */
    relation: "replaces" | "adjusts" | null;
    templateNo: string;
    symbol: string;
    number: string;
    issueDate: string;
    /** In that invoice's currency; null when unknown. */
    total: number | null;
};

/** Replacement / adjustment links of an invoice, both ways (§3.15). */
export type InvoiceRelations = {
    /** Set when this invoice replaces / adjusts an original. */
    relation: "replaces" | "adjusts" | null;
    original: InvoiceRef | null;
    /** Note of the link (`TTHDLQuan/GChu`). */
    note?: string;
    /** Invoices replacing / adjusting this one. */
    referencedBy: InvoiceRef[];
};

export type Invoice = {
    id: string;
    direction: Direction;
    issueDate: string; // yyyy-mm-dd
    templateNo: string; // mẫu số: 1, 2 …
    symbol: string; // ký hiệu (KHHDon, 6 chars): C26TAA — displayed with template: 1C26TAA
    number: string; // số HĐ: 00012345
    sellerTaxId: string;
    sellerName: string;
    sellerAddress: string;
    buyerTaxId: string;
    buyerName: string;
    buyerAddress: string;
    /** ISO 4217 code from `DVTTe` (spec 02 §3.3 as amended): VND, USD, KRW … */
    currency: string;
    preTax: number;
    tax: number;
    total: number;
    status: InvoiceStatus;
    relatedId?: string; // replacement ↔ replaced
    cqtCode: string; // mã CQT ('' when invoice without code)
    provider: string; // issuing provider short name: MISA, VNPT … (see lib/providers.ts)
    providerTaxId?: string; // provider tax ID = <MSTTCGP> in the XML
    lookupCode: string;
    /** 2nd lookup parameter some providers need (WinInvoice "Mã công ty" = cmpn_key). Falls back to seller MST. */
    lookupCompany?: string;
    lookupUrl: string;
    paymentMethod: string;
    items: InvoiceItem[];
    files: InvoiceFile[];
    /** api mode: GDT copy of the PDF (printed from the GDT view page) — shown only until a provider original exists. */
    gdtPdf?: InvoiceFile;
    tags: string[];
    source: InvoiceSource;
    syncedAt: string;
    /* ---- UI Spec v1.2 (2026-11-27) — optional: filled by the API, absent in mock data ---- */
    /** Σ fees in the invoice currency (pre-tax + tax + fee = total). */
    fee?: number;
    /** Fee lines (detail only). */
    fees?: InvoiceFee[];
    /** Trade discount `TTCKTMai` (already deducted from pre-tax). */
    tradeDiscount?: number;
    poNumber?: string;
    /** ISO date when the XML value parses as a date. */
    dueDate?: string;
    /** Due date as written ("30DAYS"). */
    dueText?: string;
    /** First item names (list row) — the full lines arrive with the detail. */
    itemNames?: string[];
    itemCount?: number;
    /** VAT rate labels on the invoice ("8%", "KCT"). */
    vatRates?: string[];
    related?: InvoiceRelations;
    /** Original + Σ adjustments (detail only, when adjustments exist). */
    effectiveTotal?: number | null;
};

export type Tag = { id: string; name: string; color: string };

export type GdtConnection = {
    taxId: string;
    companyName: string;
    username: string;
    label: string;
    status: "connected" | "error" | "expired";
    lastSyncAt: string;
    createdAt: string;
};

export type SyncRun = {
    id: string;
    taxId: string;
    companyName: string;
    direction: "both" | Direction;
    fromMonth: string; // yyyy-mm
    toMonth: string;
    startedAt: string;
    durationSec: number;
    newCount: number;
    updatedCount: number;
    xmlCount: number;
    status: "success" | "partial" | "failed";
    message?: string;
    trigger: "manual" | "bulk" | "schedule";
};

export type EmailMessage = {
    id: string;
    receivedAt: string;
    from: string;
    subject: string;
    attachments: string[];
    result: "matched" | "new" | "duplicate" | "no_invoice";
    invoiceRef?: string;
};

export function hasFile(inv: Invoice, kind: FileKind) {
    return inv.files.some((f) => f.kind === kind);
}

/** De-duplication key — identical to the one the backend will enforce. */
export function invoiceKey(i: Pick<Invoice, "sellerTaxId" | "templateNo" | "symbol" | "number">) {
    return `${i.sellerTaxId}|${i.templateNo}|${i.symbol}|${Number(i.number)}`;
}

/** Full display symbol, e.g. "1C26TAA" (template + KHHDon). */
export function fullSymbol(inv: Pick<Invoice, "templateNo" | "symbol">) {
    return `${inv.templateNo}${inv.symbol}`;
}

/** 'K' after the template digit = invoice without GDT code (CQT stores no XML). */
export function isNoCode(inv: Pick<Invoice, "symbol">) {
    return inv.symbol.charAt(0) === "K";
}

/** 'M' as the 4th char of KHHDon (C26MAA) = cash-register (máy tính tiền) invoice. */
export function isCashRegister(inv: Pick<Invoice, "symbol">) {
    return inv.symbol.charAt(3) === "M";
}
