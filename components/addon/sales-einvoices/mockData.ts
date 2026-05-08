import type { EInvoiceCurrencyTotal, EInvoiceRow } from "./types";

/**
 * Static mock data mirroring the Figma Sales e-Invoices sample (node 9194:6696).
 * Shape matches {@link EInvoiceRow} so swapping in a real API response later
 * requires no structural changes to the table components.
 */
export const mockInvoiceRows: EInvoiceRow[] = [
    {
        id: "1",
        date: "05-12-2024",
        time: "11:39:50",
        invoiceNo: "1C24TLM-0405",
        invoiceType: "Original",
        buyerName: "CÔNG TY TNHH ADTECHNOLOGY VIỆT NAM",
        mstCode: "3702351124-003",
        buyerStatus: "On closing",
        currency: "VND",
        totalAmount: "1.000.000",
        invoiceStatus: "Original",
        taxAmount: "1.000.000",
        amountBeforeTax: "1.000.000",
    },
    {
        id: "2",
        date: "05-12-2024",
        time: "11:39:50",
        invoiceNo: "1C24TLM-0405",
        invoiceType: "Original",
        buyerName: "Công ty TNHH Công Nghệ Sáng Tạo Việt Nam",
        mstCode: "3702351124-002",
        buyerStatus: "Active",
        currency: "VND",
        totalAmount: "1.000.000",
        invoiceStatus: "Original",
        taxAmount: "1.000.000",
        amountBeforeTax: "1.000.000",
    },
    {
        id: "3",
        date: "05-12-2024",
        time: "11:39:50",
        invoiceNo: "1C24TLM-0405",
        invoiceType: "Original",
        buyerName: "Công ty TNHH Dịch Vụ Công Nghệ Việt Nam",
        mstCode: "3702351124-001",
        buyerStatus: "NNT ngừng hoạt động nhưng chưa hoàn thành thủ tục chấm dứt hiệu lực MST",
        currency: "VND",
        totalAmount: "1.000.000",
        invoiceStatus: "Original",
        taxAmount: "1.000.000",
        amountBeforeTax: "1.000.000",
    },
    {
        id: "4",
        date: "05-12-2024",
        time: "11:39:50",
        invoiceNo: "1C24TLM-0406",
        invoiceType: "Original",
        buyerName: "Công ty TNHH Thương Mại Dịch Vụ Phú Quý",
        mstCode: "3702351124-004",
        buyerStatus: "Active",
        currency: "VND",
        totalAmount: "50.000.000",
        invoiceStatus: "Original",
        taxAmount: "5.000.000",
        amountBeforeTax: "45.000.000",
    },
    {
        id: "5",
        date: "05-12-2024",
        time: "11:40:10",
        invoiceNo: "1C24TLM-0407",
        invoiceType: "Replacement",
        buyerName: "Công ty Cổ Phần Xuất Nhập Khẩu Quốc Tế",
        mstCode: "3702351124-005",
        buyerStatus: "Active",
        currency: "VND",
        totalAmount: "30.000.000",
        invoiceStatus: "Replacement",
        taxAmount: "3.000.000",
        amountBeforeTax: "27.000.000",
    },
    {
        id: "6",
        date: "05-12-2024",
        time: "11:42:33",
        invoiceNo: "1C24TLM-0408",
        invoiceType: "Original",
        buyerName: "Công ty TNHH Một Thành Viên Đầu Tư",
        mstCode: "3702351124-006",
        buyerStatus: "Active",
        currency: "VND",
        totalAmount: "80.000.000",
        invoiceStatus: "Original",
        taxAmount: "8.000.000",
        amountBeforeTax: "72.000.000",
    },
    {
        id: "7",
        date: "05-12-2024",
        time: "11:43:50",
        invoiceNo: "1C24TLM-0409",
        invoiceType: "Adjustment",
        buyerName: "Công ty TNHH Tư Vấn Đầu Tư và Phát Triển",
        mstCode: "3702351124-007",
        buyerStatus: "Active",
        currency: "VND",
        totalAmount: "37.000.000",
        invoiceStatus: "Adjustment",
        taxAmount: "3.700.000",
        amountBeforeTax: "33.300.000",
    },
];

export const mockInvoiceCurrencyTotals: EInvoiceCurrencyTotal[] = [
    { currency: "VND", count: 7, total: "200000000", taxAmount: "20000000", pretaxAmount: "180000000" },
    { currency: "USD", count: 0, total: "0", taxAmount: "0", pretaxAmount: "0" },
];

/**
 * Invoice status options shown in the "All Invoice Status" filter dropdown.
 * First entry (all) shows every row; the others correspond to real invoice
 * statuses the backend will return.
 */
export const invoiceStatusFilterOptions: { key: "all" | string; labelKey: string }[] = [
    { key: "all", labelKey: "sales_einvoices.filter.status.all" },
    { key: "Original", labelKey: "sales_einvoices.filter.status.original" },
    { key: "Replacement", labelKey: "sales_einvoices.filter.status.replacement" },
    { key: "Adjustment", labelKey: "sales_einvoices.filter.status.adjustment" },
    { key: "Cancelled", labelKey: "sales_einvoices.filter.status.cancelled" },
];
