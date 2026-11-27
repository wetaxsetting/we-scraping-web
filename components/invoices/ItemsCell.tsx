"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { apiErrorText } from "@/components/invoices/apiError";
import { useDialog } from "@/components/shared/dialog";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import type { DialogStackLevel } from "@/components/ui/dialog";
import { exchangeRateOf, feeOf, getInvoice, itemNamesOf, lineTaxOf, loadInvoiceDetail, partnerOf, vndOf } from "@/lib/api/weinvoice/invoices";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { useStore } from "@/lib/api/weinvoice/store";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fmtInvoiceAmount, fmtMoney, fmtPrice, fmtQty, fmtRate, invoiceCurrency, vatRateText } from "@/lib/weinvoice/format";
import { fullSymbol, type Invoice } from "@/lib/weinvoice/types";

/**
 * "Hàng hoá / dịch vụ" cell of the invoice list (UI Spec v1.2 B7): a few item names (2 lines); hover → the lines
 * "1/n, 2/n …"; click → popup "Chi tiết hàng hoá" (B8). api rows carry the first 3 names + the line count; the
 * popup loads the detail for the full lines and fees.
 */
export function ItemsCell({ inv }: { inv: Invoice }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);
    const { names, count } = itemNamesOf(inv);
    if (!count) return <span className="text-wb-12 text-wb-ntrl-5">{t("it.none")}</span>;
    const show = (e: React.MouseEvent) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setTip({ x: Math.max(8, Math.min(r.left, window.innerWidth - 340)), y: r.bottom + 4 > window.innerHeight - 300 ? Math.max(8, r.top - 304) : r.bottom + 4 }), 250);
    };
    const hide = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setTip(null), 150);
    };
    // The tooltip and the popup are portals: React still bubbles their events to the table row, whose click opens the
    // invoice detail — stop them here.
    return (
        <span onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                data-ignore-row-click
                data-testid="items-cell"
                onClick={(e) => {
                    e.stopPropagation();
                    setTip(null);
                    setOpen(true);
                }}
                onMouseEnter={show}
                onMouseLeave={hide}
                className="line-clamp-2 cursor-pointer text-left text-wb-12 text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
            >
                {names.join(" / ")}
                {count > names.length && <span className="text-wb-ntrl-6"> {t("it.more", { n: count - names.length })}</span>}
            </button>
            {tip &&
                createPortal(
                    <div
                        style={{ position: "fixed", left: tip.x, top: tip.y }}
                        onMouseEnter={() => timer.current && clearTimeout(timer.current)}
                        onMouseLeave={hide}
                        data-testid="items-tip"
                        className="custom-scrollbar z-50 max-h-[300px] w-[330px] overflow-auto rounded-lg bg-white py-1 shadow-wb-popup ring-1 ring-black/5"
                    >
                        {names.map((name, i) => (
                            <div key={i} className="border-b border-wb-border-sidebar px-3 py-2 last:border-0">
                                <div className="flex justify-end text-wb-11 font-semibold text-wb-ntrl-6">
                                    {i + 1}/{count}
                                </div>
                                <p className="text-wb-13 text-wb-ink">{name}</p>
                            </div>
                        ))}
                        {count > names.length && <p className="px-3 py-2 text-wb-12 text-wb-ntrl-6">{t("it.more_click", { n: count - names.length })}</p>}
                    </div>,
                    document.body,
                )}
            {open && <ItemsModal id={inv.id} onClose={() => setOpen(false)} />}
        </span>
    );
}

/**
 * Popup "Chi tiết hàng hoá" (B8, §3.14): STT · Loại dòng · Mã hàng · Tên · ĐVT · SL · Đơn giá · Chiết khấu · Thuế suất ·
 * Thành tiền · Tiền thuế · Tổng (+ VND for a foreign currency); fee lines "Không thuế"; footer Cộng tiền hàng →
 * Phí / lệ phí → Tổng thanh toán; "Trên hoá đơn: …" and a warning when the sums disagree.
 */
