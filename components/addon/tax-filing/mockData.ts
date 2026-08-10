import type { TaxFilingRow, AnnexItem, TaxIndicatorRow, BkbrRow, PlCssxPurchaseRow, PlCssxSaleRow } from "./types";

export const TAX_FILING_MOCK_ROWS: TaxFilingRow[] = [
    {
        id: "1",
        declId: 1,
        filingPeriod: "Quarter 1 2026",
        status: "confirmed",
        taxPayable: 0,
        prevPeriodCredit: 0,
        carriedForward: 172800000,
        periodType: "Q",
        periodValue: 1,
        declYear: 2026,
        supplNo: 0,
        declType: "C",
        declTypeName: "01/GTGT",
        applicableCircular: "80/2021/TT-BTC",
        etaxCode: "E-TAX-2026-Q1-5BD8C901",
        modDtm: null,
    },
    {
        id: "2",
        declId: 2,
        filingPeriod: "Month 1 2026",
        status: "draft",
        taxPayable: 0,
        prevPeriodCredit: 0,
        carriedForward: 0,
        periodType: "M",
        periodValue: 1,
        declYear: 2026,
        supplNo: 0,
        declType: "C",
        declTypeName: "01/GTGT",
        applicableCircular: "80/2021/TT-BTC",
        etaxCode: null,
        modDtm: null,
    },
];

export const ANNEX_ITEMS: AnnexItem[] = [
    {
        id: "bkbr",
        code: "BKBR_01-1/GTGT",
        filingPeriod: "VAT output listing",
        defaultChecked: true,
    },
    {
        id: "bkmv",
        code: "BKMV_01-2/GTGT",
        filingPeriod: "VAT input listing",
        defaultChecked: true,
    },
    {
        id: "pl_cssx",
        code: "PL 01-6/GTGT (CSSX)",
        filingPeriod: "VAT allocation schedule annex",
        defaultChecked: false,
    },
    {
        id: "pl_vt",
        code: "PL 01-6/GTGT (VT cước trả sau)",
        filingPeriod: "VAT allocation schedule annex",
        defaultChecked: false,
    },
    {
        id: "pl_142",
        code: "PL 142/2024/QH15-174/2024/QH15-204/2025/QH15",
        filingPeriod: "VAT reduction under Resolution 204/2025/QH15",
        defaultChecked: false,
    },
];

export const QUARTER_OPTIONS = ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"];
export const YEAR_OPTIONS = ["2022", "2023", "2024", "2025", "2026"];
export const MONTH_OPTIONS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
// Activity codes matching the backend bsns_line_cd — labels resolved via t()
export const ACTIVITY_CODES = ["00", "01", "02", "03"] as const;
export type ActivityCode = typeof ACTIVITY_CODES[number];

