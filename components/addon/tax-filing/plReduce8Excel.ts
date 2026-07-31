import { fetchAllAnnexInvoices } from "@/lib/api/addon";
import {
    downloadXlsx,
    fillXlsxTemplate,
    type CellPatch,
    type RowExpansion,
} from "@/lib/xlsxTemplate";
import type { ApiVatDeclarationDetail } from "@/lib/types/api";
import type { AnnexInvoiceRow } from "./types";

/**
 * Client-side XLSX of the PL142 tab — annex "GIẢM THUẾ GTGT THEO NGHỊ QUYẾT
 * 204/2025/QH15".
 *
 * Fills the authority's own workbook rather than rebuilding it, so styles,
 * merges and column spans come from the template. The annex ships **one**
 * specimen data row per section, so both sections are grown to the real invoice
 * count first (which pushes the "Tổng cộng" rows, section II and the `eof`
 * marker down), then values are written.
 *
 * The tab itself is paginated; an export must carry everything, so the rows come
 * from {@link fetchAllAnnexInvoices} (walks every page) instead of the page
 * currently on screen.
 */

const TEMPLATE_URL = "/templates/vat-declaration-tt80-workbook.xlsx";
/** PL142 is the 8th sheet of the TT80 workbook. */
const SHEET_PATH = "xl/worksheets/sheet8.xml";

/** Specimen data rows in the pristine template. */
const SEC1_ROW = 20; // I — purchases:  B=STT C=name D:E=value F:G=vat
const SEC2_ROW = 30; // II — sales:     B=STT C=name D=value E=rate F=reduced G=reducedVat

/** Rows that follow each specimen, before any expansion. */
const SEC1_TOTAL_ROW = 22;
const SEC2_TOTAL_ROW = 32;
const DIFF_ROW = 35;

/** `[03]` on the annex reads as prose, not the list's `06/2026` label. */
function periodTextVn(detail: ApiVatDeclarationDetail): string {
    return detail.period_type === "Q"
        ? `Quý ${detail.period_value} năm ${detail.decl_year}`
        : `Tháng ${String(detail.period_value).padStart(2, "0")} năm ${detail.decl_year}`;
}

/** `"8%"` → `8`; blank / non-numeric rates (KKKNT, KCT) fall back to 0. */
function rateNumber(raw: string): number {
    const n = Number.parseFloat(String(raw).replace("%", "").trim());
    return Number.isFinite(n) ? n : 0;
}

export function plReduce8FileName(detail: ApiVatDeclarationDetail): string {
    const kind = detail.period_type === "Q" ? "Q" : "M";
    return `PhuLucGiam8_${kind}${detail.period_value}${detail.decl_year}.xlsx`;
}

/** Wipe a specimen row's data cells so template samples never leak through. */
function blankRow(
    patches: Record<string, CellPatch>,
    row: number,
    columns: readonly string[],
): void {
    for (const col of columns) patches[`${col}${row}`] = "";
}

export type PlReduce8ExcelInput = {
    sid: number;
    detail: ApiVatDeclarationDetail;
    agentNm: string;
    agentTaxCode: string;
};

export async function exportPlReduce8Excel({
    sid,
    detail,
    agentNm,
    agentTaxCode,
}: PlReduce8ExcelInput): Promise<void> {
    // Whole set, both directions — the annex lists purchases and sales.
    const [purchases, sales] = await Promise.all([
        fetchAllAnnexInvoices(sid, { annex_type: "REDUCE8", io_dv: "I" }),
        fetchAllAnnexInvoices(sid, { annex_type: "REDUCE8", io_dv: "O" }),
    ]);

    const sec1: AnnexInvoiceRow[] = purchases.rows;
    const sec2: AnnexInvoiceRow[] = sales.rows;

    // Grow section II first: expanding section I would shift its specimen row.
    const expansions: RowExpansion[] = [
        { templateRow: SEC2_ROW, count: sec2.length },
        { templateRow: SEC1_ROW, count: sec1.length },
    ];

    // Rows added above a landmark push it down.
    const extra1 = Math.max(0, sec1.length - 1);
    const extra2 = Math.max(0, sec2.length - 1);
    const sec1Total = SEC1_TOTAL_ROW + extra1;
    const sec2Start = SEC2_ROW + extra1;
    const sec2Total = SEC2_TOTAL_ROW + extra1 + extra2;
    const diffRow = DIFF_ROW + extra1 + extra2;

    const patches: Record<string, CellPatch> = {
        B3: `(Kèm theo Tờ khai thuế GTGT kỳ tính thuế  ${periodTextVn(detail)})`,
        D5: detail.tp_name,
        D7: detail.tp_tax_code,
        D9: agentNm,
        D11: agentTaxCode,
    };

    // ── Section I — io_dv "I", purchases: value (3) + deductible VAT (4) ─────
    let sec1Value = 0;
    let sec1Vat = 0;
    if (sec1.length === 0) {
        // The template ships a filled specimen row. With nothing to list it has
        // to be cleared, or its sample figures read as real data.
        blankRow(patches, SEC1_ROW, ["B", "C", "D", "F"]);
    }
    sec1.forEach((row, i) => {
        const r = SEC1_ROW + i;
        patches[`B${r}`] = String(i + 1);
        patches[`C${r}`] = row.prodNm;
        patches[`D${r}`] = row.splyAmt;
        patches[`F${r}`] = row.vatAmt;
        sec1Value += row.splyAmt;
        sec1Vat += row.vatAmt;
    });
    patches[`D${sec1Total}`] = sec1Value;
    patches[`F${sec1Total}`] = sec1Vat;

    // ── Section II — io_dv "O", sales: (5) = (4) × 80%, (6) = reduced VAT ────
    let sec2Value = 0;
    let sec2Reduced = 0;
    if (sec2.length === 0) {
        blankRow(patches, sec2Start, ["B", "C", "D", "E", "F", "G"]);
    }
    sec2.forEach((row, i) => {
        const r = sec2Start + i;
        const standard = rateNumber(row.vatRate);
        patches[`B${r}`] = String(i + 1);
        patches[`C${r}`] = row.prodNm;
        patches[`D${r}`] = row.splyAmt;
        patches[`E${r}`] = standard;
        patches[`F${r}`] = standard * 0.8;
        patches[`G${r}`] = row.reducedAmt;
        sec2Value += row.splyAmt;
        sec2Reduced += row.reducedAmt;
    });
    patches[`D${sec2Total}`] = sec2Value;
    patches[`G${sec2Total}`] = sec2Reduced;

    // ── Section III — [09] = [08] − [06] ────────────────────────────────────
    patches[`D${diffRow}`] = sec2Reduced - sec1Vat;

    // Helper totals the template keeps beside [02] / [03] ("tổng cột 6 / 3").
    patches.I9 = sec2Reduced;
    patches.J9 = sec2Value;

    const bytes = await fillXlsxTemplate(TEMPLATE_URL, patches, SHEET_PATH, expansions);
    downloadXlsx(bytes, plReduce8FileName(detail));
}
