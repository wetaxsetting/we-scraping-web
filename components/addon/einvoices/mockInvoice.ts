/**
 * Static mock data for the "View e-Invoice Details" preview modal
 * (Figma 305-8355 Sales / 305-7885 Expense).
 *
 * UI-ONLY: the modal is a static reproduction of a Vietnamese VAT invoice
 * ("HOÁ ĐƠN GIÁ TRỊ GIA TĂNG"). There is no backend behind it yet — every
 * value below is realistic sample data lifted from the Figma frame. When the
 * detail endpoint lands, replace this seed with the mapped API response; the
 * modal component's markup does not change.
 */

export type MockInvoiceItem = {
    /** STT — line number. */
    no: number;
    /** Tính chất — nature of goods/services. */
    nature: string;
    /** Tên hàng hóa, dịch vụ — item name. */
    name: string;
    /** Đơn vị tính — unit. */
    unit: string;
    /** Số lượng — quantity. */
    quantity: string;
    /** Đơn giá — unit price. */
    unitPrice: string;
    /** Chiết khấu — discount. */
    discount: string;
    /** Thuế suất — tax rate code (e.g. KCT). */
    taxRate: string;
    /** Thành tiền chưa có thuế GTGT — amount before VAT. */
    amountBeforeTax: string;
};

/** One fee line in the left summary block (legacy REC2 / EINV_FEE_DETL). */
export type MockInvoiceFeeRow = {
    /** STT — display order. */
    no: number | string;
    /** Tên loại phí — fee name. */
    name: string;
    /** Tiền phí — fee amount (pre-formatted). */
    amount: string;
};

/** One tax-rate row in the left summary block (legacy REC3 / EINV_TAX_DETL). */
export type MockInvoiceTaxRow = {
    /** Thuế suất — tax rate (e.g. "8%", "KCT"). */
    taxRate: string;
    /** Tổng tiền chưa thuế — amount before tax (pre-formatted). */
    amountBeforeTax: string;
    /** Tổng tiền thuế — tax amount (pre-formatted). */
    taxAmount: string;
};

export type MockInvoice = {
    /**
     * The GDT-supplied QR payload (verbatim `EINV_QRCODE`) — rendered to an SVG
     * QR at display time. Empty ⇒ no QR is shown. GDT generates this string; we
     * never construct it (see docs/gdt-einvoice-qr-generation-analysis.md).
     */
    qrPayload: string;
    /**
     * Legacy `einv_testresul === "2"` GDT test-invoice variant, and only for
     * Expense / DOC_TYPE "B" (einv_0002_001.ts:142-173). When true the document
     * hides the seller bank-account row, the buyer full-name / address /
     * bank-account / payment-method rows, and the currency block, and instead
     * shows the buyer phone + citizen-id rows. False for every normal invoice.
     */
    testVariant: boolean;
    meta: {
        /** Mẫu số. */
        formNo: string;
        /** Ký hiệu — invoice serial symbol. */
        serialSymbol: string;
        /** Số — invoice number. */
        number: string;
        /** Ngày … tháng … năm — issue date line under the title. */
        issueDateLine: string;
        /** MCCQT — tax-authority code. */
        mccqt: string;
    };
    seller: {
        name: string;
        taxCode: string;
        address: string;
        phone: string;
        bankAccount: string;
    };
    buyer: {
        companyName: string;
        buyerName: string;
        taxCode: string;
        address: string;
        bankAccount: string;
        paymentMethod: string;
        /** Điện thoại — buyer phone, shown only in the testVariant layout. */
        phone: string;
        /** Căn cước công dân — buyer citizen id, shown only in the testVariant layout. */
        citizenId: string;
    };
    currency: {
        code: string;
        listNo: string;
        exchangeRate: string;
        listDate: string;
    };
    items: MockInvoiceItem[];
    /** Left summary block — fee lines (legacy REC2). Empty ⇒ the fee table is
     *  not rendered (legacy removes it when there are no fees). */
    fees: MockInvoiceFeeRow[];
    /** Left summary block — tax-rate breakdown (legacy REC3), one row per rate. */
    taxRows: MockInvoiceTaxRow[];
    summary: {
        /** Tổng tiền chưa thuế (Tổng cộng thành tiền chưa có thuế). */
        totalBeforeTax: string;
        /** Tổng tiền thuế (Tổng cộng tiền thuế). */
        totalTaxAmount: string;
        /** Tổng tiền phí. */
        totalFee: string;
        /** Tổng tiền chiết khấu thương mại. */
        totalCommercialDiscount: string;
        /** Tổng tiền thanh toán bằng số. */
        totalPaymentNumeric: string;
        /** Tổng tiền thanh toán bằng chữ. */
        totalPaymentWords: string;
    };
    signature: {
        valid: boolean;
        signedBy: string;
        signedAt: string;
    };
};

