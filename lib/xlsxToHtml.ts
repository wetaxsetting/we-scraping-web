/**
 * Render one worksheet of an `.xlsx` as an HTML table that looks like the sheet.
 *
 * Written for printing a statutory form: the workbook download and the printed
 * page have to be the same document, so the layout is read out of the file —
 * column widths, row heights, merges, borders, fonts, alignment and number
 * formats — instead of being rebuilt by hand in CSS. Anything hand-rebuilt is
 * something that can drift from the form; nothing here is hand-rebuilt.
 *
 * Deliberately partial: it covers what these tax templates use (thin/medium
 * borders, bold/italic/size/name, horizontal + vertical alignment, wrap,
 * `#,##0`-family formats, shared and inline strings). Gradients, images,
 * conditional formats and themes are ignored — the forms do not use them.
 */

/** Cell address → `{ col, row }`, 1-based, `A1` → `{ col: 1, row: 1 }`. */
function parseRef(ref: string): { col: number; row: number } {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) return { col: 0, row: 0 };
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    return { col, row: Number(m[2]) };
}

function escapeHtml(raw: string): string {
    return raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Undo the XML escaping inside a text node. */
function unescapeXml(raw: string): string {
    return raw
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)))
        .replace(/&amp;/g, "&");
}

// ── styles.xml ────────────────────────────────────────────────────────────────

type Font = {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    /** Points, as stored. */
    size: number;
    name: string;
    /** CSS colour, or `""` for the sheet's default ink. */
    color: string;
};

type Border = { left: string; right: string; top: string; bottom: string };

type Xf = {
    fontId: number;
    borderId: number;
    fillId: number;
    numFmtId: number;
    horizontal?: string;
    vertical?: string;
    wrap: boolean;
    /** Degrees; only 90/180 appear in these forms. */
    textRotation?: number;
    indent?: number;
};

type Styles = {
    fonts: Font[];
    borders: Border[];
    /** CSS background per fill id; `""` where the fill paints nothing. */
    fills: string[];
    xfs: Xf[];
    /** Custom `numFmtId` → format code. */
    numFmts: Record<number, string>;
};

/**
 * The legacy indexed palette. These forms colour their headings through it
 * (`indexed="18"` is the navy the authority's template uses), so an entry that
 * is missing here prints as plain black and silently loses that.
 */
const INDEXED_COLORS: Record<number, string> = {
    0: "#000000", 1: "#FFFFFF", 2: "#FF0000", 3: "#00FF00", 4: "#0000FF",
    5: "#FFFF00", 6: "#FF00FF", 7: "#00FFFF", 8: "#000000", 9: "#FFFFFF",
    10: "#FF0000", 11: "#00FF00", 12: "#0000FF", 13: "#FFFF00", 14: "#FF00FF",
    15: "#00FFFF", 16: "#800000", 17: "#008000", 18: "#000080", 19: "#808000",
    20: "#800080", 21: "#008080", 22: "#C0C0C0", 23: "#808080",
};

/**
 * Resolve a `<color>`/`<fgColor>` element to CSS. Themes are only mapped for the
 * two that mean "paper" and "ink" — the rest are not used by these templates,
 * and inventing a colour for them would be worse than leaving it default.
 */
function colorCss(tag: string | undefined): string {
    if (!tag) return "";
    const rgb = /rgb="([0-9A-Fa-f]{6,8})"/.exec(tag)?.[1];
    if (rgb) return `#${rgb.length === 8 ? rgb.slice(2) : rgb}`;
    const indexed = /indexed="(\d+)"/.exec(tag)?.[1];
    if (indexed) return INDEXED_COLORS[Number(indexed)] ?? "";
    const theme = /theme="(\d+)"/.exec(tag)?.[1];
    if (theme === "0") return "#FFFFFF";
    if (theme === "1") return "#000000";
    return "";
}

