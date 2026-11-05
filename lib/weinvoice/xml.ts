/*
 * GDT e-invoice XML (Decree 123/2020, TT78/2021 layout) — parse + render.
 *
 * Parsing runs in the browser with DOMParser and is tolerant of namespaces /
 * casing differences between providers. Rendering (`buildInvoiceXml`) only
 * produces a readable stand-in for records whose original XML text is not held
 * client-side (mock data); real downloads must come from the backend.
 */
import type { Invoice, InvoiceItem } from "@/lib/weinvoice/types";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const rateLabel = (r: number) => (r < 0 ? "KCT" : `${r}%`);

export function buildInvoiceXml(inv: Invoice): string {
    const items = inv.items
        .map(
            (it, i) =>
                `      <HHDVu><STT>${i + 1}</STT><THHDVu>${esc(it.name)}</THHDVu><DVTinh>${esc(it.unit)}</DVTinh><SLuong>${it.qty}</SLuong><DGia>${it.price}</DGia><ThTien>${it.amount}</ThTien><TSuat>${rateLabel(it.vatRate)}</TSuat></HHDVu>`,
        )
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <KHMSHDon>${esc(inv.templateNo)}</KHMSHDon>
      <KHHDon>${esc(inv.symbol)}</KHHDon>
      <SHDon>${esc(inv.number)}</SHDon>
      <NLap>${esc(inv.issueDate)}</NLap>
      <DVTTe>${esc(inv.currency)}</DVTTe>
      <HTTToan>${esc(inv.paymentMethod)}</HTTToan>
      <MSTTCGP>${esc(inv.providerTaxId ?? "")}</MSTTCGP>
    </TTChung>
    <NDHDon>
      <NBan><Ten>${esc(inv.sellerName)}</Ten><MST>${esc(inv.sellerTaxId)}</MST><DChi>${esc(inv.sellerAddress)}</DChi></NBan>
      <NMua><Ten>${esc(inv.buyerName)}</Ten><MST>${esc(inv.buyerTaxId)}</MST><DChi>${esc(inv.buyerAddress)}</DChi></NMua>
      <DSHHDVu>
${items}
      </DSHHDVu>
      <TToan><TgTCThue>${inv.preTax}</TgTCThue><TgTThue>${inv.tax}</TgTThue><TgTTTBSo>${inv.total}</TgTTTBSo></TToan>
    </NDHDon>
    <TTKhac><TTin><TTruong>MaTraCuu</TTruong><DLieu>${esc(inv.lookupCode)}</DLieu></TTin></TTKhac>
  </DLHDon>
  <MCCQT>${esc(inv.cqtCode)}</MCCQT>
</HDon>
`;
}

export type ParsedXml = Omit<Invoice, "id" | "direction" | "files" | "tags" | "source" | "syncedAt" | "status" | "lookupCode" | "lookupUrl"> & {
    status: Invoice["status"];

    lookupCode: string;
};

/** Names providers use for the lookup code in TTKhac / custom tags (normalised with normField). */
const LOOKUP_FIELDS = ["privatecode", "transactionid", "matracuu", "mtc", "mtcuu", "manhanhd", "lookupcode", "searchkey", "fkey", "matracuuhoadon", "invoicelookupcode", "securekey", "masobimat"];

/** "Mã tra cứu" → "matracuu" (diacritics, spaces, punctuation and case removed). */
export function normField(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
}

function parseDoc(raw: string): Document | null {
    if (typeof DOMParser === "undefined") return null;
    const doc = new DOMParser().parseFromString(raw, "application/xml");
    return doc.getElementsByTagName("parsererror").length ? null : doc;
}

/** TTKhac/TTin pairs (TTruong → DLieu) plus any element whose own name is a lookup field. */
function lookupCodeFrom(doc: Document, raw: string): string {
    for (const tt of Array.from(doc.getElementsByTagNameNS("*", "TTin"))) {
        const key = normField(tt.getElementsByTagNameNS("*", "TTruong")[0]?.textContent ?? "");
        const val = tt.getElementsByTagNameNS("*", "DLieu")[0]?.textContent?.trim() ?? "";
        if (val && LOOKUP_FIELDS.includes(key)) return val;
    }
    for (const el of Array.from(doc.getElementsByTagName("*"))) {
        if (el.children.length === 0 && LOOKUP_FIELDS.includes(normField(el.localName))) {
            const v = el.textContent?.trim();
            if (v) return v;
        }
    }
    const m = raw.match(/(?:ma\s*tra\s*cuu|mã\s*tra\s*cứu)\s*[:=]\s*([A-Za-z0-9_-]{6,})/i);
    return m?.[1] ?? "";
}

/** WinInvoice-style second lookup parameter ("Mã công ty"). */
function lookupCompanyFrom(doc: Document): string {
    for (const tt of Array.from(doc.getElementsByTagNameNS("*", "TTin"))) {
        const key = normField(tt.getElementsByTagNameNS("*", "TTruong")[0]?.textContent ?? "");
        if (key === "macongty" || key === "cmpnkey") return tt.getElementsByTagNameNS("*", "DLieu")[0]?.textContent?.trim() ?? "";
    }
    return "";
}

export function lookupCompanyFromXml(raw: string): string {
    const doc = parseDoc(raw);
    return doc ? lookupCompanyFrom(doc) : "";
}

export function lookupCodeFromXml(raw: string): string {
    const doc = parseDoc(raw);
    return doc ? lookupCodeFrom(doc, raw) : "";
}

function first(root: Element | Document, name: string): Element | null {
    return root.getElementsByTagNameNS("*", name)[0] ?? root.getElementsByTagName(name)[0] ?? null;
}

function txt(root: Element | Document | null, name: string): string {
    return root ? (first(root, name)?.textContent ?? "").trim() : "";
}

const num = (s: string): number => {
    const v = Number(s.replace(/\s/g, "").replace(/,(?=\d{3}\b)/g, ""));
    return Number.isFinite(v) ? v : 0;
};

/** "10%" / "10" / "KCT" / "KKKNT" → 10 / 10 / -1 / -1. */
const parseRate = (s: string): number => {
    const v = s.trim().toUpperCase();
    if (!v || v === "KCT" || v === "KKKNT") return -1;
    const n = Number(v.replace("%", ""));
    return Number.isFinite(n) ? n : -1;
};

/** TCHDon: 1 = replacement, 2 = adjustment (TT78). */
function statusFrom(doc: Document): ParsedXml["status"] {
    const t = txt(doc, "TCHDon");
    return t === "1" ? "replacement" : t === "2" ? "adjustment" : "original";
}

/** Parse a GDT e-invoice XML. Throws `Error("invalid_xml")` / `Error("not_invoice")` with a reason the UI shows (§3.2 "Lỗi"). */
export function parseInvoiceXml(text: string): ParsedXml {
    const doc = parseDoc(text);
    if (!doc) throw new Error("invalid_xml");
    const general = first(doc, "TTChung");
    const seller = first(doc, "NBan");
    const buyer = first(doc, "NMua");
    if (!general || !seller) throw new Error("not_invoice");

    const items: InvoiceItem[] = Array.from(doc.getElementsByTagNameNS("*", "HHDVu")).map((el) => ({
        name: txt(el, "THHDVu"),
        unit: txt(el, "DVTinh"),
        qty: num(txt(el, "SLuong")),
        price: num(txt(el, "DGia")),
        amount: num(txt(el, "ThTien")),
        vatRate: parseRate(txt(el, "TSuat")),
    }));
    const totals = first(doc, "TToan");
    const preTax = num(txt(totals, "TgTCThue")) || items.reduce((s, i) => s + i.amount, 0);
    const tax = num(txt(totals, "TgTThue"));
    const total = num(txt(totals, "TgTTTBSo")) || preTax + tax;
    const providerTaxId = txt(general, "MSTTCGP");
    const lookupCompany = lookupCompanyFrom(doc);

    return {
        issueDate: txt(general, "NLap").slice(0, 10),
        templateNo: txt(general, "KHMSHDon"),
        symbol: txt(general, "KHHDon"),
        number: txt(general, "SHDon"),
        sellerTaxId: txt(seller, "MST"),
        sellerName: txt(seller, "Ten"),
        sellerAddress: txt(seller, "DChi"),
        buyerTaxId: txt(buyer, "MST"),
        buyerName: txt(buyer, "Ten"),
        buyerAddress: txt(buyer, "DChi"),
        currency: txt(general, "DVTTe") === "USD" ? "USD" : "VND",
        preTax,
        tax,
        total,
        status: statusFrom(doc),
        cqtCode: txt(doc, "MCCQT"),
        provider: "",
        providerTaxId: providerTaxId || undefined,
        lookupCode: lookupCodeFrom(doc, text),
        ...(lookupCompany ? { lookupCompany } : {}),
        paymentMethod: txt(general, "HTTToan"),
        items,
    };
}
