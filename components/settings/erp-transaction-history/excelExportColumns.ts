/**
 * Excel export column registry for Settings > ERP Transaction History.
 *
 * <p>Mirrors the V154 View Setting seed verbatim and matches the
 * backend's {@code ErpTrnsHistoryExportProvider.allowedFieldIds()}
 * 7-column set. Per CLAUDE.md §13b, View Setting is NOT rendered on
 * this panel — the hook receives
 * {@link ERP_TRANSACTION_HISTORY_FALLBACK_VS_ITEMS} as a synthetic
 * `vs.items` list so the export flow can compute column visibility +
 * order from a stable source.
 */
import type { ApiScreenOptionItem } from "@/lib/types/api";
import type { ExcelExportColumnConfig } from "@/hooks/useExcelExport";

export const ERP_TRANSACTION_HISTORY_EXPORT_COLUMNS: Record<
    string,
    ExcelExportColumnConfig
> = {
    REG_DTM: {
        headerKey: "settings.erp_transaction_history.col.date",
        format: "text",
        widthChars: 22,
    },
    ERP_TYPE: {
        headerKey: "settings.erp_transaction_history.col.type",
        format: "text",
        widthChars: 16,
    },
    TRNS_TYPE_CD: {
        headerKey: "settings.erp_transaction_history.col.transaction_type",
        format: "text",
        widthChars: 28,
    },
    ORG_FILE_NM: {
        headerKey: "settings.erp_transaction_history.col.file",
        format: "text",
        widthChars: 40,
    },
    FILE_SIZE: {
        headerKey: "settings.erp_transaction_history.col.file_size",
        format: "number",
        align: "right",
        widthChars: 16,
    },
    REG_USER: {
        headerKey: "settings.erp_transaction_history.col.user",
        format: "text",
        widthChars: 22,
    },
    REG_ID: {
        headerKey: "settings.erp_transaction_history.col.user_id",
        format: "text",
        widthChars: 18,
    },
};

export const ERP_TRANSACTION_HISTORY_FALLBACK_VS_ITEMS: ApiScreenOptionItem[] = [
    { field_id: "REG_DTM",      field_nm: "Date / Time",       disp_ord: 1, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "ERP_TYPE",     field_nm: "Direction",         disp_ord: 2, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "TRNS_TYPE_CD", field_nm: "Transaction Type",  disp_ord: 3, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "220px" },
    { field_id: "ORG_FILE_NM",  field_nm: "File Name",         disp_ord: 4, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "320px" },
    { field_id: "FILE_SIZE",    field_nm: "File Size",         disp_ord: 5, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "120px" },
    { field_id: "REG_USER",     field_nm: "Registered By",     disp_ord: 6, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "180px" },
    { field_id: "REG_ID",       field_nm: "User ID",           disp_ord: 7, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "140px" },
];