export const TAX_INDICATOR_ROWS: TaxIndicatorRow[] = [
    { no: "A", label: "No purchase or sale activities in the period (mark \"X\")", hasCheckbox: true, isSectionHeader: true, fieldIdRight: "21" },
    { no: "B", label: "VAT carried forward from the previous period", fieldIdRight: "22", valueRight: 172800000, isSectionHeader: true },
    { no: "C", label: "Declaration of Value Added Tax payable to the State Budget", isSection: true, isSectionHeader: true, isEmptyLeft: true, isEmptyRight: true },
    { no: "I", label: "Goods and services (G&S) purchased in the period", isSectionHeader: true, isSubHeader: true, isEmptyLeft: true, isEmptyRight: true },
    { no: "1", label: "Value and VAT of goods and services purchased", fieldIdLeft: "23", valueLeft: 172800000, fieldIdRight: "24", valueRight: 172800000, indent: 1 },
    { no: "", label: "Of which: imported goods and services", fieldIdLeft: "23a", valueLeft: 0, fieldIdRight: "24a", valueRight: 0, italic: true, indent: 2 },
    { no: "2", label: "VAT of goods and services purchased eligible for credit in this period", fieldIdRight: "25", valueRight: 172800000, indent: 1 },
    { no: "II", label: "Goods and services sold in the period", isSectionHeader: true, isSubHeader: true, isEmptyLeft: true, isEmptyRight: true },
    { no: "1", label: "Goods and services sold not subject to Value Added Tax", fieldIdLeft: "26", valueLeft: 108400000, indent: 1 },
    { no: "2", label: "Goods and services sold subject to VAT [27] = [29]+[30]+[32]+[32a]; [28] = [31]+[33]", fieldIdLeft: "27", valueLeft: 820000000, fieldIdRight: "28", valueRight: 58800000, bold: true, indent: 1, isTotal: true },
    { no: "a", label: "Goods and services sold subject to 0% tax rate", fieldIdLeft: "29", valueLeft: 80000000, indent: 2 },
    { no: "b", label: "Goods and services sold subject to 5% tax rate", fieldIdLeft: "30", valueLeft: 120000000, fieldIdRight: "31", valueRight: 6000000, indent: 2 },
    { no: "c", label: "Goods and services sold subject to 10% tax rate (incl. 8%)", fieldIdLeft: "32", valueLeft: 560000000, fieldIdRight: "33", valueRight: 52800000, indent: 2 },
    { no: "d", label: "Goods and services sold not subject to tax calculation", fieldIdLeft: "32a", valueLeft: 60000000, indent: 2 },
    { no: "3", label: "Total revenue and VAT of G&S sold [34] = [26]+[27]; [35] = [28]", fieldIdLeft: "34", valueLeft: 172800000, fieldIdRight: "35", valueRight: 58800000, bold: true, indent: 1, isTotal: true },
    { no: "III", label: "Value Added Tax incurred in the period [36] = [35] - [25]", fieldIdRight: "36", valueRight: -115200000, isSectionHeader: true, isSubHeader: true ,isTotal: true},
    { no: "IV", label: "Adjustments of VAT credit carried forward from previous periods", isSectionHeader: true ,isSubHeader: true ,isEmptyLeft: true, isEmptyRight: true},
    { no: "1", label: "Downward adjustment", fieldIdRight: "37", valueRight: 52800000, indent: 1 },
    { no: "2", label: "Upward adjustment", fieldIdRight: "38", valueRight: 52800000, indent: 1 },
    { no: "V", label: "Transferred VAT credited in the period", fieldIdRight: "39a", valueRight: 58800000, isSectionHeader: true, isSubHeader: true ,isTotal: true},
    { no: "VI", label: "Determination of Value Added Tax liability in the period:", isSectionHeader: true ,isSubHeader: true , isEmptyRight: true},
    { no: "1", label: "VAT payable on business activities in the period [40a] = [36]-[22]+[37]-[38]-[39a] >= 0", fieldIdRight: "40a", valueRight: 58800000, indent: 1, isTotal: true },
    { no: "2", label: "Input VAT of investment projects offset against VAT payable of business operations in the same period", fieldIdRight: "40b", valueRight: 52800000, indent: 1 },
    { no: "3", label: "Total revenue and VAT of G&S sold [34] = [26]+[27]; [35] = [28]", fieldIdRight: "40", valueRight: 58800000, bold: true, indent: 1, isTotal: true },
    { no: "4", label: "VAT not yet fully credited in this period [41] = [36]-[22]+[37]-[38]-[39a] < 0", fieldIdRight: "41", valueRight: 288800000, indent: 1, isTotal: true },
    { no: "4.1", label: "VAT requested for refund", fieldIdRight: "42", valueRight: 0, indent: 2 },
    { no: "", label: "VAT requested for refund (Account 1331)", fieldIdRight: "42a", valueRight: 0, italic: true, indent: 3 },
    { no: "", label: "VAT requested for refund (Account 1332)", fieldIdRight: "42b", valueRight: 0, italic: true, indent: 3 },
    { no: "4.2", label: "VAT remaining credited carried forward to the next period [43] = [41] - [42]", fieldIdRight: "43", valueRight: 58800000, bold: true, indent: 2, isLast: true, isTotal: true},
];

