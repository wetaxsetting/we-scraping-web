import type { ExcelExportColumn } from "@/lib/excel";
import type { AnnexType } from "@/lib/types/api";

/**
 * Column sets for the annex Excel export (API #11).
 *
 * The backend provider owns an allow-list — IO_DV / SRC_DOC_ID / INV_NO /
 * INV_SYMBOL / INV_DT / TRCO_TAX_CODE / TRCO_NM / PROD_NM / SPLY_AMT /
 * VAT_RATE / VAT_AMT / REDUCED_AMT — and intersects whatever we send against
 * it, so every FIELD_ID here must come from that list. The screen is
 * export-only (no `SYS_SCR_OPTION_WECMS` seed), which is why the columns are
 * declared here rather than derived from View Setting via `useExcelExport`.
 *
 * Headers use the shared `tax_filing.annex.col_*` keys so an exported file
 * reads the same regardless of which tab triggered it.
 */

/** Which annex the active tab represents. */
export type AnnexExportKind = "bkbr" | "bkmv" | "reduce8";

type Spec = {
    annexType: AnnexType;
    ioDv: "I" | "O";
    /** Filename stem — the period suffix is appended by the caller. */
    filePrefix: string;
    /** i18n key for the in-sheet title. */
    titleKey: string;
    fieldIds: string[];
};

const SPECS: Record<AnnexExportKind, Spec> = {
    bkbr: {
        annexType: "BKBR",
        ioDv: "O",
        filePrefix: "BangKeBanRa",
        titleKey: "tax_filing.bkbr.title",
        fieldIds: [
            "INV_SYMBOL",
            "INV_NO",
            "INV_DT",
            "TRCO_TAX_CODE",
            "TRCO_NM",
            "PROD_NM",
            "SPLY_AMT",
            "VAT_RATE",
            "VAT_AMT",
        ],
    },
    bkmv: {
        annexType: "BKMV",
        ioDv: "I",
        filePrefix: "BangKeMuaVao",
        titleKey: "tax_filing.bkmv.title",
        fieldIds: [
            "INV_SYMBOL",
            "INV_NO",
            "INV_DT",
            "TRCO_TAX_CODE",
            "TRCO_NM",
            "PROD_NM",
            "SPLY_AMT",
            "VAT_RATE",
            "VAT_AMT",
            "REDUCED_AMT",
        ],
    },
    reduce8: {
        annexType: "REDUCE8",
        ioDv: "O",
        filePrefix: "PhuLucGiam8",
        titleKey: "tax_filing.pl_reduce8.title",
        // The reduce-8 annex spans both directions, so IO_DV is worth a column
        // even though the request still filters to one side at a time.
        fieldIds: [
            "IO_DV",
            "INV_SYMBOL",
            "INV_NO",
            "INV_DT",
            "TRCO_TAX_CODE",
            "TRCO_NM",
            "PROD_NM",
            "SPLY_AMT",
            "VAT_RATE",
            "VAT_AMT",
            "REDUCED_AMT",
        ],
    },
};

/** Per-FIELD_ID wire shape: header key + cell format + column width. */
const FIELDS: Record<
    string,
    Pick<ExcelExportColumn, "format" | "align" | "widthChars"> & { headerKey: string }
> = {
    IO_DV: { headerKey: "tax_filing.annex.col_io_dv", format: "text", widthChars: 12 },
    SRC_DOC_ID: { headerKey: "tax_filing.annex.col_src_doc_id", format: "text", widthChars: 28 },
    INV_NO: { headerKey: "tax_filing.annex.col_inv_no", format: "text", widthChars: 20 },
    INV_SYMBOL: { headerKey: "tax_filing.annex.col_inv_symbol", format: "text", widthChars: 14 },
    INV_DT: { headerKey: "tax_filing.annex.col_inv_dt", format: "date", widthChars: 14 },
    TRCO_TAX_CODE: { headerKey: "tax_filing.annex.col_trco_tax_code", format: "text", widthChars: 18 },
    TRCO_NM: { headerKey: "tax_filing.annex.col_trco_nm", format: "text", widthChars: 40 },
    PROD_NM: { headerKey: "tax_filing.annex.col_prod_nm", format: "text", widthChars: 40 },
    SPLY_AMT: { headerKey: "tax_filing.annex.col_sply_amt", format: "amount", align: "right", widthChars: 22 },
    VAT_RATE: { headerKey: "tax_filing.annex.col_vat_rate", format: "text", align: "center", widthChars: 12 },
    VAT_AMT: { headerKey: "tax_filing.annex.col_vat_amt", format: "amount", align: "right", widthChars: 22 },
    REDUCED_AMT: { headerKey: "tax_filing.annex.col_reduced_amt", format: "amount", align: "right", widthChars: 22 },
};

/**
 * Build the API #11 request payload for one annex.
 *
 * @param period `period_label` from the declaration detail (e.g. `"06/2026"`);
 *               `/` is stripped for the filename since it is illegal there.
 */
export function buildAnnexExportRequest(
    kind: AnnexExportKind,
    period: string,
    t: (key: string, vars?: Record<string, string | number>) => string,
) {
    const spec = SPECS[kind];
    return {
        fileName: `${spec.filePrefix}_${period.replace(/\//g, "")}`,
        title: `${t(spec.titleKey)} ${period}`,
        columns: spec.fieldIds.map<ExcelExportColumn>((fieldId) => {
            const f = FIELDS[fieldId];
            return {
                fieldId,
                header: t(f.headerKey),
                format: f.format,
                align: f.align,
                widthChars: f.widthChars,
            };
        }),
        filters: {
            annex_type: spec.annexType,
            io_dv: spec.ioDv,
            search: null,
        },
        sort: { field: "INV_DT", direction: "ASC" as const },
    };
}
