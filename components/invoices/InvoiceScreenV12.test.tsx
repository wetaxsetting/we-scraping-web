import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/invoices/purchase",
}));

import { mergeViewColumns } from "@/components/invoices/ColumnSetting";
import { AmountSummary, RelatedInfo } from "@/components/invoices/InvoiceDetailModal";
import InvoiceSheet from "@/components/invoices/InvoiceSheet";
import { InvoiceTotals } from "@/components/invoices/InvoiceTotals";
import { ItemsCell, ItemsTable } from "@/components/invoices/ItemsCell";
import { DialogProvider } from "@/components/shared/dialog";
import type { ApiInvoice, InvoiceKpis } from "@/lib/api/weinvoice/invoices";
import { resetState, setState } from "@/lib/api/weinvoice/store";
import { LocaleProvider } from "@/lib/i18n";
import { renderedHtml } from "@/lib/weinvoice/exporter";
import type { Invoice } from "@/lib/weinvoice/types";

// docs/features/weinvoice/weinvoice-invoice-screen-v1-2-2026-11-27.md — UI Spec v1.2 B7–B11, C1–C3.

const base: ApiInvoice = {
    id: "i1", direction: "purchase", issueDate: "2026-11-05", templateNo: "1", symbol: "C26TAA", number: "12",
    sellerTaxId: "0300000009", sellerName: "NCC An Phát", sellerAddress: "", buyerTaxId: "0100000001", buyerName: "Cty",
    buyerAddress: "", currency: "VND", preTax: 300_000, tax: 24_000, total: 334_000, status: "original", cqtCode: "M1",
    provider: "", lookupCode: "", lookupUrl: "", paymentMethod: "TM/CK",
    items: [
        { name: "Bút bi", unit: "Hộp", qty: 1.5, price: 133_333.333333, amount: 200_000, vatRate: 8, kind: "goods", code: "SP01", taxAmount: 16_000, vatLabel: "8%" },
        { name: "Giấy A4", unit: "Ram", qty: 2, price: 50_000, amount: 100_000, vatRate: 8, kind: "goods", code: "SP02", taxAmount: 8_000, vatLabel: "8%" },
        { name: "Hàng tặng kèm", unit: "", qty: 0, price: 0, amount: 0, vatRate: 0, kind: "note" },
    ],
    files: [], tags: [], source: "gdt", syncedAt: "", exchangeRate: 1, totalVnd: 334_000,
    fee: 10_000, fees: [{ name: "Phí giao hàng", amount: 10_000 }], tradeDiscount: 5_000,
} as ApiInvoice;

const inLocale = (ui: React.ReactNode) =>
    render(
        <LocaleProvider>
            <DialogProvider>{ui}</DialogProvider>
        </LocaleProvider>,
    );

beforeEach(() => {
    window.localStorage.setItem("wecms_locale", "VI");
    resetState();
});

describe("B9 totals bar — one row per currency", () => {
    const kpis = (byCurrency: InvoiceKpis["byCurrency"]): InvoiceKpis => ({
        count: 3, preTax: 2_800_000, tax: 224_000, total: 3_084_000, missingXml: 0, missingPdf: 0, salesCount: 0, purchaseCount: 3,
        salesTotal: 0, purchaseTotal: 0, fee: 60_000, byCurrency,
    });

    it("VND only: one row, converted total highlighted, no extra VND row, fee '—' when none", () => {
        inLocale(<InvoiceTotals count={2} kpis={kpis([{ currency: "VND", count: 2, preTax: 300_000, tax: 24_000, fee: 0, total: 324_000, totalVnd: 324_000 }])} />);
        const rows = screen.getAllByTestId("inv-total-cur");
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveTextContent("VND");
        expect(rows[0]).toHaveTextContent("2 HĐ");
        expect(within(rows[0]).getByTestId("inv-total-fee")).toHaveTextContent("—");
        expect(rows[0]).toHaveTextContent("324.000");
        expect(screen.queryByTestId("inv-total-vnd")).toBeNull();
        expect(screen.getByTestId("inv-totals")).toHaveTextContent("Tổng 2 hoá đơn");
    });

    it("VND + USD: a row per currency in its own amounts, then the 'Tổng quy đổi (VND)' row", () => {
        inLocale(
            <InvoiceTotals
                count={3}
                kpis={kpis([
                    { currency: "VND", count: 2, preTax: 300_000, tax: 24_000, fee: 10_000, total: 334_000, totalVnd: 334_000 },
                    { currency: "USD", count: 1, preTax: 100, tax: 8, fee: 2, total: 110, totalVnd: 2_750_000 },
                ])}
            />,
        );
        const [vnd, usd] = screen.getAllByTestId("inv-total-cur");
        expect(vnd).toHaveTextContent("10.000");
        expect(usd).toHaveTextContent("USD");
        expect(usd).toHaveTextContent("100,00");
        expect(usd).toHaveTextContent("110,00");
        expect(usd).toHaveTextContent("2.750.000");
        const total = screen.getByTestId("inv-total-vnd");
        expect(total).toHaveTextContent("Tổng quy đổi (VND)");
        expect(total).toHaveTextContent("2.800.000");
        expect(total).toHaveTextContent("60.000");
        expect(total).toHaveTextContent("3.084.000");
        expect(total.textContent).not.toMatch(/\d VND/); // no "VND" after the converted numbers
    });
});

