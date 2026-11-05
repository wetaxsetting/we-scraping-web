/*
 * MOCK-grade implementation — WeInvoice UI Spec v1.0 (P1).
 *
 * Best-effort text probe of a PDF, used only to answer "does this PDF belong to the open invoice?"
 * (§3.5). It is NOT a PDF parser: it reads the raw bytes, inflates FlateDecode / ASCII85 streams
 * with the browser's DecompressionStream, and collects literal `( … )` and `< … >` strings plus the
 * raw text. Fonts with custom encodings (CID without ToUnicode) will not decode — the caller then
 * falls back to asking the user ("Vẫn đính kèm"), which is the behaviour the rule requires.
 */

const latin1 = (b: Uint8Array): string => {
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < b.length; i += CH) s += String.fromCharCode(...b.subarray(i, i + CH));
    return s;
};

/** zlib (FlateDecode) → latin1 string; "" when the stream is not deflate or the API is missing. */
async function inflate(bytes: Uint8Array): Promise<string> {
    if (typeof DecompressionStream === "undefined") return "";
    for (const fmt of ["deflate", "deflate-raw"] as const) {
        // Read chunk by chunk and keep what was inflated before an error: real PDFs often carry
        // trailing bytes after the zlib end marker, which makes the stream reject at the very end.
        const out: string[] = [];
        try {
            const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(fmt)).getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                out.push(latin1(value));
            }
        } catch {
            /* keep partial output */
        }
        if (out.length) return out.join("");
    }
    return "";
}

/** ASCII85Decode (`<~ … ~>` optional). Invalid input yields what was decoded so far. */
function ascii85(s: string): Uint8Array {
    const src = s.replace(/^<~/, "").replace(/~>[\s\S]*$/, "").replace(/\s+/g, "");
    const out: number[] = [];
    let group: number[] = [];
    const flush = (n: number[]) => {
        const len = n.length;
        while (n.length < 5) n.push(84);
        let v = 0;
        for (const c of n) v = v * 85 + c;
        const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
        out.push(...bytes.slice(0, len - 1));
    };
    for (const ch of src) {
        if (ch === "z" && group.length === 0) {
            out.push(0, 0, 0, 0);
            continue;
        }
        const c = ch.charCodeAt(0) - 33;
        if (c < 0 || c > 84) break;
        group.push(c);
        if (group.length === 5) {
            flush(group);
            group = [];
        }
    }
    if (group.length > 1) flush(group);
    return new Uint8Array(out);
}

/** Literal `(…)` and hex `<…>` strings of a content stream, joined by spaces. */
function stringsIn(s: string): string {
    const parts: string[] = [];
    // Literal strings with balanced parentheses and backslash escapes.
    for (let i = 0; i < s.length; i++) {
        if (s[i] !== "(") continue;
        let depth = 1;
        let j = i + 1;
        let cur = "";
        while (j < s.length && depth > 0) {
            const c = s[j];
            if (c === "\\") {
                const n = s[j + 1];
                if (n === "n") cur += "\n";
                else if (n === "r") cur += "\r";
                else if (n === "t") cur += "\t";
                else if (n && /[0-7]/.test(n)) {
                    const oct = s.slice(j + 1, j + 4).match(/^[0-7]{1,3}/)![0];
                    cur += String.fromCharCode(parseInt(oct, 8));
                    j += oct.length - 1;
                } else if (n !== undefined) cur += n;
                j += 2;
                continue;
            }
            if (c === "(") depth++;
            else if (c === ")") depth--;
            if (depth > 0) cur += c;
            j++;
        }
        if (cur.trim()) parts.push(cur);
        i = j - 1;
    }
    // Hex strings (skip dictionary "<<").
    for (const m of s.matchAll(/(?<!<)<([0-9A-Fa-f\s]{4,})>(?!>)/g)) {
        const hex = m[1].replace(/\s+/g, "");
        let str = "";
        // UTF-16BE (common for Vietnamese text with ToUnicode-less simple fonts) vs single-byte.
        if (hex.length % 4 === 0 && /^(00[0-9A-Fa-f]{2})+$/.test(hex)) {
            for (let k = 0; k < hex.length; k += 4) str += String.fromCharCode(parseInt(hex.slice(k, k + 4), 16));
        } else {
            for (let k = 0; k + 1 < hex.length; k += 2) str += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
        }
        if (/[0-9A-Za-z]{3,}/.test(str)) parts.push(str);
    }
    return parts.join(" ");
}

/** Raw + decoded text of a PDF (first `maxBytes` only). "" when the file is not a PDF. */
export async function pdfProbeText(file: Blob, maxBytes = 8_000_000): Promise<string> {
    const bytes = new Uint8Array(await file.slice(0, maxBytes).arrayBuffer());
    const raw = latin1(bytes);
    if (!raw.startsWith("%PDF-")) return "";
    const chunks: string[] = [stringsIn(raw)];
    const re = /stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
        const start = m.index + m[0].length;
        const end = raw.indexOf("endstream", start);
        if (end < 0) break;
        const dict = raw.slice(Math.max(0, m.index - 400), m.index);
        let stop = end;
        while (stop > start && (bytes[stop - 1] === 0x0a || bytes[stop - 1] === 0x0d)) stop--;
        const body = bytes.subarray(start, stop);
        let text = "";
        if (/\/ASCII85Decode/.test(dict)) {
            const a = ascii85(latin1(body));
            text = /\/FlateDecode/.test(dict) ? await inflate(a) : latin1(a);
        } else if (/\/FlateDecode/.test(dict)) {
            text = await inflate(body);
        } else if (!/\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)/.test(dict)) {
            text = latin1(body);
        }
        if (text) chunks.push(stringsIn(text));
        re.lastIndex = end + 9;
    }
    return chunks.join("\n");
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

/**
 * Which identifying key of the invoice the PDF's text contains (§3.5), or "" when none:
 *  - "number"  : invoice number (leading zeros optional) AND seller MST both present
 *  - "lookup"  : the provider lookup code
 *  - "cqt"     : the GDT (CQT) code
 */
export async function pdfMatchesInvoice(file: Blob, keys: { number: string; lookupCode?: string; cqtCode?: string; sellerTaxId?: string }): Promise<string> {
    let text = "";
    try {
        text = await pdfProbeText(file);
    } catch {
        return "";
    }
    if (!text) return "";
    const flat = text.replace(/\s+/g, "");
    const upper = flat.toUpperCase();
    if (keys.cqtCode && keys.cqtCode.length >= 8 && upper.includes(keys.cqtCode.replace(/\s+/g, "").toUpperCase())) return "cqt";
    if (keys.lookupCode && keys.lookupCode.length >= 4 && upper.includes(keys.lookupCode.replace(/\s+/g, "").toUpperCase())) return "lookup";
    if (keys.sellerTaxId && keys.number) {
        const digits = digitsOnly(text);
        const mst = digitsOnly(keys.sellerTaxId);
        const no = String(Number(keys.number));
        const noRe = new RegExp(`(^|\\D)0*${no}(\\D|$)`);
        if (mst && digits.includes(mst) && no !== "NaN" && noRe.test(text)) return "number";
    }
    return "";
}
