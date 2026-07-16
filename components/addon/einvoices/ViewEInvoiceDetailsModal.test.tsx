import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ViewEInvoiceDetailsModal from "./ViewEInvoiceDetailsModal";
import type { EInvoiceDetail, EInvoiceParty } from "./detailTypes";

/**
 * "View e-Invoice Details" modal — API-wired contract:
 *
 *   • renders the title + Print + PDF action buttons when open;
 *   • the header X and the footer Close both request close via onOpenChange;
 *   • renders nothing when closed;
 *   • with a loaded invoice, Print renders a standalone document via
 *     printHtmlDocument (NOT window.print() on the live DOM).
 *
 * i18n is stubbed to echo keys; the data hook + dialog + print helper are
 * mocked so assertions target wiring, not network / copy.
 */

vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({ t: (k: string) => k, locale: "EN" }),
}));

vi.mock("@/components/shared/dialog", () => ({
    useDialog: () => ({ open: vi.fn() }),
}));

const { mockUseDetail, printSpy, pdfSpy } = vi.hoisted(() => ({
    mockUseDetail: vi.fn(),
    printSpy: vi.fn(),
    pdfSpy: vi.fn(),
}));

vi.mock("@/hooks/useEInvoiceDetail", () => ({
    useEInvoiceDetail: () => mockUseDetail(),
}));

// Print + PDF operate on the modal's own invoice DOM via these shared helpers.
vi.mock("@/lib/print", () => ({ printElement: printSpy }));
vi.mock("@/lib/pdf", () => ({ downloadElementAsPdf: pdfSpy }));

const EMPTY_PARTY: EInvoiceParty = {
    name: "",
    taxId: "",
    address: "",
    phone: "",
    fullName: "",
    citizenId: "",
    bankAcc: "",
    bankName: "",
    signBy: "",
    signDate: "",
    signTime: "",
};

