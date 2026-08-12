import { downloadXlsx, fillXlsxTemplate, type CellPatch } from "@/lib/xlsxTemplate";
import type { ApiVatDeclarationDetail } from "@/lib/types/api";

/**
 * Client-side XLSX of the Declaration tab — form 01/GTGT.
 *
 * The official HTKK workbook ships as a static template and only its cell values
 * are patched, so the download is formatting-identical to what the tax authority
 * issues: 90 merges, column widths, borders, the `#,##0_);(#,##0)` amount format
 * and the live formulas on `[27] [28] [34] [35] [36] [41] [43]` all come from the
 * template rather than being reconstructed.
 *
 * Written in the browser, not server-side: the declaration has no
 * `/export/excel` endpoint, and the figures exported are the ones on screen —
 * unsaved edits included — which a round-trip could not see.
 */

/** Template lives under `public/`, so it is fetched by URL at click time. */
export const DECLARATION_TEMPLATE_URL = "/templates/vat-declaration-01-gtgt.xlsx";

/**
 * Indicator → sheet cell. `J` holds "Giá trị hàng hóa, dịch vụ", `L` the VAT
 * column; the codes and labels beside them are already in the template.
 *
 * `[21]` is absent: it is a flag written to `I36` as "X", not an amount.
 */
const CELL_BY_INDICATOR: Record<string, string> = {
    ct22: "L37",
    ct23: "J40",
    ct24: "L40",
    ct23a: "J41",
    ct24a: "L41",
    ct25: "L42",
    ct26: "J44",
    ct27: "J45",
    ct28: "L45",
    ct29: "J46",
    ct30: "J47",
    ct31: "L47",
    ct32: "J48",
    ct33: "L48",
    ct32a: "J49",
    ct34: "J50",
    ct35: "L50",
    ct36: "L51",
    ct37: "L53",
    ct38: "L54",
    ct39a: "L55",
    ct40a: "L57",
    ct40b: "L58",
    ct40: "L59",
    ct41: "L60",
    ct42: "L61",
    ct43: "L62",
};

/** `[01b]` reads as prose on the form, not as the `06/2026` list label. */
function periodTextVn(detail: ApiVatDeclarationDetail): string {
    return detail.period_type === "Q"
        ? `Quý ${detail.period_value} năm ${detail.decl_year}`
        : `Tháng ${String(detail.period_value).padStart(2, "0")} năm ${detail.decl_year}`;
}

export function exportFileName(detail: ApiVatDeclarationDetail): string {
    const kind = detail.period_type === "Q" ? "Q" : "M";
    return `WeCMS_VAT_Report_${detail.decl_year}_${kind}${detail.period_value}.xlsx`;
}

export type DeclarationExcelInput = {
    detail: ApiVatDeclarationDetail;
    /** Every ct value on screen — editable *and* computed. */
    values: Record<string, number>;
    meta: {
        agentNm: string;
        agentTaxCode: string;
        agentCtrNo: string;
        agentCtrDt: string;
        duNm: string;
        duTaxCode: string;
        duAddr: string;
        duProv: string;
        duDist: string;
        duWard: string;
    };
};

/**
 * Every cell this form writes, as one map.
 *
 * Exported because the PDF prints the *same* patched sheet: sharing the map is
 * what guarantees the two downloads carry identical figures in identical cells.
 */
export function buildDeclarationPatches({
    detail,
    values,
    meta,
}: DeclarationExcelInput): Record<string, CellPatch> {
    const patches: Record<string, CellPatch> = {
        // Header — taxpayer + period
        F4: detail.activity_name,
        G8: periodTextVn(detail),
        D10: detail.tp_name,
        D11: detail.tp_tax_code,
        // Tax agent [06] [07] [08]
        D12: meta.agentNm,
        D13: meta.agentTaxCode,
        D14: meta.agentCtrNo,
        J14: meta.agentCtrDt,
        // Dependent unit [09] [10] [11c] [11b] [11a]
        B16: meta.duNm,
        H18: meta.duTaxCode,
        D22: meta.duProv,
        D24: meta.duDist,
        D26: meta.duWard,
    };

    // [02] first filing vs [03] supplement number — mutually exclusive.
    if (detail.suppl_no > 0) patches.J9 = detail.suppl_no;
    else patches.F9 = "X";

    // [21] "no purchases or sales in the period" is a mark, not a figure.
    if ((values.ct21 ?? 0) === 1) patches.I36 = "X";

    for (const [indicator, cell] of Object.entries(CELL_BY_INDICATOR)) {
        patches[cell] = Math.round(values[indicator] ?? 0);
    }

    return patches;
}

export async function exportDeclarationExcel(
    input: DeclarationExcelInput,
): Promise<void> {
    const bytes = await fillXlsxTemplate(
        DECLARATION_TEMPLATE_URL,
        buildDeclarationPatches(input),
    );
    downloadXlsx(bytes, exportFileName(input.detail));
}
