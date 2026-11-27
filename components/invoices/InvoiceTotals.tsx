"use client";

import type { InvoiceKpis } from "@/lib/api/weinvoice/invoices";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fmtInvoiceAmount, fmtMoney } from "@/lib/weinvoice/format";

/**
 * Totals bar under the invoice table (UI Spec v1.2 §3.13, B9) — the same layout for purchase and sales: one row per
 * currency (invoices · Trước thuế · Tiền thuế · Phí / lệ phí · Tổng tiền · Tổng quy đổi (VND)) in that currency; with a
 * foreign currency or several currencies a last row "Tổng quy đổi (VND)" adds the VND amounts. No "VND" after the
 * numbers of the converted column. Totals cover the whole filtered list (server `kpis.by_currency`).
 */
export function InvoiceTotals({ kpis, count }: { kpis: InvoiceKpis; count: number }) {
    const { t } = useTranslation();
    const groups = kpis.byCurrency;
    const multi = groups.length > 1 || groups.some((g) => g.currency !== "VND");
    const cell = "px-3 py-1 text-right tabular-nums whitespace-nowrap";
    const head = "px-3 py-1 text-right font-medium whitespace-nowrap";
    const dash = <span className="font-normal text-wb-ntrl-5">—</span>;
    return (
        <div className="custom-scrollbar-x shrink-0 overflow-x-auto border-t border-wb-table-border bg-wb-bg-footer px-4 py-2 text-wb-13" data-testid="inv-totals">
            <table className="ml-auto">
                <thead>
                    <tr className="text-wb-12 text-wb-ntrl-6">
                        <th className="px-3 py-1 text-left font-semibold whitespace-nowrap text-wb-ntrl-8">{t("inv.footer_total", { n: count })}</th>
                        <th className={head}>{t("inv.col.pretax")}</th>
                        <th className={head}>{t("inv.col.tax")}</th>
                        <th className={head}>{t("inv.col.fee")}</th>
                        <th className={head}>{t("inv.col.total")}</th>
                        <th className={head}>{t("inv.col.total_vnd")}</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map((g) => (
                        <tr key={g.currency} data-testid="inv-total-cur">
                            <td className="px-3 py-1 whitespace-nowrap">
                                <span className={cn("rounded px-1.5 py-0.5 text-wb-11 font-bold", g.currency === "VND" ? "bg-white text-wb-ntrl-7 ring-1 ring-wb-border-sidebar" : "bg-wb-warn-bg text-wb-warn-text")}>{g.currency}</span>
                                <span className="ml-2 text-wb-12 text-wb-ntrl-6">{t("inv.fx_count", { n: g.count })}</span>
                            </td>
                            <td className={cell}>{fmtInvoiceAmount(g.preTax, g.currency)}</td>
                            <td className={cell}>{fmtInvoiceAmount(g.tax, g.currency)}</td>
                            <td className={cell} data-testid="inv-total-fee">{g.fee ? fmtInvoiceAmount(g.fee, g.currency) : dash}</td>
                            <td className={cn(cell, "font-semibold")}>{fmtInvoiceAmount(g.total, g.currency)}</td>
                            <td className={cn(cell, !multi && "font-semibold text-brand")}>{fmtMoney(g.totalVnd)}</td>
                        </tr>
                    ))}
                    {multi && (
                        <tr className="border-t border-wb-table-border font-semibold" data-testid="inv-total-vnd">
                            <td className="px-3 py-1 whitespace-nowrap">{t("inv.fx_total_vnd")}</td>
                            <td className={cell}>{fmtMoney(kpis.preTax)}</td>
                            <td className={cell}>{fmtMoney(kpis.tax)}</td>
                            <td className={cell}>{kpis.fee ? fmtMoney(kpis.fee) : dash}</td>
                            <td className={cell} />
                            <td className={cn(cell, "text-brand")}>{fmtMoney(kpis.total)}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