export const BKMV_GROUPS = [
    {
        id: "kkknt",
        label: "1. Goods & services sold not subject to declaration/payment (KKKNT)",
        taxRate: "KKKNT",
        rows: [
            { no: 1, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, vat: 999999000000, imported: false, importVat: 0, group: "1" },
            { no: 2, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, vat: 999999000000, imported: false, importVat: 0, group: "1" },
            { no: 3, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH WEBCASH VIETNAM", taxCode: "0318067503", revenue: 999999999999999, vat: 0, imported: false, importVat: 0, group: "1" },
            { no: 4, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH WEBCASH VIETNAM", taxCode: "0318067503", revenue: 999999999999999, vat: 0, imported: false, importVat: 0, group: "1" },
            { no: 5, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH WEBCASH VIETNAM", taxCode: "0318067503", revenue: 999999999999999, vat: 0, imported: false, importVat: 0, group: "1" },
            { no: 6, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH WEBCASH VIETNAM", taxCode: "0318067503", revenue: 999999999999999, vat: 0, imported: false, importVat: 0, group: "1" },
            { no: 7, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH WEBCASH VIETNAM", taxCode: "0318067503", revenue: 999999999999999, vat: 0, imported: false, importVat: 0, group: "1" },
            { no: 8, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH WEBCASH VIETNAM", taxCode: "0318067503", revenue: 999999999999999, vat: 0, imported: false, importVat: 0, group: "1" },
        ],
        totalRevenue: 999999999999999,
        totalVat: 999999999999,
        totalImportVat: 0,
    },
    {
        id: "common",
        label: "2. Goods & services used commonly for taxable and non-taxable operations eligible for credit",
        taxRate: "common",
        rows: [
            { no: 1, symbolCode: "1C26TBD", symbolSubCode: "210", date: "07/05/2026", supplier: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 250000000, vat: 20000000, imported: false, importVat: 0, group: "2" },
            { no: 2, symbolCode: "1C26TBD", symbolSubCode: "211", date: "08/05/2026", supplier: "CÔNG TY CỔ PHẦN SAMSUNG SDS", taxCode: "0301122334", revenue: 180000000, vat: 14400000, imported: false, importVat: 0, group: "2" },
            { no: 3, symbolCode: "1C26TBD", symbolSubCode: "212", date: "09/05/2026", supplier: "CÔNG TY TNHH FPT SOFTWARE", taxCode: "0302233445", revenue: 320000000, vat: 25600000, imported: false, importVat: 0, group: "2" },
            { no: 4, symbolCode: "1C26TBD", symbolSubCode: "213", date: "10/05/2026", supplier: "CÔNG TY TNHH LG DISPLAY", taxCode: "0303344556", revenue: 410000000, vat: 32800000, imported: true, importVat: 32800000, group: "2" },
            { no: 5, symbolCode: "1C26TBD", symbolSubCode: "214", date: "11/05/2026", supplier: "CÔNG TY CỔ PHẦN THẾ GIỚI DI ĐỘNG", taxCode: "0304455667", revenue: 95000000, vat: 7600000, imported: false, importVat: 0, group: "2" },
        ],
        totalRevenue: 1255000000,
        totalVat: 100400000,
        totalImportVat: 32800000,
    },
    {
        id: "0pct",
        label: "3. Goods & services subject to 0% tax rate",
        taxRate: "0%",
        rows: [
            { no: 1, symbolCode: "2C26TBD", symbolSubCode: "301", date: "12/05/2026", supplier: "CÔNG TY TNHH NIKE VIỆT NAM", taxCode: "0305566778", revenue: 540000000, vat: 0, imported: true, importVat: 0, group: "3" },
            { no: 2, symbolCode: "2C26TBD", symbolSubCode: "302", date: "13/05/2026", supplier: "CÔNG TY TNHH ADIDAS VIỆT NAM", taxCode: "0306677889", revenue: 620000000, vat: 0, imported: true, importVat: 0, group: "3" },
            { no: 3, symbolCode: "2C26TBD", symbolSubCode: "303", date: "14/05/2026", supplier: "CÔNG TY CỔ PHẦN VINAMILK", taxCode: "0307788990", revenue: 310000000, vat: 0, imported: false, importVat: 0, group: "3" },
        ],
        totalRevenue: 1470000000,
        totalVat: 0,
        totalImportVat: 0,
    },
    {
        id: "5pct",
        label: "4. Goods & services subject to 5% tax rate",
        taxRate: "5%",
        rows: [
            { no: 1, symbolCode: "3C26TBD", symbolSubCode: "401", date: "15/05/2026", supplier: "CÔNG TY TNHH DƯỢC PHẨM HÀ TÂY", taxCode: "0308899001", revenue: 200000000, vat: 10000000, imported: false, importVat: 0, group: "4" },
            { no: 2, symbolCode: "3C26TBD", symbolSubCode: "402", date: "16/05/2026", supplier: "CÔNG TY CỔ PHẦN TRAPHACO", taxCode: "0309900112", revenue: 340000000, vat: 17000000, imported: false, importVat: 0, group: "4" },
            { no: 3, symbolCode: "3C26TBD", symbolSubCode: "403", date: "17/05/2026", supplier: "CÔNG TY TNHH THIẾT BỊ Y TẾ ABC", taxCode: "0310011223", revenue: 128000000, vat: 6400000, imported: false, importVat: 0, group: "4" },
            { no: 4, symbolCode: "3C26TBD", symbolSubCode: "404", date: "18/05/2026", supplier: "CÔNG TY TNHH NÔNG SẢN SẠCH", taxCode: "0311122334", revenue: 76000000, vat: 3800000, imported: false, importVat: 0, group: "4" },
        ],
        totalRevenue: 744000000,
        totalVat: 37200000,
        totalImportVat: 0,
    },
    {
        id: "10pct",
        label: "5. Goods & services subject to 10% tax rate",
        taxRate: "10%",
        rows: [
            { no: 1, symbolCode: "4C26TBD", symbolSubCode: "501", date: "19/05/2026", supplier: "CÔNG TY TNHH INTEL PRODUCTS VN", taxCode: "0312233445", revenue: 850000000, vat: 85000000, imported: true, importVat: 85000000, group: "5" },
            { no: 2, symbolCode: "4C26TBD", symbolSubCode: "502", date: "20/05/2026", supplier: "CÔNG TY CỔ PHẦN FPT", taxCode: "0313344556", revenue: 460000000, vat: 46000000, imported: false, importVat: 0, group: "5" },
            { no: 3, symbolCode: "4C26TBD", symbolSubCode: "503", date: "21/05/2026", supplier: "CÔNG TY TNHH VIETTEL SOLUTIONS", taxCode: "0314455667", revenue: 720000000, vat: 72000000, imported: false, importVat: 0, group: "5" },
            { no: 4, symbolCode: "4C26TBD", symbolSubCode: "504", date: "22/05/2026", supplier: "CÔNG TY TNHH XÂY DỰNG HÒA BÌNH", taxCode: "0315566778", revenue: 1250000000, vat: 125000000, imported: false, importVat: 0, group: "5" },
            { no: 5, symbolCode: "4C26TBD", symbolSubCode: "505", date: "23/05/2026", supplier: "CÔNG TY CỔ PHẦN CƠ ĐIỆN LẠNH REE", taxCode: "0316677889", revenue: 390000000, vat: 39000000, imported: false, importVat: 0, group: "5" },
            { no: 6, symbolCode: "4C26TBD", symbolSubCode: "506", date: "24/05/2026", supplier: "CÔNG TY TNHH SCHINDLER VIỆT NAM", taxCode: "0317788990", revenue: 210000000, vat: 21000000, imported: true, importVat: 21000000, group: "5" },
        ],
        totalRevenue: 3880000000,
        totalVat: 388000000,
        totalImportVat: 106000000,
    },
    {
        id: "8pct",
        label: "6. Goods & services subject to 8% preferential tax rate (Resolution 204/2025/QH15)",
        taxRate: "8%",
        rows: [
            { no: 1, symbolCode: "5C26TBD", symbolSubCode: "601", date: "25/05/2026", supplier: "CÔNG TY TNHH SẢN XUẤT BAO BÌ TÂN Á", taxCode: "0318899001", revenue: 480000000, vat: 38400000, imported: false, importVat: 0, group: "6" },
            { no: 2, symbolCode: "5C26TBD", symbolSubCode: "602", date: "26/05/2026", supplier: "CÔNG TY CỔ PHẦN NHỰA BÌNH MINH", taxCode: "0319900112", revenue: 265000000, vat: 21200000, imported: false, importVat: 0, group: "6" },
            { no: 3, symbolCode: "5C26TBD", symbolSubCode: "603", date: "27/05/2026", supplier: "CÔNG TY TNHH HÓA CHẤT ĐỨC GIANG", taxCode: "0320011223", revenue: 175000000, vat: 14000000, imported: false, importVat: 0, group: "6" },
            { no: 4, symbolCode: "5C26TBD", symbolSubCode: "604", date: "28/05/2026", supplier: "CÔNG TY TNHH LOGISTICS GEMADEPT", taxCode: "0321122334", revenue: 92000000, vat: 7360000, imported: false, importVat: 0, group: "6" },
            { no: 5, symbolCode: "5C26TBD", symbolSubCode: "605", date: "29/05/2026", supplier: "CÔNG TY CỔ PHẦN GIẤY AN HÒA", taxCode: "0322233445", revenue: 138000000, vat: 11040000, imported: false, importVat: 0, group: "6" },
            { no: 6, symbolCode: "5C26TBD", symbolSubCode: "606", date: "30/05/2026", supplier: "CÔNG TY TNHH THÉP HÒA PHÁT", taxCode: "0323344556", revenue: 720000000, vat: 57600000, imported: false, importVat: 0, group: "6" },
            { no: 7, symbolCode: "5C26TBD", symbolSubCode: "607", date: "31/05/2026", supplier: "CÔNG TY CỔ PHẦN XI MĂNG HÀ TIÊN", taxCode: "0324455667", revenue: 305000000, vat: 24400000, imported: false, importVat: 0, group: "6" },
        ],
        totalRevenue: 2175000000,
        totalVat: 174000000,
        totalImportVat: 0,
    },
    {
        id: "import",
        label: "7. Imported goods & services subject to VAT at import stage",
        taxRate: "import",
        rows: [
            { no: 1, symbolCode: "6C26TBD", symbolSubCode: "701", date: "02/06/2026", supplier: "SAMSUNG ELECTRONICS CO., LTD (KR)", taxCode: "KR-1208601", revenue: 1850000000, vat: 185000000, imported: true, importVat: 185000000, group: "7" },
            { no: 2, symbolCode: "6C26TBD", symbolSubCode: "702", date: "03/06/2026", supplier: "TOYOTA MOTOR CORPORATION (JP)", taxCode: "JP-5010401", revenue: 2340000000, vat: 234000000, imported: true, importVat: 234000000, group: "7" },
            { no: 3, symbolCode: "6C26TBD", symbolSubCode: "703", date: "04/06/2026", supplier: "SIEMENS AG (DE)", taxCode: "DE-812526315", revenue: 980000000, vat: 98000000, imported: true, importVat: 98000000, group: "7" },
            { no: 4, symbolCode: "6C26TBD", symbolSubCode: "704", date: "05/06/2026", supplier: "GENERAL ELECTRIC COMPANY (US)", taxCode: "US-140689340", revenue: 1420000000, vat: 142000000, imported: true, importVat: 142000000, group: "7" },
            { no: 5, symbolCode: "6C26TBD", symbolSubCode: "705", date: "06/06/2026", supplier: "BOSCH LIMITED (IN)", taxCode: "IN-29AABCB1", revenue: 560000000, vat: 56000000, imported: true, importVat: 56000000, group: "7" },
        ],
        totalRevenue: 7150000000,
        totalVat: 715000000,
        totalImportVat: 715000000,
    },
    {
        id: "fixedasset",
        label: "8. Fixed assets & investment property purchased in the period",
        taxRate: "10%",
        rows: [
            { no: 1, symbolCode: "7C26TBD", symbolSubCode: "801", date: "08/06/2026", supplier: "CÔNG TY CỔ PHẦN ĐẦU TƯ NAM LONG", taxCode: "0325566778", revenue: 5200000000, vat: 520000000, imported: false, importVat: 0, group: "8" },
            { no: 2, symbolCode: "7C26TBD", symbolSubCode: "802", date: "09/06/2026", supplier: "CÔNG TY TNHH MÁY CÔNG NGHIỆP DOOSAN", taxCode: "0326677889", revenue: 3100000000, vat: 310000000, imported: true, importVat: 310000000, group: "8" },
            { no: 3, symbolCode: "7C26TBD", symbolSubCode: "803", date: "10/06/2026", supplier: "CÔNG TY CỔ PHẦN Ô TÔ TRƯỜNG HẢI", taxCode: "0327788990", revenue: 1680000000, vat: 168000000, imported: false, importVat: 0, group: "8" },
        ],
        totalRevenue: 9980000000,
        totalVat: 998000000,
        totalImportVat: 310000000,
    },
    {
        id: "noncredit",
        label: "9. Goods & services not eligible for input VAT credit",
        taxRate: "non-credit",
        rows: [
            { no: 1, symbolCode: "8C26TBD", symbolSubCode: "901", date: "12/06/2026", supplier: "CÔNG TY TNHH DU LỊCH SAIGONTOURIST", taxCode: "0328899001", revenue: 88000000, vat: 8800000, imported: false, importVat: 0, group: "9" },
            { no: 2, symbolCode: "8C26TBD", symbolSubCode: "902", date: "13/06/2026", supplier: "NHÀ HÀNG KHÁCH SẠN REX", taxCode: "0329900112", revenue: 45000000, vat: 4500000, imported: false, importVat: 0, group: "9" },
            { no: 3, symbolCode: "8C26TBD", symbolSubCode: "903", date: "14/06/2026", supplier: "CÔNG TY CỔ PHẦN GOLF LONG THÀNH", taxCode: "0330011223", revenue: 120000000, vat: 12000000, imported: false, importVat: 0, group: "9" },
            { no: 4, symbolCode: "8C26TBD", symbolSubCode: "904", date: "15/06/2026", supplier: "CÔNG TY TNHH BẢO HIỂM NHÂN THỌ", taxCode: "0331122334", revenue: 65000000, vat: 0, imported: false, importVat: 0, group: "9" },
        ],
        totalRevenue: 318000000,
        totalVat: 25300000,
        totalImportVat: 0,
    },
];

export const BKBR_GROUPS = [
    {
        id: "kkknt",
        label: "1. Goods & services sold not subject to declaration/payment (KKKNT)",
        taxRate: "KKKNT",
        rows: [
            { no: 1, symbolCode: "1C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "KKKNT", vat: 999999000000, group: "1" },
            { no: 2, symbolCode: "1C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "KKKNT", vat: 999999000000, group: "1" },
            { no: 3, symbolCode: "1C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "KKKNT", vat: 999999000000, group: "1" },
            { no: 4, symbolCode: "1C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "KKKNT", vat: 999999000000, group: "1" },
            { no: 5, symbolCode: "1C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "KKKNT", vat: 999999000000, group: "1" },
            { no: 6, symbolCode: "1C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "KKKNT", vat: 999999000000, group: "1" },
        ],
        totalRevenue: 999999999999999,
        totalVat: 0,
    },
    {
        id: "kct",
        label: "2. Goods & services not subject to Value Added Tax (VAT)",
        taxRate: "KCT",
        rows: [
            { no: 1, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "KCT", vat: 999999000000, group: "2" },
        ],
        totalRevenue: 999999999999999,
        totalVat: 0,
    },
    {
        id: "0pct",
        label: "3. Goods & services subject to 0% tax rate",
        taxRate: "0%",
        rows: [
            { no: 1, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "0%", vat: 999999000000, group: "3" },
        ],
        totalRevenue: 999999999999999,
        totalVat: 0,
    },
    {
        id: "5pct",
        label: "4. Goods & services subject to 5% tax rate",
        taxRate: "5%",
        rows: [
            { no: 1, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "5%", vat: 999999000000, group: "4" },
        ],
        totalRevenue: 999999999999999,
        totalVat: 0,
    },
    {
        id: "10pct",
        label: "5. Goods & services subject to 10% tax rate",
        taxRate: "10%",
        rows: [
            { no: 1, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "10%", vat: 999999000000, group: "5" },
        ],
        totalRevenue: 999999999999999,
        totalVat: 0,
    },
    {
        id: "8pct",
        label: "6. Goods & services subject to other preferential rates (if any)",
        taxRate: "8%",
        rows: [
            { no: 1, symbolCode: "C26TBD", symbolSubCode: "210", date: "07/05/2026", customer: "CÔNG TY TNHH INSUNG HIVINA", taxCode: "0318067503", revenue: 999999999999999, taxRate: "8%", vat: 999999000000, group: "6" },
        ],
        totalRevenue: 999999999999999,
        totalVat: 0,
    },
];


// ─── PL_CSSX tab mock data ─────────────────────────────────────────────────

export const PL_CSSX_PURCHASE_ROWS: PlCssxPurchaseRow[] = [
  { no: 1, description: "Raw materials — steel sheets (imported)", revenue: 999999999999999, vat: 79999999999999 },
  { no: 2, description: "Packaging materials — cardboard boxes", revenue: 150000000000, vat: 12000000000 },
  { no: 3, description: "Chemical solvents eligible for 8% VAT credit", revenue: 280000000000, vat: 22400000000 },
  { no: 4, description: "Office supplies and printing services", revenue: 45000000000, vat: 3600000000 },
  { no: 5, description: "Logistics & warehousing — domestic transport", revenue: 320000000000, vat: 25600000000 },
  { no: 6, description: "Machinery spare parts (8% eligible)", revenue: 510000000000, vat: 40800000000 },
  { no: 7, description: "Fuel — diesel for production equipment", revenue: 180000000000, vat: 14400000000 },
  { no: 8, description: "IT hardware (servers, switches)", revenue: 95000000000, vat: 7600000000 },
  { no: 9, description: "Professional consulting services", revenue: 60000000000, vat: 4800000000 },
  { no: 10, description: "Electricity — factory consumption", revenue: 420000000000, vat: 33600000000 },
];

export const PL_CSSX_SALE_ROWS: PlCssxSaleRow[] = [
  { no: 1, description: "Finished goods — steel components (domestic)", revenue: 1500000000000, vatRate: "8%", vatAmount: 120000000000, notes: "" },
  { no: 2, description: "Semi-finished goods — processed sheets", revenue: 750000000000, vatRate: "8%", vatAmount: 60000000000, notes: "" },
  { no: 3, description: "By-products — metal scrap (domestic sale)", revenue: 90000000000, vatRate: "8%", vatAmount: 7200000000, notes: "" },
  { no: 4, description: "Maintenance & repair services (B2B)", revenue: 200000000000, vatRate: "8%", vatAmount: 16000000000, notes: "" },
  { no: 5, description: "Tooling & mould fabrication", revenue: 130000000000, vatRate: "8%", vatAmount: 10400000000, notes: "" },
  { no: 6, description: "Technical training services", revenue: 45000000000, vatRate: "8%", vatAmount: 3600000000, notes: "" },
  { no: 7, description: "Logistics support services (subcontracted)", revenue: 80000000000, vatRate: "8%", vatAmount: 6400000000, notes: "" },
  { no: 8, description: "Warranty & after-sales services", revenue: 35000000000, vatRate: "8%", vatAmount: 2800000000, notes: "" },
];