/** Excel's border weights, mapped to what a printer can actually render. */
function borderCss(style: string): string {
    if (!style) return "none";
    if (/^(thick|medium|double)$/.test(style)) return "1.5px solid #000";
    if (/^(dotted|hair)$/.test(style)) return "1px dotted #000";
    if (/^(dashed|mediumDashed)$/.test(style)) return "1px dashed #000";
    return "1px solid #000"; // thin and everything else
}

function parseStyles(xml: string): Styles {
    const fonts: Font[] = [];
    const fontsBlock = /<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(xml)?.[1] ?? "";
    for (const m of fontsBlock.matchAll(/<font>([\s\S]*?)<\/font>/g)) {
        const f = m[1];
        fonts.push({
            bold: /<b\s*\/>/.test(f),
            italic: /<i\s*\/>/.test(f),
            underline: /<u\s*\/?>/.test(f),
            size: Number(/<sz val="([\d.]+)"/.exec(f)?.[1] ?? 10),
            name: /<name val="([^"]*)"/.exec(f)?.[1] ?? "Arial",
            color: colorCss(/<color [^/]*\/>/.exec(f)?.[0]),
        });
    }

    const borders: Border[] = [];
    const bordersBlock = /<borders[^>]*>([\s\S]*?)<\/borders>/.exec(xml)?.[1] ?? "";
    for (const m of bordersBlock.matchAll(/<border[^>]*(?:\/>|>([\s\S]*?)<\/border>)/g)) {
        const b = m[1] ?? "";
        const side = (name: string) =>
            new RegExp(`<${name}[^>]*style="([^"]+)"`).exec(b)?.[1] ?? "";
        borders.push({
            left: side("left"),
            right: side("right"),
            top: side("top"),
            bottom: side("bottom"),
        });
    }

    // A fill paints only when it is a solid pattern; `none` and the `gray125`
    // placeholder Excel always writes at index 1 must stay transparent.
    const fills: string[] = [];
    const fillsBlock = /<fills[^>]*>([\s\S]*?)<\/fills>/.exec(xml)?.[1] ?? "";
    for (const m of fillsBlock.matchAll(/<fill>([\s\S]*?)<\/fill>/g)) {
        const pattern = /patternType="([^"]*)"/.exec(m[1])?.[1] ?? "none";
        fills.push(
            pattern === "solid" ? colorCss(/<fgColor [^/]*\/>/.exec(m[1])?.[0]) : "",
        );
    }

    const numFmts: Record<number, string> = {};
    for (const m of xml.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)) {
        numFmts[Number(m[1])] = unescapeXml(m[2]);
    }

    const xfs: Xf[] = [];
    const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
    for (const m of cellXfs.matchAll(/<xf\s([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)) {
        const attrs = m[1];
        const inner = m[2] ?? "";
        const align = /<alignment([^>]*)\/>/.exec(inner)?.[1] ?? "";
        const attr = (src: string, name: string) =>
            new RegExp(`${name}="([^"]*)"`).exec(src)?.[1];
        xfs.push({
            fontId: Number(attr(attrs, "fontId") ?? 0),
            borderId: Number(attr(attrs, "borderId") ?? 0),
            fillId: Number(attr(attrs, "fillId") ?? 0),
            numFmtId: Number(attr(attrs, "numFmtId") ?? 0),
            horizontal: attr(align, "horizontal"),
            vertical: attr(align, "vertical"),
            wrap: attr(align, "wrapText") === "1",
            textRotation: align.includes("textRotation")
                ? Number(attr(align, "textRotation"))
                : undefined,
            indent: align.includes("indent") ? Number(attr(align, "indent")) : undefined,
        });
    }

    return { fonts, borders, fills, xfs, numFmts };
}

// ── number formats ────────────────────────────────────────────────────────────

/** Excel's built-in codes that these forms actually reach. */
const BUILTIN_NUM_FMT: Record<number, string> = {
    0: "General",
    1: "0",
    2: "0.00",
    3: "#,##0",
    4: "#,##0.00",
    9: "0%",
    10: "0.00%",
    14: "dd/mm/yyyy",
    37: "#,##0_);(#,##0)",
    38: "#,##0_);[Red](#,##0)",
    39: "#,##0.00_);(#,##0.00)",
    40: "#,##0.00_);[Red](#,##0.00)",
    49: "@",
};

/**
 * Format a number the way Excel would on a Vietnamese machine — `.` for
 * thousands, which is what the on-screen form and the XLSX both show.
 */
function formatNumber(value: number, code: string): string {
    if (code === "@" || code === "General") {
        return Number.isInteger(value)
            ? value.toLocaleString("de-DE")
            : String(value);
    }

    // Negative branch of `positive;negative` — Excel wraps those in parentheses.
    const negativeInParens = /\(.*\)/.test(code.split(";")[1] ?? code);
    const decimals = /\.(0+)/.exec(code)?.[1].length ?? 0;
    const grouped = code.includes("#,##");

    const abs = Math.abs(value);
    const body = grouped
        ? abs.toLocaleString("de-DE", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
          })
        : abs.toFixed(decimals);

    if (value < 0) return negativeInParens ? `(${body})` : `-${body}`;
    return body;
}

