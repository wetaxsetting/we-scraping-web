"use client";

import { lookupHref } from "@/lib/api/weinvoice/invoices";
import { fmtDate, fmtMoney } from "@/lib/weinvoice/format";
import { fullSymbol, isNoCode, type Invoice } from "@/lib/weinvoice/types";
import { cn } from "@/lib/utils";
import { vnMoneyWords } from "@/lib/weinvoice/vnwords";

/**
 * "Bản thể hiện" rendered from invoice data / XML — used when the vendor's
 * original PDF is not (yet) available, and by Tools → View invoice from XML.
 * Kept in Vietnamese on purpose: it reproduces the legal document.
 * Screen-only: printing goes through `printRenderedInvoice()` (lib/weinvoice/exporter.ts), which
 * prints `renderedHtml(inv)` in a popup — never this live DOM (CLAUDE.md §6d).
 */
export default function InvoiceSheet({ inv, className, diffWith }: { inv: Invoice; className?: string; diffWith?: Invoice }) {
    const rates = Array.from(new Set(inv.items.map((i) => i.vatRate)));
    const changed = (a: unknown, b: unknown) => diffWith !== undefined && a !== b;
    return (
        <div className={cn("mx-auto w-full max-w-[820px] bg-white p-8 font-serif text-wb-13 text-[#111] shadow-wb-card", className)}>
            <div className="relative border-[3px] border-double border-[#0b3c6f] p-6">
                {inv.status === "cancelled" && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="rotate-[-18deg] rounded border-4 border-red-600/50 px-6 py-1 text-wb-34 font-bold tracking-widest text-red-600/40">ĐÃ HUỶ</span>
                    </div>
                )}
                <div className="flex items-start justify-between gap-4">
                    <div className="w-[34%] text-wb-12 text-[#444]">
                        <div>Mẫu số: <b>{inv.templateNo}</b></div>
                        <div>Ký hiệu: <b>{fullSymbol(inv)}</b></div>
                        <div>
                            Số: <b className={cn("text-wb-15 text-red-700", changed(inv.number, diffWith?.number) && "bg-yellow-200")}>{inv.number}</b>
                        </div>
                    </div>
                    <div className="flex-1 text-center">
                        <div className="text-wb-18 font-bold tracking-wide text-[#0b3c6f]">HÓA ĐƠN GIÁ TRỊ GIA TĂNG</div>
                        <div className="italic">(VAT INVOICE)</div>
                        {inv.status === "replacement" && <div className="mt-1 text-wb-12 font-bold text-red-700">(Hóa đơn thay thế)</div>}
                        <div className={cn("mt-1", changed(inv.issueDate, diffWith?.issueDate) && "bg-yellow-200")}>
                            Ngày {inv.issueDate.slice(8, 10)} tháng {inv.issueDate.slice(5, 7)} năm {inv.issueDate.slice(0, 4)}
                        </div>
                        <div className="mt-1 text-wb-11 text-[#444]">
                            {isNoCode(inv) ? "Hóa đơn không có mã của CQT" : <>Mã của CQT: <span className="font-mono">{inv.cqtCode || "—"}</span></>}
                        </div>
                    </div>
                    <div className="w-[20%]" />
                </div>

                <div className="mt-4 border-t border-[#0b3c6f]/40 pt-3">
                    <Row label="Đơn vị bán hàng" value={<b>{inv.sellerName}</b>} />
                    <Row label="Mã số thuế" value={<span className="font-mono tracking-wider">{inv.sellerTaxId}</span>} />
                    <Row label="Địa chỉ" value={inv.sellerAddress} />
                </div>
                <div className="mt-2 border-t border-dashed border-[#0b3c6f]/30 pt-2">
                    <Row label="Đơn vị mua hàng" value={<b>{inv.buyerName}</b>} />
                    <Row label="Mã số thuế" value={<span className="font-mono tracking-wider">{inv.buyerTaxId}</span>} />
                    <Row label="Địa chỉ" value={inv.buyerAddress} />
                    <Row label="Hình thức thanh toán" value={inv.paymentMethod} />
                </div>

                <table className="mt-3 w-full border-collapse text-wb-12">
                    <thead>
                        <tr className="bg-[#eef4fb] text-[#0b3c6f]">
                            {["STT", "Tên hàng hóa, dịch vụ", "ĐVT", "Số lượng", "Đơn giá", "Thuế suất", "Thành tiền"].map((h) => (
                                <th key={h} className="border border-[#9fb6cf] px-1.5 py-1 font-bold">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {inv.items.map((it, i) => {
                            const other = diffWith?.items[i];
                            const diff = other && (other.price !== it.price || other.qty !== it.qty || other.amount !== it.amount);
                            return (
                                <tr key={i} className={cn(diff && "bg-yellow-100")}>
                                    <td className="border border-[#9fb6cf] px-1.5 py-1 text-center">{i + 1}</td>
                                    <td className="border border-[#9fb6cf] px-1.5 py-1">{it.name}</td>
                                    <td className="border border-[#9fb6cf] px-1.5 py-1 text-center">{it.unit}</td>
                                    <td className="border border-[#9fb6cf] px-1.5 py-1 text-right">{fmtMoney(it.qty)}</td>
                                    <td className="border border-[#9fb6cf] px-1.5 py-1 text-right">{fmtMoney(it.price)}</td>
                                    <td className="border border-[#9fb6cf] px-1.5 py-1 text-center">{it.vatRate < 0 ? "KCT" : `${it.vatRate}%`}</td>
                                    <td className="border border-[#9fb6cf] px-1.5 py-1 text-right">{fmtMoney(it.amount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="mt-2 ml-auto w-[62%] text-wb-13">
                    <Sum label="Cộng tiền hàng" v={inv.preTax} hl={changed(inv.preTax, diffWith?.preTax)} />
                    <Sum label={`Tiền thuế GTGT (${rates.map((r) => (r < 0 ? "KCT" : `${r}%`)).join(", ")})`} v={inv.tax} hl={changed(inv.tax, diffWith?.tax)} />
                    <Sum label="Tổng cộng tiền thanh toán" v={inv.total} bold hl={changed(inv.total, diffWith?.total)} />
                </div>
                <div className="mt-1">
                    Số tiền viết bằng chữ: <i>{vnMoneyWords(inv.total)}</i>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-6 text-center text-wb-12">
                    <div>
                        <b>Người mua hàng</b>
                        <div className="italic text-[#666]">(Ký, ghi rõ họ tên)</div>
                    </div>
                    <div>
                        <b>Người bán hàng</b>
                        <div className="mx-auto mt-2 w-fit rounded border-2 border-green-600/70 px-3 py-1 text-left text-wb-11 text-green-700">
                            Signature Valid
                            <br />
                            Ký bởi: {inv.sellerName.slice(0, 38)}
                            <br />
                            Ký ngày: {fmtDate(inv.issueDate)}
                        </div>
                    </div>
                </div>
                <div className="mt-6 border-t border-[#0b3c6f]/30 pt-2 text-center text-wb-11 text-[#666]">
                    Tra cứu tại: {lookupHref(inv).url || "—"} · Mã tra cứu: <b>{inv.lookupCode || "—"}</b> · Phát hành bởi: {inv.provider || "—"}
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex gap-2">
            <span className="w-[150px] shrink-0 text-[#444]">{label}:</span>
            <span className="min-w-0 flex-1">{value}</span>
        </div>
    );
}

function Sum({ label, v, bold, hl }: { label: string; v: number; bold?: boolean; hl?: boolean }) {
    return (
        <div className={cn("flex justify-between border-b border-dotted border-[#9fb6cf] py-0.5", bold && "font-bold", hl && "bg-yellow-200")}>
            <span>{label}:</span>
            <span>{fmtMoney(v)}</span>
        </div>
    );
}
