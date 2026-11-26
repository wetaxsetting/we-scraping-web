/*
 * Thuế › Tờ khai GTGT (01/GTGT, TT80) — record docs/features/weinvoice/weinvoice-vat-declaration-engine-invoices-2026-11-25.md.
 *
 * API only (backend record `weinvoice-vat-declaration-engine-invoices-2026-11-25`, we-scraping-api): the WeCMS VAT
 * declaration module fed by the engine invoices of one managed MST. Base path
 * `/companies/{mst}/vat-declarations`:
 *   GET    ?year=&status=&page=&size=      → { rows: VatDeclarationRow[], total_count }
 *   POST   { period_type M|Q, period_value, decl_year, bsns_line_cd, … } → VatDeclarationDetail
 *   GET    /{sid}                          → VatDeclarationDetail
 *   PUT    /{sid}  { ct22, ct25, …, agent_nm, … } (only the cells sent are overridden) → detail
 *   DELETE /{sid}                          (draft only; refused while a later period exists)
 *   POST   /{sid}/sync                     re-aggregate the period's invoices (draft only)
 *   PUT    /{sid}/lock · DELETE /{sid}/lock
 *   GET    /{sid}/annex/invoices?annex_type=BKBR|BKMV|REDUCE8&search=&io_dv=&page=&size=
 *   GET    /{sid}/export/xml | /pdf | /report-excel   (binary, locked declarations only)
 * Amounts are decimal strings on the wire (whole đồng). Mock mode has no declarations: every call
 * answers `WBE3000` so the screen can say the feature needs the server.
 */
import { WeInvoiceApiError, wiDelete, wiDownload, wiGet, wiPost, wiPut } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";

export type VatPeriodType = "M" | "Q";
export type VatStatus = "DRAFT" | "LOCKED";
export type AnnexType = "BKBR" | "BKMV" | "REDUCE8";

/** Indicator cells [21]–[43] as the backend sends them (decimal strings; ct21 = "0"/"1" flag). */
export type VatIndicators = Record<
    "ct21" | "ct22" | "ct23" | "ct24" | "ct23a" | "ct24a" | "ct25" | "ct26" | "ct27" | "ct28" | "ct29" | "ct30" | "ct31" | "ct32" | "ct32a" | "ct33" | "ct33a" | "ct34" | "ct35" | "ct36" | "ct37" | "ct38" | "ct39a" | "ct40a" | "ct40b" | "ct40" | "ct41" | "ct42" | "ct42a" | "ct42b" | "ct43",
    string | null
>;
export type VatIndicatorKey = keyof VatIndicators;

/** Cells the PUT accepts (every other cell is derived by the backend calculator). */
export const EDITABLE_CELLS: readonly VatIndicatorKey[] = [
    "ct21", "ct22", "ct23", "ct24", "ct23a", "ct24a", "ct25", "ct26", "ct29", "ct30", "ct31", "ct32", "ct32a", "ct33", "ct33a",
    "ct37", "ct38", "ct39a", "ct40b", "ct42", "ct42a", "ct42b",
];

export type VatDeclarationRow = {
    sid: number;
    periodType: VatPeriodType;
    periodValue: number;
    declYear: number;
    periodLabel: string;
    status: VatStatus;
    prevCredit: string | null;
    taxAmount: string | null;
    carriedForward: string | null;
    modDtm: string | null;
};

export type VatDeclarationDetail = {
    sid: number;
    periodType: VatPeriodType;
    periodValue: number;
    declYear: number;
    periodLabel: string;
    status: VatStatus;
    tpName: string;
    tpTaxCode: string;
    activityCode: string;
    activityName: string;
    fromDt: string;
    toDt: string;
    indicators: VatIndicators;
};

export type AnnexRow = {
    ioDv: "I" | "O";
    srcDocId: string;
    invNo: string;
    invSymbol: string;
    invDt: string;
    trcoTaxCode: string | null;
    trcoNm: string | null;
    prodNm: string | null;
    splyAmt: string;
    vatRate: string;
    vatAmt: string;
    reducedAmt: string;
};
export type AnnexGroup = { groupCd: string; rowCount: number; totalSplyAmt: string; totalVatAmt: string; totalReducedAmt: string };
export type AnnexPage = { rows: AnnexRow[]; totalCount: number; totalPages: number; pageNumber: number; pageSize: number; taxGroups: AnnexGroup[]; grandTotal: AnnexGroup };

export type CreateVatDeclaration = { periodType: VatPeriodType; periodValue: number; declYear: number; bsnsLineCd: string; bsnsLineNm?: string };

const base = (mst: string) => `/companies/${encodeURIComponent(mst)}/vat-declarations`;

function requireApi() {
    if (DATA_SOURCE !== "api") throw new WeInvoiceApiError("WBE3000", "Tờ khai GTGT cần kết nối máy chủ WeInvoice.");
}

export async function listVatDeclarations(mst: string, q: { year?: number; status?: VatStatus; page?: number; size?: number } = {}): Promise<{ rows: VatDeclarationRow[]; totalCount: number }> {
    requireApi();
    return wiGet(base(mst), { year: q.year, status: q.status, page: q.page ?? 0, size: q.size ?? 50 });
}

export async function createVatDeclaration(mst: string, req: CreateVatDeclaration): Promise<VatDeclarationDetail> {
    requireApi();
    return wiPost(base(mst), req);
}

export async function getVatDeclaration(mst: string, sid: number): Promise<VatDeclarationDetail> {
    requireApi();
    return wiGet(`${base(mst)}/${sid}`);
}

/** Saves only the given cells — an omitted cell stays derived by the backend. */
export async function saveVatDeclaration(mst: string, sid: number, cells: Partial<Record<VatIndicatorKey, string>>): Promise<VatDeclarationDetail> {
    requireApi();
    return wiPut(`${base(mst)}/${sid}`, cells);
}

export async function deleteVatDeclaration(mst: string, sid: number): Promise<void> {
    requireApi();
    await wiDelete(`${base(mst)}/${sid}`);
}

export async function syncVatDeclaration(mst: string, sid: number): Promise<VatDeclarationDetail> {
    requireApi();
    return wiPost(`${base(mst)}/${sid}/sync`);
}

export async function lockVatDeclaration(mst: string, sid: number, lock: boolean): Promise<VatDeclarationDetail> {
    requireApi();
    return lock ? wiPut(`${base(mst)}/${sid}/lock`) : wiDelete(`${base(mst)}/${sid}/lock`);
}

export async function listAnnex(mst: string, sid: number, q: { annexType: AnnexType; search?: string; page?: number; size?: number }): Promise<AnnexPage> {
    requireApi();
    return wiGet(`${base(mst)}/${sid}/annex/invoices`, { annexType: q.annexType, search: q.search || undefined, page: q.page ?? 0, size: q.size ?? 20 });
}

export type VatExportKind = "xml" | "pdf" | "report-excel";

export async function downloadVatExport(mst: string, sid: number, kind: VatExportKind): Promise<{ blob: Blob; fileName: string }> {
    requireApi();
    const ext = kind === "report-excel" ? "xlsx" : kind;
    return wiDownload("get", `${base(mst)}/${sid}/export/${kind}`, { fallbackName: `01-GTGT_${mst}_${sid}.${ext}` });
}

/** Decimal string from the wire → number (null / blank → 0). */
export function amount(v: string | null | undefined): number {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
}
