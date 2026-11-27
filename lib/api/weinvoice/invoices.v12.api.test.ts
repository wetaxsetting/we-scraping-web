import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);

import {
    effectiveTotalOf,
    exchangeRateOf,
    feeOf,
    getInvoice,
    itemNamesOf,
    lineTaxOf,
    listInvoices,
    loadInvoiceDetail,
    relationsOf,
    totalVndOf,
    vatRatesOf,
    vndOf,
} from "@/lib/api/weinvoice/invoices";
import { resetState } from "@/lib/api/weinvoice/store";

// docs/features/weinvoice/weinvoice-invoice-screen-v1-2-2026-11-27.md — UI Spec v1.2 (B5–B10, C1–C3): the list row,
// KPI and detail fields the backend added are mapped once at the boundary.

const MST = "0100000001";
const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });

const row = (id: string, extra: Record<string, unknown> = {}) => ({
    id, direction: "purchase", issue_date: "2026-11-05", template_no: "1", symbol: "C26TAA", number: "12",
    seller_tax_id: "0300000009", seller_name: "NCC", buyer_tax_id: MST, buyer_name: "Cty", partner_tax_id: "0300000009",
    partner_name: "NCC", currency: "USD", exchange_rate: 25000, pre_tax: 100, tax: 8, total: 110, total_vnd: 2_750_000,
    status: "adjustment", kind: "normal", cqt_code: "M1", provider: null, provider_tax_id: null, provider_known: false,
    has_xml: true, has_pdf: false, needs_lookup_code: false, tag_ids: [], source: "gdt", synced_at: "2026-11-06T08:00:00Z",
    fee: 2, trade_discount: 5, po_number: "PO-778", due_date: "2026-12-05", due_text: "30DAYS",
    items: ["Bút bi", "Giấy A4", "Mực in"], item_count: 6, vat_rates: ["8%", "KCT"],
    related: { relation: "adjusts", original: { id: null, relation: null, template_no: "1", symbol: "C26TAA", number: "7", issue_date: "2026-10-01", total: 300 }, referenced_by: [] },
    ...extra,
});

const kpis = {
    count: 3, pre_tax: 2_600_000, tax: 208_000, total: 2_860_000, fee: 50_000, missing_xml: 0, missing_pdf: 3,
    by_currency: [
        { currency: "VND", count: 2, pre_tax: 100_000, tax: 8_000, fee: 0, total: 108_000, total_vnd: 108_000 },
        { currency: "USD", count: 1, pre_tax: 100, tax: 8, fee: 2, total: 110, total_vnd: 2_750_000 },
    ],
};

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    resetState();
});

describe("GET /invoices — UI Spec v1.2 row + KPI fields", () => {
    it("maps fee, trade discount, PO, due date, item preview, VAT rates, related and kpis.by_currency", async () => {
        h.request.mockImplementation(async () => ok({ rows: [row("a")], total_count: 1, page: 0, size: 20, kpis, incomplete_periods: [] }));
        const res = await listInvoices({ taxId: MST, direction: "purchase", from: "2026-11-01", to: "2026-11-30", page: 1, size: 20 });

        expect(res.kpis.fee).toBe(50_000);
        expect(res.kpis.byCurrency).toEqual([
            { currency: "VND", count: 2, preTax: 100_000, tax: 8_000, fee: 0, total: 108_000, totalVnd: 108_000 },
            { currency: "USD", count: 1, preTax: 100, tax: 8, fee: 2, total: 110, totalVnd: 2_750_000 },
        ]);

        const inv = getInvoice("a")!;
        expect(inv).toMatchObject({ fee: 2, tradeDiscount: 5, poNumber: "PO-778", dueDate: "2026-12-05", dueText: "30DAYS", itemNames: ["Bút bi", "Giấy A4", "Mực in"], itemCount: 6, vatRates: ["8%", "KCT"] });
        expect(feeOf(inv)).toBe(2);
        expect(itemNamesOf(inv)).toEqual({ names: ["Bút bi", "Giấy A4", "Mực in"], count: 6 });
        expect(vatRatesOf(inv)).toEqual(["8%", "KCT"]);
        expect(exchangeRateOf(inv)).toBe(25000);
        expect(totalVndOf(inv)).toBe(2_750_000);
        expect(vndOf(inv, 8)).toBe(200_000);
        // the original is not stored → id null ("⚠ chưa có HĐ gốc")
        expect(relationsOf(inv)).toEqual({
            relation: "adjusts",
            original: { id: null, relation: null, templateNo: "1", symbol: "C26TAA", number: "7", issueDate: "2026-10-01", total: 300 },
            referencedBy: [],
        });
    });

    it("an older backend without by_currency → one VND row from the VND KPIs; no row fields → nothing invented", async () => {
        const old = row("b");
        for (const k of ["fee", "trade_discount", "po_number", "due_date", "due_text", "items", "item_count", "vat_rates", "related"]) delete (old as Record<string, unknown>)[k];
        h.request.mockImplementation(async () => ok({ rows: [{ ...old, currency: "VND", exchange_rate: 1 }], total_count: 1, page: 0, size: 20, kpis: { count: 1, pre_tax: 100, tax: 8, total: 110 }, incomplete_periods: [] }));
        const res = await listInvoices({ taxId: MST, direction: "purchase", from: "2026-11-01", to: "2026-11-30", page: 1, size: 20 });
        expect(res.kpis.byCurrency).toEqual([{ currency: "VND", count: 1, preTax: 100, tax: 8, fee: 0, total: 110, totalVnd: 110 }]);
        const inv = getInvoice("b")!;
        expect("fee" in inv || "poNumber" in inv || "related" in inv).toBe(false);
        expect(feeOf(inv)).toBe(0);
        expect(relationsOf(inv)).toBeNull();
    });

    it("a foreign currency without exchange rate has no VND amount (\"Thiếu tỷ giá\")", async () => {
        h.request.mockImplementation(async () => ok({ rows: [row("c", { exchange_rate: null, total_vnd: null })], total_count: 1, page: 0, size: 20, kpis, incomplete_periods: [] }));
        await listInvoices({ taxId: MST, direction: "purchase", from: "2026-11-01", to: "2026-11-30", page: 1, size: 20 });
        const inv = getInvoice("c")!;
        expect(exchangeRateOf(inv)).toBeNull();
        expect(totalVndOf(inv)).toBeNull();
    });
});

