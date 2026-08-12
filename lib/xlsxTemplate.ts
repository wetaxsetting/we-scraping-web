/**
 * Fill an existing `.xlsx` by patching cell values inside its sheet XML.
 *
 * Rebuilding a styled workbook from scratch can never match a statutory form
 * byte-for-byte — column widths, merges, borders and number formats all have to
 * be re-derived, and anything missed shows up as a formatting difference. This
 * helper takes the opposite route: ship the authority's own file as a template,
 * unzip it, rewrite only the `<c>` elements we have data for, and zip it back.
 * Everything we do not touch — styles, merges, formulas, print setup — survives
 * untouched because those parts are copied verbatim.
 *
 * No new dependency: `DecompressionStream("deflate-raw")` inflates the one entry
 * we edit, and that entry is written back *stored* (ZIP method 0) so no
 * compressor is needed either. Every other entry keeps its original bytes.
 *
 * Requires a browser (`fetch`, `DecompressionStream`) — call it from a click
 * handler, never during render or on the server.
 */

/** Patch value for one cell. Numbers keep any formula the template has. */
export type CellPatch = string | number;

// ── ZIP plumbing ──────────────────────────────────────────────────────────────

type ZipEntry = {
    name: string;
    /** ZIP compression method — 8 = deflate, 0 = stored. */
    method: number;
    crc: number;
    uncompSize: number;
    /** Raw bytes as stored in the archive (still compressed when method 8). */
    bytes: Uint8Array;
};

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** Read the central directory so entries can be copied without recompressing. */
function parseZip(bytes: Uint8Array): ZipEntry[] {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
        if (dv.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error("Not a ZIP archive");

    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const entries: ZipEntry[] = [];

    for (let n = 0; n < count; n++) {
        const method = dv.getUint16(p + 10, true);
        const crc = dv.getUint32(p + 16, true);
        const compSize = dv.getUint32(p + 20, true);
        const uncompSize = dv.getUint32(p + 24, true);
        const nameLen = dv.getUint16(p + 28, true);
        const extraLen = dv.getUint16(p + 30, true);
        const commentLen = dv.getUint16(p + 32, true);
        const localOffset = dv.getUint32(p + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));

        // The local header repeats the name / extra fields; data follows it.
        const lNameLen = dv.getUint16(localOffset + 26, true);
        const lExtraLen = dv.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + lNameLen + lExtraLen;

        entries.push({
            name,
            method,
            crc,
            uncompSize,
            bytes: bytes.subarray(start, start + compSize),
        });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
    const enc = new TextEncoder();
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;

    for (const e of entries) {
        const name = enc.encode(e.name);

        const lh = new Uint8Array(30 + name.length);
        const l = new DataView(lh.buffer);
        l.setUint32(0, 0x04034b50, true);
        l.setUint16(4, 20, true);
        l.setUint16(6, 0x0800, true); // UTF-8 names
        l.setUint16(8, e.method, true);
        l.setUint32(14, e.crc, true);
        l.setUint32(18, e.bytes.length, true);
        l.setUint32(22, e.uncompSize, true);
        l.setUint16(26, name.length, true);
        lh.set(name, 30);
        locals.push(lh, e.bytes);

        const ch = new Uint8Array(46 + name.length);
        const c = new DataView(ch.buffer);
        c.setUint32(0, 0x02014b50, true);
        c.setUint16(4, 20, true);
        c.setUint16(6, 20, true);
        c.setUint16(8, 0x0800, true);
        c.setUint16(10, e.method, true);
        c.setUint32(16, e.crc, true);
        c.setUint32(20, e.bytes.length, true);
        c.setUint32(24, e.uncompSize, true);
        c.setUint16(28, name.length, true);
        c.setUint32(42, offset, true);
        ch.set(name, 46);
        centrals.push(ch);

        offset += lh.length + e.bytes.length;
    }

    const cdSize = centrals.reduce((s, b) => s + b.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, centrals.length, true);
    ev.setUint16(10, centrals.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    const out = new Uint8Array(offset + cdSize + 22);
    let o = 0;
    for (const part of [...locals, ...centrals, eocd]) {
        out.set(part, o);
        o += part.length;
    }
    return out;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    // Copy into a fresh ArrayBuffer-backed view: the subarray from parseZip may
    // be typed as SharedArrayBuffer-backed, which BufferSource rejects.
    void writer.write(new Uint8Array(bytes));
    void writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// ── Sheet-XML cell patching ───────────────────────────────────────────────────

const escapeXml = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Replace one cell's content, keeping its `s=` style index.
 *
 * A cell may appear self-closing (`<c r="L37" s="9"/>`) or with content. Numbers
 * preserve an existing `<f>` so template formulas keep recalculating; strings are
 * written as inline strings, which avoids touching `sharedStrings.xml`.
 */
function setCell(xml: string, ref: string, value: CellPatch): string {
    const isNum = typeof value === "number";
    const body = isNum
        ? `<v>${value}</v>`
        : `<is><t xml:space="preserve">${escapeXml(value)}</t></is>`;
    const typeAttr = isNum ? "" : ' t="inlineStr"';

    const selfClosing = new RegExp(`<c r="${ref}"([^>]*?)/>`);
    if (selfClosing.test(xml)) {
        return xml.replace(selfClosing, (_m, attrs: string) => {
            const a = attrs.replace(/ t="[^"]*"/, "");
            return `<c r="${ref}"${a}${typeAttr}>${body}</c>`;
        });
    }

    const paired = new RegExp(`<c r="${ref}"([^>]*?)>([\\s\\S]*?)</c>`);
    return xml.replace(paired, (_m, attrs: string, inner: string) => {
        const a = attrs.replace(/ t="[^"]*"/, "");
        const formula = isNum
            ? (inner.match(/<f[^>]*>[\s\S]*?<\/f>|<f[^>]*\/>/)?.[0] ?? "")
            : "";
        return `<c r="${ref}"${a}${typeAttr}>${formula}${body}</c>`;
    });
}


// ── Row insertion ─────────────────────────────────────────────────────────────

/** Rewrite every row/cell reference at or below `from`, shifting it by `by`. */
function shiftRowsBelow(xml: string, from: number, by: number): string {
    // Row elements: <row r="30" …>
    xml = xml.replace(/<row([^>]*?)\sr="(\d+)"/g, (m, attrs: string, r: string) => {
        const n = Number(r);
        return n >= from ? `<row${attrs} r="${n + by}"` : m;
    });
    // Cell references: <c r="D30" …>
    xml = xml.replace(/<c([^>]*?)\sr="([A-Z]+)(\d+)"/g, (m, attrs: string, col: string, r: string) => {
        const n = Number(r);
        return n >= from ? `<c${attrs} r="${col}${n + by}"` : m;
    });
    // Merge ranges: <mergeCell ref="D30:E30"/>
    xml = xml.replace(
        /<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g,
        (m, c1: string, r1: string, c2: string, r2: string) => {
            const a = Number(r1);
            const b = Number(r2);
            if (a < from) return m;
            return `<mergeCell ref="${c1}${a + by}:${c2}${b + by}"/>`;
        },
    );
    return xml;
}

/** Pull one `<row>` element out of the sheet XML. */
function extractRow(xml: string, row: number): string | null {
    return xml.match(new RegExp(`<row[^>]*\\sr="${row}"[^>]*>[\\s\\S]*?</row>`))?.[0] ?? null;
}

/** Re-stamp a cloned row (and its cells) with a new row number. */
function renumberRow(rowXml: string, to: number): string {
    return rowXml
        .replace(/(<row[^>]*?\s)r="\d+"/, `$1r="${to}"`)
        .replace(/<c([^>]*?)\sr="([A-Z]+)\d+"/g, `<c$1 r="$2${to}"`);
}

/** Drop `howMany` rows starting at `from`, pulling everything below up. */
function removeRows(xml: string, from: number, howMany: number): string {
    if (howMany <= 0) return xml;

    let mergesDropped = 0;
    for (let r = from; r < from + howMany; r++) {
        const row = extractRow(xml, r);
        if (row) xml = xml.replace(row, "");

        // Merges confined to a removed row go with it.
        const rowMerges = new RegExp(`<mergeCell ref="[A-Z]+${r}:[A-Z]+${r}"\\/>`, "g");
        mergesDropped += xml.match(rowMerges)?.length ?? 0;
        xml = xml.replace(rowMerges, "");
    }

    if (mergesDropped > 0) {
        xml = xml.replace(
            /<mergeCells count="(\d+)">/,
            (_m, c: string) =>
                `<mergeCells count="${Math.max(0, Number(c) - mergesDropped)}">`,
        );
    }
    return shiftRowsBelow(xml, from + howMany, -howMany);
}

/** Clone `donorRow` into `howMany` fresh rows starting at `at`. */
function insertRows(
    xml: string,
    at: number,
    howMany: number,
    donorRow: number,
): string {
    if (howMany <= 0) return xml;

    const sample = extractRow(xml, donorRow);
    if (!sample) return xml;
    const sampleMerges = [
        ...xml.matchAll(
            new RegExp(`<mergeCell ref="([A-Z]+)${donorRow}:([A-Z]+)${donorRow}"\\/>`, "g"),
        ),
    ].map((m) => [m[1], m[2]] as const);

    // Make room, then drop the clones into the gap.
    xml = shiftRowsBelow(xml, at, howMany);

    const clones: string[] = [];
    const newMerges: string[] = [];
    for (let i = 0; i < howMany; i++) {
        const target = at + i;
        clones.push(renumberRow(sample, target));
        for (const [c1, c2] of sampleMerges) {
            newMerges.push(`<mergeCell ref="${c1}${target}:${c2}${target}"/>`);
        }
    }

    // The row that used to sit at `at` is now `at + howMany`; insert before it.
    const anchor = extractRow(xml, at + howMany);
    xml = anchor
        ? xml.replace(anchor, clones.join("") + anchor)
        : xml.replace("</sheetData>", `${clones.join("")}</sheetData>`);

    if (newMerges.length) {
        xml = xml.replace(
            /<mergeCells count="(\d+)">/,
            (_m, n: string) =>
                `<mergeCells count="${Number(n) + newMerges.length}">${newMerges.join("")}`,
        );
    }
    return xml;
}

/**
 * Resize one block of data rows to exactly `count` rows, styles included.
 *
 * A statutory annex ships a fixed number of specimen rows per section — often
 * one, sometimes several, sometimes none. A real filing needs one row per
 * invoice, so each block is grown or shrunk to fit:
 *
 * - more rows than specimens → clone (the block's own specimen, or `donorRow`
 *   when the block ships none)
 * - fewer → remove the surplus, so an empty section collapses to just its label
 *   and "Tổng" row instead of showing leftover sample data
 *
 * Cloning keeps every style, merge and column span the template defines, which
 * is what reconstructing rows by hand gets wrong.
 */
function resizeRowBlock(xml: string, block: RowExpansion): string {
    const samples = block.sampleCount ?? 1;
    const delta = block.count - samples;
    if (delta === 0) return xml;

    if (delta < 0) return removeRows(xml, block.templateRow, -delta);

    // Growing: clone the block's own specimen when it has one, else the donor.
    const donor = samples > 0 ? block.templateRow : block.donorRow;
    if (donor == null) return xml;
    return insertRows(xml, block.templateRow + samples, delta, donor);
}

/** One block of data rows to resize before values are written. */
export type RowExpansion = {
    /** First data row of the block in the pristine template. */
    templateRow: number;
    /** How many rows the output needs. `0` removes the block's rows entirely. */
    count: number;
    /** Specimen rows the template ships for this block. Defaults to `1`. */
    sampleCount?: number;
    /** Row to clone from when `sampleCount` is `0` — pick another row of the
     *  same kind so the inserted rows carry the right style. */
    donorRow?: number;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Grow/shrink the row blocks, then write the values — the whole transform a
 * sheet goes through, as one pure string→string step.
 *
 * Exported so the PDF renderer can reach the *same* patched XML the workbook
 * download contains, instead of re-deriving the form's layout by hand. One
 * source of truth means the two files cannot drift apart.
 */
export function patchSheetXml(
    xml: string,
    patches: Record<string, CellPatch>,
    expansions: readonly RowExpansion[] = [],
): string {
    for (const block of expansions) xml = resizeRowBlock(xml, block);
    for (const [ref, value] of Object.entries(patches)) {
        xml = setCell(xml, ref, value);
    }
    return xml;
}

/**
 * Fetch a workbook and hand back its XML parts as text, inflating as needed.
 *
 * The renderer needs more than the sheet: `sharedStrings.xml` resolves `t="s"`
 * values and `styles.xml` carries the fonts, borders, alignments and number
 * formats that make the printed page look like the form.
 */
export async function loadXlsxParts(
    templateUrl: string,
    wanted: readonly string[],
): Promise<Record<string, string>> {
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error(`Template not found: ${templateUrl}`);

    const entries = parseZip(new Uint8Array(await res.arrayBuffer()));
    const out: Record<string, string> = {};
    for (const entry of entries) {
        if (!wanted.includes(entry.name)) continue;
        const raw = entry.method === 8 ? await inflateRaw(entry.bytes) : entry.bytes;
        out[entry.name] = new TextDecoder().decode(raw);
    }
    return out;
}

/**
 * Fetch `templateUrl`, apply `patches` to its first worksheet, and hand back the
 * finished workbook bytes.
 *
 * @param patches cell address → value, e.g. `{ D10: "CÔNG TY …", L37: 172800000 }`.
 *                Addresses absent from the template are ignored.
 * @param sheetPath entry to patch; defaults to the first sheet.
 */
export async function fillXlsxTemplate(
    templateUrl: string,
    patches: Record<string, CellPatch>,
    sheetPath = "xl/worksheets/sheet1.xml",
    /** Grown *before* `patches` apply, so patch addresses use final row numbers.
     *  Pass descending `templateRow` order when expanding several blocks so
     *  earlier expansions do not move later specimens. */
    expansions: readonly RowExpansion[] = [],
): Promise<Uint8Array> {
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error(`Template not found: ${templateUrl}`);

    const entries = parseZip(new Uint8Array(await res.arrayBuffer()));
    const out: ZipEntry[] = [];

    for (const entry of entries) {
        if (entry.name !== sheetPath) {
            out.push(entry); // verbatim — styles / merges / formulas untouched
            continue;
        }
        const raw =
            entry.method === 8 ? await inflateRaw(entry.bytes) : entry.bytes;
        const xml = patchSheetXml(
            new TextDecoder().decode(raw),
            patches,
            expansions,
        );
        const patched = new TextEncoder().encode(xml);
        out.push({
            name: entry.name,
            method: 0, // stored, so no compressor is needed
            crc: crc32(patched),
            uncompSize: patched.length,
            bytes: patched,
        });
    }
    return buildZip(out);
}

/** Save workbook bytes through a synthetic anchor click. */
export function downloadXlsx(bytes: Uint8Array, fileName: string): void {
    const blob = new Blob([bytes as unknown as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}
