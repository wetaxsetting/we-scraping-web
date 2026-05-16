/**
 * Excel export column registry for Settings > Firm Banking History.
 *
 * <p>Mirrors the V153 View Setting seed verbatim and matches the
 * backend's {@code FirmBankingHistoryExportProvider.allowedFieldIds()}
 * 7-column set. Width values are conservative defaults sized so the
 * spreadsheet is immediately readable without manual resize; the
 * backend writer falls back to the View Setting {@code SIZE} when
 * {@code widthChars} is omitted on the wire.
 *
 * <p>Per CLAUDE.md §13b, View Setting is NOT rendered on this panel
 * (no toolbar list-icon button). The hook receives the
 * {@link FIRM_BANKING_HISTORY_FALLBACK_VS_ITEMS} array as a synthetic
 * `vs.items` list so the export flow can compute column visibility +
 * order from a stable source.
 */
import type { ApiScreenOptionItem } from "@/lib/types/api";
import type { ExcelExportColumnConfig } from "@/hooks/useExcelExport";

export const FIRM_BANKING_HISTORY_EXPORT_COLUMNS: Record<
    string,
    ExcelExportColumnConfig
> = {
    REG_DTM: {
        headerKey: "settings.firm_banking_history.col.date_time",
        format: "text",
        widthChars: 22,
    },
    SVC_TYPE: {
        headerKey: "settings.firm_banking_history.col.service_type",
        format: "text",
        widthChars: 14,
    },
    SVC_NM: {
        headerKey: "settings.firm_banking_history.col.service_name",
        format: "text",
        widthChars: 28,
    },
    SEQ_NO: {
        headerKey: "settings.firm_banking_history.col.seq_no",
        format: "text",
        widthChars: 18,
    },
    DEP_BANK_CD: {
        headerKey: "settings.firm_banking_history.col.inst_code",
        format: "text",
        widthChars: 28,
    },
    RS_CD: {
        headerKey: "settings.firm_banking_history.col.result_code",
        format: "text",
        widthChars: 14,
    },
    RS_MSG: {
        headerKey: "settings.firm_banking_history.col.result_message",
        format: "text",
        widthChars: 40,
    },
};

/**
 * Synthetic {@link ApiScreenOptionItem} list mirroring the V153 seed.
 * The panel does NOT render the View Setting popover, so it never
 * fetches live items via {@code useViewSetting()}. The export hook
 * still expects a `vs.items`-shaped array — we feed it this fallback.
 * Backend re-intersects with the persisted seed visibility, so even
 * if this list drifts the export still emits exactly what the server
 * says is visible.
 */
export const FIRM_BANKING_HISTORY_FALLBACK_VS_ITEMS: ApiScreenOptionItem[] = [
    { field_id: "REG_DTM",     field_nm: "Date / Time",    disp_ord: 1, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "SVC_TYPE",    field_nm: "Service Type",   disp_ord: 2, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "SVC_NM",      field_nm: "Service Name",   disp_ord: 3, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "220px" },
    { field_id: "SEQ_NO",      field_nm: "Seq. No.",       disp_ord: 4, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "Y", size: "160px" },
    { field_id: "DEP_BANK_CD", field_nm: "Deposit Bank",   disp_ord: 5, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "200px" },
    { field_id: "RS_CD",       field_nm: "Result Code",    disp_ord: 6, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "140px" },
    { field_id: "RS_MSG",      field_nm: "Result Message", disp_ord: 7, use_yn: "Y", fix_yn: "Y", disp_yn: "Y", sort_yn: "N", size: "320px" },
];
