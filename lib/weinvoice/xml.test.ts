import { describe, expect, it } from "vitest";

import { isCashRegister, isNoCode } from "@/lib/weinvoice/types";
import { buildInvoiceXml, lookupCodeFromXml, normField, parseInvoiceXml } from "@/lib/weinvoice/xml";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <KHMSHDon>1</KHMSHDon><KHHDon>C26TAB</KHHDon><SHDon>00001234</SHDon>
      <NLap>2026-09-15</NLap><DVTTe>VND</DVTTe><HTTToan>CK</HTTToan>
      <MSTTCGP>0101243150</MSTTCGP><TCHDon>1</TCHDon>
    </TTChung>
    <NDHDon>
      <NBan><Ten>CÔNG TY BÁN</Ten><MST>0106111222</MST><DChi>Hà Nội</DChi></NBan>
      <NMua><Ten>CÔNG TY MUA</Ten><MST>0109876543</MST><DChi>Hà Nội</DChi></NMua>
      <DSHHDVu>
        <HHDVu><THHDVu>Giấy A4</THHDVu><DVTinh>Ram</DVTinh><SLuong>10</SLuong><DGia>72000</DGia><ThTien>720000</ThTien><TSuat>10%</TSuat></HHDVu>
        <HHDVu><THHDVu>Sách</THHDVu><DVTinh>Quyển</DVTinh><SLuong>1</SLuong><DGia>250000</DGia><ThTien>250000</ThTien><TSuat>KCT</TSuat></HHDVu>
      </DSHHDVu>
      <TToan><TgTCThue>970000</TgTCThue><TgTThue>72000</TgTThue><TgTTTBSo>1042000</TgTTTBSo></TToan>
    </NDHDon>
    <TTKhac><TTin><TTruong>Mã tra cứu</TTruong><DLieu>MIS12345678</DLieu></TTin></TTKhac>
  </DLHDon>
  <MCCQT>00ABCDEF1234567890</MCCQT>
</HDon>`;

describe("parseInvoiceXml", () => {
    it("reads header, parties, items and totals from a TT78 invoice", () => {
        const p = parseInvoiceXml(SAMPLE);
        expect(p).toMatchObject({
            templateNo: "1",
            symbol: "C26TAB",
            number: "00001234",
            issueDate: "2026-09-15",
            sellerTaxId: "0106111222",
            buyerTaxId: "0109876543",
            providerTaxId: "0101243150",
            preTax: 970000,
            tax: 72000,
            total: 1042000,
            cqtCode: "00ABCDEF1234567890",
            lookupCode: "MIS12345678",
        });
        expect(p.items).toHaveLength(2);
        expect(p.items[1].vatRate).toBe(-1); // KCT
    });

    it("maps TCHDon 1 → replacement (§3.3 status)", () => {
        expect(parseInvoiceXml(SAMPLE).status).toBe("replacement");
        expect(parseInvoiceXml(SAMPLE.replace("<TCHDon>1</TCHDon>", "<TCHDon>2</TCHDon>")).status).toBe("adjustment");
        expect(parseInvoiceXml(SAMPLE.replace("<TCHDon>1</TCHDon>", "")).status).toBe("original");
    });

    it("rejects malformed XML and XML that is not an invoice (§3.2 Lỗi)", () => {
        expect(() => parseInvoiceXml("<HDon><broken>")).toThrow("invalid_xml");
        expect(() => parseInvoiceXml("<Root><A>1</A></Root>")).toThrow("not_invoice");
    });

    it("round-trips a rendered record", () => {
        const p = parseInvoiceXml(SAMPLE);
        const again = parseInvoiceXml(buildInvoiceXml({ ...p, id: "x", direction: "purchase", files: [], tags: [], source: "upload", syncedAt: "", lookupUrl: "", provider: "MISA" }));
        expect(again).toMatchObject({ symbol: p.symbol, number: p.number, sellerTaxId: p.sellerTaxId, total: p.total, lookupCode: p.lookupCode });
    });
});

describe("lookup code + invoice kinds", () => {
    it("normalises Vietnamese field names", () => {
        expect(normField("Mã tra cứu")).toBe("matracuu");
        expect(lookupCodeFromXml(SAMPLE)).toBe("MIS12345678");
    });

    it("detects no-code (K…) and cash-register (…M…) symbols (§3.3)", () => {
        expect(isNoCode({ symbol: "K26TEV" })).toBe(true);
        expect(isNoCode({ symbol: "C26TEV" })).toBe(false);
        expect(isCashRegister({ symbol: "C26MVM" })).toBe(true);
        expect(isCashRegister({ symbol: "C26TVM" })).toBe(false);
    });
});
