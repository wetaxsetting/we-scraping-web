import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/invoices/sales",
}));

import { AmountSummary } from "@/components/invoices/InvoiceDetailModal";
import InvoiceSheet from "@/components/invoices/InvoiceSheet";
import { LocaleProvider } from "@/lib/i18n";
import type { ApiInvoice } from "@/lib/api/weinvoice/invoices";
import { renderedHtml } from "@/lib/weinvoice/exporter";

// Regression (2026-11-25, docs/bugs/invoice-foreign-currency-amount-display-fix-2026-11-25.md): a USD invoice of
// 7,303.84 (3600790154 C26TKS-445) showed "7.304 ₫" in the detail panel and in the bản thể hiện.

const base: ApiInvoice = {
    id: "1", direction: "sales", issueDate: "2026-11-20", templateNo: "1", symbol: "C26TKS", number: "445",
    sellerTaxId: "3600790154", sellerName: "Bên bán", sellerAddress: "", buyerTaxId: "0300000000", buyerName: "Bên mua",
    buyerAddress: "", currency: "USD", preTax: 6640, tax: 663.84, total: 7303.84, status: "original", cqtCode: "00AB",
    provider: "", lookupCode: "", lookupUrl: "", paymentMethod: "TM/CK",
    items: [{ name: "Hàng A", unit: "Cái", qty: 2, price: 3320, amount: 6640, vatRate: 10 }] as ApiInvoice["items"],
    files: [], tags: [], source: "gdt", syncedAt: "", exchangeRate: 25705, totalVnd: 187_745_207,
} as ApiInvoice;

const inLocale = (ui: React.ReactNode) => render(<LocaleProvider>{ui}</LocaleProvider>);

describe("detail panel amounts", () => {
    it("shows a USD invoice in USD with cents, plus its VND equivalent and rate", () => {
        const { container } = inLocale(<AmountSummary inv={base} />);
        const text = container.textContent ?? "";
        expect(text).toContain("6.640,00 + 663,84 = 7.303,84 USD");
        expect(text).toContain("187.745.207");
        expect(text).toContain("25.705");
        expect(text).not.toContain("7.304");
    });

    it("shows a VND invoice with the VND code, without a conversion line", () => {
        const vnd = { ...base, currency: "VND", preTax: 44445, tax: 3555, total: 48000, exchangeRate: 1, totalVnd: 48000 };
        const { container } = inLocale(<AmountSummary inv={vnd} />);
        expect(container.textContent).toBe("44.445 + 3.555 = 48.000 VND");
    });
});

describe("bản thể hiện", () => {
    it("states the currency, keeps cents and drops the VND amount-in-words line", () => {
        inLocale(<InvoiceSheet inv={base} />);
        expect(screen.getByText("Loại tiền:")).toBeTruthy();
        expect(screen.getAllByText("USD").length).toBeGreaterThan(0);
        expect(screen.getByText("7.303,84")).toBeTruthy();
        expect(screen.queryByText(/Số tiền viết bằng chữ/)).toBeNull();
    });

    it("print popup HTML follows the same rule", () => {
        const html = renderedHtml(base);
        expect(html).toContain("<span>Loại tiền:</span><span>USD</span>");
        expect(html).toContain("7.303,84");
        expect(html).not.toContain("Số tiền viết bằng chữ");
        expect(renderedHtml({ ...base, currency: "VND", total: 48000 })).toContain("Số tiền viết bằng chữ");
    });
});
