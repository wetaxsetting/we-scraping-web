/*
 * Invoice exports — WeInvoice UI Spec v1.0 (P1), screen 04.
 *
 * api (DATA_SOURCE === "api"): the backend produces both files (CLAUDE.md §13b) — interface
 *   specification § "Invoices (screens 04, 05)":
 *   `POST /invoices/export/excel` — body = the `/invoices` filter (`InvoiceFilter`, snake_case; `ids`
 *   exports a selection) → XLSX, `WBE3021` above 50 000 rows;
 *   `POST /invoices/export/zip` — `{company_mst, ids (≤ 2000), mode, include ⊆ xml·pdf·summary}` → ZIP
 *   (streamed). The server has no rendered copy (`rendered` is skipped), so it is never requested and
 *   the dialog hides that option in api mode. The browser only downloads the files.
 *
 * mock (default):
 * - `renderedHtml` / `buildZip` run fully in the browser: they only package data the UI already
 *   holds (XML text, rendered HTML, original PDFs kept as object URLs) with the installed `jszip`.
 * - `exportExcel` deliberately does NOT build a workbook: CLAUDE.md §13b makes the backend the
 *   single XLSX producer. Until the WeInvoice export endpoint exists it reports "server only",
 *   and the ZIP "listing" is an HTML table instead of an Excel sheet for the same reason.
 * Swapping to the real backend touches this file and lib/api/weinvoice/ only.
 */

import JSZip from "jszip";

import { fileBaseName, partnerOf, xmlContent } from "@/lib/api/weinvoice/invoices";
import { WeInvoiceApiError, wiDownload } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState } from "@/lib/api/weinvoice/store";
import { downloadBlob } from "@/lib/utils";
import { fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { fullSymbol, isNoCode, type Direction, type Invoice } from "@/lib/weinvoice/types";
import { vnMoneyWords } from "@/lib/weinvoice/vnwords";

export type ZipMode = "flat" | "by_month" | "by_partner" | "by_month_partner" | "per_invoice";

export type ZipOptions = { mode: ZipMode; xml: boolean; rendered: boolean; summary: boolean; pdf?: boolean };

/** Characters Windows / macOS refuse in a path segment, plus control chars; trimmed + capped. */
const safe = (s: string): string =>
    s
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/, "")
        .trim()
        .slice(0, 80) || "_";

const esc = (s: string | number | undefined | null): string =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/** Folder (with trailing "/") an invoice's files go into for the chosen packaging mode (§3.6). */
function folderFor(inv: Invoice, mode: ZipMode): string {
    const month = inv.issueDate.slice(0, 7);
    const p = partnerOf(inv);
    const partner = safe(`${p.taxId} - ${p.name}`);
    switch (mode) {
        case "flat":
            return "";
        case "by_month":
            return `${month}/`;
        case "by_partner":
            return `${partner}/`;
        case "by_month_partner":
            return `${month}/${partner}/`;
        case "per_invoice":
            return `${safe(fileBaseName(inv))}/`;
    }
}

const STATUS_VI: Record<Invoice["status"], string> = {
    original: "Hoá đơn gốc",
    replacement: "Hoá đơn thay thế",
    replaced: "Hoá đơn bị thay thế",
    adjustment: "Hoá đơn điều chỉnh",
    adjusted: "Hoá đơn bị điều chỉnh",
    cancelled: "Hoá đơn đã huỷ",
};

const rateLabel = (r: number) => (r < 0 ? "KCT" : `${r}%`);

/**
 * Self-contained, printable "bản thể hiện" of the invoice. Kept in Vietnamese on purpose (it
 * reproduces the legal document, same as <InvoiceSheet>). Every value is HTML-escaped.
 */
