import type {
    ErpTransactionHistoryRow,
    ErpTransactionHistoryTabCounts,
} from "./types";

/**
 * Static mock for the ERP Transaction History panel — used as the
 * offline-dev affordance only. The panel now reads from the live Phase 2
 * endpoint `GET /api/v1/settings/erp-transaction-history` via
 * {@code lib/api/erpTransactionHistory.ts} + {@code useApiData}.
 *
 * <p>Row shape mirrors the post-mapper {@link ErpTransactionHistoryRow}
 * (camelCase), so the panel can drop these rows in as a fallback when
 * the backend returns no data during local dev with no API running.
 */
export const mockErpTransactionHistoryRows: ErpTransactionHistoryRow[] = [
    {
        seqNo: 759,
        orgFileNm: "Account Inquiry(VND)_30042026.xls",
        saveFileNm: "Account Inquiry(VND)_30042026.xls",
        fileSize: 11264,
        erpType: "W",
        erpTypeKey: "settings.erp_transaction_history.direction.wecms_to_erp",
        trnsTypeCd: "09",
        trnsTypeKey: "settings.erp_transaction_history.type.09",
        regDtm: "20260430073409",
        regId: "lamine@gmail.com",
        userNm: null,
    },
    {
        seqNo: 755,
        orgFileNm: "WeCMS_Vendor_Payment_upload_EN (22).xlsx",
        saveFileNm: "File_1774431115330_2.xlsx",
        fileSize: 35803,
        erpType: "E",
        erpTypeKey: "settings.erp_transaction_history.direction.erp_to_wecms",
        trnsTypeCd: "03",
        trnsTypeKey: "settings.erp_transaction_history.type.03",
        regDtm: "20260325093155",
        regId: "lamine@gmail.com",
        userNm: null,
    },
    {
        seqNo: 754,
        orgFileNm: "File_1768373586642_4.xlsx",
        saveFileNm: "File_1769595033782_4.xlsx",
        fileSize: 35781,
        erpType: "D",
        erpTypeKey: "settings.erp_transaction_history.direction.deleted",
        trnsTypeCd: "03",
        trnsTypeKey: "settings.erp_transaction_history.type.03",
        regDtm: "20260325093106",
        regId: "lamine@gmail.com",
        userNm: null,
    },
];

/**
 * Tab counts mock — matches the rows above plus a small buffer so the
 * tab chips look populated under offline dev. The live panel reads
 * counts from the backend's `total_count_*` envelope fields.
 */
export const MOCK_ERP_TAB_COUNTS: ErpTransactionHistoryTabCounts = {
    all: 3,
    W: 1,
    E: 1,
    D: 1,
};
