/*
 * "Bộ dữ liệu test" (M14, Nguồn → Tải lên).
 *
 * API mode: the engine loads its TestData folder (`XML\`, `PDF\`, `ma_tra_cuu.csv`) for the working
 * MST — `POST /test-data/load?company_mst=` queues an engine `TEST_DATA` request, the screen polls
 * `GET /requests/{id}` and shows the engine's report. Available only when the backend says so
 * (`GET /me` → `test_data_enabled`, i.e. `WECMS_WEINVOICE_TEST_DATA_ENABLED=true`, dev / SIT).
 *
 * Mock mode: unavailable — the prototype's local helper server does not exist in this build; the
 * panel stays hidden and the drop zone imports the same files.
 */
import { refreshAfterSync } from "@/lib/api/weinvoice/remote";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState } from "@/lib/api/weinvoice/store";
import { waitForRequest, wiGet, wiPost } from "@/lib/api/weinvoice/http";

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

/** `ok` when the backend allows loading test data; counts are not known before the engine runs. */
export async function testDataAvailable(): Promise<{ ok: boolean; folder?: string; xml?: number; pdf?: number }> {
    if (DATA_SOURCE !== "api") return { ok: false };
    try {
        const me = await wiGet<{ testDataEnabled?: boolean }>("/me");
        return me.testDataEnabled ? { ok: true, folder: "TestData" } : { ok: false };
    } catch {
        return { ok: false };
    }
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

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

/** Engine `TEST_DATA` result (camelCased by the transport) → the panel's report. */
export function toTestDataReport(r: Record<string, unknown> | null | undefined): TestDataReport {
    const x = r ?? {};
    const errors = Array.isArray(x.errors) ? (x.errors as { file?: unknown; error?: unknown }[]) : [];
    return {
        folder: typeof x.folder === "string" ? x.folder : "TestData",
        xmlTotal: num(x.xmlTotal),
        created: num(x.created) + num(x.merged),
        duplicate: num(x.duplicate),
        errors: errors.map((e) => ({ file: String(e.file ?? ""), error: String(e.error ?? "") })),
        newTaxIds: strs(x.newTaxIds),
        codesApplied: num(x.codesApplied),
        codesUnmatched: strs(x.codesUnmatched),
        pdfAttached: num(x.pdfAttached),
        pdfUnmatched: strs(x.pdfUnmatched),
    };
}

/**
 * Queues the engine load for the working MST and waits for it. `onProgress` gets "done/total".
 * Throws `Error("no_folder")` when the engine has no TestData folder, the engine's message otherwise.
 */
export async function loadTestData(onProgress?: (msg: string) => void): Promise<TestDataReport> {
    if (DATA_SOURCE !== "api") throw new Error("no_folder");
    const taxId = getState().activeTaxId;
    const { requestId } = await wiPost<{ requestId: string }>("/test-data/load", undefined, { companyMst: taxId });
    const done = await waitForRequest(requestId, (q) => {
        const p = (q.progress ?? {}) as { done?: number; total?: number };
        if (p.total) onProgress?.(`${p.done ?? 0}/${p.total}`);
    });
    if (done.status === "failed" || done.status === "cancelled") throw new Error(done.error || done.status);
    // New invoices / XML / PDF are in the engine tables now — reload the working MST's list.
    await refreshAfterSync(taxId);
    return toTestDataReport(done.result);
}