describe("B8 Chi tiết hàng hoá", () => {
    it("lines with kind, code, full decimals, reconciled tax; fee line 'Không thuế'; 3-line footer; on-invoice line", () => {
        inLocale(<ItemsTable inv={base} />);
        const rows = screen.getAllByTestId("items-row");
        expect(rows).toHaveLength(3);
        expect(rows[0]).toHaveTextContent("Hàng hoá, dịch vụ");
        expect(rows[0]).toHaveTextContent("SP01");
        expect(rows[0]).toHaveTextContent("1,5");
        expect(rows[0]).toHaveTextContent("133.333,333333");
        expect(rows[0]).toHaveTextContent("16.000");
        expect(rows[0]).toHaveTextContent("216.000");
        expect(rows[2]).toHaveTextContent("Ghi chú");
        const fee = screen.getByTestId("items-fee");
        expect(fee).toHaveTextContent("Phí giao hàng");
        expect(fee).toHaveTextContent("Không thuế");
        expect(screen.getByTestId("items-sub-items")).toHaveTextContent("Cộng tiền hàng");
        expect(screen.getByTestId("items-sub-items")).toHaveTextContent("324.000");
        expect(screen.getByTestId("items-sub-fees")).toHaveTextContent("10.000");
        expect(screen.getByTestId("items-total")).toHaveTextContent("Tổng thanh toán");
        expect(screen.getByTestId("items-total")).toHaveTextContent("334.000");
        const line = screen.getByTestId("items-on-invoice");
        expect(line).toHaveTextContent("Trên hoá đơn: tiền hàng 300.000 · thuế 24.000 · phí 10.000 · tổng 334.000 VND");
        expect(line).not.toHaveTextContent("⚠");
    });

    it("warns when pre-tax + tax + fees ≠ total", () => {
        inLocale(<ItemsTable inv={{ ...base, total: 340_000 }} />);
        expect(screen.getByTestId("items-on-invoice")).toHaveTextContent("⚠");
    });

    it("foreign currency: VND column per line; no fee → single 'Tổng cộng' row", () => {
        const usd = { ...base, currency: "USD", exchangeRate: 25_000, fee: undefined, fees: undefined, preTax: 300, tax: 24, total: 324, items: [{ name: "Licence", unit: "Gói", qty: 1, price: 300, amount: 300, vatRate: 8, taxAmount: 24 }] } as ApiInvoice;
        inLocale(<ItemsTable inv={usd} />);
        expect(screen.getByText("Tổng quy đổi (VND)")).toBeInTheDocument();
        expect(screen.getAllByTestId("items-row")[0]).toHaveTextContent("8.100.000");
        expect(screen.getByTestId("items-total")).toHaveTextContent("Tổng cộng");
        expect(screen.queryByTestId("items-sub-fees")).toBeNull();
    });

    it("list cell: first names, hover lists them as i/n, click opens the popup", async () => {
        vi.useFakeTimers();
        try {
            const inv = { ...base, itemNames: ["Bút bi", "Giấy A4", "Mực in"], itemCount: 5 } as Invoice;
            setState((s) => {
                s.invoices = [inv];
            });
            inLocale(<ItemsCell inv={inv} />);
            const cell = screen.getByTestId("items-cell");
            expect(cell).toHaveTextContent("Bút bi / Giấy A4 / Mực in");
            expect(cell).toHaveTextContent("+2 mặt hàng");
            fireEvent.mouseEnter(cell);
            act(() => {
                vi.advanceTimersByTime(300);
            });
            const tip = screen.getByTestId("items-tip");
            expect(tip).toHaveTextContent("1/5");
            expect(tip).toHaveTextContent("3/5");
            expect(tip).toHaveTextContent("Mực in");
            fireEvent.click(cell);
            expect(screen.getByText("Chi tiết hàng hoá")).toBeInTheDocument();
            expect(screen.getByTestId("items-modal")).toHaveTextContent("Phí giao hàng");
        } finally {
            vi.useRealTimers();
        }
    });

    it("clicks on the cell or inside the popup never reach the table row (row click = open the invoice)", () => {
        const inv = { ...base } as Invoice;
        setState((s) => {
            s.invoices = [inv];
        });
        const rowClick = vi.fn();
        inLocale(
            <table>
                <tbody>
                    <tr onClick={rowClick}>
                        <td>
                            <ItemsCell inv={inv} />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );
        fireEvent.click(screen.getByTestId("items-cell"));
        fireEvent.click(screen.getByTestId("items-on-invoice"));
        fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
        expect(rowClick).not.toHaveBeenCalled();
    });

    it("no lines (XML missing) → muted text, no link", () => {
        inLocale(<ItemsCell inv={{ ...base, items: [], itemNames: [], itemCount: 0 } as Invoice} />);
        expect(screen.queryByTestId("items-cell")).toBeNull();
        expect(screen.getByText("Chưa có dòng hàng (thiếu XML)")).toBeInTheDocument();
    });
});