export function ItemsModal({ id, onClose, stackLevel }: { id: string; onClose: () => void; stackLevel?: DialogStackLevel }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    useStore((s) => s.invoices); // re-render when the detail arrives
    const [wide, setWide] = useState(false);
    const [loading, setLoading] = useState(DATA_SOURCE === "api");
    useEffect(() => {
        if (DATA_SOURCE !== "api") return;
        let live = true;
        loadInvoiceDetail(id)
            .catch((err) => toast(apiErrorText(err, t), "error"))
            .finally(() => live && setLoading(false));
        return () => {
            live = false;
        };
    }, [id, t, toast]);
    const inv = getInvoice(id);
    if (!inv) return null;
    return (
        <Modal
            open
            onClose={onClose}
            width={wide ? "96vw" : 1100}
            stackLevel={stackLevel}
            title={
                <span className="flex items-center gap-3">
                    {t("it.title")}
                    <button type="button" onClick={() => setWide((w) => !w)} className="cursor-pointer rounded p-1 text-wb-ntrl-6 hover:bg-wb-bg-sidebar" title={t("it.expand")} aria-label={t("it.expand")}>
                        {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                    </button>
                </span>
            }
            footer={
                <Button size="md" variant="neutral" onClick={onClose}>
                    {t("common.close")}
                </Button>
            }
        >
            <ItemsTable inv={inv} loading={loading && !inv.items.length} />
        </Modal>
    );
}

/** The lines table of the popup (exported for tests). */
export function ItemsTable({ inv, loading }: { inv: Invoice; loading?: boolean }) {
    const { t } = useTranslation();
    const ccy = invoiceCurrency(inv.currency);
    const fc = ccy !== "VND";
    const rate = exchangeRateOf(inv);
    const m = (v: number) => fmtInvoiceAmount(v, ccy);
    const vnd = (v: number) => {
        const x = vndOf(inv, v);
        return x == null ? "" : fmtMoney(x);
    };
    const rows = inv.items.map((it) => ({ it, note: it.kind === "note", amt: it.amount, tax: lineTaxOf(inv, it) }));
    const sum = rows.reduce((a, r) => (r.note ? a : { a: a.a + r.amt, x: a.x + r.tax }), { a: 0, x: 0 });
    const fees = inv.fees ?? [];
    const feeSum = feeOf(inv);
    const hasCode = inv.items.some((i) => i.code);
    const lead = hasCode ? 5 : 4; // STT · Loại dòng · (Mã hàng) · Tên · ĐVT
    const tol = fc ? 0.01 : 1;
    // §3.14 "Lệch tổng thanh toán": pre-tax + tax + fee ≠ total, or the lines (+ fees) do not add up to the total
    const diff = Math.abs(inv.preTax + inv.tax + feeSum - inv.total) > tol || (rows.length > 0 && Math.abs(sum.a + sum.x + feeSum - inv.total) > tol);
    const p = partnerOf(inv);
    const th = "px-2 py-2 text-left font-semibold whitespace-nowrap";
    const td = "px-2 py-1.5 align-top";
    const num = cn(td, "text-right tabular-nums");
    return (
        <div data-testid="items-modal">
            <p className="mb-2 text-wb-13 text-wb-ntrl-7">
                <b className="text-wb-ink">
                    {fullSymbol(inv)} · {inv.number}
                </b>{" "}
                · {p.name} · {t("common.mst")} {p.taxId}
                {fc && (
                    <>
                        {" "}
                        · <b>{ccy}</b> · {t("inv.fx_rate")} {rate == null ? <span className="text-wb-status-rejected-text">{t("inv.fx_missing")}</span> : fmtRate(rate)}
                    </>
                )}
            </p>
            <div className="custom-scrollbar max-h-[60vh] overflow-auto rounded-md ring-1 ring-wb-table-border">
                <table className="w-full min-w-[900px] border-collapse text-wb-13">
                    <thead className="sticky top-0 bg-wb-bg-sidebar text-wb-12 text-wb-ntrl-8">
                        <tr>
                            <th className={th}>{t("it.c.no")}</th>
                            <th className={th}>{t("it.c.kind")}</th>
                            {hasCode && <th className={th}>{t("it.c.code")}</th>}
                            <th className={cn(th, "min-w-[240px]")}>{t("it.c.name")}</th>
                            <th className={th}>{t("it.c.unit")}</th>
                            <th className={cn(th, "text-right")}>{t("it.c.qty")}</th>
                            <th className={cn(th, "text-right")}>{t("it.c.price")}</th>
                            <th className={cn(th, "text-right")}>{t("it.c.discount")}</th>
                            <th className={cn(th, "text-right")}>{t("it.c.vat_rate")}</th>
                            <th className={cn(th, "text-right")}>{t("it.c.amount")}</th>
                            <th className={cn(th, "text-right")}>{t("it.c.vat")}</th>
                            <th className={cn(th, "text-right")}>{t("it.c.total")}</th>
                            {fc && <th className={cn(th, "text-right")}>{t("it.c.total_vnd")}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ it, note, amt, tax }, i) => (
                            <tr key={i} data-testid="items-row" className={cn("border-t border-wb-table-border", note && "text-wb-ntrl-6", it.kind === "discount" && "text-wb-status-rejected-text")}>
                                <td className={td}>{i + 1}</td>
                                <td className={cn(td, "whitespace-nowrap")}>{t(`it.kind.${it.kind ?? "goods"}`)}</td>
                                {hasCode && <td className={cn(td, "font-mono text-wb-12 text-wb-ntrl-7")}>{it.code ?? ""}</td>}
                                <td className={td}>{it.name}</td>
                                <td className={td}>{it.unit}</td>
                                <td className={num}>{note ? "" : fmtQty(it.qty)}</td>
                                <td className={num}>{note ? "" : fmtPrice(it.price, ccy)}</td>
                                <td className={num}>{note ? "" : it.discount ? m(it.discount) : "0"}</td>
                                <td className={cn(td, "text-right")}>{note ? "" : it.vatLabel || vatRateText(it.vatRate)}</td>
                                <td className={num}>{note ? "" : m(amt)}</td>
                                <td className={num}>{note ? "" : m(tax)}</td>
                                <td className={cn(num, "font-semibold")}>{note ? "" : m(amt + tax)}</td>
                                {fc && <td className={num}>{note ? "" : vnd(amt + tax)}</td>}
                            </tr>
                        ))}
                        {fees.map((f, k) => (
                            <tr key={`f${k}`} className="border-t border-wb-table-border bg-wb-warn-bg/40" data-testid="items-fee">
                                <td className={td}>{k + 1}</td>
                                <td className={cn(td, "whitespace-nowrap")}>
                                    <span className="rounded bg-wb-warn-bg px-1 text-wb-11 font-semibold text-wb-warn-text">{t("it.kind.fee")}</span>
                                </td>
                                {hasCode && <td className={td} />}
                                <td className={td} colSpan={5}>
                                    {f.name}
                                </td>
                                <td className={cn(td, "text-right text-wb-12 whitespace-nowrap text-wb-ntrl-6")}>{t("it.no_vat")}</td>
                                <td className={num}>{m(f.amount)}</td>
                                <td className={cn(num, "text-wb-ntrl-6")}>0</td>
                                <td className={cn(num, "font-semibold")}>{m(f.amount)}</td>
                                {fc && <td className={num}>{vnd(f.amount)}</td>}
                            </tr>
                        ))}
                        {!rows.length && !fees.length && (
                            <tr>
                                <td colSpan={lead + 8 + (fc ? 1 : 0)} className="px-2 py-6 text-center text-wb-ntrl-6">
                                    {loading ? t("common.loading") : t("it.none")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {rows.length + fees.length > 0 && (
                        <tfoot className="bg-wb-bg-sidebar font-semibold">
                            {feeSum !== 0 && (
                                <tr className="border-t border-wb-table-border font-medium" data-testid="items-sub-items">
                                    <td className={td} colSpan={lead + 4}>
                                        {t("it.sub_items")}
                                    </td>
                                    <td className={num}>{m(sum.a)}</td>
                                    <td className={num}>{m(sum.x)}</td>
                                    <td className={num}>{m(sum.a + sum.x)}</td>
                                    {fc && <td className={num}>{vnd(sum.a + sum.x)}</td>}
                                </tr>
                            )}
                            {feeSum !== 0 && (
                                <tr className="border-t border-wb-table-border font-medium" data-testid="items-sub-fees">
                                    <td className={td} colSpan={lead + 4}>
                                        {t("it.sub_fees")}
                                    </td>
                                    <td className={num}>{m(feeSum)}</td>
                                    <td className={num}>0</td>
                                    <td className={num}>{m(feeSum)}</td>
                                    {fc && <td className={num}>{vnd(feeSum)}</td>}
                                </tr>
                            )}
                            <tr className="border-t border-wb-table-border" data-testid="items-total">
                                <td className={td} colSpan={lead + 4}>
                                    {feeSum !== 0 ? t("it.grand_total") : t("it.total")}
                                </td>
                                <td className={num}>{m(sum.a + feeSum)}</td>
                                <td className={num}>{m(sum.x)}</td>
                                <td className={num}>{m(sum.a + sum.x + feeSum)}</td>
                                {fc && <td className={num}>{vnd(sum.a + sum.x + feeSum)}</td>}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            <p className={cn("mt-2 text-wb-12", diff ? "text-wb-warn-text" : "text-wb-ntrl-6")} data-testid="items-on-invoice">
                {feeSum !== 0
                    ? t("it.invoice_total_fee", { a: m(inv.preTax), x: m(inv.tax), f: m(feeSum), s: m(inv.total), c: ccy })
                    : t("it.invoice_total", { a: m(inv.preTax), x: m(inv.tax), s: m(inv.total), c: ccy })}
                {diff && ` — ⚠ ${t("it.diff")}`}
            </p>
        </div>
    );
}