export function renderedHtml(inv: Invoice): string {
    const rates = Array.from(new Set(inv.items.map((i) => i.vatRate))).map(rateLabel).join(", ");
    const items = inv.items
        .map(
            (it, i) => `<tr><td class="c">${i + 1}</td><td>${esc(it.name)}</td><td class="c">${esc(it.unit)}</td><td class="r">${esc(fmtMoney(it.qty))}</td><td class="r">${esc(fmtMoney(it.price))}</td><td class="c">${esc(rateLabel(it.vatRate))}</td><td class="r">${esc(fmtMoney(it.amount))}</td></tr>`,
        )
        .join("");
    const [y, m, d] = [inv.issueDate.slice(0, 4), inv.issueDate.slice(5, 7), inv.issueDate.slice(8, 10)];
    const title = `${fullSymbol(inv)} - ${inv.number}`;
    return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
@page{size:A4 portrait;margin:12mm}
body{margin:0;background:#fff;color:#111;font-family:"Times New Roman",Times,serif;font-size:13px;line-height:1.55}
.sheet{max-width:820px;margin:16px auto;border:3px double #0b3c6f;padding:24px;position:relative}
.top{display:flex;justify-content:space-between;gap:16px}
.meta{width:34%;font-size:12px;color:#444}.mid{flex:1;text-align:center}
h1{margin:0;font-size:19px;color:#0b3c6f;letter-spacing:.5px}
.no{color:#b91c1c;font-size:15px}.muted{color:#444;font-size:11px}
.blk{margin-top:12px;border-top:1px solid rgba(11,60,111,.4);padding-top:8px}
.row{display:flex;gap:8px}.row span:first-child{width:150px;flex-shrink:0;color:#444}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th,td{border:1px solid #9fb6cf;padding:4px 6px}th{background:#eef4fb;color:#0b3c6f}
.c{text-align:center}.r{text-align:right}
.sum{margin:8px 0 0 auto;width:62%}.sum div{display:flex;justify-content:space-between;border-bottom:1px dotted #9fb6cf;padding:2px 0}
.b{font-weight:bold}.sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;text-align:center;font-size:12px}
.foot{margin-top:24px;border-top:1px solid rgba(11,60,111,.3);padding-top:8px;text-align:center;font-size:11px;color:#666}
.void{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.void span{transform:rotate(-18deg);border:4px solid rgba(220,38,38,.5);color:rgba(220,38,38,.4);font-size:48px;font-weight:bold;padding:4px 24px;letter-spacing:4px}
</style></head>
<body><div class="sheet">
${inv.status === "cancelled" ? '<div class="void"><span>ĐÃ HUỶ</span></div>' : ""}
<div class="top">
<div class="meta"><div>Mẫu số: <b>${esc(inv.templateNo)}</b></div><div>Ký hiệu: <b>${esc(fullSymbol(inv))}</b></div><div>Số: <b class="no">${esc(inv.number)}</b></div></div>
<div class="mid"><h1>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</h1><div><i>(VAT INVOICE)</i></div>
${inv.status !== "original" ? `<div class="b" style="color:#b91c1c;font-size:12px">(${esc(STATUS_VI[inv.status])})</div>` : ""}
<div>Ngày ${esc(d)} tháng ${esc(m)} năm ${esc(y)}</div>
<div class="muted">${isNoCode(inv) ? "Hóa đơn không có mã của CQT" : `Mã của CQT: ${esc(inv.cqtCode || "—")}`}</div></div>
<div style="width:20%"></div>
</div>
<div class="blk">
<div class="row"><span>Đơn vị bán hàng:</span><b>${esc(inv.sellerName)}</b></div>
<div class="row"><span>Mã số thuế:</span><span>${esc(inv.sellerTaxId)}</span></div>
<div class="row"><span>Địa chỉ:</span><span>${esc(inv.sellerAddress)}</span></div>
</div>
<div class="blk">
<div class="row"><span>Đơn vị mua hàng:</span><b>${esc(inv.buyerName)}</b></div>
<div class="row"><span>Mã số thuế:</span><span>${esc(inv.buyerTaxId)}</span></div>
<div class="row"><span>Địa chỉ:</span><span>${esc(inv.buyerAddress)}</span></div>
<div class="row"><span>Hình thức thanh toán:</span><span>${esc(inv.paymentMethod)}</span></div>
</div>
<table><thead><tr><th>STT</th><th>Tên hàng hóa, dịch vụ</th><th>ĐVT</th><th>Số lượng</th><th>Đơn giá</th><th>Thuế suất</th><th>Thành tiền</th></tr></thead>
<tbody>${items}</tbody></table>
<div class="sum">
<div><span>Cộng tiền hàng:</span><span>${esc(fmtMoney(inv.preTax))}</span></div>
<div><span>Tiền thuế GTGT (${esc(rates)}):</span><span>${esc(fmtMoney(inv.tax))}</span></div>
<div class="b"><span>Tổng cộng tiền thanh toán:</span><span>${esc(fmtMoney(inv.total))}</span></div>
</div>
<div>Số tiền viết bằng chữ: <i>${esc(vnMoneyWords(inv.total))}</i></div>
<div class="sign"><div><b>Người mua hàng</b><div><i>(Ký, ghi rõ họ tên)</i></div></div>
<div><b>Người bán hàng</b><div class="muted">Ký bởi: ${esc(inv.sellerName)}<br>Ký ngày: ${esc(fmtDate(inv.issueDate))}</div></div></div>
<div class="foot">Mã tra cứu: <b>${esc(inv.lookupCode || "—")}</b> · Phát hành bởi: ${esc(inv.provider || "—")} · Bản thể hiện tạo từ dữ liệu hoá đơn (WeInvoice)</div>
</div></body></html>`;
}

/** HTML listing ("bảng kê") of the packaged invoices — replaces the spec's Excel listing (no frontend workbooks, §13b). */
function summaryHtml(invoices: Invoice[]): string {
    const rows = invoices
        .map((inv, i) => {
            const p = partnerOf(inv);
            const rates = Array.from(new Set(inv.items.map((x) => x.vatRate))).map(rateLabel).join(", ");
            return `<tr><td class="c">${i + 1}</td><td>${esc(fmtDate(inv.issueDate))}</td><td>${esc(inv.templateNo)}</td><td>${esc(inv.symbol)}</td><td>${esc(inv.number)}</td><td>${esc(p.taxId)}</td><td>${esc(p.name)}</td><td class="r">${esc(fmtMoney(inv.preTax))}</td><td class="r">${esc(fmtMoney(inv.tax))}</td><td class="r">${esc(fmtMoney(inv.total))}</td><td>${esc(rates)}</td><td>${esc(STATUS_VI[inv.status])}</td><td>${esc(inv.cqtCode)}</td><td class="c">${inv.files.some((f) => f.kind === "xml") ? "Có" : "Không"}</td><td class="c">${inv.files.some((f) => f.kind === "pdf") ? "Có" : "Không"}</td><td>${esc(inv.provider)}</td><td>${esc(inv.lookupCode)}</td></tr>`;
        })
        .join("");
    const sum = (k: "preTax" | "tax" | "total") => fmtMoney(invoices.reduce((s, i) => s + i[k], 0));
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bảng kê hoá đơn</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:16px}table{border-collapse:collapse}th,td{border:1px solid #bbb;padding:3px 6px;white-space:nowrap}th{background:#eef4fb}.r{text-align:right}.c{text-align:center}tfoot td{font-weight:bold}</style></head>
<body><h2>Bảng kê hoá đơn — ${invoices.length} hoá đơn</h2><table><thead><tr><th>STT</th><th>Ngày lập</th><th>Mẫu số</th><th>Ký hiệu</th><th>Số HĐ</th><th>MST đối tác</th><th>Tên đối tác</th><th>Tiền trước thuế</th><th>Tiền thuế</th><th>Tổng tiền</th><th>Thuế suất</th><th>Trạng thái</th><th>Mã CQT</th><th>XML</th><th>PDF</th><th>Phát hành qua</th><th>Mã tra cứu</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><td colspan="7">Tổng cộng</td><td class="r">${esc(sum("preTax"))}</td><td class="r">${esc(sum("tax"))}</td><td class="r">${esc(sum("total"))}</td><td colspan="7"></td></tr></tfoot></table></body></html>`;
}

/**
 * Real ZIP of the selected invoices in one of the 5 packaging modes (§3.6). Options: XML, original
 * PDF (only those already held as a URL), rendered HTML copy, HTML listing. Invoices without XML are
 * counted in `missing` and listed in README.txt.
 */
export async function buildZip(invoices: Invoice[], opt: ZipOptions, onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; missing: number; fileName?: string }> {
    if (DATA_SOURCE === "api") {
        // `rendered` is browser-only (the server skips it); `summary` is an Excel listing on the server.
        const include = (["xml", "pdf", "summary"] as const).filter((k) => opt[k]);
        // An empty `include` would make the server default to xml + pdf — never send one.
        if (!include.length) throw new WeInvoiceApiError("WBE_VALIDATION", "Nothing selected to package.");
        const { blob, fileName } = await wiDownload("post", "/invoices/export/zip", {
            body: { companyMst: getState().activeTaxId || undefined, ids: invoices.map((i) => i.id), mode: opt.mode, include },
            fallbackName: `WeInvoice_${invoices.length}HD_${new Date().toISOString().slice(0, 10)}.zip`,
        });
        onProgress?.(invoices.length, invoices.length);
        // OPEN: the ZIP response does not report how many invoices had no XML — `missing` stays 0.
        return { blob, missing: 0, fileName };
    }
    const zip = new JSZip();
    const missingList: string[] = [];
    const total = invoices.length;
    let done = 0;
    for (const inv of invoices) {
        const dir = folderFor(inv, opt.mode);
        const base = safe(fileBaseName(inv));
        if (opt.xml) {
            const x = xmlContent(inv);
            if (x) zip.file(`${dir}${base}.xml`, x);
            else missingList.push(`${base}${isNoCode(inv) ? " (không mã CQT)" : ""}`);
        }
        if (opt.pdf) {
            const pdf = inv.files.find((f) => f.kind === "pdf" && f.url);
            if (pdf?.url) {
                try {
                    const res = await fetch(pdf.url);
                    if (res.ok) zip.file(`${dir}${base}.pdf`, await res.arrayBuffer());
                } catch {
                    /* URL revoked / unreachable — skip, the listing still records it */
                }
            }
        }
        if (opt.rendered) zip.file(`${dir}${base}.html`, renderedHtml(inv));
        done++;
        onProgress?.(done, total);
        // Yield so the progress bar can paint on large selections.
        if (done % 25 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    if (opt.summary) zip.file("BangKe_HoaDon.html", summaryHtml(invoices));
    if (missingList.length) {
        zip.file(
            "README.txt",
            [`${missingList.length} hoá đơn chưa có XML (chưa được đóng gói XML):`, ...missingList.map((s) => `- ${s}`), "", "Dùng \"Lấy XML còn thiếu\" trên danh sách hoá đơn rồi tải lại."].join("\r\n"),
        );
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return { blob, missing: missingList.length };
}

export type ExcelExportResult = { ok: true; fileName: string } | { ok: false; reason: "server_only" };

/** Optional list filter sent with the Excel selection (title / sub-header of the workbook). */
export type ExcelFilter = { direction?: Direction; from?: string; to?: string };

/**
 * Excel export is backend-owned (CLAUDE.md §13b) — nothing is generated in the browser.
 * api mode: `POST /invoices/export/excel` with the list filter (`company_mst`, `direction`, `from`,
 * `to`) and `ids` (the selection) → the .xlsx is downloaded.
 * mock mode: no endpoint → `server_only`; callers tell the user (inv.excel_unavailable).
 */
export async function exportExcel(invoices: Invoice[], filename: string, filter: ExcelFilter = {}): Promise<ExcelExportResult> {
    if (DATA_SOURCE === "api") {
        const { blob, fileName } = await wiDownload("post", "/invoices/export/excel", {
            body: { companyMst: getState().activeTaxId || undefined, direction: filter.direction, from: filter.from, to: filter.to, ids: invoices.map((i) => i.id) },
            fallbackName: filename,
        });
        downloadBlob(blob, fileName);
        return { ok: true, fileName };
    }
    return { ok: false, reason: "server_only" };
}

/**
 * Print the rendered copy in its own popup window (CLAUDE.md §6d: never `window.print()` the live
 * DOM, no per-page print CSS). Returns false when the popup was blocked so the caller can tell the user.
 */
export function printRenderedInvoice(inv: Invoice): boolean {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return false;
    w.document.open();
    w.document.write(renderedHtml(inv));
    w.document.close();
    const go = () => {
        w.focus();
        w.print();
    };
    if (w.document.readyState === "complete") setTimeout(go, 50);
    else w.addEventListener("load", go, { once: true });
    return true;
}