describe("C1 Hoá đơn liên quan / C2 amounts", () => {
    it("adjustment whose original is not stored: '⚠ chưa có HĐ gốc' + note, nothing clickable", () => {
        const onOpen = vi.fn();
        const inv = { ...base, status: "adjustment", related: { relation: "adjusts", original: { id: null, relation: null, templateNo: "1", symbol: "C26TAA", number: "7", issueDate: "2026-10-01", total: null }, note: "Giảm giá", referencedBy: [] } } as Invoice;
        inLocale(<RelatedInfo inv={inv} onOpen={onOpen} />);
        const box = screen.getByTestId("detail-related");
        expect(box).toHaveTextContent("Điều chỉnh cho 1C26TAA-7 · 01/10/2026");
        expect(box).toHaveTextContent("Chưa có HĐ gốc trong hệ thống");
        expect(box).toHaveTextContent("Giảm giá");
        expect(within(box).queryByRole("button")).toBeNull();
    });

    it("replacement with a stored original: click opens it", () => {
        const onOpen = vi.fn();
        const inv = { ...base, status: "replacement", related: { relation: "replaces", original: { id: "o1", relation: null, templateNo: "1", symbol: "C26TAA", number: "7", issueDate: "2026-10-01", total: 300_000 }, referencedBy: [] } } as Invoice;
        inLocale(<RelatedInfo inv={inv} onOpen={onOpen} />);
        expect(screen.getByTestId("detail-related")).toHaveTextContent("Thay thế cho 1C26TAA-7");
        fireEvent.click(screen.getByRole("button", { name: "1C26TAA-7" }));
        expect(onOpen).toHaveBeenCalledWith("o1");
    });

    it("original: 'Đã được thay thế / điều chỉnh bởi (n)' + list + effective value", () => {
        const onOpen = vi.fn();
        const inv = {
            ...base,
            status: "adjusted",
            effectiveTotal: 284_000,
            related: { relation: null, original: null, referencedBy: [{ id: "a1", relation: "adjusts", templateNo: "1", symbol: "C26TAA", number: "20", issueDate: "2026-11-20", total: -50_000 }] },
        } as Invoice;
        inLocale(<RelatedInfo inv={inv} onOpen={onOpen} />);
        const box = screen.getByTestId("detail-related");
        expect(box).toHaveTextContent("Đã được thay thế / điều chỉnh bởi (1)");
        expect(box).toHaveTextContent("Điều chỉnh");
        expect(box).toHaveTextContent("-50.000");
        expect(screen.getByTestId("detail-effective")).toHaveTextContent("Giá trị còn hiệu lực: 284.000 VND");
        fireEvent.click(screen.getByRole("button", { name: "1C26TAA-20" }));
        expect(onOpen).toHaveBeenCalledWith("a1");
    });

    it("mock data: derives the link from relatedId and the effective value from the adjustments", () => {
        const orig = { ...base, id: "o", status: "adjusted", total: 300_000, related: undefined } as Invoice;
        const adj = { ...base, id: "a", number: "20", status: "adjustment", relatedId: "o", total: -50_000, related: undefined } as Invoice;
        setState((s) => {
            s.invoices = [orig, adj];
        });
        const onOpen = vi.fn();
        inLocale(<RelatedInfo inv={orig} onOpen={onOpen} />);
        expect(screen.getByTestId("detail-effective")).toHaveTextContent("250.000 VND");
    });

    it("no related invoice → no section", () => {
        const { container } = inLocale(<RelatedInfo inv={{ ...base, related: undefined } as Invoice} onOpen={vi.fn()} />);
        expect(container.textContent).toBe("");
    });

    it("amounts: pre-tax + tax + fee = total with the currency code", () => {
        const { container } = inLocale(<AmountSummary inv={base} />);
        expect(container.textContent).toBe("300.000 + 24.000 + 10.000 = 334.000 VND");
    });

    it("foreign currency without rate → 'Thiếu tỷ giá'", () => {
        const { container } = inLocale(<AmountSummary inv={{ ...base, currency: "USD", fee: 0, fees: [], exchangeRate: null, totalVnd: null, preTax: 1, tax: 0, total: 1 } as ApiInvoice} />);
        expect(container.textContent).toContain("Thiếu tỷ giá");
    });
});