function makeDetail(): EInvoiceDetail {
    return {
        docId: "D1",
        docType: "I",
        invoiceTitle: "HOÁ ĐƠN GIÁ TRỊ GIA TĂNG",
        numericSymbol: "1",
        invoiceSymbol: "C24TWV",
        handDocId: "1231",
        invoiceStatus: "",
        mccqt: "",
        qrcode:
            "00020101021202000400260052005300540058005900600062009964000001101201496252020110306C26TWV04032280508202606170608678000.0",
        originalInvoice: "",
        issuDt: "20241014",
        currencyCd: "VND",
        rate: "1",
        listNumber: "",
        listDate: "",
        paymentType: "",
        testResult: "",
        seller: { ...EMPTY_PARTY, name: "SELLER CO" },
        buyer: { ...EMPTY_PARTY, name: "BUYER CO" },
        items: [],
        fees: [],
        taxes: [],
        totals: {
            splyAmtSum: "0",
            taxAmtSum: "0",
            totlFeeAmt: "",
            totlDisAmt: "0",
            totlAmt: "0",
            totalAmtInLetter: "",
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: no invoice loaded (buttons render but are disabled).
    mockUseDetail.mockReturnValue({ data: null, loading: false, error: null });
});

describe("ViewEInvoiceDetailsModal", () => {
    it("renders title, Print and PDF buttons when open (sales)", () => {
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="sales"
                docId="D1"
            />,
        );

        expect(screen.getByText("einvoice_view_detail.title")).toBeInTheDocument();
        expect(screen.getByText("einvoice_view_detail.print")).toBeInTheDocument();
        expect(screen.getByText("einvoice_view_detail.pdf")).toBeInTheDocument();
    });

    it("renders for the expense variant too (shared component reuse)", () => {
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="expense"
                docId="D1"
            />,
        );
        expect(screen.getByText("einvoice_view_detail.title")).toBeInTheDocument();
    });

    it("renders the real GDT QR payload as a raster data-URI (not a placeholder image, not SVG)", () => {
        mockUseDetail.mockReturnValue({
            data: makeDetail(),
            loading: false,
            error: null,
        });
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="sales"
                docId="D1"
            />,
        );
        const qrs = screen.getAllByAltText("QR code");
        expect(qrs.length).toBeGreaterThan(0);
        qrs.forEach((img) => {
            const src = img.getAttribute("src") ?? "";
            // Raster (GIF) data-URI — NOT inline SVG (html2canvas can't rasterize
            // SVG, which broke the QR in the downloaded PDF).
            expect(src).toMatch(/^data:image\/gif;base64,/);
            expect(src).not.toMatch(/svg/);
        });
    });

    it("renders the einv_testresul==='2' Expense variant (hides bank/address/payment, shows phone + citizen id)", () => {
        const base = makeDetail();
        mockUseDetail.mockReturnValue({
            data: {
                ...base,
                docType: "B",
                testResult: "2",
                buyer: {
                    ...base.buyer,
                    name: "BUYER CO",
                    address: "BUYER ADDR",
                    phone: "0900-111-222",
                    citizenId: "079123456789",
                },
            },
            loading: false,
            error: null,
        });
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="expense"
                docId="D1"
            />,
        );

        // Variant-only rows appear (offscreen capture node renders the same DOM,
        // so use getAllByText and assert at least one match).
        expect(screen.getAllByText(/Điện thoại: 0900-111-222/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Căn cước công dân: 079123456789/).length).toBeGreaterThan(0);
        // Rows hidden in the variant must NOT render.
        expect(screen.queryByText(/Họ tên người mua:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Hình thức thanh toán:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Đơn vị tiền tệ:/)).not.toBeInTheDocument();
    });

    it("renders the normal (non-variant) buyer block with payment method + currency", () => {
        mockUseDetail.mockReturnValue({
            data: makeDetail(), // docType "I", testResult "" → not a variant
            loading: false,
            error: null,
        });
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="sales"
                docId="D1"
            />,
        );
        expect(screen.getAllByText(/Hình thức thanh toán:/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Đơn vị tiền tệ:/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Căn cước công dân:/)).not.toBeInTheDocument();
    });

    it("renders nothing when closed", () => {
        render(
            <ViewEInvoiceDetailsModal
                open={false}
                onOpenChange={vi.fn()}
                invoiceType="sales"
                docId="D1"
            />,
        );
        expect(
            screen.queryByText("einvoice_view_detail.title"),
        ).not.toBeInTheDocument();
    });

    it("footer Close button requests close", () => {
        const onOpenChange = vi.fn();
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={onOpenChange}
                invoiceType="sales"
                docId="D1"
            />,
        );

        fireEvent.click(screen.getByText("einvoice_view_detail.close"));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("header X button requests close", () => {
        const onOpenChange = vi.fn();
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={onOpenChange}
                invoiceType="sales"
                docId="D1"
            />,
        );

        // Both the header X (aria-label) and the footer Close (text) share the
        // "Close" accessible name; the header X is first in DOM order.
        const closers = screen.getAllByRole("button", {
            name: "einvoice_view_detail.close",
        });
        expect(closers.length).toBe(2);
        fireEvent.click(closers[0]);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("Print prints the modal's own invoice DOM via printElement", () => {
        mockUseDetail.mockReturnValue({
            data: makeDetail(),
            loading: false,
            error: null,
        });
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="sales"
                docId="D1"
            />,
        );

        fireEvent.click(screen.getByText("einvoice_view_detail.print"));
        expect(printSpy).toHaveBeenCalledTimes(1);
        // Called with the off-screen full-size invoice element — the exact same
        // <InvoiceDocument> DOM the modal renders (no separate print layout).
        expect(printSpy.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
    });

    it("PDF downloads the same invoice DOM via downloadElementAsPdf", async () => {
        mockUseDetail.mockReturnValue({
            data: makeDetail(),
            loading: false,
            error: null,
        });
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="sales"
                docId="D1"
            />,
        );

        fireEvent.click(screen.getByText("einvoice_view_detail.pdf"));
        await waitFor(() => expect(pdfSpy).toHaveBeenCalledTimes(1));
        expect(pdfSpy.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
        expect(pdfSpy.mock.calls[0][1]).toBe("D1.pdf");
    });

    it("Print is disabled (no-op) while no invoice is loaded", () => {
        render(
            <ViewEInvoiceDetailsModal
                open
                onOpenChange={vi.fn()}
                invoiceType="sales"
                docId="D1"
            />,
        );
        fireEvent.click(screen.getByText("einvoice_view_detail.print"));
        expect(printSpy).not.toHaveBeenCalled();
    });
});
