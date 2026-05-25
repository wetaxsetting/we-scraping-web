"use client";

import * as XLSX from "xlsx";

/**
 * Thin wrapper around {@link XLSX.read} that mutes the SheetJS
 * "Bad uncompressed size: N != 0" / "Bad compressed size: …"
 * warnings. SheetJS logs these via `console.error` for every ZIP
 * local-file-header whose recorded size doesn't match the central
 * directory — a benign condition that occurs in xlsx files produced
 * by Excel, LibreOffice, Google Sheets, and most other writers. The
 * workbook still parses correctly; only the noise is silenced.
 *
 * Why this matters: Next.js's dev overlay surfaces every
 * `console.error` as a Console Error popup, so without this wrapper
 * users see a scary "Bad uncompressed size: 1053 != 0" dialog on
 * every successful upload in dev.
 *
 * Real parse failures (corrupt ZIP central directory, malformed
 * sheet XML) still throw — callers wrap this in try/catch the same
 * way they would `XLSX.read`.
 */
export function readXlsxQuiet(
    input: ArrayBuffer | Uint8Array | string,
    opts?: XLSX.ParsingOptions,
): XLSX.WorkBook {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
        const first = args[0];
        if (
            typeof first === "string" &&
            (first.startsWith("Bad uncompressed size:") ||
                first.startsWith("Bad compressed size:"))
        ) {
            return;
        }
        origError.apply(console, args as Parameters<typeof console.error>);
    };
    try {
        return XLSX.read(input, opts);
    } finally {
        console.error = origError;
    }
}