describe("GET /invoices/{id} — UI Spec v1.2 detail fields", () => {
    it("maps line kind / code / reconciled tax / rate label, fee lines, related both ways and the effective value", async () => {
        h.request.mockImplementation(async () =>
            ok({
                id: "o", direction: "purchase", issue_date: "2026-10-01", template_no: "1", symbol: "C26TAA", number: "7",
                seller: { tax_id: "0300000009", name: "NCC" }, buyer: { tax_id: MST, name: "Cty" }, currency: "VND", exchange_rate: 1,
                pre_tax: 300, tax: 24, discount: 10, total: 334, total_vnd: 334, status: "adjusted", cqt_code: "M", provider: null,
                provider_tax_id: null, provider_known: false, source: "gdt", synced_at: "", fee: 10,
                fees: [{ name: "Phí dịch vụ", amount: 10 }],
                items: [
                    { line_no: 1, line_kind: 1, code: "SP01", name: "Hàng A", unit: "Cái", qty: 1.5, price: 200, discount: 0, amount: 300, vat_rate: 8, vat_rate_label: "8%", tax_amount: 24 },
                    { line_no: 2, line_kind: 4, code: null, name: "Ghi chú", unit: null, qty: null, price: null, amount: 0, vat_rate: null, vat_rate_label: null, tax_amount: null },
                    { line_no: 3, line_kind: 2, code: null, name: "Tặng kèm", unit: "Cái", qty: 1, price: 0, amount: 0, vat_rate: -2, vat_rate_label: "KKKNT", tax_amount: 0 },
                ],
                related: { relation: "adjusted_by", id: "n1", template_no: "1", symbol: "C26TAA", number: "12" },
                referenced_by: [{ id: "n1", relation: "adjusts", template_no: "1", symbol: "C26TAA", number: "12", issue_date: "2026-11-05", total: -50 }],
                effective_total: 284,
            }),
        );
        const inv = (await loadInvoiceDetail("o"))!;
        expect(inv.items.map((i) => [i.kind, i.code, i.taxAmount, i.vatLabel])).toEqual([
            ["goods", "SP01", 24, "8%"],
            ["note", undefined, undefined, undefined],
            ["promo", undefined, 0, "KKKNT"],
        ]);
        expect(inv.fees).toEqual([{ name: "Phí dịch vụ", amount: 10 }]);
        expect(inv).toMatchObject({ fee: 10, tradeDiscount: 10, effectiveTotal: 284, itemNames: ["Hàng A", "Tặng kèm"], itemCount: 2, vatRates: ["8%", "KKKNT"] });
        expect(relationsOf(inv)).toEqual({
            relation: null,
            original: null,
            referencedBy: [{ id: "n1", relation: "adjusts", templateNo: "1", symbol: "C26TAA", number: "12", issueDate: "2026-11-05", total: -50 }],
        });
        expect(effectiveTotalOf(inv)).toBe(284);
        expect(lineTaxOf(inv, inv.items[0])).toBe(24);
    });

    it("a replacement names its stored original with the note (reason)", async () => {
        h.request.mockImplementation(async () =>
            ok({
                id: "r", direction: "purchase", issue_date: "2026-11-02", template_no: "1", symbol: "C26TAA", number: "13",
                seller: { tax_id: "0300000009" }, buyer: { tax_id: MST }, currency: "VND", pre_tax: 1, tax: 0, total: 1, status: "replacement",
                cqt_code: "", provider: null, provider_tax_id: null, provider_known: false, source: "gdt", synced_at: "",
                related: { relation: "replaces", id: "o", template_no: "1", symbol: "C26TAA", number: "7", issue_date: "2026-10-01", reason: "Sai đơn giá" },
                referenced_by: [],
            }),
        );
        const inv = (await loadInvoiceDetail("r"))!;
        expect(relationsOf(inv)).toEqual({
            relation: "replaces",
            original: { id: "o", relation: null, templateNo: "1", symbol: "C26TAA", number: "7", issueDate: "2026-10-01", total: null },
            referencedBy: [],
            note: "Sai đơn giá",
        });
    });
});

describe("lineTaxOf — display fallback when the backend sent no line tax", () => {
    it("amount × rate rounded to the currency unit; notes and KCT carry none", () => {
        const vnd = { currency: "VND" } as never;
        const usd = { currency: "USD" } as never;
        expect(lineTaxOf(vnd, { name: "", unit: "", qty: 1, price: 0, amount: 12_345, vatRate: 8 })).toBe(988);
        expect(lineTaxOf(usd, { name: "", unit: "", qty: 1, price: 0, amount: 10.05, vatRate: 8 })).toBe(0.8);
        expect(lineTaxOf(vnd, { name: "", unit: "", qty: 1, price: 0, amount: 100, vatRate: -1 })).toBe(0);
        expect(lineTaxOf(vnd, { name: "", unit: "", qty: 1, price: 0, amount: 100, vatRate: 10, kind: "note" })).toBe(0);
    });
});
