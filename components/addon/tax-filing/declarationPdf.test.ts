import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
    buildDeclarationPatches,
    type DeclarationExcelInput,
} from "./declarationExcel";
import { buildDeclarationPdfHtml, pdfFileName } from "./declarationPdf";
import type { ApiVatDeclarationDetail } from "@/lib/types/api";

/**
 * The PDF is the workbook: it renders the authority's own sheet after the same
 * patches the XLSX download applies. These read the real template out of
 * `public/`, so a change to the file — or to the patch map — shows up here
 * rather than in a filed declaration.
 *
 * Unzipping in Node uses `zlib.inflateRawSync`; the app path uses
 * `DecompressionStream`, which is browser-only.
 */

function readTemplatePart(path: string): string {
    const buf = readFileSync("public/templates/vat-declaration-01-gtgt.xlsx");
    // Walk the central directory, same shape as lib/xlsxTemplate.ts.
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
        if (dv.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let n = 0; n < count; n++) {
        const method = dv.getUint16(p + 10, true);
        const compSize = dv.getUint32(p + 20, true);
        const nameLen = dv.getUint16(p + 28, true);
        const extraLen = dv.getUint16(p + 30, true);
        const commentLen = dv.getUint16(p + 32, true);
        const localOffset = dv.getUint32(p + 42, true);
        const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
        if (name === path) {
            const lNameLen = dv.getUint16(localOffset + 26, true);
            const lExtraLen = dv.getUint16(localOffset + 28, true);
            const start = localOffset + 30 + lNameLen + lExtraLen;
            const raw = buf.subarray(start, start + compSize);
            return (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
        }
        p += 46 + nameLen + extraLen + commentLen;
    }
    throw new Error(`missing ${path}`);
}

const sheet = readTemplatePart("xl/worksheets/sheet1.xml");
const shared = readTemplatePart("xl/sharedStrings.xml");
const stylesXml = readTemplatePart("xl/styles.xml");

// Số liệu thật của sid 73 (02/2026).
const detail = {
    sid: 73,
    period_type: "M",
    period_value: 2,
    decl_year: 2026,
    suppl_no: 0,
    tp_name: "CÔNG TY TNHH WEBCASH VIỆT NAM",
    tp_tax_code: "1201496252",
    activity_name: "Hoạt động sản xuất kinh doanh thông thường",
} as unknown as ApiVatDeclarationDetail;

const values: Record<string, number> = {
    ct21: 0, ct22: 0, ct23: 4040744, ct24: 351246, ct25: 351246, ct26: 0,
    ct27: 36610654, ct28: 548804, ct29: 0, ct30: 0, ct31: 0, ct32: 6830654,
    ct32a: 29780000, ct33: 548804, ct34: 36610654, ct35: 548804, ct36: 197558,
    ct37: 0, ct38: 0, ct39a: 0, ct40a: 197558, ct40b: 0, ct40: 197558,
    ct41: 0, ct42: 0, ct43: 0,
};

const meta = {
    agentNm: "", agentTaxCode: "", agentCtrNo: "", agentCtrDt: "",
    duNm: "", duTaxCode: "", duAddr: "", duProv: "", duDist: "", duWard: "",
};

const input: DeclarationExcelInput = { detail, values, meta };

const html = buildDeclarationPdfHtml(
    sheet,
    shared,
    stylesXml,
    buildDeclarationPatches(input),
    pdfFileName(detail),
);

describe("declarationPdf — rendered from the workbook", () => {
    it("là một document in được, khổ A4 dọc", () => {
        expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
        expect(html).toContain("@page { size: A4 portrait");
        expect(html).toContain("</html>");
    });

    it("giữ nguyên bố cục bảng của file Excel", () => {
        expect(html).toContain("table-layout: fixed");
        expect(html).toContain("<colgroup>");
        // Độ rộng cột lấy từ <cols> của template, không phải số tự đặt.
        expect(html).toMatch(/<col style="width:\d+px">/);
        // Chiều cao dòng lấy từ ht=".." của template.
        expect(html).toMatch(/<tr style="height:\d+px">/);
    });

    it("giữ merge của template dưới dạng colspan / rowspan", () => {
        const colspans = html.match(/colspan="\d+"/g) ?? [];
        // Template khai báo 90 vùng merge; phần in ra (A..P) phải mang phần lớn.
        expect(colspans.length).toBeGreaterThan(40);
    });

    it("giữ ô rỗng để nội dung nằm đúng cột", () => {
        // Trong bảng table-layout:fixed, bỏ một ô rỗng KHÔNG để lại khoảng trống
        // mà kéo mọi thứ phía sau sang trái một cột. Đây là lỗi từng làm lệch cả
        // khối [01a]–[11a].
        const rows = [...html.matchAll(/<tr[^>]*>((?:(?!<\/tr>)[\s\S])*)<\/tr>/g)].map(
            (m) => m[1],
        );
        const row = rows.find((r) => r.includes("[01a]"));
        expect(row).toBeDefined();
        const tds = row!.split("<td").length - 1;
        // Nhãn ở cột A, tên ngành ở cột C — hàng phải giữ đủ ô, không co lại
        // thành hai ô sát nhau.
        expect(tds).toBeGreaterThan(2);
        expect(row!.indexOf("[01a]")).toBeLessThan(
            row!.indexOf("Hoạt động sản xuất kinh doanh thông thường"),
        );
        // Ô rỗng mang một hộp cao đúng bằng chiều cao hàng Excel khai — không
        // phải &nbsp;, vì &nbsp; kéo theo một dòng chữ và làm hàng đệm 3px cao
        // thành 18px.
        expect(row).toMatch(/<td[^>]*><div style="height:[\d.]+px"><\/div><\/td>/);

        // Và không hàng nào vượt quá số cột in ra.
        for (const r of rows) {
            expect(r.split("<td").length - 1).toBeLessThanOrEqual(15);
        }
    });

    it("lấy màu chữ từ template, không tô đen tất cả", () => {
        // Template khai <color indexed="18"> — xanh navy — cho tiêu đề và nhãn.
        expect(html).toContain("color:#000080");
    });

    it("độ rộng cột theo đúng công thức ECMA-376, không phải xấp xỉ", () => {
        // width 6.28515625 ký tự → trunc(((256*w + trunc(128/7))/256)*7) = 44px.
        // Xấp xỉ w*7+5 cho 49px — lệch 5px mỗi cột, cộng dồn thấy rõ trên trang.
        expect(html).toContain('<col style="width:44px">');
    });

    it("thu nhỏ vừa đúng bề ngang in được của A4, không nhỏ hơn", () => {
        const zoom = Number(/zoom:([\d.]+)/.exec(html)?.[1]);
        expect(zoom).toBeGreaterThan(0.9);
        expect(zoom).toBeLessThanOrEqual(1);
    });

    it("bảng có bề rộng xác định, bằng đúng tổng độ rộng cột", () => {
        // table-layout:fixed chỉ tôn trọng <colgroup> khi bảng có bề rộng xác
        // định. Để "auto", trình duyệt giãn cột theo nội dung và tỉ lệ cột của
        // sheet — thứ đang được tái hiện — mất sạch.
        const widths = [...html.matchAll(/<col style="width:(\d+)px">/g)].map((m) =>
            Number(m[1]),
        );
        const total = widths.reduce((a, b) => a + b, 0);
        expect(html).toContain(`<table class="xl-table" style="width:${total}px">`);
    });

    it("cho chữ tràn sang ô rỗng, chỉ cắt khi ô bên cạnh có nội dung", () => {
        // Excel để nhãn dài chạy qua các ô rỗng bên phải. Cắt mọi ô thì nhãn
        // ("[01a] Tên hoạt động…") bị mất đuôi; không cắt ô nào thì số liệu đè
        // lên nhau.
        expect(html).not.toContain("overflow: hidden;\n"); // không có luật chung
        expect(html).toContain("overflow:hidden"); // vẫn cắt nơi cần cắt
        const rows = [...html.matchAll(/<tr[^>]*>((?:(?!<\/tr>)[\s\S])*)<\/tr>/g)].map(
            (m) => m[1],
        );
        const label = rows.find((r) => r.includes("[01a]"))!;
        const labelTd = /<td[^>]*>\[01a\][^<]*<\/td>/.exec(label)?.[0] ?? "";
        expect(labelTd).not.toContain("overflow:hidden");
    });

    it("hàng cao đúng như Excel khai — ô rỗng không kéo dài hàng đệm", () => {
        // Hàng đệm của form chỉ 3-7px. Một ô rỗng vẫn giữ một dòng chữ theo cỡ
        // font của nó, nên nếu không ép hộp thì hàng phình lên 13-18px và cả
        // biểu mẫu dài thêm ~95px.
        const heights = [...html.matchAll(/<tr style="height:(\d+)px">/g)].map((m) =>
            Number(m[1]),
        );
        expect(heights.length).toBeGreaterThan(50);
        expect(Math.min(...heights)).toBeLessThan(10);
        // Ô có chữ KHÔNG bị bọc trong hộp — bọc lại thì mất luôn khả năng tràn
        // chữ sang ô rỗng bên phải.
        expect(html).toMatch(/<td[^>]*>\[01a\]/);
    });

    it("in gọn trong một trang A4", () => {
        // Chiều cao thật chỉ trình duyệt biết (thu nhỏ làm chữ xuống dòng khác
        // đi), nên tài liệu tự đo lại rồi mới in.
        expect(html).toContain("getBoundingClientRect");
        expect(html).toContain("break-inside: avoid");
        const w = Math.round((194 / 25.4) * 96);
        const h = Math.round((281 / 25.4) * 96);
        expect(html).toContain(String(w));
        expect(html).toContain(String(h));
    });

    it("kẻ khung ô theo border của template", () => {
        expect(html).toContain("border-top:1px solid #000");
        expect(html).toContain("border-bottom:1px solid #000");
    });

    it("lấy phông và cỡ chữ từ template, không phải phông tự đặt", () => {
        // Template khai 14 phông; phần in ra chủ yếu là Tahoma. Khẳng định phông
        // đến TỪ file — nếu ai đổi template, test này đổi theo.
        expect(html).toContain("font-family:'Tahoma'");
        expect(html).toMatch(/font-size:\d+(\.\d+)?pt/);
        // Cỡ chữ phải đa dạng như trong sheet, không phải một cỡ duy nhất.
        const sizes = new Set(
            [...html.matchAll(/font-size:(\d+(?:\.\d+)?)pt/g)].map((m) => m[1]),
        );
        expect(sizes.size).toBeGreaterThan(2);
    });

    it("in tiêu đề pháp định lấy từ sharedStrings", () => {
        expect(html).toContain("TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG");
    });

    it("điền đúng số liệu, định dạng nghìn kiểu Việt Nam", () => {
        expect(html).toContain("36.610.654"); // [27] / [34]
        expect(html).toContain("548.804");     // [28] / [35]
        expect(html).toContain("197.558");     // [36] / [40]
    });

    it("kỳ tính thuế hiển thị dạng chữ, phân biệt tháng và quý", () => {
        expect(html).toContain("Tháng 02 năm 2026");
        const q = buildDeclarationPdfHtml(
            sheet, shared, stylesXml,
            buildDeclarationPatches({
                ...input,
                detail: { ...detail, period_type: "Q", period_value: 1 } as ApiVatDeclarationDetail,
            }),
            "q",
        );
        expect(q).toContain("Quý 1 năm 2026");
    });

    it("[02] đánh X khi khai lần đầu, [03] hiện số khi bổ sung", () => {
        expect(buildDeclarationPatches(input).F9).toBe("X");
        const s = buildDeclarationPatches({
            ...input,
            detail: { ...detail, suppl_no: 2 } as ApiVatDeclarationDetail,
        });
        expect(s.J9).toBe(2);
        expect(s.F9).toBeUndefined();
    });

    it("escape dữ liệu người dùng, không cho chèn thẻ", () => {
        const evil = buildDeclarationPdfHtml(
            sheet, shared, stylesXml,
            buildDeclarationPatches({
                ...input,
                meta: { ...meta, agentNm: '<script>alert(1)</script>' },
            }),
            "x",
        );
        expect(evil).not.toContain("<script>alert");
        expect(evil).toContain("&lt;script&gt;");
    });

    it("dùng đúng bộ patch của bản XLSX — hai file không thể lệch nhau", () => {
        const p = buildDeclarationPatches(input);
        expect(p.L59).toBe(197558);      // [40] thuế phải nộp
        expect(p.J45).toBe(36610654);    // [27]
        expect(p.L45).toBe(548804);      // [28]
        expect(p.D10).toBe("CÔNG TY TNHH WEBCASH VIỆT NAM");
    });

    it("tên file trùng gốc với bản XLSX", () => {
        expect(pdfFileName(detail)).toBe("WeCMS_VAT_Report_2026_M2");
    });
});