describe("C3 bản thể hiện (screen + HTML export)", () => {
    const adj = { ...base, status: "adjustment", related: { relation: "adjusts", original: { id: null, relation: null, templateNo: "1", symbol: "C26TAA", number: "7", issueDate: "2026-10-01", total: null }, note: "Giảm giá", referencedBy: [] } } as Invoice;

    it("screen: yellow related line, fee table, total fee, trade discount, qty / price decimals", () => {
        inLocale(<InvoiceSheet inv={adj} />);
        expect(screen.getByTestId("sheet-related")).toHaveTextContent("Điều chỉnh cho hoá đơn Mẫu số 1 Ký hiệu C26TAA Số 7 ngày 01/10/2026 — Giảm giá");
        expect(screen.getByTestId("sheet-fees")).toHaveTextContent("Tên loại phí");
        expect(screen.getByTestId("sheet-fees")).toHaveTextContent("Phí giao hàng");
        expect(screen.getByText("Tổng tiền phí:")).toBeInTheDocument();
        expect(screen.getByText("Tổng tiền chiết khấu thương mại:")).toBeInTheDocument();
        expect(screen.getByText("133.333,333333")).toBeInTheDocument();
        expect(screen.getByText("1,5")).toBeInTheDocument();
        expect(screen.getByText("(Hóa đơn điều chỉnh)")).toBeInTheDocument();
    });

    it("HTML export carries the same lines; no trade-discount line when it is 0", () => {
        const html = renderedHtml(adj);
        expect(html).toContain('<div class="rel">Điều chỉnh cho hoá đơn Mẫu số 1 Ký hiệu C26TAA Số 7 ngày 01/10/2026 — Giảm giá</div>');
        expect(html).toContain("<th>Tên loại phí</th><th>Tiền phí</th>");
        expect(html).toContain("<span>Tổng tiền phí:</span><span>10.000</span>");
        expect(html).toContain("<span>Tổng tiền chiết khấu thương mại:</span><span>5.000</span>");
        expect(html).toContain("133.333,333333");
        const plain = renderedHtml({ ...base, tradeDiscount: 0, fee: 0, fees: [] } as Invoice);
        expect(plain).not.toContain("chiết khấu thương mại");
        expect(plain).not.toContain("Tổng tiền phí");
        expect(plain).not.toContain('class="rel"');
    });
});

describe("B11 column settings — columns new in a version", () => {
    type K = "date" | "partner" | "items" | "currency" | "tax" | "total" | "related" | "po";
    const defaults: { key: K; visible: boolean }[] = [
        { key: "date", visible: true },
        { key: "partner", visible: true },
        { key: "items", visible: true },
        { key: "currency", visible: true },
        { key: "tax", visible: true },
        { key: "total", visible: true },
        { key: "related", visible: false },
        { key: "po", visible: false },
    ];

    it("are inserted at their default position with their default visibility; saved order / visibility kept", () => {
        // saved by v1.1: the user moved "total" before "tax" and hid "tax"
        const saved = [
            { key: "date" as K, visible: true },
            { key: "partner" as K, visible: true },
            { key: "total" as K, visible: true },
            { key: "tax" as K, visible: false },
            { key: "gone" as K, visible: true }, // a column removed since → dropped
        ];
        expect(mergeViewColumns(saved, defaults)).toEqual([
            { key: "date", visible: true },
            { key: "partner", visible: true },
            { key: "items", visible: true }, // after "partner", as in the defaults — not appended hidden at the end
            { key: "currency", visible: true },
            { key: "total", visible: true },
            { key: "related", visible: false }, // after the nearest earlier default column the user has ("total")
            { key: "po", visible: false },
            { key: "tax", visible: false },
        ]);
    });

    it("a new first column goes first", () => {
        expect(mergeViewColumns([{ key: "partner" as K, visible: true }], defaults.slice(0, 2))).toEqual([
            { key: "date", visible: true },
            { key: "partner", visible: true },
        ]);
    });
});