// ── sheet.xml ─────────────────────────────────────────────────────────────────

type Cell = {
    col: number;
    text: string;
    styleId: number;
    isNumber: boolean;
    /** Columns actually printed — hidden ones are excluded. */
    colSpan: number;
    /** Columns the merge occupies in the sheet, used to step past it. */
    rawColSpan: number;
    rowSpan: number;
    /**
     * Style of the cell at the merge's right / bottom edge. Excel keeps a merged
     * range's outline on the individual cells that form it, so the anchor knows
     * nothing about the range's right or bottom edge — reading the border off
     * the anchor alone silently drops the outer frame of the form.
     */
    rightStyleId: number;
    bottomStyleId: number;
};

/**
 * Excel column width (in "characters") → px, per ECMA-376 §18.3.1.13:
 *
 *     px = trunc(((256 * width + trunc(128 / MDW)) / 256) * MDW)
 *
 * MDW is the maximum digit width of the workbook's default font, 7px for the
 * 10pt Arial / 11pt Calibri these templates use. The common `width * 7 + 5`
 * shortcut runs ~5px wide per column, which compounds across a form into a
 * visibly different page — hence the real formula.
 */
const MAX_DIGIT_WIDTH = 7;
function widthToPx(chars: number): number {
    return Math.trunc(
        ((256 * chars + Math.trunc(128 / MAX_DIGIT_WIDTH)) / 256) * MAX_DIGIT_WIDTH,
    );
}

/** Row height in points → CSS px. */
function heightToPx(points: number): number {
    return Math.round((points * 96) / 72);
}

export type XlsxHtmlOptions = {
    /** Scale the whole table. `1` prints at Excel's own size. */
    zoom?: number;
    /**
     * Shrink the table just enough to fit this many px, and no further. Takes
     * precedence over `zoom`. Preferred for printing: the scale then follows the
     * sheet's own column widths instead of being a number someone guessed.
     */
    fitWidthPx?: number;
    /** Same, for height — set both to guarantee the sheet lands on one page. */
    fitHeightPx?: number;
    /** Hard cap on columns. Normally unnecessary — hidden columns are dropped
     *  automatically — but available when a sheet has no `hidden` flags. */
    maxCol?: number;
    /** Last row to render. */
    maxRow?: number;
};

/**
 * Convert a worksheet into a standalone `<table>` (plus the `<style>` it needs).
 *
 * @param sheetXml the worksheet XML — patched or pristine
 * @param sharedStringsXml `xl/sharedStrings.xml`, for `t="s"` cells
 * @param stylesXml `xl/styles.xml`
 */
