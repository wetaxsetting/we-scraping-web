/**
 * Shared report Excel writer — frontend-only.
 *
 * Used by every Banking > Reports page (Daily Cash, Daily Financial CMC,
 * Daily Financial HS, Cash Flow) for the "Download Excel" toolbar action.
 * Mirrors the legacy JEX `_excelDownload(grid, fileName, title, subHeader)`
 * shape (see `WECMS DEV/WECMS_STATIC/ts-src/js/smart/smart.excel.ts`):
 *
 *   Row 0   — file title (large, bold, merged across all columns)
 *   Row 1+  — optional sub-headers (`{left, right}` per row)
 *   Blank   — separator
 *   Section title (when multi-section)
 *   Header row
 *   Body rows
 *   ...next section
 *
 * NOTE — Departure from CLAUDE.md §13b: that rule requires the backend
 * (Apache POI on `wecms-api-main`) to produce the XLSX via a per-resource
 * POST /export endpoint. Most report backends are still stubs / partial
 * (only Daily Cash + Daily Financial CMC ship real data), so this writer
 * is the pragmatic interim per explicit user direction. When the
 * backend `/export` endpoints land for these screens, swap the call
 * site to {@link import("./excel").exportExcel} — the page-side column
 * registries here translate 1:1 to the backend `ExcelExportColumn` shape.
 */

// `xlsx-js-style` is a drop-in fork of `xlsx` that honours cell `.s`
// styling (bold, alignment, fills, borders) on writes. The base `xlsx`
// package silently drops `.s` on its community build, so every styled
// Excel producer in this project routes through this fork instead.
import * as xlsx from "xlsx-js-style";

/** A single column on an Excel section. */
export type ReportExcelColumn<T> = {
    header: string;
    /** Cell value — `string` / `number` / `null`. Strings render verbatim;
     *  pre-format amounts via {@link import("./currency").formatAmount}
     *  to match what the user sees on screen. */
    value: (row: T) => string | number | null;
    /** Approximate width in characters; defaults to 16. */
    widthChars?: number;
    align?: "left" | "right" | "center";
};

/** One table block inside the workbook. */
export type ReportExcelSection<T> = {
    /** Section heading rendered as a single bold row above the table. */
    title?: string;
    columns: ReadonlyArray<ReportExcelColumn<T>>;
    rows: ReadonlyArray<T>;
    /** Optional footer row — typed `(string | number | null)[]` keyed
     *  positionally against `columns`. Use for sub-totals / Total rows. */
    footer?: ReadonlyArray<string | number | null>;
};

export type ReportExcelOptions = {
    /** In-sheet title shown in the merged row 0 cell. */
    title: string;
    /** Optional sub-header rows ({@code [{ left, right }, ...]}). Mirrors
     *  legacy `subHeader` array. Each row prints `left` in column A and
     *  `right` in the last column. */
    subHeader?: ReadonlyArray<{ left?: string; right?: string }>;
    /** One or more table blocks. */
    sections: ReadonlyArray<ReportExcelSection<unknown>>;
    /** File name without extension. Defaults to `title`. */
    fileName?: string;
    /** Worksheet tab name. Defaults to `"Report"`. */
    sheetName?: string;
};

/**
 * Build the XLSX, trigger the browser download.
 *
 * Errors (no rows in any section) fall back to writing a workbook with
 * just the title + sub-headers; callers should validate upstream when a
 * blank export would mislead users.
 */
