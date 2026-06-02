/**
 * Small pure string helpers shared across features.
 *
 * First consumer: Banking > Own Account Transfer remark fields, which
 * must be bounded by the bank IB site's **byte** limit, not the JS
 * string length. Legacy `trns_0001_007.ts` measures remarks with
 * `validateStringByTES` (`new TextEncoder().encode(input).length`) —
 * Vietnamese diacritics encode to 2–3 UTF-8 bytes, so a memo that is
 * well under a 210-character cap can still exceed the bank's 210-byte
 * limit and be rejected / truncated downstream. Counting characters
 * silently lets those through; counting bytes matches the bank.
 */

/** UTF-8 byte length of a string (what the bank engine actually limits). */
export function utf8ByteLength(input: string): number {
    return new TextEncoder().encode(input).length;
}

/**
 * Truncate `input` so its UTF-8 byte length does not exceed `maxBytes`,
 * never splitting a multi-byte code point. Mirrors the legacy
 * remark-clamp behaviour (clamp from the start of the string).
 */
export function clampUtf8Bytes(input: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    if (encoder.encode(input).length <= maxBytes) return input;
    let out = "";
    let bytes = 0;
    // Iterating the string with for…of walks by code point, so surrogate
    // pairs (and any multi-byte char) are never cut in half.
    for (const ch of input) {
        const chBytes = encoder.encode(ch).length;
        if (bytes + chBytes > maxBytes) break;
        out += ch;
        bytes += chBytes;
    }
    return out;
}