export function xlsxSheetToHtml(
    sheetXml: string,
    sharedStringsXml: string,
    stylesXml: string,
    options: XlsxHtmlOptions = {},
): string {
    const styles = parseStyles(stylesXml);

    // Shared strings — concatenate every <t> in each <si> so runs survive.
    const shared: string[] = [];
    for (const m of sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
        const text = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
            .map((t) => unescapeXml(t[1]))
            .join("");
        shared.push(text);
    }

    // Column widths. `<col min max width>` covers a range.
    const colWidth = new Map<number, number>();
    let defaultWidth = 8.43;
    const sheetFormat = /<sheetFormatPr[^>]*\/>/.exec(sheetXml)?.[0] ?? "";
    const dw = /defaultColWidth="([\d.]+)"/.exec(sheetFormat)?.[1];
    if (dw) defaultWidth = Number(dw);
    // Rows without an explicit `ht` are this tall; leaving them to the browser
    // makes short rows collapse and the form loses its vertical rhythm.
    const defaultRowHeight = Number(
        /defaultRowHeight="([\d.]+)"/.exec(sheetFormat)?.[1] ?? 12.75,
    );
    // Hidden columns are the sheet's own statement of what is not part of the
    // printed form — helper columns, intermediate sums. Honouring the flag is
    // what keeps their values off the page; guessing a last column does not.
    const hidden = new Set<number>();
    for (const m of sheetXml.matchAll(/<col [^>]*\/>/g)) {
        const tag = m[0];
        const minC = Number(/min="(\d+)"/.exec(tag)?.[1] ?? 0);
        const maxC = Number(/max="(\d+)"/.exec(tag)?.[1] ?? 0);
        const w = /width="([\d.]+)"/.exec(tag)?.[1];
        const isHidden = /hidden="1"/.test(tag);
        for (let c = minC; c <= maxC; c++) {
            if (w) colWidth.set(c, Number(w));
            if (isHidden) hidden.add(c);
        }
    }

    // Merges: remember the anchor's span, and every cell it swallows.
    const spanAt = new Map<string, { colSpan: number; rowSpan: number }>();
    const covered = new Set<string>();
    for (const m of sheetXml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g)) {
        const a = parseRef(m[1]);
        const b = parseRef(m[2]);
        spanAt.set(`${a.col}:${a.row}`, {
            colSpan: b.col - a.col + 1,
            rowSpan: b.row - a.row + 1,
        });
        for (let r = a.row; r <= b.row; r++) {
            for (let c = a.col; c <= b.col; c++) {
                if (r !== a.row || c !== a.col) covered.add(`${c}:${r}`);
            }
        }
    }

    // Row heights up front: a row-spanning cell needs the heights of rows it has
    // not been reached yet.
    const rowHeightPx = new Map<number, number>();
    for (const rm of sheetXml.matchAll(/<row([^>]*)>/g)) {
        const attrs = rm[1];
        const index = Number(/\sr="(\d+)"/.exec(attrs)?.[1] ?? 0);
        if (/\shidden="1"/.test(attrs)) continue;
        const ht = /\sht="([\d.]+)"/.exec(attrs)?.[1];
        rowHeightPx.set(index, heightToPx(Number(ht ?? defaultRowHeight)));
    }

    // Every cell's style, keyed by position — merged ranges need to reach the
    // cells they swallow to recover the range's right and bottom border.
    const styleByPos = new Map<string, number>();
    for (const rm of sheetXml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
        const rowIndex = Number(/\sr="(\d+)"/.exec(rm[1])?.[1] ?? 0);
        for (const cm of rm[2].matchAll(/<c\s([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g)) {
            const ref = /(?:^|\s)r="([A-Z]+\d+)"/.exec(cm[1])?.[1];
            if (!ref) continue;
            styleByPos.set(
                `${parseRef(ref).col}:${rowIndex}`,
                Number(/(?:^|\s)s="(\d+)"/.exec(cm[1])?.[1] ?? 0),
            );
        }
    }

    // Rows and their cells.
    type Row = { index: number; heightPx: number; hidden: boolean; cells: Cell[] };
    const rows: Row[] = [];
    let widestCol = 0;

    for (const rm of sheetXml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
        const attrs = rm[1];
        const index = Number(/\sr="(\d+)"/.exec(attrs)?.[1] ?? 0);
        if (options.maxRow && index > options.maxRow) continue;
        const ht = /\sht="([\d.]+)"/.exec(attrs)?.[1];
        const rowHidden = /\shidden="1"/.test(attrs);

        const cells: Cell[] = [];
        for (const cm of rm[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const cAttrs = cm[1];
            const inner = cm[2] ?? "";
            const ref = /(?:^|\s)r="([A-Z]+\d+)"/.exec(cAttrs)?.[1];
            if (!ref) continue;
            const { col } = parseRef(ref);
            if (hidden.has(col)) continue;
            if (options.maxCol && col > options.maxCol) continue;
            if (covered.has(`${col}:${index}`)) continue;

            const styleId = Number(/(?:^|\s)s="(\d+)"/.exec(cAttrs)?.[1] ?? 0);
            const type = /(?:^|\s)t="([^"]+)"/.exec(cAttrs)?.[1];
            const rawV = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];

            let text = "";
            let isNumber = false;
            if (type === "s" && rawV != null) {
                text = shared[Number(rawV)] ?? "";
            } else if (type === "inlineStr") {
                text = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
                    .map((t) => unescapeXml(t[1]))
                    .join("");
            } else if (type === "str" && rawV != null) {
                text = unescapeXml(rawV);
            } else if (rawV != null && rawV !== "") {
                const n = Number(rawV);
                if (Number.isFinite(n)) {
                    const xf = styles.xfs[styleId];
                    const code =
                        styles.numFmts[xf?.numFmtId ?? 0] ??
                        BUILTIN_NUM_FMT[xf?.numFmtId ?? 0] ??
                        "General";
                    text = formatNumber(n, code);
                    isNumber = true;
                } else {
                    text = unescapeXml(rawV);
                }
            }

            const span = spanAt.get(`${col}:${index}`);

            // A merge may reach into hidden columns; the printed cell spans only
            // the visible ones, otherwise the table grows phantom columns.
            let visibleSpan = 0;
            for (let c = col; c < col + (span?.colSpan ?? 1); c++) {
                if (!hidden.has(c) && !(options.maxCol && c > options.maxCol)) {
                    visibleSpan++;
                }
            }
            if (visibleSpan === 0) continue;

            const rawColSpan = span?.colSpan ?? 1;
            const rowSpan = span?.rowSpan ?? 1;
            // The frame of the form lives on bordered but empty cells, so the
            // last rendered column is the last one that *shows* something —
            // text, a border or a fill — not merely the last one with a value.
            const bd = styles.borders[styles.xfs[styleId]?.borderId ?? 0];
            const shows =
                !!text ||
                !!styles.fills[styles.xfs[styleId]?.fillId ?? 0] ||
                !!(bd && (bd.left || bd.right || bd.top || bd.bottom));
            if (shows) widestCol = Math.max(widestCol, col + visibleSpan - 1);

            cells.push({
                col,
                text,
                styleId,
                isNumber,
                colSpan: visibleSpan,
                rawColSpan,
                rowSpan,
                rightStyleId:
                    styleByPos.get(`${col + rawColSpan - 1}:${index}`) ?? styleId,
                bottomStyleId:
                    styleByPos.get(`${col}:${index + rowSpan - 1}`) ?? styleId,
            });
        }

        rows.push({
            index,
            heightPx: heightToPx(Number(ht ?? defaultRowHeight)),
            hidden: rowHidden,
            cells,
        });
    }

    const lastCol = options.maxCol ?? widestCol;

    // A row is as tall as its tallest cell, and that cell is not necessarily one
    // that carries a border — so the gridline allowance has to be taken off
    // every cell in the row, not only the bordered ones.
    const rowHasTop = new Set<number>();
    const rowHasBottom = new Set<number>();
    for (const r of rows) {
        for (const c of r.cells) {
            if (styles.borders[styles.xfs[c.styleId]?.borderId ?? 0]?.top) {
                rowHasTop.add(r.index);
            }
            if (styles.borders[styles.xfs[c.bottomStyleId]?.borderId ?? 0]?.bottom) {
                rowHasBottom.add(r.index + c.rowSpan - 1);
            }
        }
    }

    // <colgroup> — one <col> per *visible* spreadsheet column, at its real width.
    const colGroup = Array.from({ length: lastCol }, (_, i) => i + 1)
        .filter((c) => !hidden.has(c))
        .map((c) => `<col style="width:${widthToPx(colWidth.get(c) ?? defaultWidth)}px">`)
        .join("");

    const cellCss = (c: Cell, clip: boolean): string => {
        const xf = styles.xfs[c.styleId];
        const font = styles.fonts[xf?.fontId ?? 0];
        const border = styles.borders[xf?.borderId ?? 0];
        const rightBorder =
            styles.borders[styles.xfs[c.rightStyleId]?.borderId ?? 0] ?? border;
        const bottomBorder =
            styles.borders[styles.xfs[c.bottomStyleId]?.borderId ?? 0] ?? border;
        const fill = styles.fills[xf?.fillId ?? 0];
        const out: string[] = [];

        if (fill) out.push(`background-color:${fill}`);

        if (border) {
            out.push(`border-left:${borderCss(border.left)}`);
            out.push(`border-right:${borderCss(rightBorder.right)}`);
            out.push(`border-top:${borderCss(border.top)}`);
            out.push(`border-bottom:${borderCss(bottomBorder.bottom)}`);
        }
        if (font) {
            out.push(`font-size:${font.size}pt`);
            out.push(`font-family:'${font.name}',serif`);
            if (font.bold) out.push("font-weight:700");
            if (font.italic) out.push("font-style:italic");
            if (font.underline) out.push("text-decoration:underline");
            if (font.color) out.push(`color:${font.color}`);
        }

        // Excel defaults numbers right, text left — only override when the sheet
        // states an alignment.
        const h = xf?.horizontal;
        out.push(
            `text-align:${
                h === "center"
                    ? "center"
                    : h === "right"
                      ? "right"
                      : h === "left"
                        ? "left"
                        : c.isNumber
                          ? "right"
                          : "left"
            }`,
        );
        const v = xf?.vertical;
        out.push(
            `vertical-align:${
                v === "center" ? "middle" : v === "top" ? "top" : "bottom"
            }`,
        );
        out.push(xf?.wrap ? "white-space:normal" : "white-space:nowrap");
        // Excel lets a long label run on across the cells to its right, and only
        // clips it once one of them has content of its own. Clipping every cell
        // instead truncates the form's labels; never clipping lets figures
        // collide. So clip exactly when the neighbour is occupied.
        if (clip) out.push("overflow:hidden");
        if (xf?.indent) out.push(`padding-left:${xf.indent * 8 + 2}px`);
        if (xf?.textRotation === 90) out.push("writing-mode:vertical-rl");

        return out.join(";");
    };

    const body = rows
        .filter((r) => !r.hidden)
        .map((r) => {
            const h = ` style="height:${r.heightPx}px"`;
            // Walk the columns rather than the cells. A sheet omits cells it has
            // nothing to say about, and in a fixed-layout table a missing <td>
            // does not leave a gap — it pulls everything after it one column to
            // the left. Emitting a spacer at each absent column is what keeps a
            // value under the heading it belongs to.
            const byCol = new Map(r.cells.map((c) => [c.col, c]));
            const tds: string[] = [];
            for (let col = 1; col <= lastCol; ) {
                if (hidden.has(col) || covered.has(`${col}:${r.index}`)) {
                    col++;
                    continue;
                }
                const c = byCol.get(col);
                if (!c) {
                    tds.push("<td></td>");
                    col++;
                    continue;
                }
                const span =
                    (c.colSpan > 1 ? ` colspan="${c.colSpan}"` : "") +
                    (c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : "");

                // Does anything sit in the next column along? If so this cell
                // has to stay inside its own box.
                let next = col + c.rawColSpan;
                while (next <= lastCol && hidden.has(next)) next++;
                const clip = !!byCol.get(next)?.text;

                // The sheet's 3-7px spacer rows came out 13-18px tall: an empty
                // cell still holds a line box the size of its font. Give those
                // cells a box of exactly the row height instead — with no text
                // in them there is nothing to clip, and the row collapses to the
                // height Excel declared.
                //
                // Cells that DO have text keep their content bare, because a
                // wrapper with `overflow` would also clip horizontally, and a
                // label running on across the empty cells to its right is
                // Excel's behaviour (see `clip` above).
                let content = escapeHtml(c.text);
                if (!content) {
                    let boxHeight = 0;
                    for (let rr = r.index; rr < r.index + c.rowSpan; rr++) {
                        boxHeight += rowHeightPx.get(rr) ?? 0;
                    }
                    // Excel's row height already contains the gridline, but a
                    // <td> adds its borders outside the content box; collapsed,
                    // each edge costs the row half a pixel.
                    if (rowHasTop.has(r.index)) boxHeight -= 0.5;
                    if (rowHasBottom.has(r.index + c.rowSpan - 1)) boxHeight -= 0.5;
                    content = `<div style="height:${Math.max(0, boxHeight)}px"></div>`;
                }

                tds.push(`<td${span} style="${cellCss(c, clip)}">${content}</td>`);
                col += c.rawColSpan;
            }
            return `<tr${h}>${tds.join("")}</tr>`;
        })
        .join("");

    const naturalWidthPx = Array.from({ length: lastCol }, (_, i) => i + 1)
        .filter((c) => !hidden.has(c))
        .reduce((sum, c) => sum + widthToPx(colWidth.get(c) ?? defaultWidth), 0);
    const naturalHeightPx = rows
        .filter((r) => !r.hidden)
        .reduce((sum, r) => sum + r.heightPx, 0);
    // Fit whichever axis is tighter, so the form stays on one page and keeps its
    // proportions. Never scale up — the sheet's own size is the ceiling.
    const fitted = Math.min(
        options.fitWidthPx ? options.fitWidthPx / naturalWidthPx : Infinity,
        options.fitHeightPx ? options.fitHeightPx / naturalHeightPx : Infinity,
    );
    const zoom = Number.isFinite(fitted) ? Math.min(1, fitted) : (options.zoom ?? 1);
    // The table needs an explicit width: `table-layout: fixed` only honours the
    // <colgroup> when the table's own width is resolved. Left to `auto`, the
    // browser widens columns to fit their text and the sheet's proportions —
    // the thing being reproduced — are lost.
    return `<div class="xl-sheet" style="zoom:${zoom}">
  <table class="xl-table" style="width:${naturalWidthPx}px"><colgroup>${colGroup}</colgroup><tbody>${body}</tbody></table>
</div>`;
}

/** The CSS the generated table relies on. Inline it into the print document. */
export const XLSX_HTML_BASE_CSS = `
  .xl-table { border-collapse: collapse; table-layout: fixed; }
  /* No blanket overflow rule: whether a cell clips is decided per cell, the way
     Excel decides it — see the renderer. */
  .xl-table td { padding: 0 2px; }
`;