export function exportReportExcel(opts: ReportExcelOptions): void {
    if (typeof window === "undefined") return;

    const maxCols = Math.max(
        1,
        ...opts.sections.map((s) => s.columns.length),
    );

    /* Build the sheet row-by-row as a 2D array of values, then apply
       merges + column widths + cell styling after via the workbook
       object model. SheetJS supports `aoa_to_sheet` for the data and
       direct sheet manipulation for everything else. */
    const aoa: (string | number | null)[][] = [];
    const merges: xlsx.Range[] = [];
    const boldCells: string[] = []; // cell addresses
    const titleCells: string[] = [];

    /* Row 0 — file title, merged across all columns. */
    aoa.push([opts.title, ...Array(maxCols - 1).fill(null)]);
    titleCells.push(xlsx.utils.encode_cell({ r: 0, c: 0 }));
    if (maxCols > 1) {
        merges.push({
            s: { r: 0, c: 0 },
            e: { r: 0, c: maxCols - 1 },
        });
    }

    /* Sub-header rows — `left` in col 0, `right` in the last col, blank
       between. Each sub-header row is merged so the right cell snaps
       to the last column. */
    if (opts.subHeader) {
        for (const sh of opts.subHeader) {
            const row: (string | number | null)[] = Array(maxCols).fill(null);
            row[0] = sh.left ?? null;
            if (maxCols > 1) row[maxCols - 1] = sh.right ?? null;
            aoa.push(row);
        }
    }

    /* Blank separator after the title block. */
    aoa.push(Array(maxCols).fill(null));

    /* Sections. */
    for (const section of opts.sections) {
        if (section.title) {
            const r = aoa.length;
            aoa.push([section.title, ...Array(maxCols - 1).fill(null)]);
            boldCells.push(xlsx.utils.encode_cell({ r, c: 0 }));
            if (section.columns.length > 1) {
                merges.push({
                    s: { r, c: 0 },
                    e: { r, c: section.columns.length - 1 },
                });
            }
        }

        // Header row
        const headerRowIdx = aoa.length;
        const headerRow: (string | number | null)[] = section.columns.map(
            (c) => c.header,
        );
        // Pad to maxCols so column widths line up across sections
        while (headerRow.length < maxCols) headerRow.push(null);
        aoa.push(headerRow);
        for (let c = 0; c < section.columns.length; c++) {
            boldCells.push(xlsx.utils.encode_cell({ r: headerRowIdx, c }));
        }

        // Body rows
        for (const row of section.rows) {
            const cells: (string | number | null)[] = section.columns.map(
                (col) => {
                    const v = col.value(row as never);
                    return v == null ? null : v;
                },
            );
            while (cells.length < maxCols) cells.push(null);
            aoa.push(cells);
        }

        // Footer
        if (section.footer && section.footer.length > 0) {
            const footerRowIdx = aoa.length;
            const footerCells: (string | number | null)[] = [...section.footer];
            while (footerCells.length < maxCols) footerCells.push(null);
            aoa.push(footerCells);
            for (let c = 0; c < section.footer.length; c++) {
                boldCells.push(
                    xlsx.utils.encode_cell({ r: footerRowIdx, c }),
                );
            }
        }

        // Blank separator between sections
        aoa.push(Array(maxCols).fill(null));
    }

    const ws = xlsx.utils.aoa_to_sheet(aoa);

    // Column widths — take the max widthChars across sections for each
    // column index. xlsx uses `.wch` for character width.
    const colWidths: xlsx.ColInfo[] = [];
    for (let c = 0; c < maxCols; c++) {
        let widest = 16;
        for (const section of opts.sections) {
            const col = section.columns[c];
            if (col?.widthChars && col.widthChars > widest) {
                widest = col.widthChars;
            }
        }
        colWidths.push({ wch: widest });
    }
    ws["!cols"] = colWidths;
    ws["!merges"] = merges;

    // Apply cell-level styling. The community `xlsx` build does not
    // honour `.s` (style) on free-tier writes — bold / fontSize get
    // dropped silently — but populating the field keeps parity with
    // any future swap to `xlsx-js-style` or backend POI. The bare
    // workbook still opens cleanly in Excel / LibreOffice with the
    // merged title and column widths intact, which matches the
    // legacy filesystem-friendly output.
    for (const addr of titleCells) {
        const cell = ws[addr];
        if (cell) {
            cell.s = {
                font: { bold: true, sz: 16 },
                alignment: { horizontal: "center", vertical: "center" },
            };
        }
    }
    for (const addr of boldCells) {
        const cell = ws[addr];
        if (cell) {
            cell.s = {
                font: { bold: true },
                alignment: { vertical: "center" },
            };
        }
    }

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, opts.sheetName ?? "Report");

    const fileName = `${opts.fileName ?? opts.title}.xlsx`;
    xlsx.writeFile(wb, fileName);
}

/** `DDMMYYYY` — same convention as legacy filenames + {@link import("./excel").todayDmy}. */
export function reportDateSuffix(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}${m}${y}`;
}
