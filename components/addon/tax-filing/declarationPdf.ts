import { printHtmlDocument } from "@/lib/print";
import { loadXlsxParts, patchSheetXml } from "@/lib/xlsxTemplate";
import { XLSX_HTML_BASE_CSS, xlsxSheetToHtml } from "@/lib/xlsxToHtml";
import {
    buildDeclarationPatches,
    DECLARATION_TEMPLATE_URL,
    exportFileName,
    type DeclarationExcelInput,
} from "./declarationExcel";

/**
 * Client-side PDF of the Declaration tab — form 01/GTGT.
 *
 * Rendered from the authority's own workbook, not from a hand-built layout: the
 * template's sheet XML is patched with exactly the map the XLSX download uses
 * (`buildDeclarationPatches`), then that sheet — its column widths, row heights,
 * 90 merges, borders, fonts and number formats — is converted to an HTML table
 * and printed. The PDF is therefore the same document as the spreadsheet, and a
 * change to the template moves both at once.
 *
 * Printed through `printHtmlDocument` per CLAUDE.md §6d (self-contained document
 * in a hidden iframe); the user saves it as PDF from the print dialog.
 *
 * No endpoint is involved. `GET /export/pdf` exists but is disabled on the
 * caller side (see VatDeclarationFormPage): it renders server-side from stored
 * figures, so it cannot show unsaved edits, and it only accepts a locked
 * declaration. Re-enable it there once the backend is corrected.
 */

/** Same inputs as the XLSX — the two exports are fed identically by design. */
export type DeclarationPdfInput = DeclarationExcelInput;

/**
 * The sheet marks its helper columns `hidden="1"`, so the renderer drops those on
 * its own. Rows carry no such flag: the form ends at 71, and row 72 is a 1px
 * filler holding the template's own `eof` marker, which must not print.
 */
const LAST_PRINTED_ROW = 71;

/**
 * Usable area of A4 portrait at the 8mm margin below — 194 × 281mm — in CSS px
 * at 96dpi. The renderer scales the sheet to fit both axes, which is what keeps
 * the declaration on a single page: split across two, the indicator table loses
 * its header row and the form stops reading as the statutory one.
 */
const A4_PRINTABLE_WIDTH_PX = Math.round((194 / 25.4) * 96);
const A4_PRINTABLE_HEIGHT_PX = Math.round((281 / 25.4) * 96);

/** Same base name as the XLSX, so a pair of downloads is obviously a pair. */
export function pdfFileName(detail: DeclarationPdfInput["detail"]): string {
    return exportFileName(detail).replace(/\.xlsx$/, "");
}

/**
 * The document itself, as a string. Split from the print call so the layout can
 * be asserted without a browser — the print step is a one-liner around it.
 */
export function buildDeclarationPdfHtml(
    sheetXml: string,
    sharedStringsXml: string,
    stylesXml: string,
    patches: Parameters<typeof patchSheetXml>[1],
    title: string,
): string {
    const table = xlsxSheetToHtml(
        patchSheetXml(sheetXml, patches),
        sharedStringsXml,
        stylesXml,
        {
            fitWidthPx: A4_PRINTABLE_WIDTH_PX,
            fitHeightPx: A4_PRINTABLE_HEIGHT_PX,
            maxRow: LAST_PRINTED_ROW,
        },
    );

    return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  html, body { margin: 0; padding: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
${XLSX_HTML_BASE_CSS}
  /* The sheet is scaled to fit one page; forbid any break inside it. */
  .xl-sheet, .xl-table, .xl-table tr { page-break-inside: avoid; break-inside: avoid; }
</style></head><body>${table}
<script>
/* The row heights in the sheet are what Excel needs for its own font; a browser
 * wraps text slightly differently and the form ends up taller, which pushes it
 * onto a second page. Only the browser knows the real height, so the fit is
 * finalised here: after layout, before print. The iframe prints on its load
 * event, which runs after this. The server-side zoom stays as the fallback for
 * anything that renders this document without scripting. */
(function () {
    var sheet = document.querySelector(".xl-sheet");
    var table = sheet && sheet.firstElementChild;
    if (!table) return;
    var W = ${A4_PRINTABLE_WIDTH_PX};
    var H = ${A4_PRINTABLE_HEIGHT_PX};
    /* Shrinking re-wraps the text, so the height after a zoom is not the height
     * before it times that zoom — one calculation lands a page or two pixels
     * over. Measure, shrink, measure again until it genuinely fits; it settles
     * in two or three passes, and the cap stops a pathological sheet looping. */
    var zoom = 1;
    for (var pass = 0; pass < 8; pass++) {
        sheet.style.zoom = String(zoom);
        var box = table.getBoundingClientRect();
        if (box.width <= W && box.height <= H) break;
        zoom *= Math.min(W / box.width, H / box.height) * 0.999;
    }
})();
<\/script></body></html>`;
}

export async function exportDeclarationPdf(
    input: DeclarationPdfInput,
): Promise<void> {
    const SHEET = "xl/worksheets/sheet1.xml";
    const SHARED = "xl/sharedStrings.xml";
    const STYLES = "xl/styles.xml";

    const parts = await loadXlsxParts(DECLARATION_TEMPLATE_URL, [
        SHEET,
        SHARED,
        STYLES,
    ]);
    if (!parts[SHEET]) throw new Error("Template worksheet not found");

    printHtmlDocument(
        buildDeclarationPdfHtml(
            parts[SHEET],
            parts[SHARED] ?? "",
            parts[STYLES] ?? "",
            buildDeclarationPatches(input),
            pdfFileName(input.detail),
        ),
    );
}