/**
 * Canonical sample invoice mirroring the Figma preview frame. Shared by both
 * the Sales and Expense variants — the only cross-variant difference in the
 * design is the modal title, which the component resolves from `invoiceType`.
 */
export const MOCK_INVOICE: MockInvoice = {
    qrPayload:
        "00020101021202000400260052005300540058005900600062009964000001101201496252020110306C26TWV04032280508202606170608678000.0",
    testVariant: false,
    meta: {
        formNo: "Mẫu số 1",
        serialSymbol: "C24TWV",
        number: "1231",
        issueDateLine: "Mẫu số 1 Ngày 14 tháng 10 năm 2024",
        mccqt: "006443BEC4789145CB9052F9B5A2D95C22",
    },
    seller: {
        name: "CÔNG TY TNHH WEBCASH VIỆT NAM",
        taxCode: "1201496252",
        address:
            "LK08-13, Khu phố 3, Phường Thới Sơn, Tỉnh Đồng Tháp, Việt Nam",
        phone: "",
        bankAccount: "1063895376 Vietcombank-Chi nhánh Thủ Thiêm, TP.HCM",
    },
    buyer: {
        companyName:
            "CÔNG TY TNHH MTV AJTOTAL VIỆT NAM - CHI NHÁNH PHỐ NỐI",
        buyerName: "",
        taxCode: "1101901122-003",
        address:
            "Đường 206, Khu F, Khu công nghiệp Phố Nối A, Xã Minh Hải, Huyện Văn Lâm, Hưng Yên, Việt Nam",
        bankAccount: "",
        paymentMethod: "Chuyển khoản",
        phone: "",
        citizenId: "",
    },
    currency: {
        code: "VND",
        listNo: "",
        exchangeRate: "1",
        listDate: "",
    },
    items: [
        {
            no: 1,
            nature: "Hàng hóa, dịch vụ",
            name: "Phí dịch vụ bộ giải pháp Phần mềm Quản lý công việc Morningmate Advanced tháng 06/2026 theo hợp đồng số WVNS26001/MOR ngày 01/01/2026",
            unit: "Tháng",
            quantity: "1",
            unitPrice: "5.900.000",
            discount: "0",
            taxRate: "KCT",
            amountBeforeTax: "5.900.000",
        },
    ],
    fees: [],
    taxRows: [
        { taxRate: "KCT", amountBeforeTax: "5.900.000", taxAmount: "0" },
    ],
    summary: {
        totalBeforeTax: "5.900.000",
        totalTaxAmount: "0",
        totalFee: "",
        totalCommercialDiscount: "0",
        totalPaymentNumeric: "5.900.000",
        totalPaymentWords: "Năm triệu chín trăm nghìn đồng.",
    },
    signature: {
        valid: true,
        signedBy: "CÔNG TY TNHH WEBCASH VIỆT NAM",
        signedAt: "2024-10-14 11:26:46",
    },
};
