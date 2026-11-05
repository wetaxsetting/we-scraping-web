/*
 * "Bộ dữ liệu test" — MOCK implementation.
 *
 * The prototype loaded a local TestData\ folder through a local helper server
 * (/api/testdata). That server does not exist in this build and wecms-web is
 * not a backend, so the feature reports itself as unavailable and the panel on
 * Nguồn → Tải lên stays hidden. Upload the same XML / ZIP files through the
 * drop zone instead.
 */

export type TestDataReport = {
    folder: string;
    xmlTotal: number;
    created: number;
    duplicate: number;
    errors: { file: string; error: string }[];
    newTaxIds: string[];
    codesApplied: number;
    codesUnmatched: string[];
    pdfAttached: number;
    pdfUnmatched: string[];
};

/** Always unavailable in this build — there is no local TestData server. */
export async function testDataAvailable(): Promise<{ ok: boolean; folder?: string; xml?: number; pdf?: number }> {
    return { ok: false };
}

type CodeRow = { number: string; symbol: string; sellerTaxId: string; code: string };

/** Parse ma_tra_cuu.csv (header row + `number,symbol,sellerTaxId,code`; `,` or `;`). */
export function parseCodesCsv(text: string): CodeRow[] {
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, "")))
        .filter((c) => c.length >= 4 && /\d/.test(c[0]))
        .map(([number, symbol, sellerTaxId, code]) => ({ number, symbol, sellerTaxId, code }));
}

export async function loadTestData(onProgress?: (msg: string) => void): Promise<TestDataReport> {
    void onProgress;
    throw new Error("no_folder");
}
